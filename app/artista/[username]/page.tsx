"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Instagram, Music2, Play, CalendarDays, MapPin, MessageCircle, ArrowLeft, ExternalLink, ChevronLeft, ChevronRight, Mic, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  display_name: string;
  username: string | null;
  bio: string | null;
  city: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  spotify_url: string | null;
  whatsapp: string | null;
};
type Show = {
  id: string;
  title: string;
  description: string | null;
  venue: string | null;
  city: string | null;
  starts_at: string;
  ends_at: string | null;
  status: string;
  show_publicly: boolean;
};

const dateKey = (value: string) => {
  const date = new Date(value);
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
};
const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function ArtistPage() {
  const params = useParams<{ username: string }>();
  const username = String(params.username ?? "").toLowerCase();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [notPublic, setNotPublic] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadPortfolio() {
      const supabase = createClient();
      const { data: artist, error } = await supabase
        .from("profiles")
        .select("id,display_name,username,bio,city,instagram_url,youtube_url,spotify_url,whatsapp")
        .eq("username", username)
        .eq("role", "musician")
        .maybeSingle();
      if (!active) return;
      if (error || !artist) {
        setNotPublic(true);
        setLoading(false);
        return;
      }
      setProfile(artist as Profile);
      const { data: events } = await supabase
        .from("events")
        .select("id,title,description,venue,city,starts_at,ends_at,status,show_publicly")
        .eq("producer_id", artist.id)
        .eq("show_publicly", true)
        .eq("status", "published")
        .gte("starts_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .order("starts_at", { ascending: true });
      if (active) setShows((events ?? []) as Show[]);
      setLoading(false);
    }
    if (username) void loadPortfolio();
    return () => { active = false; };
  }, [username]);

  const name = profile?.display_name || username.replace(/-/g, " ").replace(/\\b\\w/g, (c) => c.toUpperCase());
  const monthLabel = calendarMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const firstWeekday = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const eventDays = useMemo(() => new Set(shows.map(show => dateKey(show.starts_at))), [shows]);
  const visibleShows = selectedDate ? shows.filter(show => dateKey(show.starts_at) === selectedDate) : shows;

  if (loading) return <main><div className="container" style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}><p style={{ color: "var(--muted)" }}><LoaderCircle size={17} style={{ display: "inline", verticalAlign: "middle" }} /> Carregando portfólio...</p></div></main>;

  if (notPublic || !profile) return <main><div className="container"><nav className="nav"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link><Link className="btn btn-quiet" href="/painel"><ArrowLeft size={15}/> Voltar ao painel</Link></nav><section className="feature" style={{ maxWidth: 680, margin: "70px auto" }}><h1>Portfólio não encontrado</h1><p>Não conseguimos encontrar um perfil público com o usuário <strong>@{username}</strong>. Confira se o nome de usuário está configurado e se o perfil está publicado e ativo.</p><Link className="btn btn-primary" href="/painel">Ir ao meu painel</Link></section></div></main>;

  return (
    <main>
      <div className="container">
        <nav className="nav">
          <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
          <Link className="btn btn-quiet" href="/painel"><ArrowLeft size={15}/> Meu painel</Link>
        </nav>
        <section style={{ maxWidth: 820, margin: "48px auto 70px" }}>
          <div style={{ minHeight: 210, borderRadius: 22, background: "radial-gradient(ellipse at 20% 20%,#5d603b,transparent 55%),linear-gradient(120deg,#282c3b,#12151d)", border: "1px solid #303747", display: "grid", placeItems: "center", overflow: "hidden", position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg,#090b10cc,transparent 75%)" }} />
            <div style={{ position: "relative", textAlign: "center", padding: 20 }}><div className="eyebrow"><span className="dot" /> PORTFÓLIO DO ARTISTA</div><h1 style={{ fontSize: 42, margin: "18px 0 4px", letterSpacing: "-1.5px" }}>{name}</h1><p style={{ color: "#d4d8e2", margin: 0 }}>Música ao vivo</p></div>
          </div>
          <div className="profile-demo" style={{ marginTop: 16 }}>
            <div className="avatar">{name.split(" ").map(s => s[0]).slice(0, 2).join("")}</div>
            <div className="profile-copy"><h3>{name}</h3><p><MapPin size={13} style={{ display: "inline", verticalAlign: "middle" }} /> {profile.city || "Cidade não informada"}</p><div className="profile-url">@{profile.username}</div></div>
            <div style={{ display: "flex", gap: 10 }}>
              {profile.instagram_url && <a aria-label="Instagram" className="btn btn-quiet" href={profile.instagram_url} target="_blank" rel="noreferrer"><Instagram size={17}/></a>}
              {profile.youtube_url && <a aria-label="YouTube" className="btn btn-quiet" href={profile.youtube_url} target="_blank" rel="noreferrer"><Play size={17}/></a>}
              {profile.spotify_url && <a aria-label="Spotify" className="btn btn-quiet" href={profile.spotify_url} target="_blank" rel="noreferrer"><Music2 size={17}/></a>}
            </div>
          </div>
          <section className="section" style={{ paddingBottom: 25 }}>
            <div className="section-heading"><h2>Sobre o artista</h2><p>{profile.bio || "Em breve, mais informações sobre este artista."}</p></div>
            <div className="cards">
              <article className="feature"><div className="feature-icon"><CalendarDays/></div><h3>Agenda de shows</h3><p>Acompanhe as próximas apresentações divulgadas pelo artista.</p></article>
              <article className="feature"><div className="feature-icon"><Play/></div><h3>Vídeos e músicas</h3><p>Conteúdos e links musicais do artista.</p></article>
              <article className="feature"><div className="feature-icon"><Music2/></div><h3>Repertório</h3><p>Estilos musicais e informações para contratantes.</p></article>
            </div>
          </section>
          <section className="feature" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
              <div><div className="eyebrow"><span className="dot"/> CALENDÁRIO DE SHOWS</div><h2 style={{ textTransform: "capitalize", margin: "8px 0 0" }}>{monthLabel}</h2></div>
              <div style={{ display: "flex", gap: 8 }}><button type="button" className="btn btn-quiet" aria-label="Mês anterior" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}><ChevronLeft size={18}/></button><button type="button" className="btn btn-quiet" aria-label="Próximo mês" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}><ChevronRight size={18}/></button></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 6, textAlign: "center", fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(day => <div key={day} style={{ padding: "6px 0" }}>{day}</div>)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 6 }}>
              {Array.from({ length: firstWeekday }, (_, i) => <div key={"empty-" + i} />)}
              {Array.from({ length: daysInMonth }, (_, i) => { const day = i + 1; const key = calendarMonth.getFullYear() + "-" + String(calendarMonth.getMonth() + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0"); const hasShow = eventDays.has(key); const selected = selectedDate === key; return <button type="button" key={key} onClick={() => setSelectedDate(selected ? null : key)} style={{ minHeight: 54, padding: "7px 2px", borderRadius: 10, border: selected ? "1px solid var(--lime)" : "1px solid var(--line)", background: selected ? "rgba(198,243,107,.12)" : "var(--panel)", color: "var(--text)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer" }}><span>{day}</span>{hasShow && <Mic size={14} color="#c6f36b" aria-label="Dia com show"/>}</button>; })}
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 0 }}><Mic size={13} style={{ display: "inline", verticalAlign: "middle" }} color="#c6f36b"/> Dias com apresentação pública. Clique numa data para filtrar os shows.</p>
          </section>
          <section className="feature" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 15 }}><h2 style={{ font: "800 24px Manrope", margin: 0 }}>{selectedDate ? "Shows de " + new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR") : "Próximos shows"}</h2><span className="status">AGENDA PÚBLICA</span></div>
            {visibleShows.length === 0 ? <p style={{ color: "var(--muted)", margin: 0 }}>{selectedDate ? "Nenhum show público nesta data." : "Nenhum show público futuro cadastrado no momento."}</p> : visibleShows.map(show => <article className="event" key={show.id} style={{ alignItems: "flex-start" }}><div className="event-date"><div><strong>{new Date(show.starts_at).toLocaleDateString("pt-BR", { day: "2-digit" })}</strong><br/><span>{new Date(show.starts_at).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase()}</span></div></div><div className="event-info"><strong>{show.title}</strong><span style={{ display: "block", marginTop: 5 }}><CalendarDays size={12} style={{ display: "inline", verticalAlign: "middle" }}/> {formatDate(show.starts_at)}</span>{(show.venue || show.city) && <span style={{ display: "block", marginTop: 5 }}><MapPin size={12} style={{ display: "inline", verticalAlign: "middle" }}/> {[show.venue, show.city].filter(Boolean).join(" · ")}</span>}{show.description && <p style={{ color: "var(--muted)", fontSize: 13, margin: "8px 0" }}>{show.description}</p>}</div></article>)}
          </section>
          <section className="cta" style={{ marginTop: 20 }}><div><h2>Quer contratar {name}?</h2><p>Entre em contato para consultar disponibilidade e contratações.</p></div>{profile.whatsapp ? <a className="btn btn-primary" href={"https://wa.me/" + profile.whatsapp.replace(/\\D/g, "")} target="_blank" rel="noreferrer">WhatsApp <MessageCircle size={16}/></a> : <a className="btn btn-primary" href={profile.instagram_url || "mailto:contato@stageflow.com"} target="_blank" rel="noreferrer">Contato profissional <MessageCircle size={16}/></a>}</section>
          <p className="fine" style={{ textAlign: "center" }}><ExternalLink size={12} style={{ display: "inline", verticalAlign: "middle" }}/> Portfólio público do Stage Flow.</p>
        </section>
      </div>
    </main>
  );
}
