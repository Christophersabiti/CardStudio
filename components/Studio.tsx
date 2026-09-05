"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Brand } from "@/lib/brand";
import type { CardData, GroupData, RecordKind, StudioRecord } from "@/lib/types";
import { emptyCard, emptyGroup } from "@/lib/types";
import { buildVcard, buildGroupVcard, contactFileBase, groupFileBase } from "@/lib/vcard";
import { cardSchema, groupSchema, cardDraftSchema, groupDraftSchema } from "@/lib/validation";
import { sameContent } from "@/lib/publication";
import { isCompletedNewDraft } from "@/lib/draft-storage";
import { qrDataUrl } from "@/lib/qr";
import BuilderForm from "./BuilderForm";
import GroupBuilderForm from "./GroupBuilderForm";
import CardPreview from "./CardPreview";
import GroupPreview from "./GroupPreview";
import CardActions from "./CardActions";
import GroupActions from "./GroupActions";

export default function Studio({brand,userId,initial,initialKind="cards"}: {brand:Brand;userId:string|null;initial?:StudioRecord;initialKind?:RecordKind}) {
  const [kind,setKind] = useState<RecordKind>(initialKind);
  return <div className="max-w-[1240px] mx-auto px-5 pb-16">
    {!initial && <div className="inline-flex gap-2 mb-5" role="group" aria-label="Card type">
      <button className={`cs-button ${kind==="cards"?"cs-primary":""}`} aria-pressed={kind==="cards"} onClick={()=>setKind("cards")}>Single card</button>
      <button className={`cs-button ${kind==="groups"?"cs-primary":""}`} aria-pressed={kind==="groups"} onClick={()=>setKind("groups")}>Group / bulk contacts</button>
    </div>}
    <Editor key={`${kind}:${initial?.slug || "new"}`} brand={brand} kind={kind} userId={userId} initial={initial}/>
  </div>;
}

