"use client";

import type { CSSProperties } from "react";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, BriefcaseBusiness,
  CheckCircle2, Clock3, ExternalLink, Headphones, Instagram, MapPin, Mic2,
  Music2, Play, Share2, Sparkles, Wallet, Youtube
} from "lucide-react";
import "./musician-portfolio-polish.css";

export type MusicianTheme = "midnight" | "ivory" | "stage";
export type MusicianAccent = "lime" | "violet" | "coral" | "cyan" | "gold";
export type MusicianLayout = "spotlight" | "minimal";

export type MusicianPortfolio = {
  name: string;
  slug: string;
  headline: string;
  bio: string;
  city: string;
  instruments: string[];
  genres: string[];
  media_url: string | null;
  price_mode: "consult" | "from";
  reference_fee: number | null;
  is_published?: boolean;
  theme: MusicianTheme;
  accent: MusicianAccent;
  layout_style: MusicianLayout;
  avatar_url: string | null;
  cover_url: string | null;
  experience_years: number | null;
  performance_types: string[];
  career_highlights: string[];
  availability_note: string;
  additional_media_urls: string[];
  instagram_url: string | null;
  youtube_url: string | null;
  spotify_url: string | null;
};

export const musicianThemes: { value: MusicianTheme; label: string; description: string }[] = [
  { value: "midnight", label: "Midnight", description: "Escuro e sofisticado" },
  { value: "ivory", label: "Ivory", description: "Claro e minimalista" },
  { value: "stage", label: "Stage", description: "Noite e palco" }
];
export const musicianAccents: { value: MusicianAccent; label: string; color: string }[] = [
  { value: "lime", label: "Lima", color: "#c6f36b" },
  { value: "violet", label: "Violeta", color: "#afa6ff" },
  { value: "coral", label: "Coral", color: "#ffa48f" },
  { value: "cyan", label: "Ciano", color: "#79e3e8" },
  { value: "gold", label: "Dourado", color: "#f3c977" }
];
const accentsDark: Record<MusicianAccent, string> = {
  lime: "#c6f36b", violet: "#afa6ff", coral: "#ffa48f", cyan: "#79e3e8", gold: "#f3c977"
};
const accentsLight: Record<MusicianAccent, string> = {
  lime: "#426711", violet: "#6043af", coral: "#a3432c", cyan: "#006d76", gold: "#83570d"
};

