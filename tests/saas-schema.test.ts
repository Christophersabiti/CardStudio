import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

// Real local Postgres execution, no network, no production credentials/data.
// Supabase-owned schemas/roles are reduced fixtures; managed-service integration
// and concurrent quota enforcement require separate tests at their phase gates.
const db = new PGlite({ extensions: { pgcrypto } });
const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const guest = "33333333-3333-4333-8333-333333333333";
const cardA = "44444444-4444-4444-8444-444444444444";
const cardB = "55555555-5555-4555-8555-555555555555";
const groupA = "66666666-6666-4666-8666-666666666666";
const groupB = "77777777-7777-4777-8777-777777777777";
const tables = ["users","profiles","plans","plan_prices","subscriptions","group_cards","qr_codes",
  "billing_orders","payments","subscription_events","payment_events","usage_counters","usage_events"];
const migrations = readdirSync("supabase/migrations").filter(f => f.endsWith(".sql")).sort();
const foundation = migrations.find(f => f.endsWith("_saas_foundations.sql"))!;
const sql = (name: string) => readFileSync(`supabase/migrations/${name}`, "utf8");
let beforeCards: unknown[];
let basicPrice: string;
let basicPlan: string;
let subA: string;
let orderA: string;

async function rejects(query: string, code: string, params: unknown[] = []) {
  await assert.rejects(db.query(query, params), (e: unknown) =>
    typeof e === "object" && e !== null && "code" in e && e.code === code);
}

