"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import WorkspaceSidebar from "./workspace-sidebar";
import { useWorkspaceRole } from "../hooks/use-workspace-role";
import "./workspace-shell.css";

export default function WorkspaceFrame({ title, children }: { title: string; children: ReactNode }) {
  const role = useWorkspaceRole();
  return <div className={"sf-workspace-route" + (role ? " sf-workspace-route-ready" : "")}>
    {role ? <WorkspaceSidebar role={role}/> : null}
    <div className="sf-workspace-route-main">
      <a className="sf-workspace-skip" href="#sf-workspace-content">Ir para o conteúdo</a>
      <div className="sf-workspace-route-bar" aria-label="Localização">
        <Link href="/painel">Início</Link><span aria-hidden="true">/</span><span>{title}</span>
      </div>
      <div id="sf-workspace-content" tabIndex={-1} className="sf-workspace-route-content">{children}</div>
    </div>
  </div>;
}
