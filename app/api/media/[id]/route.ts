import { createAdminClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/session";
import { errorResponse, HttpError } from "@/lib/http";
import { z } from "zod";

export const runtime = "nodejs";
export async function GET(_req: Request, {params}: {params: Promise<{id:string}>}) {
  try {
    const {id} = await params;
    if (!z.uuid().safeParse(id).success) throw new HttpError(404,"Image not found.");
    const client = createAdminClient();
    const {data:asset,error} = await client.from("card_studio_media").select("owner_id,path").eq("id",id).maybeSingle();
    if (error) throw error;
    if (!asset) throw new HttpError(404,"Image not found.");
    const path = `/api/media/${id}`;
    const {data:card,error:cardError} = await client.from("cards").select("id").eq("published",true).is("deleted_at",null).or(`published_data->>photo.eq.${path},published_data->>logo.eq.${path}`).limit(1).maybeSingle();
    if (cardError) throw cardError;
    if (!card && (await currentUser())?.id !== asset.owner_id) throw new HttpError(404,"Image not found.");
    const {data,error:downloadError} = await client.storage.from("card-studio-private").download(asset.path);
    if (downloadError || !data) throw downloadError || new Error("Missing image");
    return new Response(data,{headers:{"Content-Type":"image/webp","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  } catch(e) { return errorResponse(e); }
}
