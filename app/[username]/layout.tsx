import type {Metadata} from "next";
import {createClient} from "@supabase/supabase-js";
import {
  getStageFlowOrigin,getPublishedProSite,
  getPublicArtistImageUrl,publicArtistDescription
} from "@/lib/pro-site-public";

type PublicSinger={
  name:string;username:string;bio?:string|null;headline?:string|null;
  city?:string|null;cover_path?:string|null;avatar_path?:string|null;
};

// Public metadata is restricted to the same published, non-sensitive artist RPC.
// No private profile SELECT or service-role key is used.
export const dynamic="force-dynamic";
export async function generateMetadata({params}:{
  params:Promise<{username:string}>;
}):Promise<Metadata>{
 const {username}=await params;
 const origin=getStageFlowOrigin();
 const unavailable:Metadata={
  metadataBase:new URL(origin),title:"Perfil de cantor | Stage Flow",
  robots:{index:false,follow:false,noarchive:true}
 };
 if(!/^[a-z0-9-]{3,30}$/.test(username))return unavailable;
 let artist:PublicSinger|null=null;
 const pro=await getPublishedProSite(username);
 if(pro?.artist?.username===username){
  artist={
   username,name:pro.artist.name||"Artista",
   headline:pro.artist.headline,bio:pro.artist.bio,city:pro.artist.city,
   cover_path:pro.artist.cover_path,avatar_path:pro.artist.avatar_path
  };
 }else{
  const root=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!root||!anon)return unavailable;
  try{
   const client=createClient(root,anon,{
    auth:{persistSession:false,autoRefreshToken:false}
   });
   const {data,error}=await client.rpc("stage_public_artist_page",{p_username:username});
   if(error||!data||data.username!==username||!data.name)return unavailable;
   artist=data as PublicSinger;
  }catch{return unavailable;}
 }
 if(!artist)return unavailable;
 const name=artist.name.trim().slice(0,90);
 const title=name+" | Stage Flow";
 const description=publicArtistDescription({artist});
 const canonical=origin+"/"+encodeURIComponent(username);
 const image=getPublicArtistImageUrl({artist});
 const robots=process.env.NEXT_PUBLIC_STAGE_FLOW_ENV==="homologation"
  ? {index:false,follow:false}:{index:true,follow:true};
 return{
  metadataBase:new URL(origin),title,description,
  alternates:{canonical},robots,
  openGraph:{
   type:"profile",title,description,url:canonical,
   siteName:"Stage Flow",locale:"pt_BR",
   ...(image?{images:[{url:image,alt:"Perfil de "+name}]}:{})
  },
  twitter:{
   card:image?"summary_large_image":"summary",title,description,
   ...(image?{images:[image]}:{})
  }
 };
}
export default function PublicSingerLayout({children}:Readonly<{children:React.ReactNode}>){
 return children;
}
