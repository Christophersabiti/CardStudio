// Run only after an administrator independently verifies control of BOTH
// identities, BEFORE first Clerk login. No public/self-service claim endpoint.
import {createRequire} from 'node:module';
import {createClient} from '@supabase/supabase-js';
createRequire(import.meta.url)('@next/env').loadEnvConfig(process.cwd());
const [legacyId,clerkId,confirmation]=process.argv.slice(2);
if(!/^[0-9a-f-]{36}$/i.test(legacyId||'')||!/^user_[A-Za-z0-9]+$/.test(clerkId||'')||confirmation!=='--ownership-verified') {
  throw new Error('Usage: npm run account:link -- SUPABASE_USER_UUID CLERK_USER_ID --ownership-verified. Independently verify both identities first.');
}
if(!process.env.CLERK_SECRET_KEY)throw new Error('Configure Clerk first.');
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:legacy,error}=await admin.auth.admin.getUserById(legacyId);
if(error||!legacy.user||legacy.user.is_anonymous)throw new Error('Legacy identity unavailable or anonymous.');
const response=await fetch(`https://api.clerk.com/v1/users/${clerkId}`,{headers:{Authorization:`Bearer ${process.env.CLERK_SECRET_KEY}`}});
if(!response.ok)throw new Error('Clerk identity unavailable.');
const user=await response.json();
if(user.banned||user.locked||!user.email_addresses?.some(e=>e.id===user.primary_email_address_id&&e.verification?.status==='verified')) {
  throw new Error('Clerk account must be active with verified primary email.');
}
const result=await admin.rpc('link_legacy_clerk_identity',{legacy_user_id:legacyId,verified_clerk_id:clerkId});
if(result.error)throw new Error('Link rejected. The account may already be linked or provisioned; no automatic merge was attempted.');
console.log('Verified identities linked; original internal owner UUID and card URLs preserved.');
