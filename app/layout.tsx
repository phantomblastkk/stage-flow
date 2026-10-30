import type { Metadata } from "next";
import "./globals.css";
import "@/src/domains/auth/styles/legacy-auth-forms.css";
import "./styles/legacy-base-responsive.css";
import "@/src/domains/artists/styles/legacy-musician-portfolio.css";
import "./styles/legacy-global-tail.css";
import "@/src/domains/artists/styles/legacy-free-singer.css";
import "./styles/legacy-after-free-singer.css";
import WorkspaceBoundary from "@/src/domains/navigation/components/workspace-boundary";

export const metadata: Metadata = {
  title: "Stage Flow — sua música, sua agenda",
  description: "Organize shows, conecte-se com produtores e divulgue seu trabalho musical em um só lugar.",
  applicationName: "Stage Flow",
  icons: {
    icon: [{ url: "/stageflow-favicon.svg", type: "image/svg+xml" }],
    shortcut: "/stageflow-favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        {process.env.NEXT_PUBLIC_STAGE_FLOW_ENV === "homologation" && (
          <div role="status" style={{ background:"#34234f",color:"#f3eaff",borderBottom:"1px solid #8464b4",padding:"9px 16px",textAlign:"center",fontSize:12,fontWeight:800,letterSpacing:".06em" }}>
            AMBIENTE DE HOMOLOGAÇÃO — DADOS DE TESTE, NÃO É O SITE OFICIAL
          </div>
        )}
        <WorkspaceBoundary>{children}</WorkspaceBoundary>
      </body>
    </html>
  );
}
