"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, CalendarDays, ExternalLink, Instagram, MapPin, MessageCircle,
  Music2, ShieldCheck, Sparkles, Vote
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./venue-public.css";

type PublicEvent = { id: string; title: string; starts_at: string };
type PublicVenue = {
  id: string; name: string; slug: string; description: string; address: string | null;
  city: string | null; state: string | null; instagram_url: string | null;
  whatsapp: string | null; logo_path: string | null; cover_path: string | null;
  is_partner: boolean; events: PublicEvent[];
};

function mediaUrl(path: string | null) {
  if (!path) return "";
  return createClient().storage.from("stage-venue-media").getPublicUrl(path).data.publicUrl;
}
function showDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric",
    month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
    .format(new Date(date));
}

export default function CasaPublicaPage() {
  const params = useParams<{slug: string}>();
  const slug = params.slug;
  const [venue, setVenue] = useState<PublicVenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
        if (active) { setLoading(false); setError("Página não encontrada."); }
        return;
      }
      try {
        const { data, error: queryError } = await createClient().rpc("stage_public_venue", {p_slug: slug});
        if (!active) return;
        if (queryError) throw queryError;
        if (!data) { setError("Esta casa ainda não possui uma página oficial publicada."); return; }
        setVenue(data as PublicVenue);
      } catch {
        if (active) setError("Não foi possível carregar esta página agora.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [slug]);

  return <main className="venue-public"><div className="container">
    <nav className="nav venue-public-nav">
      <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
      <Link href="/" className="btn btn-quiet"><ArrowLeft size={16}/> Stage Flow</Link>
    </nav>
    {loading ? <div className="venue-public-empty">Carregando perfil da casa...</div> :
      !venue ? <section className="venue-public-empty">
        <Music2 size={35}/><h1>Casa não encontrada.</h1>
        <p>{error}</p>
        <Link href="/" className="btn btn-primary">Voltar ao Stage Flow</Link>
      </section> :
      <>
        <div className="venue-public-cover">
          {venue.cover_path ? <img src={mediaUrl(venue.cover_path)} alt={"Capa de " + venue.name}/> :
            <div className="venue-public-cover-pattern"><Music2 size={52}/></div>}
        </div>
        <section className="venue-public-identity">
          <div className="venue-public-logo">
            {venue.logo_path ? <img src={mediaUrl(venue.logo_path)} alt={"Logo de " + venue.name}/> :
              <Music2 size={32}/>}
          </div>
          <div className="venue-public-identity-copy">
            <div className="venue-public-tags"><span><ShieldCheck size={13}/> Perfil oficial</span>
              {venue.is_partner && <span className="partner"><Sparkles size={13}/> Parceiro Stage Flow</span>}</div>
            <h1>{venue.name}</h1>
            <p><MapPin size={15}/>{[venue.city, venue.state].filter(Boolean).join(" · ")}
              {venue.address ? " — " + venue.address : ""}</p>
          </div>
        </section>
        <div className="venue-public-layout">
          <div>
            <section className="venue-public-section">
              <div className="venue-public-heading"><CalendarDays size={20}/><h2>Próximos shows</h2></div>
              {venue.events?.length ? <div className="venue-public-events">
                {venue.events.map((event) => <article key={event.id} className="venue-public-event">
                  <span className="venue-public-event-icon"><Music2 size={21}/></span>
                  <div><h3>{event.title}</h3><p>{showDate(event.starts_at)}</p></div>
                </article>)}
              </div> : <p className="venue-public-placeholder">
                A programação oficial ainda não foi publicada. Volte em breve para conferir os próximos shows.
              </p>}
              <p className="fine">São exibidos somente shows publicados e vinculados a esta casa no Stage Flow.</p>
            </section>
            <section className="venue-public-section">
              <div className="venue-public-heading"><Vote size={20}/><h2>Sugestões do público</h2></div>
              <p className="venue-public-placeholder">Em breve você poderá sugerir grupos e participar das votações semanais desta casa.</p>
            </section>
          </div>
          <aside className="venue-public-side">
            <section className="venue-public-section">
              <h2>Sobre a casa</h2>
              <p>{venue.description || "Conheça nossa programação e descubra os próximos eventos nesta casa."}</p>
              <div className="venue-public-links">
                {venue.instagram_url && <a href={venue.instagram_url} target="_blank" rel="noopener noreferrer">
                  <Instagram size={17}/> Instagram <ExternalLink size={14}/></a>}
                {venue.whatsapp && <a href={"https://wa.me/" + venue.whatsapp.replace(/\D/g,"")}
                    target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={17}/> WhatsApp <ExternalLink size={14}/></a>}
              </div>
            </section>
          </aside>
        </div>
        <footer className="venue-public-footer">Página oficial de {venue.name} · Feito com Stage Flow</footer>
      </>}
  </div></main>;
}
