"use client";

import type { CSSProperties } from "react";
import { ArrowUpRight, BadgeCheck, ExternalLink, MapPin, Music2, Play, Wallet } from "lucide-react";

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
};

export const musicianThemes: { value: MusicianTheme; label: string; description: string }[] = [
  { value: "midnight", label: "Midnight", description: "Escuro e sofisticado" },
  { value: "ivory", label: "Ivory", description: "Claro e minimalista" },
  { value: "stage", label: "Stage", description: "Noite e palco" },
];

export const musicianAccents: { value: MusicianAccent; label: string; color: string }[] = [
  { value: "lime", label: "Lima", color: "#c6f36b" },
  { value: "violet", label: "Violeta", color: "#afa6ff" },
  { value: "coral", label: "Coral", color: "#ffa48f" },
  { value: "cyan", label: "Ciano", color: "#79e3e8" },
  { value: "gold", label: "Dourado", color: "#f3c977" },
];

const accentsDark: Record<MusicianAccent, string> = {
  lime: "#c6f36b", violet: "#afa6ff", coral: "#ffa48f", cyan: "#79e3e8", gold: "#f3c977",
};
const accentsLight: Record<MusicianAccent, string> = {
  lime: "#426711", violet: "#6043af", coral: "#a3432c", cyan: "#006d76", gold: "#83570d",
};

const money = (amount: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

const initials = (name: string) =>
  (name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "SF");

type Props = { portfolio: MusicianPortfolio; preview?: boolean; onShare?: () => void };

export default function MusicianPortfolioView({ portfolio, preview = false, onShare }: Props) {
  const theme: MusicianTheme = musicianThemes.some(item => item.value === portfolio.theme)
    ? portfolio.theme : "midnight";
  const accent: MusicianAccent = musicianAccents.some(item => item.value === portfolio.accent)
    ? portfolio.accent : "lime";
  const layout: MusicianLayout = portfolio.layout_style === "minimal" ? "minimal" : "spotlight";
  const themeColor = theme === "ivory" ? accentsLight[accent] : accentsDark[accent];

  const style = {
    "--mp-accent": themeColor,
    "--mp-on-accent": theme === "ivory" ? "#ffffff" : "#12151a",
  } as CSSProperties;

  const title = portfolio.headline.trim() || portfolio.instruments.slice(0, 2).join(" • ") || "Músico profissional";
  const hasPhoto = Boolean(portfolio.avatar_url);
  const hasBanner = Boolean(portfolio.cover_url);

  return <article
    className={"mp-shell mp-theme-" + theme + " mp-layout-" + layout + (preview ? " mp-preview" : "")}
    style={style} aria-label={"Portfólio de " + portfolio.name}
  >
    <div className="mp-hero">
      {hasBanner && <div className="mp-hero-photo" style={{ backgroundImage: "url(" + JSON.stringify(portfolio.cover_url) + ")" }} aria-hidden="true"/>}
      <div className="mp-hero-grid" aria-hidden="true"/>
      <div className="mp-hero-content">
        <div className="mp-kicker"><span className="mp-pulse"/> STAGE FLOW / PORTFÓLIO MUSICAL</div>
        <div className="mp-identity">
          <div className="mp-avatar" aria-label={"Foto de " + portfolio.name}>
            {hasPhoto ? <img src={portfolio.avatar_url!} alt={"Foto de " + portfolio.name} loading="lazy" referrerPolicy="no-referrer"/> : <span>{initials(portfolio.name)}</span>}
          </div>
          <div className="mp-identity-copy">
            <p className="mp-overline">MÚSICO INDEPENDENTE</p>
            <h1>{portfolio.name || "Seu nome artístico"}</h1>
            <p className="mp-headline">{title}</p>
            {portfolio.city && <p className="mp-location"><MapPin size={15}/> {portfolio.city}</p>}
          </div>
        </div>
        <div className="mp-hero-footer">
          {portfolio.instruments.length > 0 && <span className="mp-hero-type"><Music2 size={15}/> {portfolio.instruments[0]}</span>}
          <span className="mp-hero-index">01 / PORTFÓLIO</span>
        </div>
      </div>
    </div>

    <div className="mp-main">
      <div className="mp-intro-row">
        <div>
          <span className="mp-section-kicker">A MÚSICA É O MEU TRABALHO</span>
          <h2>Sobre <span>mim.</span></h2>
          <p className="mp-description">
            {portfolio.bio || "Conte um pouco sobre sua trajetória, seus trabalhos e a experiência que você leva para cada apresentação."}
          </p>
          {portfolio.genres.length > 0 && <div className="mp-genre-list">{portfolio.genres.map((genre, i) =>
            <span key={genre + i}>{genre}</span>
          )}</div>}
        </div>
        <div className="mp-fee-card">
          <div className="mp-fee-label"><Wallet size={16}/> CACHÊ DE REFERÊNCIA</div>
          <strong>{portfolio.price_mode === "from" && portfolio.reference_fee != null
            ? <><small>A partir de</small> {money(portfolio.reference_fee)}</>
            : "Sob consulta"}</strong>
          <p>Propostas e valores finais são negociados individualmente.</p>
          <span className="mp-fee-foot"><BadgeCheck size={15}/> Negociação privativa</span>
        </div>
      </div>

      <section className="mp-skills">
        <div className="mp-section-title">
          <div>
            <span className="mp-section-kicker">O QUE EU TOCO</span>
            <h2>Meus <span>instrumentos.</span></h2>
          </div>
          <Music2 size={29} aria-hidden="true"/>
        </div>
        <div className="mp-instrument-grid">
          {(portfolio.instruments.length > 0 ? portfolio.instruments : ["Instrumento principal"]).map((instrument, index) =>
            <div className="mp-instrument-card" key={index}>
              <span className="mp-instrument-index">{String(index + 1).padStart(2, "0")}</span>
              <strong>{instrument}</strong>
              <Music2 size={19}/>
            </div>
          )}
        </div>
      </section>

      <section className="mp-work">
        <div>
          <span className="mp-section-kicker">NO PALCO E FORA DELE</span>
          <h2>Meu <span>trabalho.</span></h2>
          <p>Conheça minhas apresentações e o som que levo para cada projeto.</p>
        </div>
        {portfolio.media_url
          ? <a href={portfolio.media_url} className="mp-action-primary" target="_blank" rel="noopener noreferrer">
              <Play size={17} fill="currentColor"/> Ver apresentação <ArrowUpRight size={17}/>
            </a>
          : <div className="mp-work-pending"><ExternalLink size={17}/> Em breve, vídeos e apresentações</div>}
      </section>
      <div className="mp-bottom">
        <div><span className="mp-end-mark">SF.</span><span>FEITO PARA QUEM VIVE DE MÚSICA</span></div>
        {!preview && onShare && <button type="button" onClick={onShare} className="mp-share">Compartilhar portfólio <ArrowUpRight size={16}/></button>}
      </div>
    </div>
  </article>;
}
