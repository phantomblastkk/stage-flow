"use client";

import {useEffect,useState,type CSSProperties} from "react";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, BriefcaseBusiness,
  CheckCircle2, Clock3, ExternalLink, Headphones, Instagram, MapPin, Mic2,
  Music2, Play, Share2, Sparkles, Wallet, Youtube, MessageCircle, CalendarCheck2
} from "lucide-react";
import "./musician-portfolio-polish.css";
import StageVerifiedBadge from "@/components/stage-verified-badge";
import {distinctPublicBiography} from "@/lib/profile-presentation";
import {publicInstagramProfile} from "@/lib/artist-social";
import {whatsappBookingUrl,type PublicBookingContact} from "@/lib/booking-contact";

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
  { value: "violet", label: "Violeta", color: "#afa6ff" },
  { value: "coral", label: "Coral", color: "#ffa48f" },
  { value: "cyan", label: "Ciano", color: "#79e3e8" },
  { value: "gold", label: "Dourado", color: "#f3c977" }
];
const accentsDark: Record<MusicianAccent, string> = {
  lime: "#afa6ff", violet: "#afa6ff", coral: "#ffa48f", cyan: "#79e3e8", gold: "#f3c977"
};
const accentsLight: Record<MusicianAccent, string> = {
  lime: "#6043af", violet: "#6043af", coral: "#a3432c", cyan: "#006d76", gold: "#83570d"
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

type Props = { portfolio: MusicianPortfolio; preview?: boolean; onShare?: () => void; instanceId?: string; verified?: boolean; bookingContact?:PublicBookingContact|null };

export default function MusicianPortfolioView({ portfolio, preview = false, onShare, instanceId, verified = false, bookingContact=null }: Props) {
  const [playingVideo,setPlayingVideo]=useState<string|null>(null);
  const [photoBroken,setPhotoBroken]=useState(false);
  useEffect(()=>{setPhotoBroken(false);},[portfolio.avatar_url]);
  const theme: MusicianTheme = musicianThemes.some(t => t.value === portfolio.theme)
    ? portfolio.theme : "midnight";
  // Legacy lime portfolios remain valid in storage, but never render neon green.
  const accent: MusicianAccent = portfolio.accent === "lime" ? "violet" :
    musicianAccents.some(a => a.value === portfolio.accent) ? portfolio.accent : "violet";
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
    .filter((url): url is string => Boolean(url)))).slice(0, 5);
  const instagram=publicInstagramProfile(portfolio.instagram_url);
  const socials = [
    { url: instagram?.url||null, label: "Instagram", Icon: Instagram },
    { url: safeHttps(portfolio.youtube_url), label: "YouTube", Icon: Youtube },
    { url: safeHttps(portfolio.spotify_url), label: "Spotify", Icon: Headphones }
  ].filter((item): item is { url: string; label: string; Icon: typeof Instagram } => Boolean(item.url));
  const title = portfolio.headline?.trim() || instruments.slice(0, 2).join(" • ") || "Músico profissional";
  const biography=distinctPublicBiography(portfolio.headline,portfolio.bio);
  const experience = Number.isInteger(portfolio.experience_years) && portfolio.experience_years! >= 0
    ? portfolio.experience_years : null;
  const hasPhoto = Boolean(safeHttps(portfolio.avatar_url))&&!photoBroken;
  const hasBanner = Boolean(safeHttps(portfolio.cover_url));
  const directBooking=bookingContact?.mode==="whatsapp"
    ?whatsappBookingUrl(bookingContact.phone,bookingContact.greeting,portfolio.name)
    :bookingContact?.mode==="instagram"?instagram?.url||null
    :(bookingContact===null||bookingContact.mode==="auto")?instagram?.url||null:null;
  const bookingLabel=bookingContact?.mode==="whatsapp"?"Contratar pelo WhatsApp":"Chamar o músico";
  const suffix = instanceId || portfolio.slug || "preview";
  const workAnchor = "mp-trabalhos-" + suffix;
  const sectionAnchor = (section: string) => "mp-" + section + "-" + suffix;

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
              ? <img src={portfolio.avatar_url!} alt={"Foto de " + portfolio.name} loading="lazy" onError={()=>setPhotoBroken(true)}/>
              : <span>{initials(portfolio.name)}</span>}
          </div>
          <div className="mp-identity-copy">
            <p className="mp-overline">MÚSICO INDEPENDENTE</p>
            <h1>{portfolio.name || "Seu nome artístico"}{verified&&<StageVerifiedBadge compact/>}</h1>
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
            {!preview&&directBooking&&<a className="mp-action-booking" href={directBooking}
              target="_blank" rel="noopener noreferrer">
              {bookingContact?.mode==="whatsapp"?<MessageCircle size={18}/>:<CalendarCheck2 size={18}/>}
              {bookingLabel} <ArrowUpRight size={16}/>
            </a>}
            {workLinks.length > 0 && <a href={"#" + workAnchor} className="mp-action-primary">
              <Play size={16} fill="currentColor"/> Ouvir meu trabalho <ArrowDownRight size={16}/>
            </a>}
            {socials.find(s => s.label === "Instagram") && <a
              className="mp-hero-secondary" href={socials.find(s => s.label === "Instagram")!.url}
              target="_blank" rel="noopener noreferrer"
              onClick={preview ? event => event.preventDefault() : undefined}>
              <Instagram size={16}/> Instagram <ArrowUpRight size={15}/>
            </a>}
            {!preview && onShare && <button type="button" className="mp-hero-secondary"
              onClick={onShare}><Share2 size={16}/> Compartilhar</button>}
          </div>
          <span className="mp-hero-index">STAGEFLOW <span aria-hidden="true">✦</span> MÚSICA EM MOVIMENTO</span>
        </div>
      </div>
    </header>

    <div className="mp-main">
      <nav className="mp-section-nav" aria-label="Seções do portfólio">
        <a href={"#" + sectionAnchor("sobre")}>Sobre</a>
        <a href={"#" + sectionAnchor("instrumentos")}>Instrumentos</a>
        {workLinks.length > 0 && <a href={"#" + workAnchor}>Trabalhos</a>}
        {highlights.length > 0 && <a href={"#" + sectionAnchor("trajetoria")}>Trajetória</a>}
        {(directBooking||preview)&&<a href={"#"+sectionAnchor("contratar")}>Contratar</a>}
      </nav>

      <section className="mp-intro-row" id={sectionAnchor("sobre")}>
        <div className="mp-about-copy">
          <span className="mp-section-kicker">PRAZER, EU SOU</span>
          <h2>Minha <span>história.</span></h2>
          <p className="mp-description">{biography ||
            "Conheça os instrumentos, o repertório e os trabalhos deste músico."}</p>
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

      <section className="mp-skills" id={sectionAnchor("instrumentos")}>
        <div className="mp-section-title">
          <div>
            <span className="mp-section-kicker">MEUS INSTRUMENTOS</span>
            <h2>O que eu <span>toco.</span></h2>
          </div>
          <Music2 size={29} aria-hidden="true"/>
        </div>
        <div className="mp-instrument-grid">
          {(instruments.length ? instruments : ["Instrumento principal"]).map((name,index) =>
            <div className={"mp-instrument-card"+(index===0?" is-primary":"")} key={name + index}>
              <span className="mp-instrument-icon"><Music2 size={23}/></span>
              <span className="mp-instrument-name">
                <small>{index===0?"MEU INSTRUMENTO PRINCIPAL":"OUTRO INSTRUMENTO"}</small>
                <strong>{name}</strong>
              </span>
              <span className="mp-instrument-index">{String(index + 1).padStart(2, "0")}</span>
            </div>)}
        </div>
        {performances.length > 0 && <div className="mp-formats">
          <span>FORMATOS DE APRESENTAÇÃO</span>
          <div>{performances.map((item,i) => <span key={item + i}><CheckCircle2 size={14}/>{item}</span>)}</div>
        </div>}
      </section>

      {highlights.length > 0 && <section className="mp-career"
        id={sectionAnchor("trajetoria")}>
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
            <span className="mp-section-kicker">MINHA MÚSICA EM CENA</span>
            <h2>Meu <span>trabalho.</span></h2>
            <p>Vídeos, apresentações e registros da minha música.</p>
          </div>
          <Sparkles size={23} aria-hidden="true"/>
        </div>
        {workLinks.length > 0 ? <div className="mp-work-grid">
          {workLinks.map((url,index) => {
            const id=youTubeId(url);
            const playing=id&&playingVideo===id;
            return <div key={url} className="mp-work-card">
              <div className="mp-work-thumb">
                {playing?
                  <iframe
                    title={"Apresentação "+(index+1)+" de "+portfolio.name}
                    src={"https://www.youtube-nocookie.com/embed/"+id+"?autoplay=1"}
                    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin"/>:
                  id?<button type="button" className="mp-work-preview-trigger"
                    onClick={()=>setPlayingVideo(id)} aria-label={"Reproduzir vídeo "+(index+1)+" sem sair do portfólio"}>
                    <img src={"https://i.ytimg.com/vi/"+id+"/hqdefault.jpg"}
                      alt={"Miniatura da apresentação "+(index+1)} loading="lazy"/>
                    <span className="mp-work-play"><Play size={23} fill="currentColor"/></span>
                  </button>:
                  <a href={url} className="mp-work-preview-trigger" target="_blank"
                    rel="noopener noreferrer" onClick={preview?e=>e.preventDefault():undefined}>
                    <span className="mp-work-art"><Music2 size={38}/></span>
                    <span className="mp-work-play"><ExternalLink size={20}/></span>
                  </a>}
              </div>
              <a className="mp-work-card-bottom" href={url} target="_blank"
                rel="noopener noreferrer" onClick={preview?e=>e.preventDefault():undefined}
                aria-label={"Abrir apresentação "+(index+1)+" em nova aba"}>
                <div>
                  <small>{id?"VÍDEO · ASSISTA AQUI":"TRABALHO EXTERNO"}</small>
                  <strong>{index===0?"Apresentação em destaque":"Apresentação "+String(index+1).padStart(2,"0")}</strong>
                </div>
                <ArrowUpRight size={19}/>
              </a>
            </div>;
          })}
        </div> : <div className="mp-work-empty">
          <Play size={19}/> {preview
            ? "Adicione links de vídeos no editor para mostrar suas apresentações aqui."
            : "Vídeos e apresentações serão adicionados em breve."}
        </div>}
      </section>

      {(directBooking||preview)&&<section className="mp-booking-section" id={sectionAnchor("contratar")}>
        <span className="mp-booking-symbol"><MessageCircle size={26}/></span>
        <div className="mp-booking-copy">
          <span className="mp-section-kicker">PARCERIAS & OPORTUNIDADES</span>
          <h2>Vamos tocar <span>juntos?</span></h2>
          <p>Convide este músico para shows, gravações e eventos pelo contato que ele escolheu disponibilizar.</p>
        </div>
        {!preview&&directBooking&&<a href={directBooking}
          className="mp-action-booking" target="_blank" rel="noopener noreferrer">
          {bookingContact?.mode==="whatsapp"?<MessageCircle size={17}/>:<Instagram size={17}/>}
          {bookingLabel} <ArrowUpRight size={16}/>
        </a>}
        {preview&&<span className="mp-booking-preview-note">Configure seu contato de contratação no editor para liberar o botão público.</span>}
      </section>}

      {socials.length > 0 && <section className="mp-social-section">
        <div>
          <span className="mp-section-kicker">ACOMPANHE MEU SOM</span>
          <h2>Vamos nos <span>conectar.</span></h2>
        </div>
        <div className="mp-social-grid">
          {socials.map(({url,label,Icon}) => <a key={label} href={url}
            target="_blank" rel="noopener noreferrer"
              onClick={preview ? event => event.preventDefault() : undefined}>
            <Icon size={20}/><span>{label==="Instagram"&&instagram?instagram.handle:label}</span><ArrowUpRight size={16}/>
          </a>)}
        </div>
      </section>}

      <footer className="mp-bottom">
        <div><span className="mp-end-mark">SF.</span><span>MINHA MÚSICA, MEU PORTFÓLIO · STAGEFLOW</span></div>
        {!preview && onShare && <button type="button" onClick={onShare} className="mp-share">
          Compartilhar portfólio <Share2 size={15}/></button>}
      </footer>
    </div>
  </article>;
}