before(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, created_at timestamptz not null default now(), is_anonymous boolean default false);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    -- Simulate permissive managed-project defaults to exercise explicit revokes.
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
  `);
  for (const file of migrations.filter(f => f < foundation)) await db.exec(sql(file));
  await db.query("insert into auth.users(id,is_anonymous) values ($1,false),($2,false),($3,true)",[a,b,guest]);
  await db.query(`insert into public.cards(id,slug,owner_id,data,published,published_data,revision)
    values ($1,'owned-card-a',$2,'{"title":"private revision"}',true,'{"title":"published snapshot"}',7),
    ($3,'owned-card-b',$4,'{}',false,null,0),
    (gen_random_uuid(),'legacy-public',null,'{"title":"legacy"}',true,'{"title":"legacy"}',0)`,[cardA,a,cardB,b]);
  await db.query("insert into public.groups(id,slug,owner_id,data) values ($1,'group-a',$2,'{}'),($3,'group-b',$4,'{}')",[groupA,a,groupB,b]);
  await db.query("insert into public.card_studio_media(owner_id,path) values ($1,'existing/image.webp')",[a]);
  beforeCards = (await db.query("select id,slug,owner_id,data,published,published_data,revision,updated_at from public.cards order by slug")).rows;
  await db.exec(`begin; ${sql(foundation)} commit;`);
  const price = (await db.query<{id:string;plan_id:string}>("select pp.id,pp.plan_id from public.plan_prices pp join public.plans p on p.id=pp.plan_id where p.code='basic' and pp.interval='month'")).rows[0];
  basicPrice=price.id; basicPlan=price.plan_id;
  subA=(await db.query<{id:string}>("select id from public.subscriptions where owner_id=$1",[a])).rows[0].id;
  orderA=(await db.query<{id:string}>(`insert into public.billing_orders(owner_id,subscription_id,price_id,purpose,amount_minor,currency,currency_exponent,price_snapshot,idempotency_key,subscription_revision,expires_at)
    values ($1,$2,$3,'initial',20000,'UGX',0,'{"plan":"basic","interval":"month"}',gen_random_uuid(),0,now()+interval '1 hour') returning id`,[a,subA,basicPrice])).rows[0].id;
});
after(async () => { await db.close(); });

test("SaaS migration preserves existing content, ownership, slugs and legacy auth", async () => {
  assert.deepEqual((await db.query("select id,slug,owner_id,data,published,published_data,revision,updated_at from public.cards order by slug")).rows,beforeCards);
  const users=await db.query<{id:string;legacy_supabase_user_id:string;clerk_user_id:null}>("select id,legacy_supabase_user_id,clerk_user_id from public.users order by id");
  assert.deepEqual(users.rows,[{id:a,legacy_supabase_user_id:a,clerk_user_id:null},{id:b,legacy_supabase_user_id:b,clerk_user_id:null}]);
  assert.equal((await db.query("select * from public.cards where owner_id is null")).rows.length,1);
  assert.equal((await db.query("select * from public.subscriptions where status='free'")).rows.length,2);
  assert.equal((await db.query("select * from public.card_studio_media where size_bytes is null")).rows.length,1);
  const fks=await db.query<{count:number}>("select count(*)::int as count from pg_constraint where contype='f' and confrelid='auth.users'::regclass and conrelid in ('public.cards'::regclass,'public.groups'::regclass,'public.card_studio_media'::regclass)");
  assert.equal(fks.rows[0].count,3);
});

test("SaaS migration supports a fresh empty installation", async () => {
  const fresh=new PGlite({extensions:{pgcrypto}});
  try {
    await fresh.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,created_at timestamptz default now(),is_anonymous boolean);
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
    for(const file of migrations.filter(f => f <= foundation)) await fresh.exec(`begin; ${sql(file)} commit;`);
    assert.equal((await fresh.query("select * from public.plans")).rows.length,3);
    assert.equal((await fresh.query("select * from public.users")).rows.length,0);
  } finally { await fresh.close(); }
});

test("new tables are RLS-enabled and inaccessible to both client roles", async () => {
  for(const table of tables) {
    const result=await db.query<{relrowsecurity:boolean}>("select relrowsecurity from pg_class where oid=$1::regclass",[`public.${table}`]);
    assert.equal(result.rows[0].relrowsecurity,true,table);
    for(const role of ["anon","authenticated"]) {
      for(const privilege of ["SELECT","INSERT","UPDATE","DELETE","TRUNCATE"]) {
        const access=await db.query<{allowed:boolean}>("select has_table_privilege($1,$2,$3) as allowed",[role,`public.${table}`,privilege]);
        assert.equal(access.rows[0].allowed,false,`${role} ${table} ${privilege}`);
      }
      await db.exec(`set role ${role}`);
      try { await rejects(`select * from public.${table}`,"42501"); }
      finally { await db.exec("reset role"); }
    }
  }
  await db.exec("set role service_role");
  try { assert.equal((await db.query("select * from public.plans")).rows.length,3); }
  finally { await db.exec("reset role"); }
});

test("existing owner RLS still hides other users and private drafts from anonymous callers", async () => {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);
  await db.exec("set role authenticated");
  try {
    assert.deepEqual((await db.query("select id from public.cards")).rows,[{id:cardA}]);
    await rejects("update public.cards set published=true","42501");
  } finally { await db.exec("reset role"); }
  await db.exec("set role anon");
  try { await rejects("select * from public.cards","42501"); }
  finally { await db.exec("reset role"); }
});

test("same-owner foreign keys reject cross-user group membership and billing references", async () => {
  await db.query("insert into public.group_cards(owner_id,group_id,card_id) values ($1,$2,$3)",[a,groupA,cardA]);
  await rejects("insert into public.group_cards(owner_id,group_id,card_id) values ($1,$2,$3)","23503",[a,groupA,cardB]);
  await rejects("insert into public.group_cards(owner_id,group_id,card_id) values ($1,$2,$3)","23503",[a,groupB,cardA]);
  await rejects(`insert into public.payments(owner_id,order_id,provider,merchant_reference,amount_minor,currency,currency_exponent)
    values ($1,$2,'pesapal','cross-owner',20000,'UGX',0)`,"23503",[b,orderA]);
  await rejects(`insert into public.billing_orders(owner_id,subscription_id,price_id,purpose,amount_minor,currency,currency_exponent,price_snapshot,idempotency_key,subscription_revision,expires_at)
    values ($1,$2,$3,'initial',20000,'UGX',0,'{}',gen_random_uuid(),0,now()+interval '1 hour')`,"23503",[b,subA,basicPrice]);
});

test("plan proposals seed correct integer UGX prices without enabling paid checkout", async () => {
  assert.deepEqual((await db.query("select p.code,pp.interval,pp.amount_minor::int,pp.currency_exponent,pp.enabled from public.plan_prices pp join public.plans p on p.id=pp.plan_id order by p.code,pp.interval")).rows,[
    {code:"basic",interval:"month",amount_minor:20000,currency_exponent:0,enabled:false},
    {code:"basic",interval:"year",amount_minor:200000,currency_exponent:0,enabled:false},
    {code:"premium",interval:"month",amount_minor:60000,currency_exponent:0,enabled:false},
    {code:"premium",interval:"year",amount_minor:600000,currency_exponent:0,enabled:false},
  ]);
  assert.deepEqual((await db.query("select code from public.plans where enabled")).rows,[{code:"free"}]);
  await rejects("update public.plan_prices set amount_minor=1 where id=$1","23514",[basicPrice]);
  await rejects("delete from public.plan_prices where id=$1","23514",[basicPrice]);
  await rejects("update public.plans set active_cards=999 where id=$1","23514",[basicPlan]);
});

test("subscription constraints reject duplicate accounts, mismatched prices and invalid periods", async () => {
  await rejects("insert into public.subscriptions(owner_id,plan_id) values ($1,$2)","23505",[a,basicPlan]);
  await rejects("update public.subscriptions set status='active',price_id=$1,plan_id=$2 where id=$3","23514",[basicPrice,basicPlan,subA]);
  await rejects("update public.subscriptions set price_id=$1,status='active',current_period_start=now(),current_period_end=now()+interval '1 month' where id=$2","23503",[basicPrice,subA]);
  await rejects("update public.subscriptions set renewal_mode='provider' where id=$1","23514",[subA]);
});

test("orders are immutable and retries reuse a unique purchase identity", async () => {
  await rejects("update public.billing_orders set amount_minor=1 where id=$1","23514",[orderA]);
  await rejects("update public.billing_orders set owner_id=$1 where id=$2","23514",[b,orderA]);
  await rejects("update public.billing_orders set status='paid' where id=$1","23514",[orderA]);
  await rejects(`insert into public.billing_orders(owner_id,subscription_id,price_id,purpose,amount_minor,currency,currency_exponent,price_snapshot,idempotency_key,subscription_revision,expires_at)
    select owner_id,subscription_id,price_id,purpose,amount_minor,currency,currency_exponent,price_snapshot,idempotency_key,subscription_revision,expires_at from public.billing_orders where id=$1`,"23505",[orderA]);
});

test("payment verification fields and provider tracking identities cannot be omitted or duplicated", async () => {
  const payment=await db.query<{id:string}>(`insert into public.payments(owner_id,order_id,provider,provider_tracking_id,merchant_reference,amount_minor,currency,currency_exponent)
    values ($1,$2,'pesapal','tracking-a','merchant-a',20000,'UGX',0) returning id`,[a,orderA]);
  await rejects("update public.payments set status='completed' where id=$1","23514",[payment.rows[0].id]);
  await rejects(`insert into public.payments(owner_id,order_id,provider,provider_tracking_id,merchant_reference,amount_minor,currency,currency_exponent)
    values ($1,$2,'pesapal','tracking-a','merchant-b',20000,'UGX',0)`,"23505",[a,orderA]);
  await db.query("update public.payments set status='completed',verified_at=now() where id=$1",[payment.rows[0].id]);
  await rejects("update public.payments set amount_minor=1 where id=$1","23514",[payment.rows[0].id]);
  await rejects("update public.payments set provider_tracking_id='replacement' where id=$1","23514",[payment.rows[0].id]);
});

test("QR drafts require an owner and publication requires a live dynamic snapshot", async () => {
  await rejects("insert into public.qr_codes(slug,type,mode,title,data) values ('ownerless','url','dynamic','Test','{}')","23502");
  const qr=await db.query<{id:string}>("insert into public.qr_codes(owner_id,slug,type,mode,title,data) values ($1,'qr-test-a','url','dynamic','Test','{}') returning id",[a]);
  await rejects("update public.qr_codes set published=true where id=$1","23514",[qr.rows[0].id]);
  await db.query("update public.qr_codes set published=true,published_data='{}' where id=$1",[qr.rows[0].id]);
  await rejects("update public.qr_codes set deleted_at=now() where id=$1","23514",[qr.rows[0].id]);
  await rejects("update public.qr_codes set archived_at=now() where id=$1","23514",[qr.rows[0].id]);
  await rejects("update public.qr_codes set mode='static' where id=$1","23514",[qr.rows[0].id]);
});

test("usage periods, deltas and event retries preserve quota accounting foundations", async () => {
  await rejects("insert into public.usage_counters values ($1,'active_cards','current',-1,now())","23514",[a]);
  await rejects("insert into public.usage_counters values ($1,'monthly_cards','2026-13',0,now())","23514",[a]);
  await rejects("insert into public.usage_counters values ($1,'active_cards','2026-09',0,now())","23514",[a]);
  const event=await db.query<{id:string;operation_id:string}>(`insert into public.usage_events(owner_id,operation_id,metric,period_key,delta,resource_type,resource_id)
    values ($1,gen_random_uuid(),'monthly_cards','2026-09',1,'card',$2) returning id,operation_id`,[a,cardA]);
  await rejects(`insert into public.usage_events(owner_id,operation_id,metric,period_key,delta,resource_type,resource_id)
    values ($1,$2,'monthly_cards','2026-09',1,'card',$3)`,"23505",[a,event.rows[0].operation_id,cardA]);
  await rejects("delete from public.usage_events where id=$1","23514",[event.rows[0].id]);
});

test("subscription history is append-only and IPN retries have a unique inbox identity", async () => {
  await db.query("insert into public.subscription_events(owner_id,subscription_id,event_key,event_type) values ($1,$2,'event-one','created')",[a,subA]);
  await rejects("update public.subscription_events set event_type='modified' where event_key='event-one'","23514");
  await db.query("insert into public.payment_events(provider,deduplication_key,provider_tracking_id) values ('pesapal','notification-a','tracking-a')");
  await rejects("insert into public.payment_events(provider,deduplication_key,provider_tracking_id) values ('pesapal','notification-a','tracking-a')","23505");
});
