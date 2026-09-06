import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
const db = new PGlite({ extensions: { pgcrypto } });
let owner: string, admin: string;
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
  for (const f of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  owner = (
    await db.query<{ id: string }>(
      "select * from ensure_clerk_user('user_QuotaTest','Quota')",
    )
  ).rows[0].id;
  admin = (
    await db.query<{ id: string }>(
      "select * from ensure_clerk_user('user_SuperTest','Super')",
    )
  ).rows[0].id;
  await db.query("update users set app_role='superadmin' where id=$1", [admin]);
});
after(async () => {
  await db.close();
});
test("quotas roll back failed inserts and never refund monthly creation on delete", async () => {
  await db.query(
    "insert into cards(slug,owner_id,data) values('quota-first',$1,'{}')",
    [owner],
  );
  await assert.rejects(
    db.query(
      "insert into cards(slug,owner_id,data) values('quota-second',$1,'{}')",
      [owner],
    ),
    /Plan limit/,
  );
  assert.equal(
    (
      await db.query<{ value: number }>(
        "select value from usage_counters where owner_id=$1 and metric='monthly_cards'",
        [owner],
      )
    ).rows[0].value,
    1,
  );
  await db.query("update cards set deleted_at=now() where slug='quota-first'");
  await db.query(
    "insert into cards(slug,owner_id,data) values('quota-second',$1,'{}')",
    [owner],
  );
  await assert.rejects(
    db.query("update cards set deleted_at=null where slug='quota-first'"),
    /Plan limit/,
  );
  assert.equal(
    (
      await db.query<{ value: number }>(
        "select value from usage_counters where owner_id=$1 and metric='monthly_cards'",
        [owner],
      )
    ).rows[0].value,
    2,
  );
});
test("trial is one-time and expiry immediately restores Free entitlements", async () => {
  await db.exec(
    "update commercial_settings set trial_enabled=true,trial_plan_id=(select id from plans where code='basic'),trial_days=7",
  );
  const first = (
    await db.query<{ ends_at: Date }>("select * from start_account_trial($1)", [
      owner,
    ])
  ).rows[0];
  const again = (
    await db.query<{ ends_at: Date }>("select * from start_account_trial($1)", [
      owner,
    ])
  ).rows[0];
  assert.deepEqual(first.ends_at, again.ends_at);
  assert.equal(
    (
      await db.query<{ code: string }>("select * from effective_plan($1)", [
        owner,
      ])
    ).rows[0].code,
    "basic",
  );
  await assert.rejects(
    db.query("update account_trials set ends_at=now() where owner_id=$1", [
      owner,
    ]),
    /immutable/,
  );
  const expired = (
    await db.query<{ id: string }>(
      "select * from ensure_clerk_user('user_ExpiredTrial','Expired')",
    )
  ).rows[0].id;
  await db.query(
    "insert into account_trials(owner_id,plan_id,started_at,ends_at) select $1,id,now()-interval '8 days',now()-interval '1 day' from plans where code='basic'",
    [expired],
  );
  assert.equal(
    (
      await db.query<{ code: string }>("select * from effective_plan($1)", [
        expired,
      ])
    ).rows[0].code,
    "free",
  );
});
test("superadmin commercial controls are denied to members and browser roles", async () => {
  await assert.rejects(
    db.query("select admin_commercial_update($1,'settings',null,'{}')", [
      owner,
    ]),
    /Superadmin/,
  );
  for (const role of ["authenticated", "anon"]) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(
        db.query("select start_account_trial($1)", [owner]),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select * from commercial_settings"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("update users set app_role='superadmin'"),
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
  }
  await assert.rejects(
    db.query(
      'select admin_commercial_update($1,\'account\',$1,\'{"status":"disabled","app_role":"member"}\')',
      [admin],
    ),
    /own access/,
  );
});
test("verified payments fulfill exactly once and reject spoofed amounts", async () => {
  await db.exec(
    "update commercial_settings set checkout_enabled=true; update plans set enabled=true where code='basic'; update plan_prices set enabled=true where plan_id=(select id from plans where code='basic')",
  );
  const price = (
    await db.query<{ id: string }>(
      "select id from plan_prices where interval='month' and currency='UGX' and plan_id=(select id from plans where code='basic')",
    )
  ).rows[0].id;
  const order = (
    await db.query<{ id: string }>(
      "select * from create_checkout($1,$2,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')",
      [owner, price],
    )
  ).rows[0];
  const retry = (
    await db.query<{ id: string }>(
      "select * from create_checkout($1,$2,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')",
      [owner, price],
    )
  ).rows[0];
  assert.equal(order.id, retry.id);
  await assert.rejects(
    db.query("select fulfill_pesapal('tracking',$1,1,'UGX',1)", [order.id]),
    /mismatch/,
  );
  assert.equal(
    (
      await db.query<{ result: string }>(
        "select fulfill_pesapal('tracking',$1,20000,'UGX',1) result",
        [order.id],
      )
    ).rows[0].result,
    "paid",
  );
  const first = (
    await db.query(
      "select current_period_end from subscriptions where owner_id=$1",
      [owner],
    )
  ).rows;
  assert.equal(
    (
      await db.query<{ result: string }>(
        "select fulfill_pesapal('tracking',$1,20000,'UGX',1) result",
        [order.id],
      )
    ).rows[0].result,
    "already_paid",
  );
  assert.deepEqual(
    (
      await db.query(
        "select current_period_end from subscriptions where owner_id=$1",
        [owner],
      )
    ).rows,
    first,
  );
  await db.query("select fulfill_pesapal('tracking',$1,20000,'UGX',3)", [
    order.id,
  ]);
  assert.equal(
    (
      await db.query<{ status: string }>(
        "select status from billing_orders where id=$1",
        [order.id],
      )
    ).rows[0].status,
    "refunded",
  );
  assert.equal(
    (
      await db.query<{ result: string }>(
        "select fulfill_pesapal('tracking',$1,20000,'UGX',1) result",
        [order.id],
      )
    ).rows[0].result,
    "review_required",
  );
});

test('storage, disabled accounts and moderation respect database enforcement', async()=>{
 const id=(await db.query<{id:string}>("select * from ensure_clerk_user('user_StorageTest','Storage')")).rows[0].id;
 await assert.rejects(db.query("insert into card_studio_media(owner_id,path,size_bytes) values($1,'too-large',5000001)",[id]),/Plan limit/);
 assert.equal((await db.query('select * from card_studio_media where owner_id=$1',[id])).rows.length,0);
 await db.query("update users set status='disabled' where id=$1",[id]);
 await assert.rejects(db.query("insert into cards(slug,owner_id,data) values('disabled-card',$1,'{}')",[id]),/disabled/);
 await db.query("update users set status='active' where id=$1",[id]);
 const card=(await db.query<{id:string}>("insert into cards(slug,owner_id,data,published,published_data) values('moderated-card',$1,'{}',true,'{}') returning id",[id])).rows[0].id;
 await assert.rejects(db.query("select admin_resource_update($1,'cards',$2,'unpublish','Test moderation')",[owner,card]),/Superadmin/);
 await db.query("select admin_resource_update($1,'cards',$2,'unpublish','Test moderation')",[admin,card]);
 assert.equal((await db.query<{published:boolean}>("select published from cards where id=$1",[card])).rows[0].published,false);
 assert.equal((await db.query("select * from admin_audit where target_id=$1",[card])).rows.length,1);
});
