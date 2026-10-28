import type {MetadataRoute} from "next";
import {getStageFlowOrigin} from "@/lib/pro-site-public";

/** Only explicitly published artist and venue pages should be indexed. */
export default function robots():MetadataRoute.Robots{
 const origin=getStageFlowOrigin();
 if(process.env.NEXT_PUBLIC_STAGE_FLOW_ENV==="homologation"){
  return {rules:[{userAgent:"*",disallow:"/"}]};
 }
 return {
  rules:[{userAgent:"*",allow:"/",disallow:[
   "/perfil-artistico","/perfis","/contratar",
   "/api/","/auth/","/login","/cadastro","/painel",
   "/admin/","/assinatura","/configuracoes","/minha-conta",
   "/minha-disponibilidade","/meu-desempenho","/meu-portfolio",
   "/meu-perfil-artistico","/meus-convites","/meus-shows",
   "/notificacoes","/conversas","/convites","/financeiro",
   "/eventos","/equipes","/parceiros","/marketplace",
   "/shows-recorrentes","/locais","/homologacao","/pro/"
  ]}],
  sitemap:origin+"/sitemap.xml",host:origin
 };
}
