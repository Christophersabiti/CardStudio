import "server-only";
import { z } from "zod";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/http";
import { stampSvg } from "@/lib/stamp-render";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const item = z.object({
  id: z.string().min(1).max(80), text: z.string().max(80),
  place: z.enum(["top", "center", "bottom"]), curved: z.boolean().optional(),
  size: z.number().min(6).max(36), bold: z.boolean(), font: z.string().max(40),
  color: color.optional(), letterSpacing: z.number().min(0).max(6),
  signature: z.boolean().optional(), imageData: z.string().max(600_000).optional(),
  assetLabel: z.string().max(20).optional(), imageScale:z.number().min(.5).max(1.5).optional(),
  imageX:z.number().min(-80).max(80).optional(), imageFit:z.enum(["contain","cover"]).optional(),
  dx:z.number().min(-220).max(220).optional(), dy:z.number().min(-220).max(220).optional(),
}).strict();
export const stampDesignSchema = z.object({
  title: z.string().trim().min(1).max(64),
  shape: z.enum(["Circle", "Oval", "Rectangle", "Square", "Triangle", "Shield", "Hexagon", "Octagon"]),
  color, border: z.number().int().min(1).max(12), borderStyle: z.string().max(40),
  aging: z.number().min(0).max(80), dateFormat: z.enum(["DD/MM/YYYY", "DD MMM YYYY", "MMM DD, YYYY", "YYYY-MM-DD"]),
  items: z.array(item).max(24),
}).strict().superRefine((design,ctx)=>{
  design.items.forEach((entry,index)=>{
    const limit=entry.curved?40:64;
    if(entry.text.length>limit)ctx.addIssue({code:"custom",path:["items",index,"text"],message:`${entry.curved?"Curved text":"Stamp text"} must be ${limit} characters or fewer to stay readable inside the design.`});
  });
});
export type StampDesign = z.infer<typeof stampDesignSchema>;
export const stampSaveSchema = z.object({ id: z.string().uuid().optional(), design: stampDesignSchema }).strict();

const mediaId = /^\/api\/media\/([0-9a-f-]{36})$/i;
async function imageAsData(value: string, owner: string) {
  const match = mediaId.exec(value);
  if (!match) throw new HttpError(400,"An uploaded stamp image is unavailable. Upload it again.");
  const c=createAdminClient();
  const {data,error}=await c.from("card_studio_media").select("owner_id,path").eq("id",match[1]).eq("owner_id",owner).maybeSingle();
  if(error) throw error;
  if(!data) throw new HttpError(400,"An uploaded stamp image is unavailable. Upload it again.");
  const file=await c.storage.from("card-studio-private").download(data.path);
  if(file.error||!file.data) throw new HttpError(400,"An uploaded stamp image is unavailable. Upload it again.");
  const bytes=Buffer.from(await file.data.arrayBuffer());
  return `data:image/png;base64,${(await sharp(bytes).png().toBuffer()).toString("base64")}`;
}

export async function renderStampPng(design: StampDesign, owner: string) {
  const paths=design.items.filter(i=>i.imageData?.startsWith("/api/media/"));
  const assets=new Map<string,string>();
  for(const i of paths) assets.set(i.id,await imageAsData(i.imageData!,owner));
  const svg=await stampSvg(design,assets);
  return sharp(Buffer.from(svg)).resize(1500,1500).png().toBuffer();
}
