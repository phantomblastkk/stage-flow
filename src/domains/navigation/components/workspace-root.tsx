"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AccountProvider, useAccount } from "@/src/domains/account/account-context";
import { Button, LoadingState } from "@/src/components/ui";
import WorkspaceFrame from "./workspace-frame";
import StageRealtimeBridge from "./stage-realtime-bridge";

function PrivateAccountBoundary({ children }: { children: ReactNode }) {
  const { snapshot, refresh } = useAccount();
  const router = useRouter();
  const path = usePathname();
  const previousPath = useRef(path);
  useEffect(() => {
    const previous = previousPath.current;previousPath.current = path;
    if (previous !== path && (previous.startsWith("/meu-portfolio") || previous.startsWith("/meu-perfil-artistico"))) void refresh();
  }, [path, refresh]);
  useEffect(() => {
    if (snapshot.status === "signed_out") router.replace("/login");
  }, [snapshot.status, router]);
  if (snapshot.status === "loading" || snapshot.status === "signed_out")
    return <LoadingState label="Carregando sua conta…"/>;
  if (snapshot.status === "error" || !snapshot.user || !snapshot.profile) return <main className="container">
    <div className="sf-workspace-error" role="alert">{snapshot.error || "Não foi possível carregar sua conta."}</div>
    <Button disabled={snapshot.refreshing} onClick={() => void refresh()}>Tentar novamente</Button>
  </main>;
  // Auth identity changes remount private descendants, clearing forms, messages and financial state.
  return <div key={snapshot.user.id + ":" + snapshot.epoch}>
    <StageRealtimeBridge/>
    {snapshot.error && <div className="sf-workspace-error" role="alert">{snapshot.error}
      <Button variant="ghost" disabled={snapshot.refreshing} onClick={() => void refresh()}>Tentar novamente</Button>
    </div>}
    {children}
  </div>;
}
export default function WorkspaceRoot({ title, children }: { title: string | null; children: ReactNode }) {
  return <AccountProvider><PrivateAccountBoundary>
    {title ? <WorkspaceFrame title={title}>{children}</WorkspaceFrame> : children}
  </PrivateAccountBoundary></AccountProvider>;
}
