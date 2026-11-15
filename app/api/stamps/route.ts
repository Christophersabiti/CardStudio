import { currentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import { errorResponse, HttpError, jsonResponse, checkOrigin, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { stampSaveSchema } from "@/lib/stamps";
import { storeImage } from "@/lib/media";

export const runtime="nodejs";
export async function GET(){
  try{
    const user=await currentUser(); if(!user) throw new HttpError(401,"Sign in to access saved stamp designs.");
    const {data,error}=await createAdminClient().from("stamp_designs").select("id,name,design,revision,updated_at").eq("owner_id",user.id).is("deleted_at",null).order("updated_at",{ascending:false});
    if(error) throw error;
    return jsonResponse({designs:data});
  }catch(e){return errorResponse(e);}
}
export async function POST(req:Request){
  try{
    checkOrigin(req); const user=await currentUser(); if(!user) throw new HttpError(401,"Sign in to save a reusable stamp design.");
    await rateLimit(user.id,"stamp-design-save",30,60);
    const body=stampSaveSchema.parse(await readJson(req,750_000));
    const c=createAdminClient();
    for(const item of body.design.items){
      if(item.imageData?.startsWith("data:")) item.imageData=await storeImage(item.imageData,user.id);
    }
    if(body.id){
      const {data,error}=await c.from("stamp_designs").update({name:body.design.title,design:body.design}).eq("id",body.id).eq("owner_id",user.id).is("deleted_at",null).select("id,name,design,revision,updated_at").maybeSingle();
      if(error) throw error;
      if(!data) throw new HttpError(404,"Saved stamp design not found.");
      return jsonResponse({design:data});
    }
    const {data,error}=await c.from("stamp_designs").insert({owner_id:user.id,name:body.design.title,design:body.design}).select("id,name,design,revision,updated_at").single();
    if(error) throw error;
    return jsonResponse({design:data},201);
  }catch(e){return errorResponse(e);}
}
export async function DELETE(req:Request){
  try{
    checkOrigin(req); const user=await currentUser(); if(!user) throw new HttpError(401,"Sign in to manage saved stamp designs.");
    const id=new URL(req.url).searchParams.get("id"); if(!id) throw new HttpError(400,"Choose a saved design.");
    await rateLimit(user.id,"stamp-design-delete",30,60);
    const {data,error}=await createAdminClient().from("stamp_designs").update({deleted_at:new Date().toISOString()}).eq("id",id).eq("owner_id",user.id).is("deleted_at",null).select("id").maybeSingle();
    if(error) throw error; if(!data) throw new HttpError(404,"Saved stamp design not found.");
    return jsonResponse({ok:true});
  }catch(e){return errorResponse(e);}
}
