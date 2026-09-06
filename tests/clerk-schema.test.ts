import assert from "node:assert/strict";
import { before,after,test } from "node:test";
import { readFileSync,readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const db=new PGlite({extensions:{pgcrypto}});
const oldId="11111111-1111-4111-8111-111111111111";
const oldOther="22222222-2222-4222-8222-222222222222";
const migrations=readdirSync("supabase/migrations").filter(f=>f.endsWith('.sql')).sort();
const cutover=migrations.find(f=>f.endsWith('_clerk_identity_cutover.sql'))!;
let newId:string;
async function reject(sql:string,code:string,args:unknown[]=[]) {
  await assert.rejects(db.query(sql,args),(e:unknown)=>!!e&&typeof e==='object'&&'code' in e&&e.code===code);
}
async function asClerk(subject:string,work:()=>Promise<void>) {
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:subject,role:'authenticated'})]);
  await db.exec('set role authenticated');
  try {await work();} finally {await db.exec('reset role');}
}
before(async()=>{
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
  for(const file of migrations.filter(f=>f<cutover)) await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
  // Accounts created AFTER Phase 1 must be caught up safely by Phase 2.
  await db.query(`insert into auth.users(id,raw_app_meta_data,raw_user_meta_data) values
    ($1,'{"card_studio_role":"admin"}','{}'),($2,'{}','{"card_studio_role":"admin"}')`,[oldId,oldOther]);
  await db.query(`insert into public.cards(slug,owner_id,data,published,published_data,revision)
    values ('old-owned',$1,'{"name":"private"}',true,'{"name":"public"}',5),
    ('old-other',$2,'{}',false,null,0),('old-unowned',null,'{}',true,'{}',0)`,[oldId,oldOther]);
  await db.exec(`begin; ${readFileSync('supabase/migrations/'+cutover,'utf8')} commit;`);
});
after(async()=>{await db.close();});

test('Clerk cutover retains legacy owners and snapshots, with trusted roles only',async()=>{
  const account=await db.query<{app_role:string}>("select app_role from public.users where id=$1",[oldId]);
  assert.equal(account.rows[0].app_role,'admin');
  assert.equal((await db.query<{app_role:string}>("select app_role from public.users where id=$1",[oldOther])).rows[0].app_role,'member');
  assert.deepEqual((await db.query("select slug,owner_id,data,published_data,revision from public.cards where slug='old-owned'")).rows,
    [{slug:'old-owned',owner_id:oldId,data:{name:'private'},published_data:{name:'public'},revision:5}]);
  assert.equal((await db.query("select * from public.cards where owner_id is null")).rows.length,1);
  assert.equal((await db.query("select * from pg_constraint where contype='f' and confrelid='public.users'::regclass and conrelid in ('public.cards'::regclass,'public.groups'::regclass,'public.card_studio_media'::regclass)")).rows.length,3);
});

test('verified Clerk provisioning is idempotent and grants one Free subscription',async()=>{
  const first=(await db.query<{id:string}>("select * from public.ensure_clerk_user('user_NewAccount','New User')")).rows[0];
  newId=first.id;
  const retry=(await db.query<{id:string}>("select * from public.ensure_clerk_user('user_NewAccount','New Name')")).rows[0];
  assert.equal(first.id,retry.id);
  assert.equal((await db.query("select * from public.subscriptions where owner_id=$1",[newId])).rows.length,1);
  assert.equal((await db.query("select * from public.profiles where user_id=$1",[newId])).rows.length,1);
  await db.query("insert into public.cards(slug,owner_id,data) values ('clerk-new-card',$1,'{}')",[newId]);
});

test('Clerk subject RLS gives only mapped active owners access and rejects old JWTs',async()=>{
  await asClerk('user_NewAccount',async()=>{
    assert.deepEqual((await db.query("select slug from public.cards")).rows,[{slug:'clerk-new-card'}]);
    assert.equal((await db.query('select * from public.users')).rows.length,1);
    assert.equal((await db.query('select * from public.subscriptions')).rows.length,1);
    assert.equal((await db.query('select * from public.profiles')).rows.length,1);
    await reject("update public.users set app_role='admin'",'42501');
    await reject("insert into public.cards(slug,data) values ('bypass-card','{}')",'42501');
  });
  await asClerk(oldId,async()=>assert.equal((await db.query('select * from public.cards')).rows.length,0));
  await asClerk('user_Unmapped',async()=>assert.equal((await db.query('select * from public.cards')).rows.length,0));
});

