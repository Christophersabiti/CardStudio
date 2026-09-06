// Invoke from a scheduler using Authorization: Bearer BILLING_JOB_SECRET.
// No browser/client JWT is sufficient; the same secret protects the app worker.
Deno.serve(async (request:Request) => {
 const secret=Deno.env.get('BILLING_JOB_SECRET');
 const site=Deno.env.get('CARD_STUDIO_SITE_URL');
 const actual=new TextEncoder().encode(request.headers.get('authorization')||'');
 const expected=new TextEncoder().encode(`Bearer ${secret}`);
 let mismatch=actual.length^expected.length;
 for(let i=0;i<expected.length;i++)mismatch|=(actual[i]||0)^expected[i];
 if(request.method!=='POST'||!secret||mismatch!==0)return new Response('Unauthorized',{status:401});
 if(!site||new URL(site).protocol!=='https:')return new Response('Configuration unavailable',{status:503});
 try{const response=await fetch(new URL('/api/internal/billing-maintenance',site),{method:'POST',headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(120000)});return new Response(await response.text(),{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}catch{return new Response('Worker unavailable',{status:503});}
});
