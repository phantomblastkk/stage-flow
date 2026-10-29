"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Only the owner of a published musician portfolio sees this shortcut.
 * Do not infer ownership from a public slug or from a local user name:
 * the private RPC resolves the current authenticated user's portfolio.
 */
export default function MusicianOwnerEditButton({ slug }: { slug: string }) {
  const [ownedSlug, setOwnedSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    let generation = 0;
    const client = createClient();
    setOwnedSlug(null);

    async function checkOwner() {
      const current = ++generation;
      try {
        const { data: authData, error: authError } = await client.auth.getUser();
        if (!active || current !== generation || authError || !authData.user) return;
        const { data, error } = await client.rpc("stage_my_musician_portfolio");
        if (!active || current !== generation || error) return;
        if (data?.is_published === true && data?.slug === slug) setOwnedSlug(slug);
        else setOwnedSlug(null);
      } catch {
        if (active && current === generation) setOwnedSlug(null);
      }
    }

    void checkOwner();
    const { data: listener } = client.auth.onAuthStateChange(event => {
      if (!active) return;
      if (event === "SIGNED_OUT") {
        generation++;
        setOwnedSlug(null);
      } else if (event === "SIGNED_IN") {
        // Run Supabase calls after the auth event callback exits.
        queueMicrotask(() => { if (active) void checkOwner(); });
      }
    });
    return () => {
      active = false;
      generation++;
      listener.subscription.unsubscribe();
    };
  }, [slug]);

  if (!slug || ownedSlug !== slug) return null;
  return <Link href="/perfil-artistico?aba=instrumentista" className="premium-site-owner-edit">
    <Pencil size={17} aria-hidden="true" /> Editar meu perfil
  </Link>;
}
