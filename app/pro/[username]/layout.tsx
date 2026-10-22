import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getPublishedProSite,
  getStageFlowOrigin,
  publicArtistDescription,
  publicProUrl
} from "@/lib/pro-site-public";

// O crawler recebe dados do snapshot público real, no servidor.
// Despublicar o site ou revogar o Pro remove as tags e bloqueia a rota.
export const dynamic="force-dynamic";

type Props={
  children:React.ReactNode;
  params:Promise<{username:string}>;
};

export async function generateMetadata({params}:Omit<Props,"children">):Promise<Metadata>{
  const {username}=await params;
  const site=await getPublishedProSite(username);
  const origin=getStageFlowOrigin();

  if(!site?.artist){
    return{
      metadataBase:new URL(origin),
      title:"Site profissional indisponível | Stage Flow",
      robots:{index:false,follow:false,noarchive:true}
    };
  }

  const name=(site.artist.name||"Artista").replace(/\s+/g," ").trim().slice(0,90);
  const title=name+" | Site profissional — Stage Flow";
  const description=publicArtistDescription(site);
  const canonical=publicProUrl(username);
  const poster=canonical+"/opengraph-image";

  return{
    metadataBase:new URL(origin),
    title,
    description,
    applicationName:"Stage Flow",
    alternates:{canonical},
    robots:{index:true,follow:true},
    openGraph:{
      type:"profile",
      locale:"pt_BR",
      siteName:"Stage Flow",
      url:canonical,
      title,
      description,
      images:[{
        url:poster,
        width:1200,
        height:630,
        alt:"Site profissional de "+name+" no Stage Flow"
      }]
    },
    twitter:{
      card:"summary_large_image",
      title,
      description,
      images:[poster]
    }
  };
}

export default async function ProArtistLayout({children,params}:Props){
  const {username}=await params;
  const site=await getPublishedProSite(username);
  if(!site?.artist)notFound();
  return children;
}
