import {createRequire} from 'node:module';
import {createClient} from '@supabase/supabase-js';
createRequire(import.meta.url)('@next/env').loadEnvConfig(process.cwd());
let failures=0;
function check(ok,message){console.log(`${ok?'PASS':'NEEDS SETUP'} ${message}`);if(!ok)failures++;}
const pk=process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const sk=process.env.CLERK_SECRET_KEY;
check(!!pk,'Clerk publishable key assignment');
check(!!sk,'Clerk secret key assignment');
check(!!process.env.CLERK_WEBHOOK_SIGNING_SECRET,'Clerk webhook signing secret (required for lifecycle delivery)');
check(process.env.NEXT_PUBLIC_SITE_URL==='http://localhost:3000','Local canonical origin is http://localhost:3000');
if(pk&&sk) {
  check(pk.startsWith('pk_test_')&&sk.startsWith('sk_test_'),'Development Clerk keys selected for local testing');
  check((pk.startsWith('pk_test_')&&sk.startsWith('sk_test_'))||(pk.startsWith('pk_live_')&&sk.startsWith('sk_live_')),'Clerk keys use the same environment');
  try {
    const response=await fetch('https://api.clerk.com/v1/users/count',{headers:{Authorization:`Bearer ${sk}`}});
    check(response.ok,'Clerk backend credential accepted');
  } catch {check(false,'Clerk backend reachable');}
}
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
check(!!url&&!!key,'Supabase server connection configured');
if(url&&key) {
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await client.from('users').select('clerk_user_id,app_role,clerk_disabled').limit(0);
  check(!error,'Phase 1 and Phase 2 database tables/columns available');
}
console.log('Native Supabase Clerk integration and real email recovery must also be checked using the Phase 2 runbook. No key values were printed.');
process.exitCode=failures?1:0;
