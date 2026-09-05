import { notFound, redirect } from "next/navigation";
import Header from "@/components/Header";
import Studio from "@/components/Studio";
import { activeBrand } from "@/lib/brand";
import { currentUser } from "@/lib/supabase/session";
import { ownedRecord } from "@/lib/records";
export default async function EditPage({params}:{params:Promise<{kind:string;slug:string}>}) {
  const {kind,slug}=await params;
  if(kind!=="cards"&&kind!=="groups")notFound();
  const user=await currentUser();if(!user)redirect(`/login?next=${encodeURIComponent(`/edit/${kind}/${slug}`)}`);
  const record=await ownedRecord(kind,slug,user.id);
  if(!record||record.deleted_at)notFound();
  return <><Header brand={activeBrand}/><Studio brand={activeBrand} userId={user.id} initial={record} initialKind={kind}/></>;
}
