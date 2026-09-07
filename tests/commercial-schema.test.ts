import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
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

test('idle deadlines are server-controlled, do not extend on reads and cannot be revived', async()=>{
 const read=async(touch=false)=>(await db.query<{v:{active:boolean;remaining:number}}>("select check_app_session('sess_test','user_idle',$1) v",[touch])).rows[0].v;
 assert.equal((await read()).active,true);
 await db.exec("update app_sessions set last_activity=clock_timestamp()-interval '14 minutes 59 seconds' where session_id='sess_test'");
 assert.equal((await read()).active,true);
 assert.ok((await read()).remaining<2);
 assert.ok((await read(true)).remaining>899);
 await db.exec("update app_sessions set last_activity=clock_timestamp()-interval '15 minutes 1 second' where session_id='sess_test'");
 assert.equal((await read(true)).active,false);
 assert.equal((await read(true)).active,false);
 assert.equal((await db.query<{v:{active:boolean}}>("select check_app_session('sess_test','other',true) v")).rows[0].v.active,false);
 await assert.rejects(db.exec("set role authenticated; select check_app_session('forged','user_idle',true)"));await db.exec('reset role');
});

test('combined search covers later pages, normalizes accents and phones, and isolates owners and Trash',async()=>{
 for(let i=0;i<26;i++)await db.query("insert into cards(id,slug,owner_id,data) values(gen_random_uuid(),$1,$2,$3)",['search_'+String(i).padStart(3,'0'),admin,JSON.stringify({firstName:'José',lastName:'Searchable '+i,phones:[{value:'+256 770 123 456'}],organization:i===0?'Unique Needle':'Studio'})]);
 const search=async(q:string,ownerId=admin,trash=false,page=1)=>(await db.query<{v:{total:number;items:{id:string}[]}}>('select search_owned_cards($1,$2,$3,$4) v',[ownerId,q,trash,page])).rows[0].v;
 assert.equal((await search('Jose')).total,26);assert.equal((await search('Jose')).items.length,24);
 assert.equal((await search('Jose',admin,false,2)).items.length,2);
 assert.equal((await search('unique needle')).total,1);assert.equal((await search('256770123456')).total,26);
 assert.equal((await search('Unique Needle',owner)).total,0);
 await db.exec("update cards set deleted_at=now() where slug='search_000'");
 assert.equal((await search('unique needle')).total,0);assert.equal((await search('unique needle',admin,true)).total,1);
 assert.equal((await search("' OR 1=1 --")).total,0);
 await assert.rejects(db.exec(`set role authenticated; select search_owned_cards('${admin}','',false,1)`));await db.exec('reset role');
});

test('new accounts require onboarding and private recovery is never client-readable',async()=>{
 const fresh=(await db.query<{onboarding_complete:boolean}>("select * from ensure_clerk_user('user_NewOnboarding','New')")).rows[0];assert.equal(fresh.onboarding_complete,false);
 for(const table of ['app_sessions','draft_recovery','plan_presentation']){
 const row=(await db.query<{allowed:boolean}>("select has_table_privilege('authenticated',$1,'SELECT') allowed",[table])).rows[0];assert.equal(row.allowed,false);
 }
 await assert.rejects(db.query('select update_plan_presentation($1,null,$2)',[owner,JSON.stringify({upgrade_threshold:90})]));
 await db.query('select update_plan_presentation($1,null,$2)',[admin,JSON.stringify({upgrade_threshold:85})]);
 assert.equal((await db.query<{upgrade_threshold:number}>('select upgrade_threshold from commercial_settings')).rows[0].upgrade_threshold,85);
});

test('superadmins exceed every plan quota while usage remains recorded',async()=>{
 await db.exec('begin');
 try {
  for(const [metric,resource] of [['active_cards','card'],['monthly_cards','card'],['active_groups','group'],['active_qr_codes','qr_code'],['monthly_qr_codes','qr_code'],['storage_bytes','media']]){
   const period=metric.startsWith('monthly')?'2026-09':'current';
   await db.query('select quota_delta($1,$2,$3,1000000000000,$4,gen_random_uuid(),gen_random_uuid())',[admin,metric,period,resource]);
   const row=(await db.query<{value:number}>('select value from usage_counters where owner_id=$1 and metric=$2 and period_key=$3',[admin,metric,period])).rows[0];
   assert.ok(Number(row.value)>=1000000000000);
  }
 }finally{await db.exec('rollback');}
});

