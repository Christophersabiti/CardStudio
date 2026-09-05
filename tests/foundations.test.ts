import test from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { cardSchema, groupSchema, cardDraftSchema, groupDraftSchema, safeNext, safeWebUrl } from '../lib/validation';
import { emptyCard } from '../lib/types';
import { buildVcard, buildGroupVcard } from '../lib/vcard';
import { qrDataUrl } from '../lib/qr';
import { sameContent } from '../lib/publication';
import { readJson, HttpError, checkOrigin, errorResponse } from '../lib/http';
const card = {...emptyCard(),firstName:'Amina',lastName:'Namusoke',phones:[{type:'CELL' as const,value:'+256 700 123456'}],emails:['amina@example.com']};

test('validates nested fields and rejects malformed groups without a runtime exception',()=>{
  assert.equal(cardSchema.safeParse(card).success,true);
  for(const invalid of [{}, {name:4,members:[]}, {name:'Team',members:[{firstName:3}]}])assert.equal(groupSchema.safeParse(invalid).success,false);
  for(const invalid of [{...card,phones:[null]}, {...card,firstName:42}, {...card,emails:['invalid']},{...card,phones:Array(11).fill(card.phones[0])}])assert.equal(cardSchema.safeParse(invalid).success,false);
});
test('rejects dangerous URLs, credentials, unknown social platforms and hostile images',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,test','file:///etc/passwd','https://user:pass@example.com'])assert.equal(safeWebUrl(url),false);
  assert.equal(cardSchema.safeParse({...card,socials:{twitter:'https://x.com/example',whatsapp:'https://wa.me/256700123456'}}).success,true);
  assert.equal(cardSchema.safeParse({...card,socials:{evil:'https://example.com'}}).success,false);
  assert.equal(cardSchema.safeParse({...card,photo:'data:image/svg+xml;base64,AAA='}).success,false);
});
test('safe redirects cannot leave the application',()=>{
  for(const next of ['//evil.test','https://evil.test','/\\evil.test','/dashboard/../../auth/signout','/edit/cards/abc123?next=//evil.test'])assert.equal(safeNext(next),'/dashboard');
  assert.equal(safeNext('/edit/cards/abc123'),'/edit/cards/abc123');
  assert.equal(safeNext('/?mode=groups'),'/?mode=groups');
});
test('content comparison catches stale group data and ignores JSONB key ordering',()=>{
  assert.equal(sameContent({a:1,b:{c:2}},{b:{c:2},a:1}),true);
  assert.equal(sameContent({members:[{name:'A'}]},{members:[{name:'B'}]}),false);
});
test('vCard escapes newlines and folds UTF-8 safely',()=>{
  const vcard=buildVcard({...card,firstName:'A\r\nEND:VCARD\rBEGIN:VCARD',tagline:'é'.repeat(200)});
  assert.equal(vcard.match(/^BEGIN:VCARD$/gm)?.length,1);
  assert.match(vcard,/FN:A\\nEND:VCARD\\nBEGIN:VCARD/);
  for(const line of vcard.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
  assert.ok(vcard.endsWith('END:VCARD\r\n'));
  const unfolded=vcard.replace(/\r\n /g,'');assert.ok(unfolded.includes('é'.repeat(200)));
});
test('group contact file contains one complete block per member',()=>{
  const v=buildGroupVcard({name:'Team',organization:'Studio',tagline:'',members:[{firstName:'A',lastName:'',title:'',organization:'',phone:'',email:''},{firstName:'B',lastName:'',title:'',organization:'',phone:'',email:''}]});
  assert.equal(v.match(/BEGIN:VCARD/g)?.length,2);assert.equal(v.match(/END:VCARD/g)?.length,2);
});
test('generated PNG QRs decode to exact dynamic links and offline contact data',async()=>{
  for(const payload of ['https://cards.example.com/c/abc123',buildVcard(card)]) {
    const url=await qrDataUrl(payload,{width:512});
    const png=PNG.sync.read(Buffer.from(url.split(',')[1],'base64'));
    assert.equal(jsQR(new Uint8ClampedArray(png.data),png.width,png.height)?.data,payload);
  }
  await assert.rejects(qrDataUrl('x'.repeat(10000)));
});
test('body limits count actual UTF-8 bytes even without content-length',async()=>{
  const payload=Buffer.from(JSON.stringify({name:'é'.repeat(40)}));
  const req=new Request('http://localhost/api/cards',{method:'POST',headers:{'Content-Type':'application/json'},body:payload});
  await assert.rejects(readJson(req,60),(e:unknown)=>e instanceof HttpError&&e.status===413);
  const good=new Request('http://localhost/api/cards',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"ok":true}'});
  assert.deepEqual(await readJson(good),{ok:true});
});
test('malformed JSON and cross-origin writes fail safely',async()=>{
  await assert.rejects(readJson(new Request('http://localhost/api/cards',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'})),(e:unknown)=>e instanceof HttpError&&e.status===400);
  assert.throws(()=>checkOrigin(new Request('http://localhost/api/cards',{headers:{Origin:'https://evil.test'}})),HttpError);
  checkOrigin(new Request('http://localhost/api/cards',{headers:{Origin:'http://localhost'}}));
  const response=errorResponse(new Error('secret database information'));assert.equal(response.status,503);assert.ok(!(await response.text()).includes('secret'));
});

test('local recovery keeps incomplete drafts while cloud validation remains strict',()=>{
  const incomplete={...card,firstName:'',lastName:'',emails:['unfinished@'],websites:['https://']};
  assert.equal(cardDraftSchema.safeParse(incomplete).success,true);
  assert.equal(cardSchema.safeParse(incomplete).success,false);
  assert.equal(groupDraftSchema.safeParse({name:'',organization:'',tagline:'',members:[]}).success,true);
  assert.equal(cardDraftSchema.safeParse({...card,phones:[null]}).success,false);
});
