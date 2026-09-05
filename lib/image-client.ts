export async function prepareImage(file: File,max: number,transparent: boolean): Promise<string> {
  if(!["image/png","image/jpeg","image/webp"].includes(file.type))throw new Error("Choose a PNG, JPEG or WebP image.");
  if(file.size>5_000_000)throw new Error("Choose an image smaller than 5 MB.");
  const url=URL.createObjectURL(file);
  try {
    const image=new Image();
    await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error("This image could not be read."));image.src=url;});
    if(image.width*image.height>20_000_000)throw new Error("Choose an image below 20 megapixels.");
    const scale=Math.min(1,max/Math.max(image.width,image.height));
    const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
    const context=canvas.getContext("2d");if(!context)throw new Error("Image processing is unavailable in this browser.");
    context.drawImage(image,0,0,canvas.width,canvas.height);
    return canvas.toDataURL(transparent?"image/png":"image/jpeg",.85);
  }finally{URL.revokeObjectURL(url);}
}
