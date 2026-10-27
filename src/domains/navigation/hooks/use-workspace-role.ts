"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WorkspaceRole } from "../workspace-navigation";

/** Presentation only. Page queries/RPCs remain responsible for authorization. */
export function useWorkspaceRole() {
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [revision, setRevision] = useState(0);
  const identity = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Keep callback synchronous: never await Supabase calls under the auth lock.
      if (event === "INITIAL_SESSION") return;
      const next = session?.user.id ?? null;
      if (next !== identity.current || event === "USER_UPDATED") {
        identity.current = next;
        setRole(null);
        setRevision(value => value + 1);
      }
    });
    async function load() {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!active || error || !user) return;
      identity.current = user.id;
      const [profile, partner, owner] = await Promise.all([
        supabase.from("profiles").select("is_singer,is_musician,is_producer").eq("id", user.id).maybeSingle(),
        supabase.rpc("stage_venue_partner_access"),
        supabase.rpc("stage_owner_admin_status"),
      ]);
      if (!active || profile.error || !profile.data) return;
      const access = partner.data as { status?: string; items?: unknown[] } | null;
      setRole({
        isSinger: profile.data.is_singer === true,
        isMusician: profile.data.is_musician === true,
        isProducer: profile.data.is_producer === true,
        isOwnerAdmin: !owner.error && owner.data === true,
        partnerHouseCount: !partner.error && access?.status === "ok" ? access.items?.length ?? 0 : 0,
      });
    }
    void load().catch(() => { /* Navigation failure must not hide the page or sign out. */ });
    return () => { active = false; subscription.unsubscribe(); };
  }, [revision]);

  return role;
}
