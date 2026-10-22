export type FlyerFormat = "feed" | "story";
export type FlyerFit = "cover" | "contain";
export type FlyerCrop = {
  fit: FlyerFit;
  zoom: number;
  x: number;
  y: number;
};
export type FlyerSettings = {
  feed: FlyerCrop;
  story: FlyerCrop;
};

export const FLYER_SIZES: Record<FlyerFormat, {width:number;height:number}> = {
  feed: { width:1080, height:1350 },
  story: { width:1080, height:1920 }
};

export function defaultFlyerSettings(): FlyerSettings {
  const base = ():FlyerCrop => ({fit:"cover",zoom:1,x:0,y:0});
  return {feed:base(),story:base()};
}

export function safeFlyerSettings(raw:unknown):FlyerSettings {
  const defaults=defaultFlyerSettings();
  if (!raw || typeof raw!=="object") return defaults;
  const obj=raw as Record<string,unknown>;
  const read=(format:FlyerFormat):FlyerCrop=>{
    const input=obj[format];
    if(!input || typeof input!=="object")return defaults[format];
    const data=input as Record<string,unknown>;
    const clamp=(v:unknown,min:number,max:number,otherwise:number)=>
      typeof v==="number" && Number.isFinite(v)?Math.max(min,Math.min(max,v)):otherwise;
    return {
      fit:data.fit==="contain"?"contain":"cover",
      zoom:clamp(data.zoom,1,3,1),
      x:clamp(data.x,-100,100,0),
      y:clamp(data.y,-100,100,0)
    };
  };
  return {feed:read("feed"),story:read("story")};
}

/** Render flyer in browser canvas. All coordinates scale with output resolution.
 *  "cover" uses central crop by default. "contain" preserves all original
 *  artwork over a blurred version of the image (never crops text).
 */
export function drawFlyer(
  canvas:HTMLCanvasElement,
  image:HTMLImageElement,
  format:FlyerFormat,
  crop:FlyerCrop,
  preview=false
):void {
  const size=FLYER_SIZES[format];
  const factor=preview?0.38:1;
  const w=Math.round(size.width*factor),h=Math.round(size.height*factor);
  if(canvas.width!==w)canvas.width=w;
  if(canvas.height!==h)canvas.height=h;
  const ctx=canvas.getContext("2d");
  if(!ctx)return;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle="#171225";
  ctx.fillRect(0,0,w,h);
  const iw=image.naturalWidth,ih=image.naturalHeight;
  if(!iw||!ih)return;
  const cover=Math.max(w/iw,h/ih);
  const contain=Math.min(w/iw,h/ih);

  if(crop.fit==="contain"){
    // Blur on a centered enlarged image, including overscan to avoid edges.
    const blur=Math.max(5,Math.round(w*0.032));
    ctx.save();
    ctx.filter="blur("+blur+"px)";
    const bgScale=cover*1.12;
    const bw=iw*bgScale,bh=ih*bgScale;
    ctx.drawImage(image,(w-bw)/2,(h-bh)/2,bw,bh);
    ctx.restore();
    ctx.fillStyle="rgba(7,9,22,.33)";
    ctx.fillRect(0,0,w,h);
  }

  const scale=(crop.fit==="cover"?cover:contain)*crop.zoom;
  const dw=iw*scale,dh=ih*scale;
  // Pan spans the full available overflow for crop mode; when contained,
  // the same sliders position the image within the available negative space.
  const dx=(w-dw)/2 + Math.abs(w-dw)/2*(crop.x/100);
  const dy=(h-dh)/2 + Math.abs(h-dh)/2*(crop.y/100);
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  ctx.drawImage(image,dx,dy,dw,dh);
}

export async function loadFlyerImage(src:string):Promise<HTMLImageElement>{
  const image=new Image();
  if(/^https?:\/\//.test(src))image.crossOrigin="anonymous";
  image.decoding="async";
  image.src=src;
  await image.decode();
  return image;
}

export async function makeFlyerBlob(
  image:HTMLImageElement,format:FlyerFormat,crop:FlyerCrop
):Promise<Blob>{
  const canvas=document.createElement("canvas");
  drawFlyer(canvas,image,format,crop);
  return new Promise((resolve,reject)=>{
    canvas.toBlob(blob=>blob?resolve(blob):
      reject(new Error("Não foi possível gerar a imagem.")),"image/jpeg",.93);
  });
}

export function downloadFlyer(blob:Blob,name:string){
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),30000);
}

export function flyerFileName(title:string,format:FlyerFormat):string{
  const normalized=title.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,46);
  return (normalized||"show")+"-"+format+"-stage-flow.jpg";
}
