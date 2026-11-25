import { notFound, redirect } from "next/navigation";
import SiteHeader from "@/components/nav/SiteHeader";
import Studio from "@/components/Studio";
import { activeBrand } from "@/lib/brand";
import { currentUser } from "@/lib/auth/session";
import { ownedRecord } from "@/lib/records";
import { touchAsset } from "@/lib/assets";
export default async function EditPage({params}:{params:Promise<{kind:string;slug:string}>}) {
  const {kind,slug}=await params;
  if(kind!=="cards"&&kind!=="groups")notFound();
  const user=await currentUser();if(!user)redirect(`/sign-in?next=${encodeURIComponent(`/edit/${kind}/${slug}`)}`);
  const record=await ownedRecord(kind,slug,user.id);
  if(!record||record.deleted_at)notFound();
  await touchAsset(user.id,kind==="cards"?"card":"group",record.id);
  return <><SiteHeader /><Studio brand={activeBrand} userId={user.id} initial={record} initialKind={kind}/></>;
}
