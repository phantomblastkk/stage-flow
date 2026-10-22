import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// Publicação de páginas Pro é resolvida novamente a cada requisição;
// retirar do ar ou revogar acesso bloqueia imediatamente a rota.
export const dynamic = "force-dynamic";

type PublicSite = {
  artist?: {
    name?:string;username?:string;bio?:string;
    headline?:string;cover_path?:string|null;avatar_path?:string|null;
  };
};
type Props={
  children:React.ReactNode;
  params:Promise<{username:string}>;
};

async function getPublishedSite(username:string):Promise<PublicSite|null>{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!anon||!/^[a-z0-9-]{3,30}$/.test(username))return null;
  try {
    const client=createClient(url,anon,{
      auth:{persistSession:false,autoRefreshToken:false}
    });
    const {data,error}=await client.rpc("stage_public_pro_artist_site",{
      p_username:username
    });
    return error||!data?null:data as PublicSite;
  }catch{return null;}
}

export async function generateMetadata({params}:Omit<Props,"children">):Promise<Metadata>{
  const {username}=await params;
  const site=await getPublishedSite(username);
  if(!site?.artist){
    return{
      title:"Site profissional indisponível | Stage Flow",
      robots:{index:false,follow:false}
    };
  }
  const artist=site.artist;
  const title=(artist.name||"Artista")+" | Site profissional Stage Flow";
  const description=(artist.headline||artist.bio||
    "Conheça meus shows, músicas e trabalhos no Stage Flow.").slice(0,155);
  const url="https://stage-flow-lemon.vercel.app/pro/"+username;
  const base=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const imagePath=artist.cover_path||artist.avatar_path;
  const image=base&&imagePath
    ?base.replace(/\/$/,"")+"/storage/v1/object/public/stage-artist-public/"+
      imagePath.split("/").map(encodeURIComponent).join("/")
    :undefined;
  return{
    title,description,
    alternates:{canonical:url},
    robots:{index:true,follow:true},
    openGraph:{
      type:"profile",locale:"pt_BR",url,
      title,description,siteName:"Stage Flow",
      ...(image?{images:[{url:image,alt:"Foto de "+(artist.name||"artista")}]}:{})
    },
    twitter:{card:image?"summary_large_image":"summary",title,description}
  };
}

export default async function ProArtistLayout({children,params}:Props){
  const {username}=await params;
  const site=await getPublishedSite(username);
  if(!site?.artist)notFound();
  return children;
}
