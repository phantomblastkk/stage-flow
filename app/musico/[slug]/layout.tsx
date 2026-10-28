import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { getStageFlowOrigin } from "@/lib/pro-site-public";

type PublicMusician = {
  name?: string | null;
  slug?: string | null;
  headline?: string | null;
  bio?: string | null;
  city?: string | null;
  instruments?: string[] | null;
  avatar_url?: string | null;
  cover_url?: string | null;
};

// Public metadata must use the same published-only RPC as the visible portfolio.
// Never request the private editor, drafts, fees or authenticated account data.
export const dynamic = "force-dynamic";

function safePublicImage(value: string | null | undefined): string | null {
  if (!value || value.length > 1000) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const origin = getStageFlowOrigin();
  const unavailable: Metadata = {
    metadataBase: new URL(origin),
    title: "Portfólio de músico | Stage Flow",
    robots: { index: false, follow: false, noarchive: true }
  };
  if (!/^[a-z0-9-]{3,30}$/.test(slug)) return unavailable;

  const endpoint = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!endpoint || !anon) return unavailable;

  let musician: PublicMusician;
  try {
    const client = createClient(endpoint, anon, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data, error } = await client.rpc("stage_public_musician_portfolio", {
      p_slug: slug
    });
    if (error || !data || typeof data !== "object") return unavailable;
    musician = data as PublicMusician;
  } catch {
    return unavailable;
  }

  if (musician.slug !== slug || typeof musician.name !== "string"
    || !musician.name.trim()) return unavailable;

  const name = musician.name.trim().slice(0, 90);
  const title = name + " | Músico no Stage Flow";
  const instruments = Array.isArray(musician.instruments)
    ? musician.instruments.filter(item => typeof item === "string").slice(0, 3).join(", ")
    : "";
  const intro = musician.headline || musician.bio || instruments ||
    "Conheça o trabalho e o portfólio deste músico no Stage Flow.";
  const normalized = intro.replace(/\s+/g, " ").trim();
  const description = normalized.length > 160
    ? normalized.slice(0, 157).trimEnd() + "…" : normalized;
  // A published artistic @ is the only canonical address when the account has both roles.
  // The lookup is published-only and a failure preserves the legacy musician URL.
  let publicUsername: string | null = null;
  try {
    const client = createClient(endpoint, anon, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data, error } = await client.rpc("stage_public_artistic_musician", {
      p_slug: slug
    });
    if (!error && data && typeof data.username === "string"
      && /^[a-z0-9-]{3,30}$/.test(data.username)
      && data.is_singer === true) publicUsername = data.username;
  } catch { /* Existing public musician metadata stays valid. */ }
  const canonical = origin + (publicUsername
    ? "/" + encodeURIComponent(publicUsername)
    : "/musico/" + encodeURIComponent(slug));
  const image = safePublicImage(musician.cover_url)
    || safePublicImage(musician.avatar_url);
  const robots = process.env.NEXT_PUBLIC_STAGE_FLOW_ENV === "homologation"
    ? { index: false, follow: false } : { index: true, follow: true };

  return {
    metadataBase: new URL(origin),
    title, description,
    alternates: { canonical },
    robots,
    openGraph: {
      type: "profile", title, description, url: canonical,
      siteName: "Stage Flow", locale: "pt_BR",
      ...(image ? { images: [{ url: image, alt: "Portfólio de " + name }] } : {})
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title, description,
      ...(image ? { images: [image] } : {})
    }
  };
}

export default function PublicMusicianLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
