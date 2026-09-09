import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { unzipSync } from "fflate";
import sharp from "sharp";
import jsQR from "jsqr";
import { emptyCard, type CardRecord } from "../lib/types";
import { BRANDS } from "../lib/brand";
import { cardSchema, cardDraftSchema } from "../lib/validation";
import { samePublishedContent } from "../lib/publication";
import { printSnapshot, hasPrintPackage } from "../lib/print-package/policy";
import { renderPrintPackage } from "../lib/print-package/render";
const data = {...emptyCard(),firstName:"Zoë",lastName:"Sabiti PMP®",title:"Data & BI Specialist",organization:"Example Studio",phones:[{type:"CELL" as const,value:"+256777123456"}],emails:["zoe@example.com"],websites:["https://example.com"],location:"Kampala, Uganda",role:"Director",tagline:"Clear ideas. Lasting connections."};
const record: CardRecord = {id:"id",slug:"demo123",owner_id:"owner",data,published:true,published_data:data,revision:12,created_at:"",updated_at:"",deleted_at:null,view_count:0};
test("saved QR defaults to Online while explicit Offline survives validation and recovery",()=>{
  assert.equal(cardSchema.parse(data).qrMode,"dynamic");
  assert.equal(cardDraftSchema.parse({...data,qrMode:"offline"}).qrMode,"offline");
  assert.equal(cardSchema.parse({...data,qrMode:"offline"}).qrMode,"offline");
  assert.equal(cardSchema.safeParse({...data,qrMode:"other"}).success,false);
  assert.ok(samePublishedContent(data,{...data,qrMode:"offline"}));
  assert.ok(!samePublishedContent(data,{...data,firstName:"Someone else"}));
});
test("billing capability fails closed for Free, missing, and unknown plans",()=>{
  for(const code of ["free",undefined,null,"admin","superadmin","enterprise",{}]) assert.equal(hasPrintPackage(code),false);
  assert.equal(hasPrintPackage("basic"),true);assert.equal(hasPrintPackage("premium"),true);
});
test("online exports require matching publication, current revision, and canonical domain",()=>{
  assert.equal(printSnapshot(record,12,"https://cards.example.com").payload,"https://cards.example.com/c/demo123");
  assert.throws(()=>printSnapshot(record,11,"https://cards.example.com"),/changed/);
  assert.throws(()=>printSnapshot({...record,deleted_at:"now"},12),/Restore/);
  assert.throws(()=>printSnapshot({...record,published:false},12),/Publish/);
  assert.throws(()=>printSnapshot({...record,data:{...data,firstName:"New"}},12),/Publish/);
  for(const origin of [undefined,"http://localhost:3000","https://preview.vercel.app","https://user:pass@cards.example.com","https://cards.example.com/path","https://127.0.0.1","https://cards.example.com?x=1"]) assert.throws(()=>printSnapshot(record,12,origin));
});
test("offline private export preserves the contact snapshot without publication or origin",()=>{
  const s=printSnapshot({...record,published:false,published_data:null,data:{...data,qrMode:"offline"}},12);
  assert.equal(s.mode,"offline");assert.match(s.payload,/BEGIN:VCARD/);assert.match(s.payload,/Zoë/);
  assert.ok(s.payload.includes("+256777123456"));
});
test("package contains separate physically sized PDFs and matching scan-safe RGB mockup",async()=>{
  for(const mode of ["dynamic","offline"] as const){
    const snapshot=printSnapshot({...record,data:{...data,qrMode:mode}},12,"https://cards.example.com");
    const result=await renderPrintPackage({...snapshot,brand:BRANDS.neutral,preset:mode==="offline"?"bleed":"exact"});
    const files=unzipSync(result.zip);
    assert.deepEqual(Object.keys(files).sort(),["back.pdf","front.pdf","mockup.png"]);
    for(const name of ["front.pdf","back.pdf"]){
      const doc=await PDFDocument.load(files[name]);assert.equal(doc.getPageCount(),1);
      const p=doc.getPage(0),trim=p.getTrimBox();
      assert.ok(Math.abs(trim.width-85.6*72/25.4)<.001);assert.ok(Math.abs(trim.height-54*72/25.4)<.001);
      assert.ok(Math.abs(p.getWidth()-(mode==="offline"?91.6:85.6)*72/25.4)<.001);
      assert.ok(Math.abs(trim.x-(mode==="offline"?3:0)*72/25.4)<.001);
      assert.match(doc.getSubject() || "",/RGB/);
    }
    const raw=await sharp(Buffer.from(result.frontSvg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.equal(jsQR(new Uint8ClampedArray(raw.data),raw.info.width,raw.info.height)?.data,snapshot.payload);
    const meta=await sharp(files["mockup.png"]).metadata();
    assert.equal(meta.width,3072);assert.equal(meta.height,2048);assert.equal(meta.space,"srgb");
    // The big front inside the finished mockup must decode to the very same payload.
    const proof=await sharp(files["mockup.png"]).extract({left:230,top:170,width:1232,height:778}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.equal(jsQR(new Uint8ClampedArray(proof.data),proof.info.width,proof.info.height)?.data,snapshot.payload);
  }
});
test("renderer rejects overflowing details, unsupported glyphs, and undersized images",async()=>{
  const options={data,payload:"https://cards.example.com/c/demo123",mode:"dynamic" as const,brand:BRANDS.neutral,revision:1};
  await assert.rejects(()=>renderPrintPackage({...options,data:{...data,emails:Array(5).fill("x@example.com")}}),/four phone\/email/);
  await assert.rejects(()=>renderPrintPackage({...options,data:{...data,firstName:"🚀"}}),/character/);
  await assert.rejects(()=>renderPrintPackage({...options,photo:Buffer.from([1,2,3])}));
  const tiny=await sharp({create:{width:10,height:10,channels:3,background:"red"}}).png().toBuffer();
  await assert.rejects(()=>renderPrintPackage({...options,photo:tiny}),/too small/);
  const logo=await readFile("public/brands/pmi-uganda.png");
  const a=await renderPrintPackage({...options,logo});
  const b=await renderPrintPackage({...options,data:{...data,firstName:"Jane"},logo});
  assert.notDeepEqual(a.mockup,b.mockup);
});

test("server service blocks non-owners and Free before rendering and rechecks revocation",async()=>{
  const { createPrintPackage }=await import("../lib/print-package/service");
  let allowed=true,reads=0,renders=0;
  let latest=record;
  const deps={
    ownedRecord:async(_slug:string,ownerId:string)=>{reads++;return ownerId==="owner"?latest:null;},
    allowed:async()=>allowed,
    render:async()=>{renders++;return new Uint8Array([80,75]);},
  };
  await assert.rejects(()=>createPrintPackage("intruder","demo123",12,"exact","https://cards.example.com",deps),/not found/);
  assert.equal(renders,0);
  allowed=false;
  await assert.rejects(()=>createPrintPackage("owner","demo123",12,"exact","https://cards.example.com",deps),/Basic and Premium/);
  assert.equal(renders,0);
  allowed=true;
  const ok=await createPrintPackage("owner","demo123",12,"exact","https://cards.example.com",deps);
  assert.deepEqual(ok.zip,new Uint8Array([80,75]));assert.ok(reads>=4);
  await assert.rejects(()=>createPrintPackage("owner","demo123",12,"exact","https://cards.example.com",{...deps,render:async()=>{allowed=false;return new Uint8Array();}}),/Basic and Premium/);
  allowed=true;
  await assert.rejects(()=>createPrintPackage("owner","demo123",12,"exact","https://cards.example.com",{...deps,render:async()=>{latest={...record,revision:13};return new Uint8Array();}}),/changed/);
});