function Editor({brand,kind,userId,initial}: {brand:Brand;kind:RecordKind;userId:string|null;initial?:StudioRecord}) {
  const router = useRouter();
  const [data,setData] = useState<CardData|GroupData>(initial?.data || (kind==="cards"?emptyCard():emptyGroup()));
  const [record,setRecord] = useState(initial);
  const [ready,setReady] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [draftNotice,setDraftNotice] = useState("");
  const [localVersion,setLocalVersion] = useState("");
  const [consent,setConsent] = useState(false);
  const [qrMode,setQrMode] = useState<"dynamic"|"offline">(initial?.published?"dynamic":"offline");
  const [qrResult,setQrResult] = useState({payload:"",url:"",error:""});
  const [origin,setOrigin] = useState("");
  const requestId = useRef<string>("");
  const completedNewDraft = useRef(false);
  const key = `card_studio_v2:${userId || "guest"}:${kind}:${initial?.slug || "new"}`;
  const guestKey = `card_studio_v2:guest:${kind}:new`;
  const legacyKey = kind === "cards" ? "card_studio_draft_v1" : "card_studio_group_draft_v1";
  const snapshot = useRef<{data: CardData|GroupData;revision:number|undefined;requestId?:string}>({data,revision:initial?.revision});

  // Hydrate browser-only draft storage after SSR; never overwrite it with the server default.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(()=>{
    setOrigin(window.location.origin);
    requestId.current = crypto.randomUUID();
    try {
      let raw = localStorage.getItem(key) || (!initial && userId ? localStorage.getItem(guestKey) : null);
      if (!initial && raw && isCompletedNewDraft(JSON.parse(raw))) {
        localStorage.removeItem(key);
        raw = null;
      }
      if (!raw && !initial) { const legacy = localStorage.getItem(legacyKey); if (legacy) raw = JSON.stringify({data:JSON.parse(legacy)}); }
      if(raw) {
        const draft = JSON.parse(raw);
        if (!initial && typeof draft.requestId === "string" && /^[0-9a-f-]{36}$/.test(draft.requestId)) requestId.current = draft.requestId;
        const parsed = (kind==="cards"?cardDraftSchema:groupDraftSchema).safeParse(draft.data);
        if(parsed.success && (!initial || draft.revision===initial.revision)) {
          setData(parsed.data as CardData|GroupData);
          snapshot.current.data=parsed.data as CardData|GroupData;
          if(initial && !sameContent(parsed.data,initial.data))setDraftNotice("Restored your unsaved changes from this browser.");
        } else if(initial && draft.revision!==initial.revision) {
          setDraftNotice("A newer version was saved elsewhere. Loaded the latest cloud draft.");
        }
      }
    } catch {setDraftNotice("Browser draft storage is unavailable. Save your draft online before leaving.");}
    setReady(true);
    return ()=>{ if(completedNewDraft.current)return; try {localStorage.setItem(key,JSON.stringify(snapshot.current));}catch{/* Notice is surfaced by autosave. */} };
  },[key,guestKey,legacyKey,initial,kind,userId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(()=>{
    if(!ready)return;
    snapshot.current={data,revision:record?.revision,requestId:requestId.current};
    const timer=setTimeout(()=>{
      if(completedNewDraft.current)return;
      try {localStorage.setItem(key,JSON.stringify(snapshot.current));setLocalVersion(JSON.stringify(snapshot.current.data));}
      catch {setDraftNotice("This browser could not save your draft. Save online before leaving.");}
    },300);
    return ()=>clearTimeout(timer);
  },[data,record?.revision,key,ready]);

  const dirty = !record || !sameContent(data,record.data);
  const matchesPublished = !!record?.published && sameContent(data,record.published_data);
  const publicUrl = record?.published && origin ? `${origin}/${kind==="cards"?"c":"g"}/${record.slug}` : "";
  const validated = useMemo(()=>(kind==="cards"?cardSchema:groupSchema).safeParse(data),[data,kind]);
  const vcard = useMemo(()=>kind==="cards"?buildVcard(data as CardData):buildGroupVcard(data as GroupData),[data,kind]);
  const qrPayload = kind==="groups" || qrMode==="dynamic" ? (matchesPublished?publicUrl:"") : (validated.success?vcard:"");
  const qr = qrResult.payload === qrPayload ? qrResult.url : "";
  const qrError = qrResult.payload === qrPayload ? qrResult.error : "";
  useEffect(()=>{
    let active=true;
    if(!qrPayload)return;
    const timer=setTimeout(()=>{
      qrDataUrl(qrPayload,{width:512}).then(url=>{if(active)setQrResult({payload:qrPayload,url,error:""});}).catch(()=>{if(active)setQrResult({payload:qrPayload,url:"",error:"This contact has too much information for an offline QR. Use a published profile QR or shorten the details."});});
    },150);
    return ()=>{active=false;clearTimeout(timer);};
  },[qrPayload]);
  const needsProtection = dirty && (busy || localVersion !== JSON.stringify(data));
  useEffect(()=>{
    const warn=(e:BeforeUnloadEvent)=>{if(needsProtection){e.preventDefault();}};
    window.addEventListener("beforeunload",warn);
    return ()=>window.removeEventListener("beforeunload",warn);
  },[needsProtection]);

  async function save(action:"save"|"publish"|"unpublish") {
    setBusy(true);setError("");setNotice("");
    try {
      if(action!=="unpublish" && !validated.success)throw new Error(validated.error.issues.slice(0,3).map(i=>`${i.path.join(".") || "Card"}: ${i.message}`).join(" "));
      const res=await fetch(`/api/${kind}${record?`/${record.slug}`:""}`,{
        method:record?"PATCH":"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(record?{action,revision:record.revision,...(action!=="unpublish"?{data}:{}),consent}:{id:requestId.current,data,publish:action==="publish",consent}),
      });
      const result=await res.json();if(!res.ok)throw new Error(result.error || "Could not save. Please try again.");
      const next=result.record as StudioRecord;
      if(!initial)completedNewDraft.current=true;
      setRecord(next);
      if(action!=="unpublish")setData(next.data);
      snapshot.current={data:action==="unpublish"?data:next.data,revision:next.revision,requestId:requestId.current};
      try {
        const savedKey = `card_studio_v2:${userId}:${kind}:${next.slug}`;
        localStorage.setItem(savedKey,JSON.stringify(snapshot.current));
        if(!initial)localStorage.removeItem(key);
        if(!initial && userId){localStorage.removeItem(guestKey);localStorage.removeItem(legacyKey);}
      } catch { setDraftNotice("Saved online. Browser draft storage is unavailable."); }
      if(action==="publish")setQrMode("dynamic");
      setConsent(false);
      setNotice(action==="publish"?"Published. Your profile link stays the same when you update it.":action==="unpublish"?"Unpublished. The public link no longer shows this card.":"Draft saved privately. Your published card has not changed.");
      if(!record)router.replace(`/edit/${kind}/${next.slug}`);

    } catch(e) {setError(e instanceof Error?e.message:"Could not save. Please try again.");}
    finally {setBusy(false);}
  }

  return <>
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div><h1 className="text-xl font-bold">{record?"Edit":"Create"} {kind==="cards"?"card":"group"}</h1><p className="text-sm cs-muted mt-2" role="status">{!record?"Local draft · not published":dirty?"Unsaved changes":record.published?(matchesPublished?"Published · up to date":"Draft saved · unpublished changes"):"Private draft"}</p></div>
      {userId && <Link href="/dashboard" className="cs-button">My cards</Link>}
    </div>
    {draftNotice && <p className="cs-panel text-sm mb-4" role="status">{draftNotice}</p>}
    <div className="cs-studio-grid">
      <fieldset disabled={busy || !ready} className="cs-editor-col min-w-0 border-0 p-0 m-0">
        {kind==="cards"?<BuilderForm data={data as CardData} setData={update=>setData(current=>typeof update==="function"?update(current as CardData):update)}/>:<GroupBuilderForm data={data as GroupData} setData={update=>setData(current=>typeof update==="function"?update(current as GroupData):update)}/>}
      </fieldset>
      <div className="flex flex-col gap-4 lg:sticky lg:top-5 cs-stage-col">
        <div className="flex justify-between"><h2 className="font-bold">Live preview</h2><span className="text-xs cs-muted">Updates as you type</span></div>
        <div className="cs-panel grid place-items-center"><div className="cs-print">
          {kind==="cards"?<CardPreview data={data as CardData} qrUrl={qr} brand={brand} qrLabel={qrMode==="dynamic"?"Scan to view my profile":"Scan to save my contact"}/>:<GroupPreview data={data as GroupData} qrUrl={qr} brand={brand}/>}
        </div></div>
        {kind==="cards" && <div className="cs-panel text-sm flex flex-col gap-2">
          <label htmlFor="qr-type" className="font-semibold">QR type</label>
          <select id="qr-type" className="cs-input" value={qrMode} onChange={e=>setQrMode(e.target.value as "dynamic"|"offline")}>
            <option value="offline">Offline contact QR · fixed snapshot</option>
            <option value="dynamic" disabled={!record?.published}>Profile QR · stays up to date</option>
          </select>
          <p className="cs-muted">{qrMode==="offline"?"Works without internet. Downloaded codes and contact files cannot be updated or revoked.":"Opens your published profile online. The same QR shows future published updates."}</p>
        </div>}
        {(kind==="groups" || qrMode==="dynamic") && !matchesPublished && <p role="status" className="text-sm cs-muted">Publish the current details to enable the profile QR and sharing. Any existing public link still shows the last published version.</p>}
        {qrError && <p role="alert" className="cs-error">{qrError}</p>}
        {kind==="cards"?<CardActions firstName={(data as CardData).firstName} lastName={(data as CardData).lastName} qrAccent={brand.colors.primary} vcard={vcard} qrUrl={qr} fileBase={contactFileBase(data as CardData)} disabled={!validated.success || busy}/>:<GroupActions vcard={vcard} qrUrl={qr} fileBase={groupFileBase(data as GroupData)} memberCount={(data as GroupData).members.length} disabled={!validated.success || busy}/>}
        <div className="cs-panel flex flex-col gap-3">
          <h2 className="font-bold">Save and publish</h2>
          {!userId?<><p className="text-sm cs-muted">Your draft is saved in this browser. Sign in to save it online, publish a link, and make updates later.</p><Link className="cs-button cs-primary text-center" href={`/login?next=${encodeURIComponent(`/?mode=${kind}`)}`}>Sign in to save</Link></>:<>
            <p className="text-sm cs-muted">Drafts are private. Published cards can be viewed by anyone with the link.</p>
            {kind==="groups" && <label className="flex gap-3 text-sm items-start"><input type="checkbox" className="mt-1" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>I am authorized to share every member’s contact details publicly. Anyone with this link can download the full group.</span></label>}
            <div className="flex flex-wrap gap-2">
              <button className="cs-button" disabled={busy || !ready || (!dirty && !!record)} onClick={()=>save("save")}>{busy?"Saving…":"Save private draft"}</button>
              <button className="cs-button cs-primary" disabled={busy || !ready || (kind==="groups"&&!consent)} onClick={()=>save("publish")}>{record?.published?"Publish updates":"Publish card"}</button>
              {record?.published && <button className="cs-button" disabled={busy} onClick={()=>save("unpublish")}>Unpublish</button>}
            </div>
          </>}
          {publicUrl && matchesPublished && <div className="flex gap-2"><input aria-label="Public card link" readOnly className="cs-input min-w-0 flex-1" value={publicUrl}/><button className="cs-button" onClick={async()=>{try{await navigator.clipboard.writeText(publicUrl);setNotice("Link copied.");}catch{setError("Copy isn't available. Select and copy the link above.");}}}>Copy link</button></div>}
          {publicUrl && <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline">Open last published version ↗</a>}
          {notice && <p role="status" className="text-sm">{notice}</p>}
          {error && <p role="alert" className="cs-error">{error}</p>}
          {kind==="groups" && <p className="text-xs cs-muted">Contact-import steps vary by phone. Downloading a file does not confirm that every contact was added.</p>}
        </div>
      </div>
    </div>
  </>;
}
