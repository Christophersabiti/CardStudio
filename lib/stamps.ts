import "server-only";
import { z } from "zod";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/http";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const item = z.object({
  id: z.string().min(1).max(80), text: z.string().max(80),
  place: z.enum(["top", "center", "bottom"]), curved: z.boolean().optional(),
  size: z.number().min(6).max(36), bold: z.boolean(), font: z.string().max(40),
  color: color.optional(), letterSpacing: z.number().min(0).max(6),
  signature: z.boolean().optional(), imageData: z.string().max(600_000).optional(),
  assetLabel: z.string().max(20).optional(), imageScale:z.number().min(.5).max(1.5).optional(),
  imageX:z.number().min(-80).max(80).optional(), imageFit:z.enum(["contain","cover"]).optional(),
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

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
const shape = (name: StampDesign["shape"], n: number) => {
  switch(name){
    case "Circle": return `<circle cx="250" cy="250" r="${185-n}"/>`;
    case "Oval": return `<ellipse cx="250" cy="250" rx="${205-n}" ry="${150-n}"/>`;
    case "Rectangle": return `<rect x="${35+n}" y="${100+n}" width="${430-2*n}" height="${300-2*n}" rx="8"/>`;
    case "Square": return `<rect x="${65+n}" y="${65+n}" width="${370-2*n}" height="${370-2*n}" rx="10"/>`;
    case "Triangle": return `<polygon points="250,${52+n} ${450-n},${425-n} ${50+n},${425-n}"/>`;
    case "Shield": return `<polygon points="${90+n},${65+n} ${410-n},${65+n} ${410-n},285 250,${445-n} ${90+n},285"/>`;
    case "Hexagon": return `<polygon points="${145+n},${52+n} ${355-n},${52+n} ${450-n},250 ${355-n},${448-n} ${145+n},${448-n} ${50+n},250"/>`;
    case "Octagon": return `<polygon points="${155+n},${45+n} ${345-n},${45+n} ${455-n},${155+n} ${455-n},${345-n} ${345-n},${455-n} ${155+n},${455-n} ${45+n},${345-n} ${45+n},${155+n}"/>`;
  }
};
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
  const top="M 100 205 Q 250 112 400 205", bottom="M 100 295 Q 250 388 400 295";
  const dash=design.borderStyle==="Dotted, office"?"1 7":design.borderStyle==="Serrated, notary"?"2 3":"";
  const text=design.items.map(i=>{
    const y=i.place==="top"?190:i.place==="bottom"?310:250;
    const fontSize=Math.max(10.2,Math.min(i.size*1.7,(i.curved?300:400)/Math.max(i.text.length*.6,1)));
    const ink=i.color||design.color;
    const img=assets.get(i.id);
    if(img){const scale=i.imageScale||1,w=210*scale,h=84*scale,cx=250+(i.imageX||0);return `<image href="${img}" x="${cx-w/2}" y="${y-h/2}" width="${w}" height="${h}" preserveAspectRatio="${i.imageFit==="cover"?"xMidYMid slice":"xMidYMid meet"}"/>`;}
    const content=esc(i.text), font=esc(i.font);
    if(i.curved&&i.place!=="center") return `<text fill="${ink}" font-family="${font}" font-weight="${i.bold?700:400}" font-size="${fontSize}" letter-spacing="${i.letterSpacing*1.4}" text-anchor="middle"><textPath href="#${i.place==="top"?"top":"bottom"}" startOffset="50%">${content}</textPath></text>`;
    return `<text x="250" y="${y}" fill="${ink}" font-family="${font}" font-weight="${i.bold?700:400}" font-size="${fontSize}" letter-spacing="${i.letterSpacing*1.4}" text-anchor="middle" dominant-baseline="middle">${content}</text>`;
  }).join("");
  const rings=`<g fill="none" stroke="${design.color}" stroke-width="${design.border}" ${dash?`stroke-dasharray="${dash}"`:""}>${shape(design.shape,0)}${design.borderStyle!=="Plain"?`<g opacity=".85">${shape(design.shape,11)}</g>`:""}${design.borderStyle.includes("triple")?`<g opacity=".65">${shape(design.shape,19)}</g>`:""}</g>`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500"><defs><path id="top" d="${top}"/><path id="bottom" d="${bottom}"/></defs><g opacity="${1-design.aging*.004}">${rings}${text}</g></svg>`;
  return sharp(Buffer.from(svg)).resize(1500,1500).png().toBuffer();
}
