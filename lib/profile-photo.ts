// Browser-side crop: a square portrait is saved, not a letterboxed landscape file.
// Original source is never modified; images already uploaded remain intact.
export async function prepareProfilePortrait(file:File):Promise<File>{
  if(!["image/jpeg","image/png","image/webp"].includes(file.type))return file;
  try{
    let image:ImageBitmap|HTMLImageElement;
    let objectUrl:string|null=null;
    if(typeof createImageBitmap==="function")image=await createImageBitmap(file);
    else{
      objectUrl=URL.createObjectURL(file);
      const element=new Image();element.src=objectUrl;
      await element.decode();image=element;
    }
    const width=image.width,height=image.height;
    if(!width||!height||width>12000||height>12000)throw Error("invalid_dimensions");
    const side=Math.min(width,height);
    // Slight portrait zoom removes common padding; position upper-middle for faces.
    const crop=side*.94;
    const x=(width-crop)/2,y=Math.max(0,Math.min(height-crop,(height-crop)*.36));
    const canvas=document.createElement("canvas");canvas.width=800;canvas.height=800;
    const ctx=canvas.getContext("2d");if(!ctx)throw Error("canvas_unavailable");
    ctx.fillStyle="#1b2030";ctx.fillRect(0,0,800,800);
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
    ctx.drawImage(image,x,y,crop,crop,0,0,800,800);
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",.9));
    if("close" in image&&typeof image.close==="function")image.close();
    if(objectUrl)URL.revokeObjectURL(objectUrl);
    if(!blob)throw Error("image_export_unavailable");
    return new File([blob],file.name.replace(/\.[^.]+$/,"")+"-perfil.jpg",{type:"image/jpeg",lastModified:Date.now()});
  }catch{return file;}
}
