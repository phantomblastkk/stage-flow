"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { workspaceRouteTitle } from "../workspace-routes";
import WorkspaceMobileNav from "./workspace-mobile-nav";
import StageRealtimeBridge from "./stage-realtime-bridge";

// Public pages do not mount the workspace or start its authenticated queries.
const WorkspaceRoot = dynamic(() => import("./workspace-root"));

export default function WorkspaceBoundary({ children }: { children: ReactNode }) {
  const path = usePathname();
  const title = workspaceRouteTitle(path);
  // Render a single mobile navigation outside the private workspace frame.
  // Public profiles, authentication, Marketplace and all other routes retain it.
  return <>
    <StageRealtimeBridge/>
    {path !== "/marketplace" && (title || path === "/painel")
      ? <WorkspaceRoot title={title}>{children}</WorkspaceRoot>
      : children}
    <WorkspaceMobileNav/>
  </>;
}
