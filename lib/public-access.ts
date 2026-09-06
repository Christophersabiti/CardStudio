import 'server-only';
import {createAdminClient} from './supabase/server';
export async function publicOwnerActive(ownerId:string|null){if(!ownerId)return true;const {data,error}=await createAdminClient().from('users').select('id').eq('id',ownerId).eq('status','active').eq('clerk_disabled',false).maybeSingle();if(error)throw error;return !!data;}
