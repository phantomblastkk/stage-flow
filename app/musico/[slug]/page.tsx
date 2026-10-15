"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Guitar, LoaderCircle, MapPin, Music2, Wallet } from "lucide-react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type PublicPortfolio = {
  name: string;
  slug: string;
  bio: string;
  city: string;
  instruments: string[];
  genres: string[];
  media_url: string | null;
  price_mode: "consult" | "from";
  reference_fee: number | null;
};

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export default function PortfolioMusicoPublico() {
  const { slug } = useParams<{ slug: string }>();
  const [portfolio, setPortfolio] = useState<PublicPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!slug) return;
      const { data, error: requestError } = await createClient().rpc("stage_public_musician_portfolio", {
        p_slug: slug,
      });
      if (!active) return;
      if (requestError) {
        setError("Não foi possível carregar o portfólio. Verifique se musician_portfolios_migration.sql foi executado no Supabase.");
      } else {
        setPortfolio((data as PublicPortfolio | null) ?? null);
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [slug]);

  return <main><div className="container" style={{ minHeight: "100vh", paddingBottom: 55 }}>
    <nav className="nav">
      <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
      <Link className="btn btn-quiet" href="/"><ArrowLeft size={15}/> Início</Link>
    </nav>
    {loading ? <section className="feature" style={{ maxWidth: 690, margin: "52px auto" }}>
      <p style={{ color: "var(--muted)" }}><LoaderCircle size={18} style={{ display: "inline", verticalAlign: "middle" }}/> Carregando portfólio...</p>
    </section> : error ? <section className="feature" style={{ maxWidth: 690, margin: "52px auto" }}>
      <h1>Não foi possível carregar</h1><p>{error}</p>
    </section> : !portfolio ? <section className="feature" style={{ maxWidth: 690, margin: "52px auto" }}>
      <h1>Portfólio indisponível</h1>
      <p>O músico ainda não publicou uma página com esse endereço ou ela foi desativada.</p>
      <Link className="btn btn-primary" href="/">Voltar ao Stage Flow</Link>
    </section> : <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <section style={{ padding: "48px 0 22px" }}>
        <div className="eyebrow"><span className="dot"/> PORTFÓLIO PROFISSIONAL</div>
        <h1 style={{ fontSize: "clamp(33px,6vw,55px)", margin: "12px 0 9px" }}>
          <span className="accent">{portfolio.name}</span>
        </h1>
        <p className="lead">
          <Music2 size={19} style={{ display: "inline", verticalAlign: "middle" }}/> Músico profissional
          {portfolio.city && <span> · <MapPin size={16} style={{ display: "inline", verticalAlign: "middle" }}/> {portfolio.city}</span>}
        </p>
      </section>
      <section className="feature" style={{ display: "grid", gap: 22 }}>
        {portfolio.bio && <div>
          <h2 style={{ fontSize: 20, margin: "0 0 8px" }}>Sobre o músico</h2>
          <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: "var(--muted)", lineHeight: 1.8, margin: 0 }}>{portfolio.bio}</p>
        </div>}
        <div>
          <h2 style={{ fontSize: 20, margin: "0 0 12px" }}><Guitar size={20} style={{ display: "inline", verticalAlign: "middle" }}/> Instrumentos</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {portfolio.instruments.map(instrument => <span key={instrument} style={{ border: "1px solid var(--line)", borderRadius: 99, padding: "8px 12px", fontSize: 13, background: "var(--panel2)" }}>{instrument}</span>)}
          </div>
        </div>
        {portfolio.genres.length > 0 && <div>
          <h2 style={{ fontSize: 20, margin: "0 0 12px" }}>Estilos musicais</h2>
          <p style={{ color: "var(--muted)", margin: 0 }}>{portfolio.genres.join(" • ")}</p>
        </div>}
        <div style={{ border: "1px solid var(--line)", borderRadius: 14, padding: 20, background: "var(--panel2)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--muted)", fontSize: 12, marginBottom: 8 }}><Wallet size={16}/> CACHÊ DE REFERÊNCIA</span>
          <strong style={{ fontSize: "clamp(22px,5vw,32px)" }}>{portfolio.price_mode === "from" && portfolio.reference_fee != null
            ? "A partir de " + money(portfolio.reference_fee)
            : "Sob consulta"}</strong>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "10px 0 0" }}>O valor final é negociado individualmente para cada apresentação.</p>
        </div>
        {portfolio.media_url && <div>
          <h2 style={{ fontSize: 20, margin: "0 0 10px" }}>Conheça meu trabalho</h2>
          <a className="btn btn-quiet" href={portfolio.media_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> Abrir vídeo ou portfólio</a>
        </div>}
      </section>
      <div className="coming" style={{ marginTop: 18 }}>
        <p style={{ margin: 0, fontSize: 13 }}>Este é um portfólio gratuito de músico no Stage Flow. A contratação direta pelo marketplace será adicionada em uma próxima etapa.</p>
      </div>
    </div>}
  </div></main>;
}