test("QR assets reserve quota, reject foreign references and revoke public access",async()=>{
 const own=(await db.query<{id:string}>("select * from ensure_clerk_user('user_QrOwner','QR owner')")).rows[0].id;
 const other=(await db.query<{id:string}>("select * from ensure_clerk_user('user_QrOther','QR other')")).rows[0].id;
 const aid='aa111111-1111-4111-8111-111111111111',qid='bb111111-1111-4111-8111-111111111111';
 await db.query("insert into qr_assets(id,owner_id,kind,size_bytes,upload_path) values($1,$2,'image',1000,'test/incoming')",[aid,own]);
 assert.equal((await db.query<{value:number}>("select value from usage_counters where owner_id=$1 and metric='storage_bytes'",[own])).rows[0].value,1000);
 const payload=JSON.stringify({type:'image',source:'/api/qr-assets/'+aid,media:[]});
 await assert.rejects(db.query("insert into qr_codes(id,owner_id,slug,type,mode,title,data) values($1,$2,'qr-asset-test','image','dynamic','Image',$3)",[qid,own,payload]),/Asset is not ready/);
 await db.query("update qr_assets set state='ready',path='test/ready',mime_type='image/webp' where id=$1",[aid]);
 await assert.rejects(db.query("insert into qr_codes(id,owner_id,slug,type,mode,title,data) values($1,$2,'qr-asset-test','image','dynamic','Image',$3)",[qid,other,payload]),/Asset is not ready/);
 await db.query("insert into qr_codes(id,owner_id,slug,type,mode,title,data,published,published_data) values($1,$2,'qr-asset-test','image','dynamic','Image',$3,true,$3)",[qid,own,payload]);
 assert.equal((await db.query<{ok:boolean}>("select qr_asset_is_public($1) ok",[aid])).rows[0].ok,true);
 await db.query("select record_qr_metric($1,'opens')",[qid]);
 await db.query("select record_qr_metric($1,'clicks')",[qid]);
 assert.deepEqual((await db.query("select opens,clicks from qr_metrics where qr_id=$1",[qid])).rows[0],{opens:1,clicks:1});
 await db.query("update qr_codes set published=false where id=$1",[qid]);
 assert.equal((await db.query<{ok:boolean}>("select qr_asset_is_public($1) ok",[aid])).rows[0].ok,false);
 await db.query("update qr_assets set created_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=$1",[aid]);
 assert.equal((await db.query("select * from claim_qr_asset_cleanup($1)",[own])).rows.length,0);
 await db.query("update qr_codes set data='{}',published_data=null where id=$1",[qid]);
 assert.equal((await db.query("select * from claim_qr_asset_cleanup($1)",[own])).rows.length,1);
 await db.query("delete from qr_assets where id=$1",[aid]);
 assert.equal((await db.query<{value:number}>("select value from usage_counters where owner_id=$1 and metric='storage_bytes'",[own])).rows[0].value,0);
});
test("browser roles cannot access QR assets, analytics or privileged functions",async()=>{
 for(const role of ['anon','authenticated']) {
  await db.exec(`set role ${role}`);
  try{for(const sql of ["select * from qr_assets","select * from qr_metrics","select qr_asset_is_public('aa111111-1111-4111-8111-111111111111')","select record_qr_metric('bb111111-1111-4111-8111-111111111111','opens')"])await assert.rejects(db.query(sql),/permission denied/);}finally{await db.exec('reset role');}
 }
});

test("cancelled upload capacity remains reserved until token expiry",async()=>{
 const account=(await db.query<{id:string}>("select * from ensure_clerk_user('user_QrReserve','Reserve')")).rows[0].id;
 const id='cc111111-1111-4111-8111-111111111111';
 await db.query("insert into qr_assets(id,owner_id,kind,upload_path,upload_bucket,expected_bytes,reserved_bytes,size_bytes) values($1,$2,'image','reserve/incoming','qr-upload-1',10000,1000000,1000000)",[id,account]);
 await db.query("update qr_assets set state='cancelled' where id=$1",[id]);
 assert.equal((await db.query("select * from claim_qr_asset_cleanup($1)",[account])).rows.length,0);
 assert.equal((await db.query<{value:number}>("select value from usage_counters where owner_id=$1 and metric='storage_bytes'",[account])).rows[0].value,1000000);
 await db.query("update qr_assets set expires_at=now()-interval '1 second' where id=$1",[id]);
 assert.equal((await db.query("select * from claim_qr_asset_cleanup($1)",[account])).rows.length,1);
 await db.query("delete from qr_assets where id=$1",[id]);
 assert.equal((await db.query<{value:number}>("select value from usage_counters where owner_id=$1 and metric='storage_bytes'",[account])).rows[0].value,0);
 assert.equal((await db.query<{file_size_limit:number}>("select file_size_limit from storage.buckets where id='qr-upload-1'")).rows[0].file_size_limit,1000000);
});
