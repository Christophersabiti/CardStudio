import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
let member: string, admin: string, premium: string, basic: string;
const plan = async (id: string) => (await db.query<{ code: string }>("select (effective_plan($1)).code", [id])).rows[0].code;
const sub = async (id: string) => (await db.query<{ status: string; provider: string | null; plan_id: string; current_period_end: Date | null; price_id: string | null }>("select status,provider,plan_id,current_period_end,price_id from subscriptions where owner_id=$1", [id])).rows[0];
const grant = (target: string, planId: string, months = 1, actor = admin) =>
  db.query<{ id: string; period_start: Date; period_end: Date }>("select * from admin_grant_plan($1,$2,$3,$4,'MM-REF-001','Paid by mobile money',50000,'UGX')", [actor, target, planId, months]);

before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,created_at timestamptz default now(),is_anonymous boolean default false,
      raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema public,auth to authenticated,anon,service_role;
    grant execute on function auth.jwt() to authenticated,anon,service_role;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    alter default privileges in schema public grant all on tables to authenticated,anon,service_role;`);
  for (const f of readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort())
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  member = (await db.query<{ id: string }>("select * from ensure_clerk_user('user_GrantMember','Grace Member')")).rows[0].id;
  admin = (await db.query<{ id: string }>("select * from ensure_clerk_user('user_GrantAdmin','Ada Admin')")).rows[0].id;
  await db.query("update users set app_role='superadmin' where id=$1", [admin]);
  await db.exec("update plans set enabled=true where code in ('basic','premium')");
  premium = (await db.query<{ id: string }>("select id from plans where code='premium'")).rows[0].id;
  basic = (await db.query<{ id: string }>("select id from plans where code='basic'")).rows[0].id;
});
after(async () => { await db.close(); });

test("a manual grant activates the plan immediately without a catalog price", async () => {
  assert.equal(await plan(member), "free");
  const g = (await grant(member, premium)).rows[0];
  const s = await sub(member);
  assert.deepEqual([s.status, s.provider, s.plan_id, s.price_id], ["active", "manual", premium, null]);
  assert.equal(await plan(member), "premium");
  const days = (g.period_end.getTime() - g.period_start.getTime()) / 86_400_000;
  assert.ok(days >= 28 && days <= 31, `one calendar month, got ${days}`);
  const onboarded = (await db.query<{ onboarding_complete: boolean }>("select onboarding_complete from users where id=$1", [member])).rows[0];
  assert.equal(onboarded.onboarding_complete, true);
  const audit = (await db.query<{ n: number }>("select count(*)::int n from admin_audit where action='grant_plan' and target_id=$1", [member])).rows[0];
  assert.equal(audit.n, 1);
});

test("granting the same plan again extends from the current end date", async () => {
  const before = (await sub(member)).current_period_end!;
  const g = (await grant(member, premium, 3)).rows[0];
  assert.equal(g.period_start.getTime(), before.getTime());
  assert.equal((await sub(member)).current_period_end!.getTime(), g.period_end.getTime());
});

test("revoking grants newest first steps back through each period, then to Free", async () => {
  const grants = (await db.query<{ id: string; period_start: Date }>("select id,period_start from manual_grants where owner_id=$1 order by created_at", [member])).rows;
  await db.query("select admin_revoke_grant($1,$2,'Payment reversed by bank')", [admin, grants[1].id]);
  assert.equal((await sub(member)).current_period_end!.getTime(), grants[1].period_start.getTime());
  assert.equal(await plan(member), "premium");
  await assert.rejects(db.query("select admin_revoke_grant($1,$2,'Again please')", [admin, grants[1].id]), /already revoked/);
  await db.query("select admin_revoke_grant($1,$2,'Customer refunded in full')", [admin, grants[0].id]);
  const s = await sub(member);
  assert.equal(s.status, "canceled");
  assert.equal(await plan(member), "free");
});

test("a different plan starts now, and expiry of a manual period passes the constraints", async () => {
  await grant(member, basic);
  assert.equal(await plan(member), "basic");
  await grant(member, premium);
  assert.equal(await plan(member), "premium");
  await db.query("update subscriptions set current_period_start=now()-interval '40 days', current_period_end=now()-interval '1 day' where owner_id=$1", [member]);
  await db.query("select commercial_maintenance()");
  assert.equal((await sub(member)).status, "expired");
  assert.equal(await plan(member), "free");
});

test("only active superadmins can grant, list or switch features, and browser roles have no access", async () => {
  await assert.rejects(grant(member, premium, 1, member), /Superadmin required/);
  await assert.rejects(db.query("select admin_list_accounts($1)", [member]), /Superadmin required/);
  await assert.rejects(db.query("select admin_set_feature($1,'stamps',false)", [member]), /Superadmin required/);
  await assert.rejects(db.query("select * from admin_grant_plan($1,$2,$3,0,'REF')", [admin, member, premium]), /between 1 and 24/);
  await assert.rejects(db.query("select * from admin_grant_plan($1,$2,(select id from plans where code='free'),1,'REF')", [admin, member]), /Basic or Premium/);
  for (const role of ["authenticated", "anon"]) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(db.query("select * from manual_grants"), /permission denied/);
      await assert.rejects(db.query("select * from feature_flags"), /permission denied/);
      await assert.rejects(db.query("select * from admin_grant_plan($1,$2,$3,1,'REF')", [admin, member, premium]), /permission denied/);
      await assert.rejects(db.query("select admin_overview($1)", [admin]), /permission denied/);
    } finally {
      await db.exec("reset role");
    }
  }
});

test("account directory searches, segments and counts content", async () => {
  await grant(member, premium);
  type Page = { total: number; items: { id: string; plan_code: string; source: string; display_name: string }[] };
  const list = async (query: string, segment = "all", ids: string[] = []) =>
    (await db.query<{ r: Page }>("select admin_list_accounts($1,$2,$3,$4,1) r", [admin, query, ids, segment])).rows[0].r;
  assert.equal((await list("")).total, 2);
  assert.deepEqual((await list("grace")).items.map((i) => i.id), [member]);
  assert.deepEqual((await list("nobody@example.com", "all", ["user_GrantAdmin"])).items.map((i) => i.id), [admin]);
  const paid = await list("", "paid");
  assert.deepEqual(paid.items.map((i) => [i.id, i.plan_code, i.source]), [[member, "premium", "manual"]]);
  assert.deepEqual((await list("", "expiring")).items.map((i) => i.id), []);
  assert.deepEqual((await list("", "admins")).items.map((i) => i.id), [admin]);
  const overview = (await db.query<{ r: { manual: number; by_plan: Record<string, number> } }>("select admin_overview($1) r", [admin])).rows[0].r;
  assert.equal(overview.manual, 1);
  assert.equal(overview.by_plan.premium, 1);
});

test("feature switches are audited", async () => {
  await db.query("select admin_set_feature($1,'stamps',false)", [admin]);
  assert.equal((await db.query<{ enabled: boolean }>("select enabled from feature_flags where key='stamps'")).rows[0].enabled, false);
  await assert.rejects(db.query("select admin_set_feature($1,'lead_capture',false)", [admin]), /Unknown feature/);
  assert.equal((await db.query<{ n: number }>("select count(*)::int n from admin_audit where action='feature'")).rows[0].n, 1);
});
