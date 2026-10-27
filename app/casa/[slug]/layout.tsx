import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import {getStageFlowOrigin} from "@/lib/pro-site-public";

type PublicVenue = {
  slug: string;
  name: string;
  description?: string | null;
  city?: string | null;
  state?: string | null;
  logo_path?: string | null;
  cover_path?: string | null;
};

const unavailable: Metadata = {
  title: "Casa de show indisponível | Stage Flow",
  robots: { index: false, follow: false }
};

// Only a published official venue may get public-facing social metadata.
// This read uses the anon key and the same approved-only RPC as the public page.
export async function generateMetadata({
  params
}: {
  params: Promise<{slug:string}>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!slug || slug.length > 80 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return unavailable;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return unavailable;

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data, error } = await supabase.rpc("stage_public_venue", {p_slug:slug});
    const venue = data as PublicVenue | null;
    if (error || !venue || venue.slug !== slug || !venue.name) return unavailable;

    const title = venue.name + " | Programação de shows | Stage Flow";
    const where = [venue.city,venue.state].filter(Boolean).join(" · ");
    const description = (venue.description?.trim() ||
      ("Conheça " + venue.name + (where ? " em " + where : "") +
        ". Veja a agenda pública de shows, flyers e informações para visitar a casa."))
      .slice(0,180);

    const imagePath = [venue.cover_path,venue.logo_path].find(path=>
      typeof path === "string" &&
      /^[0-9a-f-]{36}\/(cover|logo)\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(path));
    const imageUrl = imagePath
      ? supabase.storage.from("stage-venue-media").getPublicUrl(imagePath).data.publicUrl
      : null;

    const origin=getStageFlowOrigin();
    const canonical=origin+"/casa/"+encodeURIComponent(slug);
    return {
      metadataBase:new URL(origin),
      title, description,
      alternates:{canonical},
      openGraph: {
        type: "website", title, description, url:canonical,locale:"pt_BR",siteName: "Stage Flow",
        ...(imageUrl ? {images:[{url:imageUrl,alt:"Imagem oficial de "+venue.name}]}:{})
      },
      twitter: {
        card:imageUrl?"summary_large_image":"summary",title,description,
        ...(imageUrl ? {images:[imageUrl]}:{})
      },
      robots: process.env.NEXT_PUBLIC_STAGE_FLOW_ENV === "homologation"
        ? {index:false,follow:false}
        : {index:true,follow:true}
    };
  } catch {
    // A temporary network failure must not generate a fake venue profile.
    return unavailable;
  }
}

export default function PublicVenueLayout({children}:Readonly<{children:React.ReactNode}>) {
  return children;
}