const money = (amount: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "SF";

function safeHttps(input: string | null | undefined): string | null {
  if (!input || input.length > 500) return null;
  try {
    const u = new URL(input);
    return u.protocol === "https:" && !u.username && !u.password ? u.href : null;
  } catch { return null; }
}
function youTubeId(link: string): string | null {
  try {
    const url = new URL(link);
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);
    let id: string | null = null;
    if (host === "youtu.be" || host === "www.youtu.be") id = parts[0] || null;
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
      if (parts[0] === "watch") id = url.searchParams.get("v");
      else if (["shorts", "live", "embed"].includes(parts[0])) id = parts[1] || null;
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}

type Props = { portfolio: MusicianPortfolio; preview?: boolean; onShare?: () => void };

export default function MusicianPortfolioView({ portfolio, preview = false, onShare }: Props) {
  const theme: MusicianTheme = musicianThemes.some(t => t.value === portfolio.theme)
    ? portfolio.theme : "midnight";
  const accent: MusicianAccent = musicianAccents.some(a => a.value === portfolio.accent)
    ? portfolio.accent : "lime";
  const layout: MusicianLayout = portfolio.layout_style === "minimal" ? "minimal" : "spotlight";
  const themeColor = theme === "ivory" ? accentsLight[accent] : accentsDark[accent];

  const style = {
    "--mp-accent": themeColor,
    "--mp-on-accent": theme === "ivory" ? "#fff" : "#12151a"
  } as CSSProperties;
  const instruments = Array.isArray(portfolio.instruments) ? portfolio.instruments : [];
  const genres = Array.isArray(portfolio.genres) ? portfolio.genres : [];
  const performances = Array.isArray(portfolio.performance_types) ? portfolio.performance_types : [];
  const highlights = Array.isArray(portfolio.career_highlights) ? portfolio.career_highlights : [];
  const extra = Array.isArray(portfolio.additional_media_urls) ? portfolio.additional_media_urls : [];
  const workLinks = Array.from(new Set([portfolio.media_url, ...extra]
    .map(link => safeHttps(link))
    .filter((url): url is string => Boolean(url)))).slice(0, 3);
  const socials = [
    { url: safeHttps(portfolio.instagram_url), label: "Instagram", Icon: Instagram },
    { url: safeHttps(portfolio.youtube_url), label: "YouTube", Icon: Youtube },
    { url: safeHttps(portfolio.spotify_url), label: "Spotify", Icon: Headphones }
  ].filter((item): item is { url: string; label: string; Icon: typeof Instagram } => Boolean(item.url));
  const title = portfolio.headline?.trim() || instruments.slice(0, 2).join(" • ") || "Músico profissional";
  const experience = Number.isInteger(portfolio.experience_years) && portfolio.experience_years! >= 0
    ? portfolio.experience_years : null;
  const hasPhoto = Boolean(safeHttps(portfolio.avatar_url));
  const hasBanner = Boolean(safeHttps(portfolio.cover_url));
  const workAnchor = "mp-trabalhos-" + (portfolio.slug || "preview");

  return <article
    className={"mp-shell mp-polished mp-theme-" + theme + " mp-layout-" + layout +
      (preview ? " mp-preview" : "")}
    style={style} aria-label={"Portfólio de " + portfolio.name}
  >
    <header className="mp-hero">
      {hasBanner && <div className="mp-hero-photo"
        style={{ backgroundImage: "url(" + JSON.stringify(portfolio.cover_url) + ")" }}
        aria-hidden="true"/>}
      <div className="mp-hero-grid" aria-hidden="true"/>
      <div className="mp-hero-content">
        <div className="mp-kicker">
          <span className="mp-pulse"/>
          STAGE FLOW / PORTFÓLIO DE MÚSICO
          <span className="mp-free-stamp">PERFIL GRATUITO</span>
        </div>
        <div className="mp-identity">
          <div className="mp-avatar">
            {hasPhoto
              ? <img src={portfolio.avatar_url!} alt={"Foto de " + portfolio.name} loading="lazy"/>
              : <span>{initials(portfolio.name)}</span>}
          </div>
          <div className="mp-identity-copy">
            <p className="mp-overline">MÚSICO INDEPENDENTE</p>
            <h1>{portfolio.name || "Seu nome artístico"}</h1>
            <p className="mp-headline">{title}</p>
            <div className="mp-hero-meta">
              {portfolio.city && <span><MapPin size={15}/> {portfolio.city}</span>}
              {instruments[0] && <span><Music2 size={15}/> {instruments[0]}</span>}
              {experience !== null && <span><Clock3 size={15}/> {experience === 0 ? "Início de carreira"
                : experience === 1 ? "1 ano de experiência" : experience + " anos de experiência"}</span>}
            </div>
          </div>
        </div>
        <div className="mp-hero-footer">
          <div className="mp-hero-buttons">
            {workLinks.length > 0 && <a href={"#" + workAnchor} className="mp-action-primary">
              <Play size={16} fill="currentColor"/> Ouvir meu trabalho <ArrowDownRight size={16}/>
            </a>}
            {socials.find(s => s.label === "Instagram") && <a
              className="mp-hero-secondary" href={socials.find(s => s.label === "Instagram")!.url}
              target="_blank" rel="noopener noreferrer">
              <Instagram size={16}/> Instagram <ArrowUpRight size={15}/>
            </a>}
            {!preview && onShare && <button type="button" className="mp-hero-secondary"
              onClick={onShare}><Share2 size={16}/> Compartilhar</button>}
          </div>
          <span className="mp-hero-index">PORTFÓLIO / 01</span>
        </div>
      </div>
    </header>

    <div className="mp-main">
      <nav className="mp-section-nav" aria-label="Seções do portfólio">
        <a href={"#mp-sobre-" + (portfolio.slug || "preview")}>Sobre</a>
        <a href={"#mp-instrumentos-" + (portfolio.slug || "preview")}>Instrumentos</a>
        {workLinks.length > 0 && <a href={"#" + workAnchor}>Trabalhos</a>}
        {highlights.length > 0 && <a href={"#mp-trajetoria-" + (portfolio.slug || "preview")}>Trajetória</a>}
      </nav>

      <section className="mp-intro-row" id={"mp-sobre-" + (portfolio.slug || "preview")}>
        <div className="mp-about-copy">
          <span className="mp-section-kicker">PRAZER, EU SOU</span>
          <h2>Minha <span>história.</span></h2>
          <p className="mp-description">{portfolio.bio ||
            "Conte aqui sua trajetória, os projetos em que participa e sua experiência nos palcos."}</p>
          {genres.length > 0 && <div className="mp-genre-list">
            {genres.map((genre,i) => <span key={genre + i}>{genre}</span>)}
          </div>}
          {(experience !== null || performances.length > 0) && <div className="mp-profile-facts">
            {experience !== null && <div>
              <Clock3 size={19}/>
              <strong>{experience === 0 ? "Começando" : experience + (experience === 1 ? " ano" : " anos")}</strong>
              <small>Experiência na música</small>
            </div>}
            {performances.length > 0 && <div>
              <BriefcaseBusiness size={19}/>
              <strong>{performances.length} {performances.length === 1 ? "formato" : "formatos"}</strong>
              <small>Tipos de apresentação</small>
            </div>}
          </div>}
        </div>
        <aside className="mp-fee-card">
          <div className="mp-fee-label"><Wallet size={16}/> CACHÊ DE REFERÊNCIA</div>
          <strong>{portfolio.price_mode === "from" && portfolio.reference_fee != null
            ? <><small>A partir de</small> {money(portfolio.reference_fee)}</> : "Sob consulta"}</strong>
          <p>O valor final depende do evento e é combinado diretamente com o organizador.</p>
          <span className="mp-fee-foot"><BadgeCheck size={15}/> Negociação individual</span>
          {portfolio.availability_note?.trim() && <div className="mp-availability">
            <CheckCircle2 size={17}/><span>{portfolio.availability_note.trim()}</span>
          </div>}
        </aside>
      </section>

      <section className="mp-skills" id={"mp-instrumentos-" + (portfolio.slug || "preview")}>
        <div className="mp-section-title">
          <div>
            <span className="mp-section-kicker">MEUS INSTRUMENTOS</span>
            <h2>O que eu <span>toco.</span></h2>
          </div>
          <Music2 size={29} aria-hidden="true"/>
        </div>
        <div className="mp-instrument-grid">
          {(instruments.length ? instruments : ["Instrumento principal"]).map((name,index) =>
            <div className="mp-instrument-card" key={name + index}>
              <span className="mp-instrument-index">{String(index + 1).padStart(2, "0")}</span>
              <strong>{name}</strong>
              <Music2 size={19}/>
            </div>)}
        </div>
        {performances.length > 0 && <div className="mp-formats">
          <span>FORMATOS DE APRESENTAÇÃO</span>
          <div>{performances.map((item,i) => <span key={item + i}><CheckCircle2 size={14}/>{item}</span>)}</div>
        </div>}
      </section>

      {highlights.length > 0 && <section className="mp-career"
        id={"mp-trajetoria-" + (portfolio.slug || "preview")}>
        <div>
          <span className="mp-section-kicker">POR ONDE JÁ PASSEI</span>
          <h2>Experiências e <span>projetos.</span></h2>
        </div>
        <div className="mp-career-list">
          {highlights.map((item,i) => <div key={item + i}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            <strong>{item}</strong>
            <CheckCircle2 size={17}/>
          </div>)}
        </div>
      </section>}

      <section className="mp-work" id={workAnchor}>
        <div className="mp-work-top">
          <div>
            <span className="mp-section-kicker">SOM DE VERDADE</span>
            <h2>Meu <span>trabalho.</span></h2>
            <p>Vídeos, apresentações e registros da minha música.</p>
          </div>
          <Sparkles size={23} aria-hidden="true"/>
        </div>
        {workLinks.length > 0 ? <div className="mp-work-grid">
          {workLinks.map((url,index) => {
            const id = youTubeId(url);
            return <a key={url} className="mp-work-card" href={url}
              target="_blank" rel="noopener noreferrer"
              aria-label={"Abrir apresentação " + (index+1) + " em nova aba"}>
              <div className="mp-work-thumb">
                {id ? <img src={"https://i.ytimg.com/vi/" + id + "/hqdefault.jpg"}
                  alt={"Miniatura da apresentação " + (index + 1)} loading="lazy"/> :
                  <div className="mp-work-art"><Music2 size={38}/></div>}
                <span className="mp-work-play">{id ? <Play size={20} fill="currentColor"/> :
                  <ExternalLink size={20}/>}</span>
              </div>
              <div className="mp-work-card-bottom">
                <div>
                  <small>{id ? "VÍDEO NO YOUTUBE" : "PORTFÓLIO EXTERNO"}</small>
                  <strong>Apresentação {String(index + 1).padStart(2,"0")}</strong>
                </div>
                <ArrowUpRight size={19}/>
              </div>
            </a>;
          })}
        </div> : <div className="mp-work-empty">
          <Play size={19}/> {preview
            ? "Adicione links de vídeos no editor para mostrar suas apresentações aqui."
            : "Vídeos e apresentações serão adicionados em breve."}
        </div>}
      </section>

      {socials.length > 0 && <section className="mp-social-section">
        <div>
          <span className="mp-section-kicker">ACOMPANHE MEU SOM</span>
          <h2>Me encontre <span>online.</span></h2>
        </div>
        <div className="mp-social-grid">
          {socials.map(({url,label,Icon}) => <a key={label} href={url}
            target="_blank" rel="noopener noreferrer">
            <Icon size={20}/><span>{label}</span><ArrowUpRight size={16}/>
          </a>)}
        </div>
      </section>}

      <footer className="mp-bottom">
        <div><span className="mp-end-mark">SF.</span><span>UM ESPAÇO GRATUITO PARA QUEM VIVE DE MÚSICA</span></div>
        {!preview && onShare && <button type="button" onClick={onShare} className="mp-share">
          Compartilhar portfólio <Share2 size={15}/></button>}
      </footer>
    </div>
  </article>;
}
