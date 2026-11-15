import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import { checkOrigin, errorResponse, HttpError, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { renderStampPng, stampDesignSchema } from "@/lib/stamps";
import { storeImage } from "@/lib/media";

export const runtime="nodejs";
const requestSchema=z.object({operation_id:z.uuid(),design_id:z.uuid(),design:stampDesignSchema}).strict();
export async function POST(req:Request){
  try{
    checkOrigin(req); const user=await currentUser(); if(!user) throw new HttpError(401,"Sign in to generate and download stamps.");
    await rateLimit(user.id,"stamp-generation",60,60);
    const request=requestSchema.parse(await readJson(req,750_000));
    const c=createAdminClient();
    const {data:saved,error}=await c.from("stamp_designs").select("id").eq("id",request.design_id).eq("owner_id",user.id).is("deleted_at",null).maybeSingle();
    if(error) throw error; if(!saved) throw new HttpError(404,"Save this design before generating a PNG.");
    for(const item of request.design.items){if(item.imageData?.startsWith("data:")) item.imageData=await storeImage(item.imageData,user.id);}
    const png=await renderStampPng(request.design,user.id);
    const {data:quota,error:quotaError}=await c.rpc("record_stamp_generation",{account_id:user.id,operation:request.operation_id,design:request.design_id});
    if(quotaError){if(quotaError.code==="P0001") throw new HttpError(429,"You have reached this plan’s monthly stamp generation limit. It resets at the start of your next billing month."); throw quotaError;}
    const filename=`${request.design.title.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").toLowerCase()||"stamp"}-${new Date().toISOString().slice(0,10)}.png`;
    return new Response(new Uint8Array(png),{headers:{"Content-Type":"image/png","Content-Disposition":`attachment; filename="${filename}"`,"Cache-Control":"private, no-store","X-Stamp-Usage":JSON.stringify(quota)}});
  }catch(e){return errorResponse(e);}
}
