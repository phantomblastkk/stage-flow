"use client";
import { useAccount } from "@/src/domains/account/account-context";
import type { WorkspaceRole } from "../workspace-navigation";

/** Presentation only; authorization stays in the database. No independent profile query. */
export function useWorkspaceRole(): WorkspaceRole | null {
  const { snapshot } = useAccount();
  const profile = snapshot.profile;
  return snapshot.status === "ready" && profile ? {
    isSinger: profile.is_singer === true, isMusician: profile.is_musician === true,
    isProducer: profile.is_producer === true, ...snapshot.permissions,
  } : null;
}
