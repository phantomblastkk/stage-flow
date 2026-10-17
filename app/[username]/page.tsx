"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CalendarDays, Instagram, LoaderCircle, MapPin, Music2, Play, Share2, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ArtistBookingForm from "@/components/artist-booking-form";

type PublicArtist = {
  name: string;
  username: string;
  bio: string;
  city: string;
  instagram_url: string | null;
  youtube_url: string | null;
  spotify_url: string | null;
  headline?: string;
  accent?: "violet" | "lime" | "cyan";
  avatar_path?: string | null;
  cover_path?: string | null;
};

type PublicEvent = {
  title: string;
  venue: string | null;
  city: string | null;
  starts_at: string;
};

export default function FreeArtistPage() {
  const { username } = useParams<{username: string}>();
  const [artist, setArtist] = useState<PublicArtist | null>(null);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!username) { setLoading(false); return; }
      const supabase = createClient();
      const { data, error } = await supabase.rpc("stage_public_artist_page", {
        p_username: username
      });
      if (!active) return;
      if (error) {
        setProblem("A página não está disponível agora. Confira se a migração de perfis gratuitos foi executada.");
      } else if (data) {
        setArtist(data as PublicArtist);
        const { data: publicEvents } = await supabase.rpc(
          "stage_public_artist_events", { p_username: username }
        );
        if (!active) return;
        setEvents((publicEvents ?? []) as PublicEvent[]);
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [username]);

  const mediaUrl = (path?: string | null) =>
    path ? createClient().storage.from("stage-artist-public").getPublicUrl(path).data.publicUrl : null;
  const accent = artist?.accent === "lime" ? "#c6f36b" : artist?.accent === "cyan" ? "#72dce7" : "#a99bff";
  const themeStyle = { "--artist-free-accent": accent } as CSSProperties;

  async function shareProfile() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: (artist?.name ?? "Artista") + " — Stage Flow", url });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    try { await navigator.clipboard.writeText(url); setCopied(true); }
    catch { setProblem("Não foi possível copiar o link. Copie o endereço da barra do navegador."); }
  }

  if (loading) return <main className="container" style={{ minHeight: "75vh", display: "grid", placeItems: "center" }}>
    <p style={{ display: "flex", alignItems: "center", gap: 9, color: "var(--muted)" }}><LoaderCircle size={18}/> Carregando página do artista...</p>
  </main>;

  return <main>
    <div className="container">
      <nav className="nav">
        <Link href="/" className="brand"><span className="brand-mark">S</span> stage flow</Link>
        <Link href="/" className="btn btn-quiet"><ArrowLeft size={15}/> Início</Link>
      </nav>
      {!artist ? <section className="feature" style={{ maxWidth: 660, margin: "60px auto" }}>
        <div className="eyebrow"><span className="dot"/> PERFIL DE ARTISTA</div>
        <h1 style={{ fontSize: 34, marginTop: 20 }}>Página não encontrada.</h1>
        <p>{problem || "Este artista ainda não publicou seu perfil ou este nome de usuário não existe."}</p>
        <Link className="btn btn-primary" href="/" style={{ marginTop: 16 }}>Voltar ao Stage Flow</Link>
      </section> : <div className="artist-free-page" style={themeStyle}>
        <section className="artist-free-hero">
          {artist.cover_path && <div className="artist-free-cover-photo" style={{ backgroundImage: `url("${mediaUrl(artist.cover_path)}")` }} aria-hidden="true"/>}
          <div className="artist-free-overline">STAGE FLOW / ARTISTA</div>
          <div className="artist-free-monogram">
            {artist.avatar_path
              ? <img src={mediaUrl(artist.avatar_path)!} alt={"Foto de " + artist.name} loading="lazy"/>
              : artist.name.trim().split(/\s+/).slice(0,2).map(x => x[0]?.toUpperCase()).join("")}
          </div>
          <div className="artist-free-intro">
            <div>
              <div className="artist-free-handle">@{artist.username}</div>
              <h1>{artist.name}</h1>
              <p className="artist-free-tagline"><Music2 size={17}/> {artist.headline || "Música ao vivo"}{artist.city && <> <span>·</span> <MapPin size={16}/>{artist.city}</>}</p>
            </div>
            <div className="artist-free-hero-actions">
              <a href="#contratar" className="btn btn-primary">
                <Send size={16}/> Solicitar show
              </a>
              <button type="button" className="btn btn-quiet" onClick={() => void shareProfile()}>
                <Share2 size={16}/>{copied ? "Link copiado!" : "Compartilhar"}
              </button>
            </div>
          </div>
        </section>

        <div className="artist-free-content">
          <section className="artist-free-card">
            <span className="artist-free-label">APRESENTAÇÃO</span>
            <h2>Sobre o artista</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{artist.bio || "Em breve, mais informações sobre este artista."}</p>
            <div className="artist-free-socials">
              {artist.instagram_url && <a href={artist.instagram_url} target="_blank" rel="noopener noreferrer" className="btn btn-quiet"><Instagram size={16}/> Instagram <ArrowUpRight size={14}/></a>}
              {artist.youtube_url && <a href={artist.youtube_url} target="_blank" rel="noopener noreferrer" className="btn btn-quiet"><Play size={16}/> YouTube <ArrowUpRight size={14}/></a>}
              {artist.spotify_url && <a href={artist.spotify_url} target="_blank" rel="noopener noreferrer" className="btn btn-quiet"><Music2 size={16}/> Spotify <ArrowUpRight size={14}/></a>}
            </div>
          </section>

          <section className="artist-free-card">
            <span className="artist-free-label">AGENDA PÚBLICA</span>
            <h2>Próximos shows</h2>
            {events.length === 0 ? <p>Nenhuma apresentação pública futura cadastrada no momento.</p> :
              <div className="artist-free-events">
                {events.map((event, index) => <div className="artist-free-event" key={event.starts_at + event.title + index}>
                  <div className="artist-free-event-date">
                    <strong>{new Date(event.starts_at).toLocaleDateString("pt-BR", { day: "2-digit" })}</strong>
                    <span>{new Date(event.starts_at).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase()}</span>
                  </div>
                  <div>
                    <strong>{event.title}</strong>
                    <span><CalendarDays size={13}/> {new Date(event.starts_at).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" })}</span>
                    {(event.venue || event.city) && <span><MapPin size={13}/> {[event.venue, event.city].filter(Boolean).join(" · ")}</span>}
                  </div>
                </div>)}
              </div>}
          </section>

          <ArtistBookingForm username={artist.username} artistName={artist.name}/>
        </div>
        {problem && <p role="alert" style={{ color: "#ffb5b5", paddingTop: 20 }}>{problem}</p>}
        <footer className="artist-free-footer">
          <span>Perfil público gratuito · stage flow</span>
          <span>A música conecta.</span>
        </footer>
      </div>}
    </div>
  </main>;
}
