import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import Dashboard from "@/components/Dashboard";
import { activeBrand } from "@/lib/brand";
import { createSessionClient, currentUser } from "@/lib/supabase/session";
import { isAdministrator } from "@/lib/roles";
import type { RecordKind, StudioRecord } from "@/lib/types";

export default async function DashboardPage({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const user=await currentUser();if(!user)redirect("/login?next=/dashboard");
  const page=Math.max(1,Math.min(10000,Number.parseInt((await searchParams).page || "1") || 1));
  const client=await createSessionClient();
  const results=await Promise.all((["cards","groups"] as const).map(async kind=>{
    const {data,error,count}=await client.from(kind).select("*",{count:"exact"}).eq("owner_id",user.id).order("created_at",{ascending:false}).range((page-1)*30,page*30-1);
    if(error)throw error;
    return {count:count||0,items:(data||[]).map(r=>({...r,kind}) as StudioRecord & {kind:RecordKind})};
  }));
  const items=results.flatMap(r=>r.items).sort((a,b)=>b.created_at.localeCompare(a.created_at));
  return <><Header brand={activeBrand}/><main className="max-w-5xl mx-auto px-5 pb-16">
    <div className="flex flex-wrap justify-between items-start gap-4"><div><h1 className="text-3xl font-bold">My cards</h1><p className="cs-muted mt-2 text-sm">{user.email}</p></div><div className="flex gap-2">{isAdministrator(user)&&<Link href="/admin" className="cs-button">Administration</Link>}<Link href="/" className="cs-button cs-primary">Create card</Link><form action="/auth/signout" method="post"><button className="cs-button">Sign out</button></form></div></div>
    <Dashboard items={items}/>
    <nav className="flex gap-4 mt-6" aria-label="Pagination">{page>1&&<Link href={`/dashboard?page=${page-1}`} className="cs-button">Previous page</Link>}{results.some(r=>r.count>page*30)&&<Link href={`/dashboard?page=${page+1}`} className="cs-button">Next page</Link>}</nav>
    <p className="text-xs cs-muted mt-8">Cards created before accounts were introduced are not automatically assigned. Contact the site administrator to verify ownership of an older card.</p>
  </main></>;
}
