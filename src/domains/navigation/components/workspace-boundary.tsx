"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { workspaceRouteTitle } from "../workspace-routes";

// Public pages do not mount the workspace or start its authenticated queries.
const WorkspaceFrame = dynamic(() => import("./workspace-frame"));

export default function WorkspaceBoundary({ children }: { children: ReactNode }) {
  const title = workspaceRouteTitle(usePathname());
  return title ? <WorkspaceFrame title={title}>{children}</WorkspaceFrame> : children;
}
