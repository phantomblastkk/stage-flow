import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { getStageFlowOrigin } from "@/lib/pro-site-public";

// Public singer pages (free and Pro) share the same /username canonical URL.
// The server RPC only lists singer accounts that chose to publish.
export const dynamic="force-dynamic";

type SitemapArtist={username:string;updated_at:string|null};

export default async function sitemap():Promise<MetadataRoute.Sitemap>{
  const origin=getStageFlowOrigin();
  const result:MetadataRoute.Sitemap=[
    {url:origin+"/",changeFrequency:"weekly",priority:1}
  ];
  const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!supabaseUrl||!anon)return result;

  try{
    const client=createClient(supabaseUrl,anon,{
      auth:{persistSession:false,autoRefreshToken:false}
    });
    const {data,error}=await client.rpc("stage_public_singer_sitemap");
    if(error||!Array.isArray(data))return result;
    for(const entry of data as SitemapArtist[]){
      if(!entry?.username||!/^[a-z0-9-]{3,30}$/.test(entry.username))continue;
      const lastModified=entry.updated_at?new Date(entry.updated_at):null;
      result.push({
        url:origin+"/"+encodeURIComponent(entry.username),
        ...(lastModified&&!Number.isNaN(lastModified.valueOf())?
          {lastModified}:{}),
        changeFrequency:"weekly",
        priority:0.8
      });
    }
  }catch{
    // Sem migração/configuração, manter um sitemap mínimo válido.
  }
  return result;
}
