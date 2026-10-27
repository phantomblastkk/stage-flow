"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, LoaderCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { trackPublicPortfolioView } from "@/lib/musician-metrics";
import MusicianPortfolioView, { MusicianPortfolio } from "@/components/musician-portfolio-view";
import {useStageVerified} from "@/lib/use-stage-verified";

export default function PortfolioMusicoPublico() {
  const { slug } = useParams<{ slug: string }>();
  const [portfolio, setPortfolio] = useState<MusicianPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const verified=useStageVerified("musician",slug,Boolean(portfolio));

  useEffect(() => {
    let active = true;
    async function load() {
      if (!slug) {
        setLoading(false);
        return;
      }
      const { data, error: requestError } = await createClient().rpc(
        "stage_public_musician_portfolio",
        { p_slug: slug }
      );
      if (!active) return;
      if (requestError) {
        setError("Não foi possível carregar este portfólio no momento. Tente novamente mais tarde.");
      } else {
        const published = (data as MusicianPortfolio | null) ?? null;
        setPortfolio(published);
        // Apenas página pública realmente carregada, não o editor nem a prévia.
        // Contagens são aproximadas e deduplicadas por navegador/dia.
        if (published?.slug) void trackPublicPortfolioView(published.slug);
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [slug]);

  async function sharePortfolio() {
    const url = window.location.href;
    setManualUrl("");
    if (navigator.share) {
      try {
        await navigator.share({ title: (portfolio?.name || "Músico") + " — Stage Flow", url });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setError("");
    } catch {
      setManualUrl(url);
      setError("Selecione o endereço abaixo para copiar manualmente.");
    }
  }

  return <main style={{ minHeight: "100vh", paddingBottom: 15 }}>
    <div className="mp-public-head">
      <nav className="nav">
        <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
        <Link className="btn btn-quiet" href="/"><ArrowLeft size={15}/> Voltar ao site</Link>
      </nav>
    </div>
    {loading ? <section className="container" style={{ padding: "62px 0", maxWidth: 690 }}>
      <p style={{ color: "var(--muted)", display: "flex", gap: 10, alignItems: "center" }}><LoaderCircle size={18}/> Carregando portfólio...</p>
    </section>
    : !portfolio ? <section className="feature" style={{ maxWidth: 690, margin: "55px auto", width: "calc(100% - 32px)" }}>
      <div className="eyebrow"><span className="dot"/> STAGE FLOW</div>
      <h1 style={{ fontSize: "clamp(29px,5vw,44px)" }}>Portfólio indisponível.</h1>
      <p>{error || "O músico ainda não publicou uma página com esse endereço ou a página foi desativada."}</p>
      <Link className="btn btn-primary" style={{ marginTop: 16 }} href="/">Voltar ao Stage Flow</Link>
    </section>
    : <div className="mp-public-wrap">
      <MusicianPortfolioView portfolio={portfolio} verified={verified} onShare={() => void sharePortfolio()}/>
      {copied && <p role="status" style={{ fontSize: 12, color: "var(--lime)", marginTop: 13, display: "flex", alignItems: "center", gap: 6 }}><Copy size={14}/> Link copiado!</p>}
      {error && <p role="alert" style={{ fontSize: 12, color: "#ffb5b5", marginTop: 13 }}>{error}</p>}
      {manualUrl && <div className="mp-public-manual-share">
        <label htmlFor="mp-manual-share">Endereço do seu portfólio</label>
        <input id="mp-manual-share" readOnly value={manualUrl}
          onFocus={event => event.currentTarget.select()}
          onClick={event => event.currentTarget.select()}/>
      </div>}
      <p style={{ color: "var(--muted)", fontSize: 11, textAlign: "center", marginTop: 17 }}>
        Perfil criado e publicado pelo músico. O cachê de cada show é negociado em particular.
      </p>
    </div>}
  </main>;
}
