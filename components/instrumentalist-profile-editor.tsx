"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Check, CheckCircle2, Copy, ExternalLink, Eye, EyeOff, X,
  ImagePlus, LoaderCircle, Palette, Save, Share2, SlidersHorizontal, Sparkles, Upload,
  BriefcaseBusiness, Clock3, Instagram, Youtube, Headphones, ListChecks, ChartNoAxesCombined, ArrowRight
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {prepareProfilePortrait} from "@/lib/profile-photo";
import MusicianPortfolioView, {
  MusicianPortfolio, MusicianLayout,
  musicianThemes, musicianAccents
} from "@/components/musician-portfolio-view";
import "@/app/meu-portfolio/musician-portfolio-editor.css";
import MarketplaceMusicianSettings from "@/components/marketplace-musician-settings";
import BookingContactSettings from "@/components/booking-contact-settings";
import MobileEditorWizard from "@/components/mobile-editor-wizard";
import {revealMobileEditorField,useMobileEditorKeyboardVisibility} from "@/components/mobile-editor-focus";

type EditorPortfolio = MusicianPortfolio & { is_published: boolean };

const blank: EditorPortfolio = {
  name: "Seu nome artístico",
  slug: "",
  headline: "",
  bio: "",
  city: "",
  instruments: [],
  genres: [],
  media_url: null,
  price_mode: "consult",
  reference_fee: null,
  is_published: false,
  theme: "midnight",
  accent: "violet",
  layout_style: "spotlight",
  avatar_url: null,
  cover_url: null,
  experience_years: null,
  performance_types: [],
  career_highlights: [],
  availability_note: "",
  additional_media_urls: [],
  instagram_url: null,
  youtube_url: null,
  spotify_url: null
};

const fieldStyle = {
  width: "100%",
  border: "1px solid var(--line)",
  background: "var(--panel)",
  color: "var(--text)",
  borderRadius: 11,
  padding: "13px 14px"
};

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
}

