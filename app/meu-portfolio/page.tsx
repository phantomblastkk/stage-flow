"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ExternalLink, Eye, EyeOff, LoaderCircle, Music2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Portfolio = {
  name: string;
  slug: string;
  bio: string;
  city: string;
  instruments: string[];
  genres: string[];
  media_url: string | null;
  price_mode: "consult" | "from";
  reference_fee: number | null;
  is_published: boolean;
};

export default function MeuPortfolioDeMusico() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [instruments, setInstruments] = useState("");
  const [genres, setGenres] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [priceMode, setPriceMode] = useState<"consult" | "from">("consult");
  const [referenceFee, setReferenceFee] = useState("");
  const [published, setPublished] = useState(false);
  const [savedSlug, setSavedSlug] = useState("");
  const [savedPublished, setSavedPublished] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) { router.replace("/login"); return; }
      const { data, error } = await supabase.rpc("stage_my_musician_portfolio");
      if (!active) return;
      if (error) {
        setMessage("Ainda não foi possível carregar o portfólio. Execute musician_portfolios_migration.sql no Supabase. Detalhes: " + error.message);
        setIsError(true);
      } else if (!data) {
        setMessage("Esta área é reservada a contas com a função de músico/artista.");
        setIsError(true);
      } else {
        const p = data as Portfolio;
        setName(p.name || "");
        setSlug(p.slug || "");
        setBio(p.bio || "");
        setCity(p.city || "");
        setInstruments((p.instruments || []).join(", "));
        setGenres((p.genres || []).join(", "));
        setMediaUrl(p.media_url || "");
        setPriceMode(p.price_mode || "consult");
        setReferenceFee(p.reference_fee == null ? "" : String(p.reference_fee));
        setPublished(Boolean(p.is_published));
        setSavedSlug(p.slug || "");
        setSavedPublished(Boolean(p.is_published));
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [router]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage("");
    setIsError(false);

    const instrumentList = instruments.split(",").map(x => x.trim()).filter(Boolean);
    const genreList = genres.split(",").map(x => x.trim()).filter(Boolean);
    const fee = priceMode === "from" ? Number(referenceFee.replace(",", ".")) : null;
    const { data, error } = await createClient().rpc("stage_save_musician_portfolio", {
      p_slug: slug.trim(),
      p_bio: bio.trim(),
      p_city: city.trim(),
      p_instruments: instrumentList,
      p_genres: genreList,
      p_media_url: mediaUrl.trim() || null,
      p_price_mode: priceMode,
      p_reference_fee: fee,
      p_is_published: published,
    });

    if (error || data !== "saved") {
      const issues: Record<string, string> = {
        invalid_slug: "O endereço deve ter de 3 a 30 caracteres, usando apenas letras minúsculas, números e hífens.",
        slug_taken: "Esse endereço já está sendo usado por outro músico. Escolha outro.",
        instruments_required: "Informe pelo menos um instrumento para publicar.",
        too_many_tags: "Use até 10 instrumentos e até 10 estilos musicais.",
        invalid_price: "Informe um valor inicial válido, maior que zero, com até duas casas decimais.",
        invalid_media: "O link do trabalho precisa começar com https:// e ter até 500 caracteres.",
        text_too_long: "Sua apresentação ou cidade ultrapassou o tamanho permitido.",
      };
      setIsError(true);
      setMessage(error?.message || issues[String(data)] || "Não foi possível salvar seu portfólio.");
    } else {
      setSavedSlug(slug.trim());
      setSavedPublished(published);
      setMessage(published ? "Portfólio publicado! Você já pode compartilhar o endereço abaixo." : "Rascunho salvo. Seu portfólio não aparece publicamente até você ativar a publicação.");
    }
    setSaving(false);
  }

  if (loading) return <main><div className="container" style={{ minHeight: "75vh", display: "grid", placeItems: "center" }}><p style={{ color: "var(--muted)" }}><LoaderCircle size={18} style={{ display: "inline", verticalAlign: "middle" }}/> Carregando seu portfólio...</p></div></main>;

  const publicUrl = savedSlug ? "/musico/" + savedSlug : "";
  return <main><div className="container" style={{ paddingBottom: 60 }}>
    <nav className="nav"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link><Link className="btn btn-quiet" href="/painel"><ArrowLeft size={15}/> Meu painel</Link></nav>
    <section style={{ padding: "40px 0 24px" }}>
      <div className="eyebrow"><span className="dot"/> SUA VITRINE MUSICAL</div>
      <h1 style={{ fontSize: "clamp(32px,5vw,46px)", marginBottom: 12 }}>Meu <span className="accent">portfólio.</span></h1>
      <p className="lead">Uma página simples para mostrar seus instrumentos e trabalhos, sem precisar de subdomínio nem de um plano pago.</p>
    </section>
    {message && <div role={isError ? "alert" : "status"} className="coming" style={isError ? { borderColor: "#754343", background: "#281919", color: "#ffb5b5", maxWidth: 780 } : { maxWidth: 780 }}>{message}</div>}
    <section className="feature" style={{ maxWidth: 780, marginTop: 16 }}>
      <h2 style={{ fontSize: 22, marginTop: 0 }}><Music2 size={20} style={{ display: "inline", verticalAlign: "middle" }}/> Dados do músico</h2>
      <p style={{ color: "var(--muted)", fontSize: 13 }}>Nome exibido: <strong style={{ color: "var(--text)" }}>{name}</strong>. Para alterar o nome, futuramente usaremos a configuração da conta.</p>
      <form onSubmit={save} style={{ display: "grid", gap: 13 }}>
        <div className="field"><label htmlFor="portfolio-slug">Endereço da sua página *</label>
          <input id="portfolio-slug" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} minLength={3} maxLength={30} pattern="[a-z0-9-]{3,30}" required placeholder="joao-percussionista"/>
          <span className="field-help">stageflow.com/musico/{slug || "seu-nome"} (no domínio oficial futuramente)</span>
        </div>
        <div className="field"><label htmlFor="portfolio-bio">Sobre você</label>
          <textarea id="portfolio-bio" value={bio} onChange={e => setBio(e.target.value)} rows={4} maxLength={700} placeholder="Ex.: Sou percussionista, faço samba e pagode..." style={{ width: "100%", padding: 13, border: "1px solid var(--line)", background: "var(--panel)", borderRadius: 11, color: "var(--text)" }}/>
        </div>
        <div className="field"><label htmlFor="portfolio-city">Cidade de atuação</label>
          <input id="portfolio-city" value={city} onChange={e => setCity(e.target.value)} maxLength={120} placeholder="São Paulo - SP"/>
        </div>
        <div className="field"><label htmlFor="portfolio-instruments">Instrumentos que toca *</label>
          <input id="portfolio-instruments" value={instruments} onChange={e => setInstruments(e.target.value)} placeholder="Pandeiro, Tantã, Repique de mão"/>
          <span className="field-help">Separe os instrumentos por vírgula. Até dez.</span>
        </div>
        <div className="field"><label htmlFor="portfolio-genres">Estilos musicais</label>
          <input id="portfolio-genres" value={genres} onChange={e => setGenres(e.target.value)} placeholder="Samba, Pagode, MPB"/>
        </div>
        <div className="field"><label htmlFor="portfolio-media">Link de um trabalho (opcional)</label>
          <input id="portfolio-media" type="url" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="https://youtube.com/..."/>
          <span className="field-help">Pode ser YouTube, Instagram ou outro link HTTPS para demonstrar seu trabalho.</span>
        </div>
        <div className="field">
          <label>Como mostrar o cachê no seu portfólio?</label>
          <div className="role-options" style={{ marginTop: 6 }}>
            <button type="button" className="role-option" aria-pressed={priceMode === "from"}
              onClick={() => setPriceMode("from")} style={priceMode === "from" ? { borderColor: "var(--lime)" } : {}}>
              <strong>A partir de R$</strong><span>Você escolhe o valor público de referência.</span>
            </button>
            <button type="button" className="role-option" aria-pressed={priceMode === "consult"}
              onClick={() => setPriceMode("consult")} style={priceMode === "consult" ? { borderColor: "var(--lime)" } : {}}>
              <strong>Sob consulta</strong><span>Não mostramos nenhum valor ao público.</span>
            </button>
          </div>
          {priceMode === "from" && <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="portfolio-fee">Valor inicial (R$) *</label>
            <input id="portfolio-fee" type="number" inputMode="decimal" min="0.01" max="999999.99" step="0.01"
              value={referenceFee} onChange={e => setReferenceFee(e.target.value)} placeholder="Ex.: 300" required/>
          </div>}
          <p className="field-help">O cachê de cada show continua privado e pode ser negociado. O valor exibido aqui não é um preço fechado.</p>
        </div>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, lineHeight: 1.6 }}>
          <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} style={{ marginTop: 5, accentColor: "var(--lime)" }}/>
          <span style={{ fontSize: 13 }}><strong>Publicar minha página</strong><br/><span style={{ color: "var(--muted)" }}>Quando ativado, qualquer pessoa com o endereço poderá acessar seu portfólio. Desmarque para ocultá-lo.</span></span>
        </label>
        <button type="submit" className="btn btn-primary" disabled={saving} style={{ justifyContent: "center" }}><Save size={17}/>{saving ? "Salvando..." : published ? "Salvar e publicar" : "Salvar rascunho"}</button>
      </form>
    </section>
    {savedSlug && <section className="feature" style={{ maxWidth: 780, marginTop: 18 }}>
      <h2 style={{ fontSize: 19, margin: "0 0 8px" }}>{savedPublished ? <Eye size={19} style={{ verticalAlign: "middle" }}/> : <EyeOff size={19} style={{ verticalAlign: "middle" }}/>} {savedPublished ? "Portfólio publicado" : "Rascunho privado"}</h2>
      <p style={{ fontSize: 13, color: "var(--muted)" }}>{savedPublished ? "Sua página já está disponível para compartilhar com contratantes e bandas." : "Para publicar, marque a opção acima e salve novamente."}</p>
      {savedPublished && <Link className="btn btn-quiet" href={publicUrl} target="_blank"><ExternalLink size={16}/> Abrir minha página</Link>}
    </section>}
  </div></main>;
}
