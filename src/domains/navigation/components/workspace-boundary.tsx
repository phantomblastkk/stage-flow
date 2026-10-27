"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { workspaceRouteTitle } from "../workspace-routes";

// Public pages do not mount the workspace or start its authenticated queries.
const WorkspaceRoot = dynamic(() => import("./workspace-root"));

export default function WorkspaceBoundary({ children }: { children: ReactNode }) {
  const path = usePathname();
  const title = workspaceRouteTitle(path);
  return path !== "/marketplace" && (title || path === "/painel") ? <WorkspaceRoot title={title}>{children}</WorkspaceRoot> : children;
}