export default function MeuPortfolioDeMusico({unifiedSinger=false,username=null}:{unifiedSinger?:boolean;username?:string|null}) {
  const router = useRouter();
  useMobileEditorKeyboardVisibility();
  const [portfolio, setPortfolio] = useState<EditorPortfolio>(blank);
  const [mobileStep,setMobileStep]=useState(unifiedSinger?1:0);
  const [instrumentsText, setInstrumentsText] = useState("");
  const [genresText, setGenresText] = useState("");
  const [performancesText, setPerformancesText] = useState("");
  const [highlightsText, setHighlightsText] = useState("");
  const [additionalMediaText, setAdditionalMediaText] = useState("");
  const [referenceFeeText, setReferenceFeeText] = useState("");
  const [savedSlug, setSavedSlug] = useState("");
  const [savedPublished, setSavedPublished] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const [previewTab, setPreviewTab] = useState(false);
  const closePreviewRef = useRef<HTMLButtonElement>(null);
  const openPreviewRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!previewTab) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closePreviewRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewTab(false);
      if (event.key !== "Tab") return;
      const dialog = closePreviewRef.current?.closest('[role="dialog"]');
      if (!dialog) return;
      const elements = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])'
      ));
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      openPreviewRef.current?.focus();
    };
  }, [previewTab]);

  function update<K extends keyof EditorPortfolio>(key: K, value: EditorPortfolio[K]) {
    setPortfolio(prev => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) { router.replace("/login"); return; }
      const { data, error: requestError } = await supabase.rpc("stage_my_musician_portfolio");
      if (!active) return;
      if (requestError) {
        setError(true);
        setStatus("Para usar o portfólio completo, execute musician_portfolio_complete_migration.sql no Supabase. Detalhes: " + requestError.message);
      } else if (!data) {
        setError(true);
        setStatus("Esta área é exclusiva para contas com a função de músico/artista.");
      } else {
        const row = data as Partial<EditorPortfolio>;
        const next: EditorPortfolio = {
          ...blank,
          ...row,
          name: row.name || "Músico",
          slug: row.slug || slugify(row.name || "") || ("musico-" + user.id.slice(0, 6)),
          instruments: row.instruments || [],
          genres: row.genres || [],
          theme: row.theme || "midnight",
          accent: row.accent === "lime" ? "violet" : row.accent || "violet",
          layout_style: row.layout_style || "spotlight",
          media_url: row.media_url || null,
          avatar_url: row.avatar_url || null,
          cover_url: row.cover_url || null,
          experience_years: row.experience_years ?? null,
          performance_types: Array.isArray(row.performance_types) ? row.performance_types : [],
          career_highlights: Array.isArray(row.career_highlights) ? row.career_highlights : [],
          availability_note: row.availability_note || "",
          additional_media_urls: Array.isArray(row.additional_media_urls) ? row.additional_media_urls : [],
          instagram_url: row.instagram_url || null,
          youtube_url: row.youtube_url || null,
          spotify_url: row.spotify_url || null,
          is_published: Boolean(row.is_published)
        };
        setPortfolio(next);
        setInstrumentsText(next.instruments.join(", "));
        setGenresText(next.genres.join(", "));
        setPerformancesText(next.performance_types.join(", "));
        setHighlightsText(next.career_highlights.join("\n"));
        setAdditionalMediaText(next.additional_media_urls.join("\n"));
        setReferenceFeeText(next.reference_fee == null ? "" : String(next.reference_fee));
        setSavedSlug(row.is_published ? (row.slug || "") : "");
        setSavedPublished(Boolean(row.is_published));
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [router]);

  async function uploadPhoto(kind: "avatar" | "cover", event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"
    };
    if (!extensions[file.type] || file.size > 5 * 1024 * 1024) {
      setError(true);
      setStatus("Escolha uma imagem JPG, PNG ou WebP de no máximo 5 MB.");
      return;
    }
    setUploading(kind);
    setError(false);
    setStatus("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError(true);
      setStatus("Entre novamente na sua conta para enviar a imagem.");
      setUploading(null);
      return;
    }
    const prepared=kind==="avatar"?await prepareProfilePortrait(file):file;
    const path = user.id + "/" + crypto.randomUUID() + "." + extensions[prepared.type];
    const { error: uploadError } = await supabase.storage
      .from("stage-musician-media")
      .upload(path, prepared, { cacheControl: "3600", contentType: prepared.type, upsert: false });
    if (uploadError) {
      setError(true);
      setStatus("Não foi possível enviar a foto. Execute o SQL de aparência e tente novamente. Detalhes: " + uploadError.message);
    } else {
      const { data: { publicUrl } } = supabase.storage
        .from("stage-musician-media").getPublicUrl(path);
      update(kind === "avatar" ? "avatar_url" : "cover_url", publicUrl);
      setStatus("Imagem enviada! Clique em Salvar alterações para usá-la no seu portfólio.");
    }
    setUploading(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || uploading) return;
    setSaving(true);
    setStatus("");
    setError(false);
    setCopied(false);

    const instrumentList = instrumentsText.split(",").map(v => v.trim()).filter(Boolean);
    const genreList = genresText.split(",").map(v => v.trim()).filter(Boolean);
    const performanceList = performancesText.split(",").map(v => v.trim()).filter(Boolean);
    const highlightList = highlightsText.split("\n").map(v => v.trim()).filter(Boolean);
    const additionalLinks = additionalMediaText.split("\n").map(v => v.trim()).filter(Boolean);
    if (performanceList.length > 8 || highlightList.length > 6 || additionalLinks.length > 4) {
      setError(true);
      setStatus("Use até 8 formatos de apresentação, 6 destaques de carreira e 4 vídeos extras.");
      setSaving(false);
      return;
    }
    if (performanceList.some(v => v.length < 2 || v.length > 45) ||
        highlightList.some(v => v.length < 4 || v.length > 120)) {
      setError(true);
      setStatus("Cada formato deve ter 2 a 45 caracteres e cada destaque 4 a 120.");
      setSaving(false);
      return;
    }
    const amount = portfolio.price_mode === "from"
      ? Number(referenceFeeText.replace(",", ".")) : null;
    if (instrumentList.length > 10 || genreList.length > 10) {
      setStatus("Use no máximo 10 instrumentos e 10 estilos musicais.");
      setError(true);
      setSaving(false);
      return;
    }
    const {data:mainArtist} = unifiedSinger
      ? await createClient().rpc("stage_my_artist_page") : {data:null};
    const shared=mainArtist as {bio?:string;city?:string;headline?:string;instagram_url?:string|null;youtube_url?:string|null;spotify_url?:string|null}|null;
    const { data, error: saveError } = await createClient().rpc(
      "stage_save_musician_portfolio_v4", {
        p_slug: portfolio.slug.trim(),
        p_bio: shared?.bio ?? portfolio.bio.trim(),
        p_city: shared?.city ?? portfolio.city.trim(),
        p_instruments: instrumentList,
        p_genres: genreList,
        p_media_url: portfolio.media_url || null,
        p_price_mode: portfolio.price_mode,
        p_reference_fee: amount,
        p_is_published: portfolio.is_published,
        p_headline: shared?.headline ?? portfolio.headline.trim(),
        p_theme: portfolio.theme,
        p_accent: portfolio.accent,
        p_layout_style: portfolio.layout_style,
        p_avatar_url: portfolio.avatar_url || null,
        p_cover_url: portfolio.cover_url || null,
        p_experience_years: portfolio.experience_years,
        p_performance_types: performanceList,
        p_career_highlights: highlightList,
        p_availability_note: portfolio.availability_note.trim(),
        p_additional_media_urls: additionalLinks,
        p_instagram_url: shared?.instagram_url ?? portfolio.instagram_url?.trim() ?? null,
        p_youtube_url: shared?.youtube_url ?? portfolio.youtube_url?.trim() ?? null,
        p_spotify_url: shared?.spotify_url ?? portfolio.spotify_url?.trim() ?? null
      }
    );

    if (saveError || data !== "saved") {
      const messages: Record<string, string> = {
        invalid_slug: "O link precisa ter entre 3 e 30 caracteres, usando letras, números e hífens.",
        slug_taken: "Esse endereço já pertence a outro músico. Escolha outro.",
        instruments_required: "Informe pelo menos um instrumento antes de publicar a página.",
        too_many_tags: "Use no máximo 10 instrumentos e 10 estilos.",
        invalid_tag: "Cada instrumento ou estilo deve ter entre 2 e 45 caracteres.",
        invalid_media: "O link do vídeo deve começar com https:// e ter até 500 caracteres.",
        invalid_price_mode: "Selecione como seu cachê deve aparecer.",
        invalid_price: "Informe um valor maior que zero e com até duas casas decimais.",
        invalid_style: "Selecione um dos temas, cores e layouts disponíveis.",
        invalid_avatar: "A foto precisa ter sido enviada pela área de upload deste portfólio.",
        invalid_cover: "A capa precisa ter sido enviada pela área de upload deste portfólio.",
        text_too_long: "Algum texto ultrapassou o limite permitido.",
        invalid_experience: "Informe entre 0 e 60 anos de experiência ou deixe vazio.",
        invalid_availability: "A informação sobre disponibilidade deve ter até 140 caracteres.",
        too_many_details: "Use no máximo 8 formatos, 6 destaques e 4 vídeos extras.",
        invalid_performance: "Cada formato de apresentação precisa ter entre 2 e 45 caracteres.",
        invalid_highlights: "Cada destaque precisa ter entre 4 e 120 caracteres.",
        invalid_social: "Confira os links: use Instagram, YouTube ou Spotify com endereço HTTPS."
      };
      setError(true);
       setStatus((saveError?.code === "PGRST202" || saveError?.code === "42883")
        ? "O banco ainda precisa da migração stage_musician_portfolio_expanded_migration.sql para usar os campos expandidos."
        : saveError?.message || messages[String(data)] || "Não foi possível salvar o portfólio.");
    } else {
      setPortfolio(prev => ({
        ...prev, instruments: instrumentList, genres: genreList,
        performance_types: performanceList, career_highlights: highlightList,
        additional_media_urls: additionalLinks, reference_fee: amount
      }));
      setSavedSlug(portfolio.slug);
      setSavedPublished(portfolio.is_published);
      setStatus(portfolio.is_published
        ? "Alterações publicadas! Sua página já está pronta para compartilhar."
        : "Rascunho salvo. A página continua oculta até você publicar.");
    }
    setSaving(false);
  }

  const effectivePreview = {
    ...portfolio,
    instruments: instrumentsText.split(",").map(v => v.trim()).filter(Boolean).slice(0, 10),
    genres: genresText.split(",").map(v => v.trim()).filter(Boolean).slice(0, 10),
    performance_types: performancesText.split(",").map(v => v.trim()).filter(Boolean).slice(0, 8),
    career_highlights: highlightsText.split("\n").map(v => v.trim()).filter(Boolean).slice(0, 6),
    additional_media_urls: additionalMediaText.split("\n").map(v => v.trim()).filter(Boolean).slice(0, 4),
    reference_fee: portfolio.price_mode === "from" && Number(referenceFeeText.replace(",", ".")) > 0
      ? Number(referenceFeeText.replace(",", ".")) : null
  };
  const publicPath = unifiedSinger&&username ? "/"+encodeURIComponent(username) : "/musico/" + savedSlug;
  const completed = [
    Boolean(portfolio.avatar_url),
    Boolean(portfolio.bio.trim()),
    Boolean(instrumentsText.trim()),
    Boolean(portfolio.city.trim()),
    Boolean(portfolio.headline.trim()),
    Boolean(portfolio.media_url || additionalMediaText.trim())
  ].filter(Boolean).length;

  async function sharePortfolio() {
    if (!savedPublished || !savedSlug) return;
    const url = window.location.origin + publicPath;
    if (navigator.share) {
      try { await navigator.share({ title: portfolio.name + " | Stage Flow", url }); return; }
      catch (err) { if (err instanceof Error && err.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(url); setCopied(true); }
    catch { setError(true); setStatus("Não foi possível copiar o link automaticamente."); }
  }

  if (loading) return <main className="container" style={{ minHeight: "75vh", display: "grid", placeItems: "center" }}>
    <p style={{ color: "var(--muted)" }}><LoaderCircle size={17} style={{ display: "inline", verticalAlign: "middle" }}/> Carregando personalização...</p>
  </main>;

  return <main className="mp-editor-workspace" data-editor-active={mobileStep} onFocusCapture={event=>revealMobileEditorField(event.target)}><div className="container" style={{ paddingBottom: 60 }}>
    <nav className="nav">
      <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
      <Link className="btn btn-quiet" href="/painel"><ArrowLeft size={15}/> Voltar</Link>
    </nav>
    <section style={{ padding: "38px 0 24px" }}>
      <div className="eyebrow"><span className="dot"/> SEU ESPAÇO NA MÚSICA</div>
      <h1 style={{ fontSize: "clamp(32px,5vw,46px)", margin: "14px 0 12px" }}>Suas habilidades. <span className="accent">Um perfil só.</span></h1>
      <p className="lead" style={{ maxWidth: 760 }}>Instrumentos, repertório e condições de contratação complementam sua única página artística. O Marketplace utiliza o mesmo perfil público.</p>
      <div className="mp-editor-progress" aria-label={"Perfil com " + completed + " de 6 informações essenciais"}>
        <div><ListChecks size={16}/><strong>{completed}/6</strong> informações essenciais preenchidas</div>
        <div className="mp-editor-progress-bar" aria-hidden="true"><span style={{ width: Math.round(completed / 6 * 100) + "%" }}/></div>
        <small>Foto, apresentação, instrumentos, cidade, frase de destaque e vídeo.</small>
      </div>
    </section>

    {status && <div className="coming" role={error ? "alert" : "status"} style={error ? { borderColor: "#754343", background: "#281919", color: "#ffb5b5" } : {}}>
      {!error && <CheckCircle2 size={17} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }}/>}
      {status}
    </div>}

    <section className="mp-reach-link" data-editor-step="4" aria-label="Painel de desempenho do músico">
      <div>
        <span className="mp-reach-eyebrow"><ChartNoAxesCombined size={16}/> SEU ALCANCE</span>
        <h2>Veja quem seu trabalho está alcançando.</h2>
        <p>Confira visitas ao portfólio, aparições no futuro marketplace e convites recebidos. Estatísticas privadas, gratuitas e sem expor visitantes.</p>
      </div>
      <Link href="/meu-desempenho" className="mp-reach-button">
        Ver meu desempenho <ArrowRight size={16}/>
      </Link>
    </section>

    <div data-editor-step="4" className="mp-marketplace-wizard-setting"><MarketplaceMusicianSettings portfolioPublished={portfolio.is_published}/></div>
    {unifiedSinger&&<section className="mp-editor-panel" role="note" style={{marginBottom:17}}>
      <h2>Seu perfil público é único</h2>
      <p>Foto, apresentação, cidade e redes sociais são editadas em Dados do perfil único. Aqui você acrescenta instrumentos, formatos de apresentação, valores de referência e disponibilidade para o Marketplace.</p>
      <Link href="/perfil-artistico?aba=dados">Editar meus dados principais</Link>
    </section>}

    <MobileEditorWizard
      steps={[...(!unifiedSinger?[{value:0,label:"Visual e fotos"}]:[]),
        {value:1,label:"Instrumentos"},{value:2,label:"Experiência"},
        {value:3,label:"Mídias"},{value:4,label:"Contratação e publicação"}]}
      active={mobileStep} onChange={setMobileStep}
      formId="musician-portfolio-form" disabled={saving||Boolean(uploading)}
    />
    <div className={"mp-editor-columns"+(unifiedSinger?" mp-unified-singer":"")}>

      <div>
        <form id="musician-portfolio-form" onSubmit={save} style={{ display: "grid", gap: 17 }}>
          <section id="mp-aparencia" data-editor-step="0" className="mp-editor-panel">
            <h2><Palette size={18} style={{ verticalAlign: "middle", marginRight: 7 }}/> Aparência da página</h2>
            <p>Escolha um visual que combine com sua música. Não precisa programar.</p>

            <div className="field">
              <label>Estilo do site</label>
              <div className="mp-preset-list">
                {musicianThemes.map(theme => <button type="button" key={theme.value}
                  className="mp-theme-option" aria-pressed={portfolio.theme === theme.value}
                  onClick={() => update("theme", theme.value)}>
                  <span className="mp-theme-swatch" style={{
                    color: theme.value === "ivory" ? "#1a2330" : "#f1eff8",
                    background: theme.value === "midnight" ? "linear-gradient(135deg,#161e30,#080b13)" :
                      theme.value === "ivory" ? "linear-gradient(135deg,#f9f4e9,#ddd5c9)" :
                      "linear-gradient(135deg,#542b56,#120b20)"
                  }}/>
                  <strong>{theme.label}</strong>
                  <small>{theme.description}</small>
                </button>)}
              </div>
            </div>
            <div className="field">
              <label>Cor de destaque</label>
              <div className="mp-color-list">
                {musicianAccents.map(accent =>
                  <button key={accent.value} type="button" className="mp-color-btn"
                    aria-label={"Cor " + accent.label}
                    title={accent.label}
                    aria-pressed={portfolio.accent === accent.value}
                    onClick={() => update("accent", accent.value)}>
                    <span style={{ background: accent.color, color: "#10151c" }}>
                      {portfolio.accent === accent.value && <Check size={17}/>}
                    </span>
                  </button>)}
              </div>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Organização da página</label>
              <div className="mp-layout-options">
                {([
                  ["spotlight", "Destaque", "Capa grande e apresentação marcante"],
                  ["minimal", "Minimalista", "Visual compacto e discreto"]
                ] as const).map(([value, name, description]) =>
                  <button type="button" key={value} className="mp-layout-option"
                    aria-pressed={portfolio.layout_style === value}
                    onClick={() => update("layout_style", value as MusicianLayout)}>
                    <strong>{name}</strong><small>{description}</small>
                  </button>)}
              </div>
            </div>
          </section>

          <section id="mp-fotos" data-editor-step="0" className="mp-editor-panel">
            <h2><ImagePlus size={18} style={{ verticalAlign: "middle", marginRight: 7 }}/> Suas fotos</h2>
            <p>Envie JPG, PNG ou WebP de até 5 MB, diretamente do celular ou computador.</p>
            <div className="field">
              <label htmlFor="avatar-upload">Foto de perfil (quadrada)</label>
              <label className="mp-file-upload">
                <Upload size={16}/>
                {uploading === "avatar" ? "Enviando foto..." : "Escolher foto de perfil"}
                <input id="avatar-upload" type="file" accept="image/jpeg,image/png,image/webp"
                  disabled={Boolean(uploading) || saving} onChange={e => void uploadPhoto("avatar", e)}/>
              </label>
              {portfolio.avatar_url && <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img src={portfolio.avatar_url} alt="Foto selecionada" style={{ width: 66, height: 66, borderRadius: 17, objectFit: "cover" }}/>
                <button className="btn btn-quiet" type="button" onClick={()=>update("avatar_url", null)}>Remover da página</button>
              </div>}
            </div>
            <div className="field">
              <label htmlFor="cover-upload">Imagem de capa (horizontal)</label>
              <label className="mp-file-upload">
                <Upload size={16}/>
                {uploading === "cover" ? "Enviando capa..." : "Escolher imagem de capa"}
                <input id="cover-upload" type="file" accept="image/jpeg,image/png,image/webp"
                  disabled={Boolean(uploading) || saving} onChange={e => void uploadPhoto("cover", e)}/>
              </label>
              {portfolio.cover_url && <>
                <div className="mp-mini-preview" style={{ backgroundImage: "url(" + JSON.stringify(portfolio.cover_url) + ")" }}/>
                <button className="btn btn-quiet" type="button" onClick={()=>update("cover_url", null)}>Remover capa da página</button>
              </>}
              <span className="field-help">Fotos enviadas são arquivos destinados à divulgação pública. Não envie documentos ou imagens privadas.</span>
            </div>
          </section>

          <section id="mp-instrumentos" data-editor-step="1" className="mp-editor-panel">
            <h2><SlidersHorizontal size={18} style={{ verticalAlign: "middle", marginRight: 7 }}/> Informações profissionais</h2>
            <p>Seu nome exibido é <strong style={{ color: "var(--text)" }}>{portfolio.name}</strong>, definido na sua conta.</p>
            <div className="field">
              <label htmlFor="portfolio-slug">Endereço da página *</label>
              <input id="portfolio-slug" value={portfolio.slug}
                onChange={e => update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,""))}
                minLength={3} maxLength={30} pattern="[a-z0-9-]{3,30}" placeholder="joao-cavaquinho" required={!unifiedSinger}/>
              <span className="field-help">Seu endereço público será <strong>/musico/{portfolio.slug || "seu-nome"}</strong> no domínio do StageFlow.</span>
            </div>
            <div className="field">
              <label htmlFor="portfolio-headline">Frase de destaque</label>
              <input id="portfolio-headline" value={portfolio.headline}
                onChange={e => update("headline", e.target.value)} maxLength={110}
                placeholder="Ex.: Percussionista especializado em samba e pagode"/>
            </div>
            <div className="field">
              <label htmlFor="portfolio-bio">Sua apresentação</label>
              <textarea id="portfolio-bio" value={portfolio.bio}
                onChange={e => update("bio", e.target.value)} rows={4} maxLength={700}
                placeholder="Conte sua trajetória, experiências e o que você toca..."
                style={{ ...fieldStyle, resize: "vertical" }}/>
              <span className="field-help">{portfolio.bio.length}/700 caracteres</span>
            </div>
            <div className="field">
              <label htmlFor="portfolio-city">Cidade de atuação</label>
              <input id="portfolio-city" value={portfolio.city}
                onChange={e => update("city", e.target.value)} maxLength={120}
                placeholder="São Paulo - SP"/>
            </div>
            <div className="field">
              <label htmlFor="portfolio-instruments">Instrumentos *</label>
              <input id="portfolio-instruments" value={instrumentsText}
                onChange={e => setInstrumentsText(e.target.value)}
                placeholder="Cavaquinho, Violão, Pandeiro"/>
              <span className="field-help">Separe por vírgulas. Até 10 instrumentos.</span>
            </div>
            <div className="field">
              <label htmlFor="portfolio-genres">Estilos musicais</label>
              <input id="portfolio-genres" value={genresText}
                onChange={e => setGenresText(e.target.value)}
                placeholder="Samba, Pagode, MPB"/>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="portfolio-media">Link da apresentação principal</label>
              <input id="portfolio-media" type="url" value={portfolio.media_url || ""}
                onChange={e => update("media_url", e.target.value || null)}
                placeholder="https://www.youtube.com/watch?v=..."/>
              <span className="field-help">Seu vídeo principal aparece em destaque na seção de trabalhos.</span>
            </div>
          </section>

          <section id="mp-trajetoria" data-editor-step="2" className="mp-editor-panel">
            <h2><BriefcaseBusiness size={18} style={{ verticalAlign: "middle", marginRight: 7 }}/> Experiência e trajetória</h2>
            <p>Mostre ao contratante onde você atua e as experiências que fazem parte da sua carreira.</p>
            <div className="field">
              <label htmlFor="mp-years"><Clock3 size={14} style={{ verticalAlign: "middle" }}/> Anos de experiência (opcional)</label>
              <input id="mp-years" type="number" min={0} max={60} step={1}
                placeholder="Ex.: 5" value={portfolio.experience_years ?? ""}
                onChange={e => update("experience_years", e.target.value === ""
                  ? null : Number(e.target.value))}/>
              <span className="field-help">Use 0 se está começando na música. Não invente tempo de carreira.</span>
            </div>
            <div className="field">
              <label htmlFor="mp-formats">Formatos de apresentação</label>
              <input id="mp-formats" value={performancesText}
                onChange={e => setPerformancesText(e.target.value)}
                placeholder="Banda completa, Roda de samba, Eventos corporativos"/>
              <span className="field-help">Separe por vírgulas. Até 8 formatos, com 45 caracteres cada.</span>
            </div>
            <div className="field">
              <label htmlFor="mp-highlights">Projetos, apresentações ou experiências marcantes</label>
              <textarea id="mp-highlights" rows={6} maxLength={760}
                value={highlightsText} onChange={e => setHighlightsText(e.target.value)}
                placeholder={"Participação no grupo X\nShow na casa de samba Y\nGravação do projeto Z"}
                style={{ ...fieldStyle, resize: "vertical" }}/>
              <span className="field-help">Um destaque por linha, até 6, com 120 caracteres cada. Informe somente experiências reais.</span>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="mp-availability">Regiões e disponibilidade para shows</label>
              <input id="mp-availability" value={portfolio.availability_note}
                onChange={e => update("availability_note", e.target.value)}
                maxLength={140} placeholder="Ex.: Atendo São Paulo e região, inclusive finais de semana"/>
              <span className="field-help">Esse texto é informativo; não reserva horários nem confirma disponibilidade.</span>
            </div>
          </section>

          <section id="mp-midias" data-editor-step="3" className="mp-editor-panel">
            <h2><Youtube size={18} style={{ verticalAlign: "middle", marginRight: 7 }}/> Vídeos e redes sociais</h2>
            <p>Seu portfólio gratuito pode mostrar até 5 vídeos e apresentações, com reprodução incorporada ao clicar no vídeo do YouTube. Não precisa fazer upload.</p>
            <div className="field">
              <label htmlFor="mp-extra-media">Mais vídeos ou apresentações (opcional)</label>
              <textarea id="mp-extra-media" rows={5} maxLength={2100}
                value={additionalMediaText} onChange={e => setAdditionalMediaText(e.target.value)}
                placeholder={"https://youtu.be/....\nhttps://www.youtube.com/watch?v=...."}
                style={{ ...fieldStyle, resize: "vertical" }}/>
              <span className="field-help">Um endereço HTTPS por linha. Até 4 links extras além da apresentação principal, chegando a 5 trabalhos.</span>
            </div>
            <div className="field">
              <label htmlFor="mp-instagram"><Instagram size={14} style={{ verticalAlign: "middle" }}/> Instagram</label>
              <input id="mp-instagram" type="url" value={portfolio.instagram_url || ""}
                onChange={e => update("instagram_url", e.target.value || null)}
                placeholder="https://www.instagram.com/seuperfil"/>
            </div>
            <div className="field">
              <label htmlFor="mp-youtube"><Youtube size={14} style={{ verticalAlign: "middle" }}/> Canal no YouTube</label>
              <input id="mp-youtube" type="url" value={portfolio.youtube_url || ""}
                onChange={e => update("youtube_url", e.target.value || null)}
                placeholder="https://www.youtube.com/@seucanal"/>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="mp-spotify"><Headphones size={14} style={{ verticalAlign: "middle" }}/> Spotify</label>
              <input id="mp-spotify" type="url" value={portfolio.spotify_url || ""}
                onChange={e => update("spotify_url", e.target.value || null)}
                placeholder="https://open.spotify.com/artist/..."/>
              <span className="field-help">Esses links e os vídeos ficarão públicos apenas quando você publicar o portfólio.</span>
            </div>
          </section>

          <div data-editor-step="4"><BookingContactSettings kind="musician"
            instagramConfigured={Boolean(portfolio.instagram_url)}/></div>

          <section id="mp-cache" data-editor-step="4" className="mp-editor-panel">
            <h2>Seu cachê público</h2>
            <p>O valor mostrado aqui é apenas uma referência. A negociação de cada show continua privada.</p>
            <div className="mp-layout-options" style={{ marginTop: 13, marginBottom: 15 }}>
              <button type="button" className="mp-layout-option"
                aria-pressed={portfolio.price_mode === "consult"} onClick={()=>update("price_mode","consult")}>
                <strong>Sob consulta</strong><small>Nenhum valor é exibido.</small>
              </button>
              <button type="button" className="mp-layout-option"
                aria-pressed={portfolio.price_mode === "from"} onClick={()=>update("price_mode","from")}>
                <strong>A partir de R$</strong><small>Divulgue um valor inicial.</small>
              </button>
            </div>
            {portfolio.price_mode === "from" && <div className="field">
              <label htmlFor="portfolio-fee">Valor de referência em reais *</label>
              <input id="portfolio-fee" type="number" min="0.01" max="999999.99" step="0.01"
                inputMode="decimal" required value={referenceFeeText}
                onChange={e=>setReferenceFeeText(e.target.value)} placeholder="Ex.: 350"/>
            </div>}
          </section>

          <section id="mp-publicacao" data-editor-step="4" className="mp-editor-panel">
            <h2>Publicação e privacidade</h2>
            <p>O perfil só aparece para outras pessoas depois que você escolher publicar e salvar.</p>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", padding: "12px 0" }}>
              <input type="checkbox" checked={portfolio.is_published}
                onChange={e=>update("is_published",e.target.checked)}
                style={{ marginTop: 5, accentColor: "var(--accent)", flexShrink: 0 }}/>
              <span style={{ fontSize: 13, lineHeight: 1.6 }}>
                <strong>{unifiedSinger?"Publicar informações de músico":"Publicar meu perfil artístico"}</strong>
                <span style={{ display: "block", color: "var(--muted)" }}>
                  Qualquer pessoa com o link poderá ver sua página, fotos, instrumentos e cachê de referência, quando escolhido.
                </span>
              </span>
            </label>
            <div className="mp-editor-stickybar">
              <span style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 12, color: "var(--muted)" }}>
                {portfolio.is_published ? <Eye size={15}/> : <EyeOff size={15}/>}
                {portfolio.is_published ? "Publicar alterações" : "Salvar como rascunho"}
              </span>
              <button type="submit" className="btn btn-primary" disabled={saving || Boolean(uploading)}>
                {saving ? <LoaderCircle size={16}/> : <Save size={16}/>}
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </section>
        </form>

        {savedSlug && <section className="mp-editor-panel" data-editor-step="4" style={{ marginTop: 17 }}>
          <h2>{savedPublished ? "Sua página está publicada" : "Seu rascunho foi salvo"}</h2>
          <p>{savedPublished ? "Compartilhe o link do seu portfólio com contratantes." : "Ative a publicação e salve para liberar seu link."}</p>
          {savedPublished && <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 15 }}>
            <Link href={publicPath} target="_blank" className="btn btn-quiet"><ExternalLink size={15}/> Abrir página</Link>
            <button type="button" className="btn btn-primary" onClick={() => void sharePortfolio()}>
              {copied ? <Copy size={16}/> : <Share2 size={16}/>}
              {copied ? "Link copiado" : "Compartilhar"}
            </button>
          </div>}
        </section>}
      </div>

      <aside className="mp-editor-preview" data-editor-step="4">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
          <div className="mp-editor-title" style={{ margin: 0 }}><Sparkles size={17} color="#C0A7FF"/> Prévia das informações</div>
          <button type="button" ref={openPreviewRef} className="btn btn-quiet" disabled={unifiedSinger} style={{ padding: "8px 11px", fontSize: 12 }}
            aria-haspopup="dialog" aria-expanded={previewTab}
            onClick={() => setPreviewTab(true)}>
            {previewTab ? "Prévia aberta" : "Abrir tela cheia"}
          </button>
        </div>
        {!unifiedSinger&&<MusicianPortfolioView portfolio={effectivePreview} preview instanceId="editor-compact"/>}
        {unifiedSinger&&<p style={{color:"var(--muted)",lineHeight:1.7}}>Os dados salvos aparecem na seção <strong>Atuação musical</strong> do seu perfil público principal. A identidade visual é a mesma do cantor e não existe um segundo portfólio.</p>}
        {unifiedSinger&&savedPublished&&<Link href={publicPath} target="_blank" className="btn btn-quiet">Ver meu perfil artístico</Link>}
        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 12, lineHeight: 1.6 }}>
          {unifiedSinger?"As informações adicionais só aparecem após você salvar e publicar.":"Esta é uma prévia local. Outras pessoas só verão suas alterações depois de salvar e publicar."}
        </p>
      </aside>
    </div>
    {!unifiedSinger&&previewTab && <div className="mp-preview-overlay">
      <button type="button" className="mp-preview-backdrop"
        aria-label="Fechar prévia" onClick={() => setPreviewTab(false)}/>
      <section className="mp-preview-dialog" role="dialog" aria-modal="true" aria-label="Prévia ampliada do portfólio">
        <header className="mp-preview-dialog-header">
          <div>
            <strong><Sparkles size={17}/> Seu portfólio em tela cheia</strong>
            <small>Prévia das alterações ainda não publicadas</small>
          </div>
          <button type="button" ref={closePreviewRef} onClick={() => setPreviewTab(false)}>
            <X size={18}/> Fechar
          </button>
        </header>
        <div className="mp-preview-dialog-content">
          <MusicianPortfolioView portfolio={effectivePreview} instanceId="editor-full"/>
        </div>
      </section>
    </div>}
  </div></main>;
}
