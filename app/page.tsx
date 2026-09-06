import Shell from "@/components/marketing/Shell";
import Home from "@/components/marketing/Home";
import { redirect } from "next/navigation";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  if (mode === "cards" || mode === "groups") redirect(`/studio?mode=${mode}`);
  return (
    <Shell>
      <Home />
    </Shell>
  );
}
