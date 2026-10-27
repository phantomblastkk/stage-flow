import type {Metadata} from "next";
import {getStageFlowOrigin} from "@/lib/pro-site-public";

export async function generateMetadata({params}:{
  params:Promise<{username:string}>;
}):Promise<Metadata>{
  const {username}=await params;
  return{
    metadataBase:new URL(getStageFlowOrigin()),
    title:"Perfil de cantor | Stage Flow",
    alternates:{canonical:"/"+encodeURIComponent(username)},
    robots:{index:false,follow:true}
  };
}

// Não fazer notFound por falta de assinatura Pro:
// /pro/usuario precisa continuar redirecionando para /usuario.
export default function LegacyProLayout({children}:Readonly<{children:React.ReactNode}>){
  return children;
}
