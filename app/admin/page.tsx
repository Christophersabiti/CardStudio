import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Header from "@/components/Header";
import { activeBrand } from "@/lib/brand";
import { currentUser } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/server";
import { isAdministrator } from "@/lib/roles";

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!isAdministrator(user)) notFound();
  const client = createAdminClient();
  const totals = await Promise.all((["cards", "groups"] as const).map(async kind => {
    const {count,error} = await client.from(kind).select("id",{count:"exact",head:true}).is("deleted_at",null);
    if(error) throw error;
    return {kind,count:count || 0};
  }));
  return <><Header brand={activeBrand}/><main className="max-w-5xl mx-auto px-5 pb-16">
    <h1 className="text-3xl font-bold">Administration</h1>
    <p className="cs-muted mt-2">Signed in as {user.email}</p>
    <div className="grid sm:grid-cols-2 gap-4 my-6">{totals.map(({kind,count})=><section key={kind} className="cs-panel"><h2 className="capitalize font-semibold">Active {kind}</h2><p className="text-3xl font-bold mt-2">{count}</p></section>)}</div>
    <p className="cs-muted text-sm mb-6">Overview of cards and groups across Card Studio, excluding Trash.</p>
    <Link href="/dashboard" className="cs-button cs-primary">My cards</Link>
  </main></>;
}
