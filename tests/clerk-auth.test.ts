import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {test} from 'node:test';
import {NextRequest} from 'next/server';
import {verifyWebhook} from '@clerk/nextjs/webhooks';
import {clerkEventArguments,boundedWebhookRequest} from '../lib/auth/webhook';
import {authorizedParties,isClerkConfigured} from '../lib/auth/config';

test('auth configuration never enables a partial setup or trusts arbitrary origins',()=>{
  const original={...process.env};
  try {
    delete process.env.CLERK_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    assert.equal(isClerkConfigured(),false);
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY='test-key';
    assert.equal(isClerkConfigured(),false);
    process.env.CLERK_SECRET_KEY='test-secret';
    assert.equal(isClerkConfigured(),true);
    process.env.NEXT_PUBLIC_SITE_URL='http://localhost:3000';
    assert.deepEqual(authorizedParties(),['http://localhost:3000']);
    process.env.NEXT_PUBLIC_SITE_URL='https://cardstudio.sabtechonline.com';
    assert.deepEqual(authorizedParties(),['https://cardstudio.sabtechonline.com']);
    for(const invalid of ['http://evil.example','https://example.com/path','https://example.com/','not-a-url']) {
      process.env.NEXT_PUBLIC_SITE_URL=invalid;assert.throws(authorizedParties);
    }
  } finally {
    for(const key of ['CLERK_SECRET_KEY','NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY','NEXT_PUBLIC_SITE_URL']) {
      if(original[key]===undefined) delete process.env[key];else process.env[key]=original[key];
    }
  }
});

test('Clerk webhook signature rejects forged, modified and stale requests',async()=>{
  const key=Buffer.from('local-only-test-signing-key-32byte');
  const secret='whsec_'+key.toString('base64');
  const timestamp=Math.floor(Date.now()/1000).toString();
  const id='msg_localtest';
  const payload=JSON.stringify({type:'user.created',timestamp:Date.now(),data:{id:'user_Test',first_name:'Test',public_metadata:{role:'admin'}}});
  const signature=(body:string,time=timestamp)=>'v1,'+createHmac('sha256',key).update(`${id}.${time}.${body}`).digest('base64');
  const request=(body:string,sig:string,time=timestamp)=>new NextRequest('https://example.com/api/webhooks/clerk',{
    method:'POST',body,headers:{'svix-id':id,'svix-timestamp':time,'svix-signature':sig,'Content-Type':'application/json'},
  });
  const event=await verifyWebhook(await boundedWebhookRequest(request(payload,signature(payload))),{signingSecret:secret});
  const args=clerkEventArguments(event,id,timestamp);
  assert.equal(args.verified_clerk_id,'user_Test');
  assert.equal('role' in args,false);
  assert.equal('owner_id' in args,false);
  await assert.rejects(verifyWebhook(request(payload,'v1,forged'),{signingSecret:secret}));
  await assert.rejects(verifyWebhook(request(payload.replace('user_Test','user_Admin'),signature(payload)),{signingSecret:secret}));
  const stale=(Number(timestamp)-1000).toString();
  await assert.rejects(verifyWebhook(request(payload,signature(payload,stale),stale),{signingSecret:secret}));
});

test('webhook bytes are bounded and deleted-user events support signed timestamp fallback',async()=>{
  await assert.rejects(boundedWebhookRequest(new Request('https://example.com',{method:'POST',body:'é'.repeat(50)}),99));
  const args=clerkEventArguments({type:'user.deleted',data:{id:'user_Deleted'}},'msg_delete','1700000000');
  assert.equal(args.event_at,1700000000000);
  assert.equal(clerkEventArguments({type:'user.updated',timestamp:1,data:{id:'user_Locked',locked:true}},'msg_lock').provider_disabled,false);
  assert.equal(clerkEventArguments({type:'user.updated',timestamp:2,data:{id:'user_Banned',banned:true}},'msg_ban').provider_disabled,true);
  assert.throws(()=>clerkEventArguments({type:'user.deleted',data:{id:'invalid'}},'msg_delete','1700000000'));
});
