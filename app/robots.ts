import type { MetadataRoute } from "next";
import { getStageFlowOrigin } from "@/lib/pro-site-public";

export default function robots():MetadataRoute.Robots{
  const origin=getStageFlowOrigin();
  return{
    rules:[
      {
        userAgent:"*",
        allow:"/",
        disallow:[
          "/api/",
          "/auth/",
          "/login",
          "/cadastro",
          "/painel",
          "/configuracoes",
          "/meu-perfil-artistico",
          "/meu-perfil",
          "/meus-convites",
          "/eventos",
          "/marketplace"
        ]
      }
    ],
    sitemap:origin+"/sitemap.xml",
    host:origin
  };
}
