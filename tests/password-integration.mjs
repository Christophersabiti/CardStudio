// Opt-in live auth verification with synthetic accounts, removed in finally.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHmac} from 'node:crypto';
import {createRequire} from 'node:module';
import {createClient} from '@supabase/supabase-js';
const require=createRequire(import.meta.url);require('@next/env').loadEnvConfig(process.cwd());
const origin=process.env.CARD_STUDIO_TEST_ORIGIN;
if(!origin||!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Use a local test origin.');
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const accounts=[];
let checks=0;
function check(value,message){assert.ok(value,message);checks++;console.log('PASS '+message);}
async function login(email,password,extra={}){return fetch(origin+'/api/auth/password',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email,password,...extra}),redirect:'manual'});}
try{
  for(const role of ['admin','member']){
    const email=`password-test-${randomUUID()}@example.com`,password=randomBytes(32).toString('hex');
    const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:role==='admin'?{card_studio_role:'admin'}:{},user_metadata:{card_studio_role:'admin'}});if(error)throw error;
    accounts.push({id:data.user.id,email});
    const wrong=await login(email,'incorrect-test-password');check(wrong.status===401,'invalid password rejected');check(!wrong.headers.getSetCookie().length,'failed login does not create a session');
    const res=await login(email,password,{next:'https://example.com'});check(res.status===200,'password login succeeds');check((await res.json()).next==='/dashboard','external redirect rejected');
    const cookie=res.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');check(!!cookie,'successful login sets session cookies');
    const page=await fetch(origin+'/admin',{headers:{Cookie:cookie},redirect:'manual'});check(page.status===(role==='admin'?200:404),role==='admin'?'verified admin can view administration':'user-editable role cannot grant admin access');
    const dash=await fetch(origin+'/dashboard',{headers:{Cookie:cookie}});check(dash.status===200,'password session opens dashboard');
  }
  const csrf=await fetch(origin+'/api/auth/password',{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json'},body:'{}'});check(csrf.status===403,'cross-origin password request rejected');
  const anon=await fetch(origin+'/admin',{redirect:'manual'});check(anon.status===307,'anonymous admin access redirects to login');
  console.log(`Password integration checks passed: ${checks}`);
}finally{
  for(const account of accounts){const {error}=await admin.auth.admin.deleteUser(account.id);if(error)throw error;const key=createHmac('sha256',process.env.SUPABASE_SERVICE_ROLE_KEY).update(`password-email:${account.email}`).digest('hex');await admin.from('card_studio_limits').delete().eq('key',key);}
  console.log('Synthetic password accounts removed.');
}
