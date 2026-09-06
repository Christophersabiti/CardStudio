// Opt-in Clerk development integration. Never run with production Clerk keys.
// Run against the local production build with CARD_STUDIO_TEST_ORIGIN set.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';

import sharp from 'sharp';
const require=createRequire(import.meta.url);require('@next/env').loadEnvConfig(process.cwd());
const origin=process.env.CARD_STUDIO_TEST_ORIGIN;
if(!origin || !['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw new Error('Set CARD_STUDIO_TEST_ORIGIN to the local app.');
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
if (!process.env.CLERK_SECRET_KEY?.startsWith('sk_test_')) throw new Error('Configure Clerk DEVELOPMENT keys in .env.local before running this suite.');
const {error:ready}=await admin.from('users').select('clerk_user_id,app_role').limit(0);
if(ready)throw new Error('Apply the Phase 1 and Phase 2 migrations to the confirmed test database first.');
const created=[];const rateKeys=[];
async function clerk(path,method='GET',body) {
  const res=await fetch('https://api.clerk.com/v1'+path,{method,headers:{Authorization:'Bearer '+process.env.CLERK_SECRET_KEY,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(!res.ok)throw new Error(`Clerk test request failed (${res.status})`);
  return res.status===204?null:res.json();
}
let checks=0;
function check(condition,message){assert.ok(condition,message);checks++;console.log(`PASS ${message}`);}
async function identity() {
  const email=`cardstudio-${randomUUID()}+clerk_test@example.com`;
  const user=await clerk('/users','POST',{email_address:[email],password:randomBytes(32).toString('hex'),skip_password_checks:true});
  const fixture={clerkId:user.id,id:null};created.push(fixture);
  const session=await clerk('/sessions','POST',{user_id:user.id});
  fixture.sessionId=session.id;
  const token=async()=>(await clerk(`/sessions/${session.id}/tokens`,'POST')).jwt;
  const account=await fetch(origin+'/api/account',{headers:{Authorization:'Bearer '+await token()}});
  if(account.status!==200)throw new Error(`Account provisioning failed (${account.status}); check migrations and verified Clerk email.`);
  fixture.id=(await account.json()).user.id;
  const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{accessToken:token,auth:{persistSession:false,autoRefreshToken:false}});
  return {...fixture,client,token};
}
async function request(path,who,body,method=body?'POST':'GET') {
  const response=await fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,...(who?{Authorization:'Bearer '+await who.token()}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const text=await response.text();let json;try{json=JSON.parse(text);}catch{}
  return {status:response.status,json,text,headers:response.headers};
}
const base={firstName:'TestAmina',lastName:'Namusoke',title:'Original role',organization:'Synthetic QA',phones:[{type:'CELL',value:'+256700123456'}],emails:['test@example.com'],websites:['https://example.com'],socials:{linkedin:'https://linkedin.com/in/example'},location:'Kampala, Uganda',tagline:'Test only',role:'',accent:'secondary',photo:'',logo:''};
try {
  const a=await identity(),b=await identity();
  const denied=await request('/api/cards',null,{id:randomUUID(),data:base});check(denied.status===401,'anonymous cloud save rejected');
  const csrf=await fetch(origin+'/api/cards',{method:'POST',headers:{Origin:'https://evil.example',Authorization:'Bearer '+await a.token(),'Content-Type':'application/json'},body:JSON.stringify({id:randomUUID(),data:base})});check(csrf.status===403,'cross-origin mutation rejected');
  const malformed=await request('/api/groups',a,{id:randomUUID(),data:{members:[]}});check(malformed.status===400,'missing group name returns validation error, not server error');
  const unsafe=await request('/api/cards',a,{id:randomUUID(),data:{...base,websites:['javascript:alert(1)']}});check(unsafe.status===400,'unsafe URL rejected');
  const oversized=await fetch(origin+'/api/cards',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+await a.token(),'Content-Type':'application/json'},body:JSON.stringify({padding:'é'.repeat(700000)})});check(oversized.status===413,'oversized UTF-8 request rejected');
  const id=randomUUID();let res=await request('/api/cards',a,{id,data:base});check(res.status===201,'owner creates private cloud draft');let card=res.json.record;
  const retry=await request('/api/cards',a,{id,data:base});check(retry.json.record.id===id,'retry uses the same record, not a duplicate');
  check((await request(`/c/${card.slug}`)).status===404,'private draft has no public page');
  check((await request(`/edit/cards/${card.slug}`,b)).status===404,'other owner cannot open editor');
  check((await request(`/api/cards/${card.slug}`,b,{action:'publish',revision:card.revision},'PATCH')).status===404,'other owner cannot publish a card');
  const foreign=await b.client.from('cards').select('id').eq('id',card.id);check(!foreign.error&&foreign.data.length===0,'database RLS hides another owner’s rows');
  const direct=await a.client.from('cards').update({published:true}).eq('id',card.id);check(!!direct.error,'direct browser writes cannot bypass endpoint validation');
  const image='data:image/png;base64,'+(await sharp({create:{width:20,height:20,channels:4,background:'#0055aa'}}).png().toBuffer()).toString('base64');
  res=await request('/api/uploads',a,{image});check(res.status===200,'validated raster image stored privately');const media=res.json.url;
  check((await request(media)).status===404,'unpublished media unavailable to anonymous viewers');
  check((await request(media,b)).status===404,'private media unavailable to other owner');
  const ownImage=await request(media,a);check(ownImage.status===200&&ownImage.headers.get('cache-control').includes('no-store'),'owner can access private media without public caching');
  const badImage=await request('/api/uploads',a,{image:'data:image/png;base64,aGVsbG8='});check(badImage.status===400,'fake image content rejected');
  res=await request(`/api/cards/${card.slug}`,a,{action:'publish',revision:card.revision,data:{...base,photo:media}},'PATCH');check(res.status===200,'owner publishes current snapshot');card=res.json.record;
  const published=await request(`/c/${card.slug}`);check(published.status===200&&published.text.includes('Original role'),'published profile renders saved content');
  check(published.text.includes('Scan to view my profile'),'public card uses dynamic profile QR');
  check((await request(media)).status===200,'published card exposes only its referenced image');
  const originalSlug=card.slug;
  res=await request(`/api/cards/${card.slug}`,a,{action:'save',revision:card.revision,data:{...card.data,title:'Private revised role'}},'PATCH');check(res.status===200,'owner saves a revised private draft');card=res.json.record;
  const unchanged=await request(`/c/${card.slug}`);check(unchanged.text.includes('Original role')&&!unchanged.text.includes('Private revised role'),'private draft save does not change public profile');
  const conflict=await request(`/api/cards/${card.slug}`,a,{action:'publish',revision:card.revision-1},'PATCH');check(conflict.status===409,'stale editor revision cannot overwrite newer changes');
  res=await request(`/api/cards/${card.slug}`,a,{action:'publish',revision:card.revision,data:card.data},'PATCH');card=res.json.record;
  check(card.slug===originalSlug&&(await request(`/c/${card.slug}`)).text.includes('Private revised role'),'published update keeps the same public link');
  res=await request(`/api/cards/${card.slug}`,a,{action:'duplicate',revision:card.revision,id:randomUUID()},'PATCH');check(res.status===201&&res.json.record.slug!==card.slug&&!res.json.record.published,'duplicate is a distinct private draft');
  res=await request(`/api/cards/${card.slug}`,a,{action:'unpublish',revision:card.revision},'PATCH');card=res.json.record;
  check((await request(`/c/${card.slug}`)).status===404&&(await request(media)).status===404,'unpublish revokes public page and private media access');
  res=await request(`/api/cards/${card.slug}`,a,{action:'delete',revision:card.revision},'PATCH');card=res.json.record;check(!!card.deleted_at&&!card.published,'delete moves card to recoverable Trash');
  res=await request(`/api/cards/${card.slug}`,a,{action:'restore',revision:card.revision},'PATCH');card=res.json.record;check(!card.deleted_at&&!card.published,'restore does not accidentally republish');
  const group={name:'Synthetic test group',organization:'QA',tagline:'',members:[{firstName:'Member',lastName:'One',title:'',organization:'',phone:'+256700123456',email:'test@example.com'}]};
  const noConsent=await request('/api/groups',b,{id:randomUUID(),data:group,publish:true});check(noConsent.status===400,'group publication requires explicit consent');
  res=await request('/api/groups',b,{id:randomUUID(),data:group,publish:true,consent:true});check(res.status===201,'authorized group publication succeeds');let g=res.json.record;
  check((await request(`/g/${g.slug}`)).status===200,'published group page loads');
  res=await request(`/api/groups/${g.slug}`,b,{action:'save',revision:g.revision,data:{...group,name:'Unpublished group revision'}},'PATCH');g=res.json.record;
  const publicGroup=await request(`/g/${g.slug}`);check(publicGroup.text.includes('Synthetic test group')&&!publicGroup.text.includes('Unpublished group revision'),'group draft changes do not silently change shared roster');
  res=await request(`/api/groups/${g.slug}`,b,{action:'delete',revision:g.revision},'PATCH');check(res.status===200&&(await request(`/g/${g.slug}`)).status===404,'group deletion revokes the public bundle');
  const bucket=randomUUID();rateKeys.push(bucket);
  const limits=await Promise.all(Array.from({length:6},()=>admin.rpc('consume_card_studio_limit',{bucket_key:bucket,max_requests:2,window_seconds:60})));
  check(limits.every(r=>!r.error)&&limits.filter(r=>r.data===true).length===2,'distributed rate limit is atomic under concurrent requests');
  const forbidden=await b.client.rpc('consume_card_studio_limit',{bucket_key:bucket,max_requests:1000,window_seconds:60});check(!!forbidden.error,'browser cannot change its rate limit');
  const dash=await request('/dashboard',a);check(dash.status===200&&dash.text.includes('TestAmina'),'signed-in dashboard lists owned cards');
  const signedout=await request('/auth/signout',a,{},'POST');check(signedout.status===303&&(await clerk(`/sessions/${a.sessionId}`)).status==='revoked','sign-out revokes the Clerk session');
  console.log(`Integration checks passed: ${checks}`);
} finally {
  // Delete only records and assets belonging to synthetic accounts created above.
  for(const fixture of created) {
    const owner=fixture.id;
    if(!owner){await clerk(`/users/${fixture.clerkId}`,'DELETE');continue;}
    for(const kind of ['cards','groups']){const {error}=await admin.from(kind).delete().eq('owner_id',owner);if(error)throw error;}
    const {data:assets,error}=await admin.from('card_studio_media').select('path').eq('owner_id',owner);if(error)throw error;
    if(assets.length){const removed=await admin.storage.from('card-studio-private').remove(assets.map(a=>a.path));if(removed.error)throw removed.error;}
    const removed=await admin.from('card_studio_media').delete().eq('owner_id',owner);if(removed.error)throw removed.error;
    for(const scope of ['record-write','upload'])rateKeys.push(createHmac('sha256',process.env.SUPABASE_SERVICE_ROLE_KEY).update(`${scope}:${owner}`).digest('hex'));
    await clerk(`/users/${fixture.clerkId}`,'DELETE');
    const {error:disabled}=await admin.from('users').update({status:'deleted',clerk_disabled:true}).eq('id',owner);if(disabled)throw disabled;
  }
  if(rateKeys.length)await admin.from('card_studio_limits').delete().in('key',rateKeys);
  console.log('Synthetic Clerk accounts, cards, uploads and rate fixtures cleaned. Internal deleted-account tombstones/Free subscriptions remain for webhook safety.');
}
