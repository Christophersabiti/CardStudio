import Header from "@/components/Header";
import Studio from "@/components/Studio";
import { activeBrand } from "@/lib/brand";
import { currentUser } from "@/lib/supabase/session";

export default async function Home({searchParams}:{searchParams:Promise<{mode?:string}>}) {
  const user = await currentUser();
  const mode = (await searchParams).mode;
  return (
    <>
      <Header brand={activeBrand} />
      <Studio brand={activeBrand} userId={user?.id || null} initialKind={mode === "groups" ? "groups" : "cards"} />
    </>
  );
}
