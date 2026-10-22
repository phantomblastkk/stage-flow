import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * A página Pro só pode usar o snapshot público autorizado pelo Supabase:
 * nunca consultar diretamente rascunhos, convites ou mídias privadas.
 */
export type PublicProSite = {
  artist?: {
    name?:string;
    username?:string;
    headline?:string|null;
    bio?:string|null;
    cover_path?:string|null;
    avatar_path?:string|null;
    city?:string|null;
  };
};

export function getStageFlowOrigin():string {
  const candidates=[
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    "https://stage-flow-lemon.vercel.app"
  ];
  for(const value of candidates){
    if(!value)continue;
    try{
      const origin=new URL(/^https?:\/\//.test(value)?value:"https://"+value);
      if(origin.protocol==="https:")return origin.origin;
    }catch{/* Keep the public fallback. */}
  }
  return "https://stage-flow-lemon.vercel.app";
}

export function publicProUrl(username:string):string{
  return getStageFlowOrigin()+"/pro/"+encodeURIComponent(username);
}

export async function getPublishedProSite(username:string):Promise<PublicProSite|null>{
  if(!/^[a-z0-9-]{3,30}$/.test(username))return null;
  const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!supabaseUrl||!anonKey)return null;

  try{
    const client=createClient(supabaseUrl,anonKey,{
      auth:{persistSession:false,autoRefreshToken:false}
    });
    const {data,error}=await client.rpc("stage_public_pro_artist_site",{
      p_username:username
    });
    if(error||!data||typeof data!=="object")return null;
    const site=data as PublicProSite;
    return site.artist&&site.artist.username===username?site:null;
  }catch{
    return null;
  }
}

export function getPublicArtistImageUrl(site:PublicProSite):string|null{
  const root=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const raw=site.artist?.cover_path||site.artist?.avatar_path;
  if(!root||!raw||raw.length>512)return null;
  const parts=raw.split("/");
  if(parts.some(part=>!part||part==="."||part===".."||
    !/^[a-zA-Z0-9_.-]+$/.test(part)))return null;
  try{
    const url=new URL(root);
    if(url.protocol!=="https:")return null;
    return url.origin+"/storage/v1/object/public/stage-artist-public/"+
      parts.map(encodeURIComponent).join("/");
  }catch{return null;}
}

export function publicArtistDescription(site:PublicProSite):string{
  const artist=site.artist;
  const candidate=(artist?.headline||artist?.bio||"").replace(/\s+/g," ").trim();
  if(!candidate)return "Conheça a música, os vídeos e a agenda de shows deste artista no Stage Flow Pro.";
  return candidate.length>160?candidate.slice(0,157).trimEnd()+"…":candidate;
}
