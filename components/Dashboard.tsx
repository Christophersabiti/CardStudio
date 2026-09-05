"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { CardData, GroupData, RecordKind, StudioRecord } from "@/lib/types";
import { sameContent } from "@/lib/publication";

export default function Dashboard({items}: {items:(StudioRecord & {kind:RecordKind})[]}) {
  const router=useRouter();
  const [busy,setBusy]=useState("");
  const [confirm,setConfirm]=useState("");
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [trash,setTrash]=useState(false);
  const duplicateIds=useRef<Record<string,string>>({});
  const visible=items.filter(r=>!!r.deleted_at===trash);
  async function action(record:StudioRecord & {kind:RecordKind},action:"duplicate"|"unpublish"|"delete"|"restore") {
    setBusy(record.id);setError("");setMessage("");
    try {
      if(action==="duplicate")duplicateIds.current[record.id] ||= crypto.randomUUID();
      const res=await fetch(`/api/${record.kind}/${record.slug}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,revision:record.revision,...(action==="duplicate"?{id:duplicateIds.current[record.id]}:{})})});
      const result=await res.json();if(!res.ok)throw new Error(result.error);
      setConfirm("");
      if(action==="duplicate")router.push(`/edit/${record.kind}/${result.record.slug}`);
      else {setMessage(action==="delete"?"Moved to Trash and unpublished. You can restore it here.":action==="restore"?"Restored as a private draft. Publish it when you're ready.":"Unpublished. The public link no longer shows this card.");router.refresh();}
    }catch(e){setError(e instanceof Error?e.message:"Could not update this card.");}
    finally{setBusy("");}
  }
  return <>
    <div className="flex gap-2 my-6" role="group" aria-label="Card list"><button aria-pressed={!trash} className={`cs-button ${!trash?"cs-primary":""}`} onClick={()=>setTrash(false)}>My cards</button><button aria-pressed={trash} className={`cs-button ${trash?"cs-primary":""}`} onClick={()=>setTrash(true)}>Trash</button></div>
    {error&&<p role="alert" className="cs-error mb-4">{error}</p>}
    {message&&<p role="status" className="cs-panel text-sm mb-4">{message}</p>}
    {visible.length===0?<div className="cs-panel"><h2 className="text-lg font-bold">{trash?"Trash is empty":"Your next introduction starts here"}</h2><p className="cs-muted mt-2">{trash?"Deleted cards remain recoverable here.":"Create a card, save it privately, then publish when you're ready."}</p>{!trash&&<Link href="/" className="cs-button cs-primary inline-block mt-4">Create a card</Link>}</div>:<div className="grid md:grid-cols-2 gap-4">{visible.map(record=>{
      const title=record.kind==="groups"?(record.data as GroupData).name:([(record.data as CardData).firstName,(record.data as CardData).lastName].filter(Boolean).join(" ")||(record.data as CardData).organization);
      return <article key={record.id} className="cs-panel flex flex-col gap-3">
        <span className="cs-muted text-xs uppercase tracking-wide">{record.kind==="cards"?"Individual card":"Group contacts"}</span>
        <h2 className="text-xl font-bold break-words">{title}</h2>
        <p className="text-sm cs-muted">{record.deleted_at?"In Trash":record.published?(sameContent(record.data,record.published_data)?"Published":"Published · draft changes pending"):"Private draft"}</p>
        <div className="flex flex-wrap gap-2">
          {trash?<button className="cs-button" disabled={!!busy} onClick={()=>action(record,"restore")}>Restore as draft</button>:<>
            <Link className="cs-button cs-primary" href={`/edit/${record.kind}/${record.slug}`}>Edit card</Link>
            {record.published&&<a className="cs-button" href={`/${record.kind==="cards"?"c":"g"}/${record.slug}`} target="_blank" rel="noopener noreferrer">View public card ↗</a>}
            <button className="cs-button" disabled={!!busy} onClick={()=>action(record,"duplicate")}>Duplicate</button>
            {record.published&&<button className="cs-button" disabled={!!busy} onClick={()=>action(record,"unpublish")}>Unpublish</button>}
            <button className="cs-button" disabled={!!busy} onClick={()=>setConfirm(record.id)}>Move to Trash</button>
          </>}
        </div>
        {confirm===record.id&&<div className="rounded-lg border p-3 flex flex-col gap-2"><p className="text-sm">Move this card to Trash? Its public link will stop working. Downloaded files cannot be recalled.</p><div className="flex gap-2"><button className="cs-button" disabled={!!busy} onClick={()=>action(record,"delete")}>Confirm move</button><button className="cs-button" onClick={()=>setConfirm("")}>Cancel</button></div></div>}
        {busy===record.id&&<p role="status" className="text-sm">Updating…</p>}
      </article>;
    })}</div>}
  </>;
}