test('identity provisioning, linking and webhook RPCs cannot be called by clients',async()=>{
  for(const role of ['anon','authenticated']) {
    await db.exec(`set role ${role}`);
    try {
      await reject("select public.ensure_clerk_user('user_Admin','Fake')",'42501');
      await reject("select public.link_legacy_clerk_identity($1,'user_NewAccount')",'42501',[oldId]);
      await reject("select public.sync_clerk_user_event('fake','user_NewAccount','user.deleted',1,'',false)",'42501');
      await reject('select * from public.clerk_webhook_events','42501');
    } finally {await db.exec('reset role');}
  }
});

test('explicit legacy linking preserves UUID and refuses silent account merges',async()=>{
  await db.query("select public.link_legacy_clerk_identity($1,'user_Legacy')",[oldId]);
  await db.query("select public.link_legacy_clerk_identity($1,'user_Legacy')",[oldId]);
  const legacy=(await db.query<{id:string}>("select * from public.ensure_clerk_user('user_Legacy','Legacy')")).rows[0];
  assert.equal(legacy.id,oldId);
  await reject("select public.link_legacy_clerk_identity($1,'user_NewAccount')",'23505',[oldOther]);
  await reject("select public.link_legacy_clerk_identity($1,'user_SomeoneElse')",'23505',[oldId]);
  await asClerk('user_Legacy',async()=>assert.deepEqual((await db.query('select slug from public.cards')).rows,[{slug:'old-owned'}]));
});

test('webhook replay and out-of-order updates cannot duplicate accounts or revert profiles',async()=>{
  await db.query("select public.sync_clerk_user_event('evt-new','user_Events','user.updated',200,'Current',false)");
  const retry=await db.query<{sync_clerk_user_event:boolean}>("select public.sync_clerk_user_event('evt-new','user_Events','user.updated',200,'Wrong',false)");
  assert.equal(retry.rows[0].sync_clerk_user_event,false);
  await db.query("select public.sync_clerk_user_event('evt-old','user_Events','user.created',100,'Old',false)");
  const profile=await db.query<{display_name:string}>("select p.display_name from public.profiles p join public.users u on u.id=p.user_id where u.clerk_user_id='user_Events'");
  assert.equal(profile.rows[0].display_name,'Current');
});

test('deleted identities stay tombstoned after late events and retain their content',async()=>{
  await db.query("select public.sync_clerk_user_event('evt-delete','user_NewAccount','user.deleted',300,'',false)");
  await db.query("select public.sync_clerk_user_event('evt-resurrect','user_NewAccount','user.updated',400,'Revive',false)");
  await reject("select public.ensure_clerk_user('user_NewAccount','Revive')",'42501');
  await asClerk('user_NewAccount',async()=>assert.equal((await db.query('select * from public.cards')).rows.length,0));
  assert.equal((await db.query('select * from public.cards where owner_id=$1',[newId])).rows.length,1);
});

test('local administrative disable survives Clerk updates and denies provisioning',async()=>{
  await db.query("update public.users set status='disabled' where clerk_user_id='user_Events'");
  await db.query("select public.sync_clerk_user_event('evt-unban','user_Events','user.updated',500,'Latest',false)");
  await reject("select public.ensure_clerk_user('user_Events','Latest')",'42501');
  await asClerk('user_Events',async()=>assert.equal((await db.query('select * from public.profiles')).rows.length,0));
});

test('Clerk deletion arriving before first login prevents later provisioning',async()=>{
  await db.query("select public.sync_clerk_user_event('evt-early-delete','user_DeletedFirst','user.deleted',500,'',false)");
  await db.query("select public.sync_clerk_user_event('evt-late-create','user_DeletedFirst','user.created',100,'Late',false)");
  await reject("select public.ensure_clerk_user('user_DeletedFirst','Late')",'42501');
});

test('Clerk provider blocks deny RLS access and cannot be undone by stale events',async()=>{
  await db.query("select public.sync_clerk_user_event('evt-block','user_Legacy','user.updated',600,'Legacy',true)");
  await db.query("select public.sync_clerk_user_event('evt-stale-unblock','user_Legacy','user.updated',500,'Legacy',false)");
  await reject("select public.ensure_clerk_user('user_Legacy','Legacy')",'42501');
  await asClerk('user_Legacy',async()=>assert.equal((await db.query('select * from public.cards')).rows.length,0));
});
