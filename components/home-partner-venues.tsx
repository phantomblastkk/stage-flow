"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Building2, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type PartnerVenue = {
  id: string;
  name: string;
  slug: string | null;
  logo_path: string | null;
};

function PartnerLogo({ venue }: { venue: PartnerVenue }) {
  const [broken, setBroken] = useState(false);
  const validLogo = venue.logo_path &&
    venue.logo_path.startsWith(venue.id + "/logo/") &&
    /\.(jpe?g|png|webp)$/i.test(venue.logo_path);
  const url = validLogo && !broken
    ? createClient().storage.from("stage-venue-media").getPublicUrl(venue.logo_path!).data.publicUrl
    : null;

  return <span className="home-partner-logo">
    {url
      ? <img src={url} alt={`Logo de ${venue.name}`} loading="lazy" onError={() => setBroken(true)} />
      : <Building2 size={30} aria-hidden="true" />}
  </span>;
}

export default function HomePartnerVenues() {
  const [venues, setVenues] = useState<PartnerVenue[]>([]);
  const [ready,setReady]=useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data, error } = await createClient().rpc("stage_public_partner_venues",{
          p_limit:12
        });
        if (error) throw error;
        if (active) setVenues(((Array.isArray(data)?data:[]) as PartnerVenue[]).filter(
          (item): item is PartnerVenue => Boolean(item.id && item.name && item.slug &&
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug))
        ));
      } catch {
        // A home segue utilizável mesmo quando o módulo de casas não está habilitado.
        if (active) setVenues([]);
      }finally{
        if(active)setReady(true);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  if(!ready)return null;

  return <section className="home-partners" aria-labelledby="home-partners-title">
    <div className="home-partners-heading">
      <div>
        <span className="home-kicker"><Sparkles size={14} aria-hidden="true"/> CONHEÇA QUEM ESTÁ COM A GENTE</span>
        <h2 id="home-partners-title">Casas parceiras <span>Stage Flow.</span></h2>
        <p>Espaços que fazem a música acontecer. Conheça as casas e acompanhe a programação de cada uma.</p>
      </div>
    </div>
    {venues.length===0?<div className="home-partner-empty">
      <Building2 size={28} aria-hidden="true"/>
      <div><strong>Nossos próximos palcos parceiros vêm aí.</strong>
       <p>As casas aparecem aqui quando seu perfil oficial está aprovado, publicado e marcado como parceiro pelo StageFlow.</p>
      </div>
    </div>:<div className="home-partners-grid">
      {venues.map(venue => <Link className="home-partner-card"
        href={"/casa/" + venue.slug} key={venue.id}
        aria-label={"Conhecer a programação de " + venue.name}>
        <PartnerLogo venue={venue}/>
        <span className="home-partner-name">{venue.name}</span>
        <span className="home-partner-arrow"><ArrowUpRight size={18} aria-hidden="true"/></span>
      </Link>)}
    </div>}
  </section>;
}
