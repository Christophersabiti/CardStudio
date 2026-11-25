import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

// Real local Postgres with the full migration chain; no network or production data.
const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
let owner: string, other: string;
type Item = { kind: string; id: string; name: string; derivedName: string; favorite: boolean; deletedAt: string | null };
type Page = { total: number; counts: Record<string, number>; items: Item[] };
const list = async (account: string, args: { kind?: string; q?: string; section?: string; sort?: string } = {}) =>
  (await db.query<{ r: Page }>("select list_design_assets($1,$2,$3,$4,$5,1) r", [account, args.kind ?? "", args.q ?? "", args.section ?? "all", args.sort ?? "updated"])).rows[0].r;

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
  owner = (await db.query<{ id: string }>("select * from ensure_clerk_user('user_LibraryOwner','Lib Owner')")).rows[0].id;
  other = (await db.query<{ id: string }>("select * from ensure_clerk_user('user_LibraryOther','Other Person')")).rows[0].id;
  await db.query(`insert into cards(slug,owner_id,data,updated_at) values('libcard01',$1,'{"firstName":"Grace","lastName":"Nakato","title":"Head of Sales"}',now()-interval '3 days'),
    ('othercard1',$2,'{"firstName":"Not","lastName":"Mine"}',now())`, [owner, other]);
  await db.query(`insert into stamp_designs(owner_id,name,design,updated_at) values($1,'Director Approval Stamp – Uganda','{"title":"Director Approval Stamp – Uganda","shape":"Rectangle","items":[{"text":"DIRECTOR"},{"text":"APPROVED"}]}',now()-interval '1 day')`, [owner]);
  await db.query(`insert into signature_designs(owner_id,name,design) values($1,'Sabtech Corporate Signature','{"name":"Christopher","company":"Sabtech Online"}')`, [owner]);
  await db.query(`insert into print_packages(owner_id,name,config,updated_at) values($1,'Office print kit','{"parts":{"card":true}}',now()-interval '30 days')`, [owner]);
});
after(async () => { await db.close(); });

test("lists only the owner's designs across products, newest first", async () => {
  const r = await list(owner);
  assert.equal(r.total, 4);
  assert.deepEqual(r.items.map((i) => i.kind), ["signature", "stamp", "card", "print"]);
  assert.ok(!r.items.some((i) => i.name === "Not Mine"));
  assert.equal(r.items.find((i) => i.kind === "card")!.name, "Grace Nakato");
  assert.deepEqual(r.counts, { card: 1, stamp: 1, signature: 1, print: 1 });
});

test("search matches private names and text printed on a stamp", async () => {
  assert.deepEqual((await list(owner, { q: "approved" })).items.map((i) => i.kind), ["stamp"]);
  assert.deepEqual((await list(owner, { q: "sabtech corporate" })).items.map((i) => i.kind), ["signature"]);
  assert.deepEqual((await list(owner, { q: "head sales" })).items.map((i) => i.kind), ["card"]);
  assert.equal((await list(owner, { q: "zzzz-no-match" })).total, 0);
  // Search terms are normalised, so LIKE wildcards in input cannot widen the match.
  assert.equal((await list(owner, { q: "%" })).total, 4);
});

test("a private library name and favourite override defaults without touching the card", async () => {
  const card = (await list(owner, { kind: "card" })).items[0];
  await db.query("insert into design_assets(owner_id,kind,source_id,name,favorite) values($1,'card',$2,'Grace – sales card',true)", [owner, card.id]);
  const after = (await list(owner, { kind: "card" })).items[0];
  assert.equal(after.name, "Grace – sales card");
  assert.equal(after.derivedName, "Grace Nakato");
  assert.deepEqual((await list(owner, { section: "favorites" })).items.map((i) => i.id), [card.id]);
  assert.equal((await list(owner, { q: "sales card" })).items[0].id, card.id);
  const stored = (await db.query<{ data: { firstName: string } }>("select data from cards where id=$1", [card.id])).rows[0];
  assert.equal(stored.data.firstName, "Grace");
  // Metadata keyed to another account never applies.
  await db.query("insert into design_assets(owner_id,kind,source_id,name) values($1,'card',$2,'hijack')", [other, card.id]);
  assert.equal((await list(owner, { kind: "card" })).items[0].name, "Grace – sales card");
});

test("cards report whether the published snapshot matches the draft, ignoring the QR preference", async () => {
  const card = (await list(owner, { kind: "card" })).items[0] as Item & { upToDate: boolean };
  assert.equal(card.upToDate, false);
  await db.query(`update cards set published=true,published_data=data||'{"qrMode":"offline"}' where id=$1`, [card.id]);
  assert.equal(((await list(owner, { kind: "card" })).items[0] as Item & { upToDate: boolean }).upToDate, true);
  await db.query(`update cards set data=data||'{"title":"Changed"}' where id=$1`, [card.id]);
  assert.equal(((await list(owner, { kind: "card" })).items[0] as Item & { upToDate: boolean }).upToDate, false);
  await db.query("update cards set published=false,published_data=null where id=$1", [card.id]);
});

test("Trash is separate, recent is time-bound and sorting by name works", async () => {
  await db.query("update print_packages set deleted_at=now() where owner_id=$1", [owner]);
  assert.equal((await list(owner)).total, 3);
  assert.deepEqual((await list(owner, { section: "trash" })).items.map((i) => i.kind), ["print"]);
  assert.ok(!(await list(owner, { section: "recent" })).items.some((i) => i.kind === "print"));
  assert.deepEqual((await list(owner, { sort: "name" })).items.map((i) => i.name), ["Director Approval Stamp – Uganda", "Grace – sales card", "Sabtech Corporate Signature"]);
});

test("new tables bump revisions and stay closed to browser roles", async () => {
  await db.query("update signature_designs set name='Renamed' where owner_id=$1", [owner]);
  assert.equal((await db.query<{ revision: number }>("select revision from signature_designs where owner_id=$1", [owner])).rows[0].revision, 2);
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    for (const q of ["select * from design_assets", "select * from signature_designs", "select * from print_packages", `select list_design_assets('${owner}')`])
      await assert.rejects(db.query(q), (e: unknown) => typeof e === "object" && e !== null && "code" in e && e.code === "42501", `${role}: ${q}`);
    await db.exec("reset role");
  }
});
