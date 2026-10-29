"use client";

import "@/app/meu-perfil-artistico/site-profissional/premium-preview.css";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2,
  ChevronLeft, ChevronRight, Crown, ExternalLink, Globe2, Instagram,
  LockKeyhole, LoaderCircle, MapPin, Mic2, Music2, PlayCircle,
  Sparkles, Youtube, Palette, Save, Eye, EyeOff, RotateCcw, ArrowUp, ArrowDown
} from "lucide-react";
import {Button,LoadingState} from "@/src/components/ui";
import { createClient } from "@/lib/supabase/client";
import {publicInstagramProfile} from "@/lib/artist-social";
import {distinctPublicBiography} from "@/lib/profile-presentation";
import ProShowCards from "@/app/meu-perfil-artistico/site-profissional/pro-show-cards";
import { PremiumGalleryEditor, PremiumGalleryShowcase, usePremiumGallery } from "@/app/meu-perfil-artistico/site-profissional/premium-media-gallery";
import ProSitePublicationControls from "@/app/meu-perfil-artistico/site-profissional/pro-publish-controls";

type ArtistPreview = {
  name: string;
  username: string | null;
  bio: string;
  city: string;
  headline?: string;
  accent?: "violet" | "lime" | "cyan";
  avatar_path?: string | null;
  cover_path?: string | null;
  instagram_url?: string | null;
  youtube_url?: string | null;
  spotify_url?: string | null;
  is_public: boolean;
  custom_subdomain_enabled: boolean;
};

type SectionId = "about" | "photos" | "videos" | "agenda" | "contact";
type PreviewTheme = "midnight" | "concert" | "ivory";
type PreviewAccent = "violet" | "lime" | "cyan" | "gold" | "coral";
type PremiumDraft = {
  theme: PreviewTheme;
  accent: PreviewAccent;
  section_order: SectionId[];
  visible_sections: SectionId[];
};

const SECTION_IDS: SectionId[] = ["about","photos","videos","agenda","contact"];
const SECTION_LABELS: Record<SectionId, string> = {
  about: "Sobre", photos: "Galeria de fotos",
  videos: "Vídeos", agenda: "Agenda", contact: "Contato"
};
const sectionAnchor: Record<SectionId, string> = {
  about: "#premium-sobre", photos: "#premium-fotos",
  videos: "#premium-videos", agenda: "#premium-agenda",
  contact: "#premium-contato"
};
function upgradeSections(raw: unknown): SectionId[] {
  if (!Array.isArray(raw)) return [...SECTION_IDS];
  const converted = raw.flatMap((id: string) =>
    id === "portfolio" ? ["photos","videos"] : [id]
  ).filter((id: string) => SECTION_IDS.includes(id as SectionId));
  return [...new Set(converted)] as SectionId[];
}
const defaultDraft = (): PremiumDraft => ({
  theme: "midnight",
  accent: "violet",
  section_order: [...SECTION_IDS],
  visible_sections: [...SECTION_IDS]
});
const themeChoices: { id: PreviewTheme; title: string; description: string }[] = [
  { id: "midnight", title: "Midnight", description: "Azul escuro e elegante" },
  { id: "concert", title: "Concert", description: "Roxo e luz de palco" },
  { id: "ivory", title: "Ivory", description: "Claro e sofisticado" }
];
const accentChoices: { id: PreviewAccent; name: string; color: string }[] = [
  { id: "violet", name: "Roxo", color: "#a976ff" },
  { id: "lime", name: "Rosa", color: "#e6a3c8" },
  { id: "cyan", name: "Ciano", color: "#60cde9" },
  { id: "gold", name: "Dourado", color: "#f0bd65" },
  { id: "coral", name: "Coral", color: "#ff978b" }
];

type PublicShow = {
  id: string;
  title: string;
  venue: string | null;
  city: string | null;
  starts_at: string;
  flyer_path?: string | null;
  flyer_settings?: unknown;
};

const monthTitle = (month: Date) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(month);

const fullDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(new Date(value));

const dayCode = (date: Date) =>
  String(date.getFullYear()) + "-" +
  String(date.getMonth() + 1).padStart(2, "0") + "-" +
  String(date.getDate()).padStart(2, "0");

const showCode = (startsAt: string) => dayCode(new Date(startsAt));

function monthCells(month: Date): (Date | null)[] {
  const year = month.getFullYear();
  const number = month.getMonth();
  const first = new Date(year, number, 1).getDay();
  const days = new Date(year, number + 1, 0).getDate();
  return [
    ...Array.from({ length: first }, () => null),
    ...Array.from({ length: days }, (_, day) => new Date(year, number, day + 1)),
  ];
}

export default function SiteProfissionalPreview({ active = true, onEditData }: { active?: boolean; onEditData?: () => void }) {
  const router = useRouter();
  const [artist, setArtist] = useState<ArtistPreview | null>(null);
  const [events, setEvents] = useState<PublicShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [ownerAttempt, setOwnerAttempt] = useState(0);
  const [draftAttempt, setDraftAttempt] = useState(0);
  const [draftLoading, setDraftLoading] = useState(true);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const ownerReady = Boolean(artist);
  const [problem, setProblem] = useState("");
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [draft, setDraft] = useState<PremiumDraft>(defaultDraft);
  const instagram=publicInstagramProfile(artist?.instagram_url);
  const biography=artist?distinctPublicBiography(artist.headline,artist.bio):"";
  const [savedDraft, setSavedDraft] = useState<PremiumDraft>(defaultDraft);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [editorOpen, setEditorOpen] = useState(true);
  const [draftReady, setDraftReady] = useState(false);
  const gallery = usePremiumGallery(Boolean(artist));

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setProblem("");
      try {
        const supabase = createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (!active) return;
        if (userError && userError.name !== "AuthSessionMissingError") {
          setProblem("Não foi possível verificar sua conta. Tente novamente.");
          return;
        }
        if (!user) {
          router.replace("/login");
          return;
        }

        // Dados do próprio artista: preview autenticada, não rota pública premium.
        const { data: owner, error: ownerError } = await supabase.rpc("stage_my_artist_page");
        if (!active) return;
        if (ownerError) {
          setProblem("Não foi possível abrir a prévia do seu perfil. Tente novamente.");
          setLoading(false);
          return;
        }
        if (!owner) {
          setProblem("Esta prévia é destinada a contas com função de cantor ou artista.");
          setLoading(false);
          return;
        }
        setArtist(owner as ArtistPreview);

        // Exibe APENAS eventos que o próprio artista marcou como públicos e publicados.
        // Esta consulta usa a sessão do proprietário e as políticas já existentes.
        const { data: ownerEvents, error: eventsError } = await supabase
          .from("events")
          .select("id,title,venue,city,starts_at")
          .eq("producer_id", user.id)
          .eq("show_publicly", true)
          .eq("status", "published")
          .gte("starts_at", new Date().toISOString())
          .order("starts_at", { ascending: true })
          .limit(40);

        if (!active) return;
        if (eventsError) setProblem("Não foi possível carregar a agenda da prévia. Seus dados de aparência foram preservados.");
        else {
          // Consulta opcional: o restante da prévia continua funcionando
          // mesmo se o administrador ainda não executou o SQL dos flyers.
          const {data:flyers,error:flyerError}=await supabase.from("events")
            .select("id,flyer_path,flyer_settings")
            .eq("producer_id",user.id)
            .eq("show_publicly",true)
            .eq("status","published")
            .gte("starts_at",new Date().toISOString())
            .limit(40);
          if(!active)return;
          const flyerMap=new Map(
            (flyerError?[]:(flyers||[])).map(item=>[item.id,item] as const)
          );
          setEvents((ownerEvents||[]).map(item=>({
            ...item,...(flyerMap.get(item.id)||{})
          })) as PublicShow[]);
        }
      } catch {
        if (active) setProblem("Não foi possível carregar a prévia. Tente novamente.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [router, ownerAttempt]);

  // A design retry is independent of identity, agenda and gallery reads.
  useEffect(() => {
    if (!ownerReady) return;
    let active = true;
    async function loadDraft() {
      setDraftLoading(true);
      setDraftError("");
      try {
        const supabase = createClient();
        const { data: savedDesign, error: designError } = await supabase.rpc("stage_my_premium_site_draft");
        if (!active) return;
        if (designError) {
          setDraftError("Não foi possível carregar seu rascunho. Tente novamente para editar com segurança.");
        } else if (savedDesign && typeof savedDesign === "object" &&
          typeof savedDesign.theme === "string" && typeof savedDesign.accent === "string" &&
          Array.isArray(savedDesign.section_order) && Array.isArray(savedDesign.visible_sections)) {
          const saved = savedDesign as Partial<PremiumDraft>;
          // Preserva rascunhos anteriores à separação do Portfólio.
          const order = upgradeSections(saved.section_order);
          const visible = upgradeSections(saved.visible_sections);
          const validOrder = order.length === SECTION_IDS.length &&
            SECTION_IDS.every(id => order.includes(id));
          const validVisible = visible.length >= 1 &&
            visible.every(id => SECTION_IDS.includes(id));
          const next: PremiumDraft = {
            theme: themeChoices.some(item => item.id === saved.theme) ? saved.theme! : "midnight",
            accent: accentChoices.some(item => item.id === saved.accent) ? saved.accent! : "violet",
            section_order: validOrder ? order : [...SECTION_IDS],
            visible_sections: validVisible ? visible : [...SECTION_IDS]
          };
          setDraft(next);
          setSavedDraft(next);
          setDraftLoaded(true);
          const legacySections = Array.isArray(saved.section_order) &&
            saved.section_order.includes("portfolio" as SectionId);
          if (legacySections) {
            setDraftError("Seu rascunho usa uma versão anterior. Confira a ordem de Fotos e Vídeos e salve para atualizar suas escolhas.");
          }
          // Um design antigo ainda exige migracao antes da publicacao com 5 secoes.
          setDraftReady(Boolean((savedDesign as {updated_at?:string|null}).updated_at) &&
            !legacySections);
        } else {
          setDraftError("Não foi possível carregar seu rascunho. Tente novamente para editar com segurança.");
        }

      } catch {
        if (active) setDraftError("Não foi possível carregar seu rascunho. Tente novamente para editar com segurança.");
      } finally {
        if (active) setDraftLoading(false);
      }
    }
    void loadDraft();
    return () => { active = false; };
  }, [ownerReady, draftAttempt]);

  // The same profile may have been edited on the free-data tab while this
  // editor stays mounted. Refresh owner-only identity when revisiting Pro,
  // without resetting the unsaved Pro theme, sections or gallery draft.
  useEffect(() => {
    if (!active || loading) return;
    if (!artist) return;
    let current = true;
    void Promise.resolve(createClient().rpc("stage_my_artist_page")).then(({ data, error }) => {
      if (current && !error && data) setArtist(data as ArtistPreview);
    }).catch(() => { /* Keep the current preview and local design on refresh failure. */ });
    return () => { current = false; };
  }, [active, loading]);

  const datesWithShows = useMemo(() => new Set(events.map(e => showCode(e.starts_at))), [events]);
  const selectedShows = selectedDate ? events.filter(e => showCode(e.starts_at) === selectedDate) : events;
  const firstName = artist?.name || "Seu nome artístico";
  const visibleOrder = draft.section_order.filter(section => draft.visible_sections.includes(section));
  const unsaved = JSON.stringify(draft) !== JSON.stringify(savedDraft);

  function moveSection(section: SectionId, direction: -1 | 1) {
    setDraft(prev => {
      const current = prev.section_order.indexOf(section);
      const target = current + direction;
      if (target < 0 || target >= prev.section_order.length) return prev;
      const reordered = [...prev.section_order];
      [reordered[current], reordered[target]] = [reordered[target], reordered[current]];
      return { ...prev, section_order: reordered };
    });
    setDraftMessage("");
  }

  function toggleSection(section: SectionId) {
    const shown = draft.visible_sections.includes(section);
    if (shown && draft.visible_sections.length === 1) {
      setDraftMessage("Mantenha pelo menos uma seção visível.");
      return;
    }
    setDraftMessage("");
    setDraft(prev => ({
      ...prev,
      visible_sections: shown
        ? prev.visible_sections.filter(id => id !== section)
        : [...prev.visible_sections, section]
    }));
  }

  async function saveDraft() {
    if (!artist || savingDraft || !draftLoaded || draftLoading) return;
    setSavingDraft(true);
    setDraftMessage("");
    try {
      const { data, error: saveError } = await createClient().rpc("stage_save_premium_site_draft", {
        p_theme: draft.theme,
        p_accent: draft.accent,
        p_section_order: draft.section_order,
        p_visible_sections: draft.visible_sections
      });
      if (saveError || data !== "saved") {
        setDraftError("Não foi possível salvar seu rascunho. Suas escolhas continuam aqui para tentar novamente.");
        setDraftMessage("");
      } else {
        setDraftError("");
        setSavedDraft({
          ...draft,
          section_order: [...draft.section_order],
          visible_sections: [...draft.visible_sections]
        });
        setDraftReady(true);
        setDraftMessage("Rascunho salvo! Fotos e Vídeos têm visibilidade e posição independentes. Clique em Republicar para atualizar o site público.");
      }
    } catch {
      setDraftError("Não foi possível salvar seu rascunho. Suas escolhas continuam aqui para tentar novamente.");
    } finally {
      setSavingDraft(false);
    }
  }

  const imageUrl = (path?: string | null) =>
    path ? createClient().storage.from("stage-artist-public").getPublicUrl(path).data.publicUrl : "";

  if (loading) {
    return <div className="container premium-editor-loading">
      <LoadingState label="Preparando o editor do seu perfil..."/>
    </div>;
  }

  return <div className="premium-preview-app singer-pro-embedded">
    <div className="premium-preview-toolbar">
      <span className="premium-preview-label"><LockKeyhole size={15}/> MESMO PERFIL PÚBLICO · PRÉVIA PRIVADA DAS OPÇÕES PRO</span>
      <Link href="/meu-perfil-artistico?aba=dados" className="premium-preview-back"
        onClick={onEditData ? event => { event.preventDefault(); onEditData(); } : undefined}>Editar dados do perfil <ArrowUpRight size={15}/></Link>
    </div>

    {problem && <div className="premium-preview-problem" role="alert">{problem}</div>}

    {!artist ? <div className="premium-preview-empty">
      <Mic2 size={28}/>
      <h1>A personalização do seu perfil começa aqui.</h1>
      <p>Confira seus dados ou tente abrir a prévia novamente.</p>
      <Button onClick={() => setOwnerAttempt(attempt => attempt + 1)}>Tentar abrir prévia</Button>
      <Link href="/perfil-artistico" className="btn btn-primary"
        onClick={onEditData ? event => { event.preventDefault(); onEditData(); } : undefined}>Configurar meu perfil <ArrowRight size={16}/></Link>
    </div> : <>
      <section className="premium-design-editor" aria-label="Personalização Pro do perfil de cantor">
        <div className="premium-design-heading">
          <div>
            <span className="premium-design-eyebrow"><Palette size={15}/> VISUAL E RECURSOS DO MESMO PERFIL</span>
            <h2>Seu estilo, seu palco.</h2>
            <p>Este é o mesmo perfil público do cantor. Configure aqui os temas, as galerias e a ordem das seções Pro, sem criar outro site ou endereço.</p>
          </div>
          <button type="button" className="premium-design-collapse"
            onClick={() => setEditorOpen(current => !current)}
            aria-expanded={editorOpen}>{editorOpen ? "Ocultar opções" : "Personalizar"} <ArrowRight size={15}/></button>
        </div>
        {draftLoading && <LoadingState label="Carregando seu rascunho de aparência..."/>}
        {!draftLoaded && !draftLoading && <Button variant="secondary"
          onClick={() => setDraftAttempt(attempt => attempt + 1)}>Tentar carregar rascunho</Button>}
        {editorOpen && draftLoaded && <fieldset className="premium-design-controls" aria-label="Opções de aparência"
          disabled={!draftLoaded || draftLoading || savingDraft}>
          <div className="premium-design-options">
            <div className="premium-design-group">
              <h3>Tema do site</h3>
              <div className="premium-design-themes">
                {themeChoices.map(choice =>
                  <button key={choice.id} type="button" className={"premium-design-theme premium-design-theme-" + choice.id}
                    aria-pressed={draft.theme === choice.id}
                    onClick={() => { setDraft(prev => ({ ...prev, theme: choice.id })); setDraftMessage(""); }}>
                    <span className="premium-design-theme-swatch"><i/><b/></span>
                    <strong>{choice.title}</strong><small>{choice.description}</small>
                  </button>
                )}
              </div>
            </div>
            <div className="premium-design-group">
              <h3>Cor de destaque</h3>
              <div className="premium-design-colors">
                {accentChoices.map(choice =>
                  <button key={choice.id} type="button" aria-pressed={draft.accent === choice.id}
                    className="premium-design-color"
                    onClick={() => { setDraft(prev => ({...prev, accent: choice.id})); setDraftMessage(""); }}
                    aria-label={"Cor " + choice.name}>
                    <span style={{backgroundColor:choice.color}}/>
                    {choice.name}
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="premium-design-sections">
            <div className="premium-design-sections-heading">
              <h3>Organizar seções</h3>
              <span>Fotos e vídeos são duas seções independentes. Desmarque qualquer uma sem ocultar a outra.</span>
            </div>
            {draft.section_order.map((section, index) =>
              <div className="premium-design-section-item" key={section}>
                <label>
                  <input type="checkbox" checked={draft.visible_sections.includes(section)}
                    onChange={() => toggleSection(section)}
                    disabled={draft.visible_sections.length === 1 && draft.visible_sections.includes(section)}
                    aria-label={"Exibir seção " + SECTION_LABELS[section]}/>
                  <span>{draft.visible_sections.includes(section) ? <Eye size={15}/> : <EyeOff size={15}/>}</span>
                  <strong>{SECTION_LABELS[section]}</strong>
                </label>
                <div>
                  <button type="button" aria-label={"Subir " + SECTION_LABELS[section]}
                    disabled={index === 0} onClick={() => moveSection(section,-1)}><ArrowUp size={15}/></button>
                  <button type="button" aria-label={"Descer " + SECTION_LABELS[section]}
                    disabled={index === draft.section_order.length - 1} onClick={() => moveSection(section,1)}><ArrowDown size={15}/></button>
                </div>
              </div>
            )}
          </div>
          <div className="premium-design-footer">
            <span className="premium-design-save-status">
              {unsaved ? "Alterações ainda não salvas" : draftReady ? "Seu rascunho está salvo" : "Experimente o editor"}
            </span>
            <button type="button" className="premium-design-reset"
              onClick={() => {setDraft(defaultDraft());setDraftMessage("Padrão restaurado na prévia. Salve para manter.");}}>
              <RotateCcw size={15}/> Restaurar padrão
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void saveDraft()}
              disabled={!draftLoaded || draftLoading || savingDraft || (!unsaved && draftReady)}>
              {savingDraft ? <LoaderCircle size={16}/> : <Save size={16}/>}
              {savingDraft ? "Salvando..." : "Salvar rascunho"}
            </button>
          </div>
        </fieldset>}
        {draftError && <p className="premium-design-feedback premium-design-error" role="alert">{draftError}</p>}
        {draftMessage && <p className="premium-design-feedback" role="status">{draftMessage}</p>}
      </section>
      <PremiumGalleryEditor gallery={gallery}/>
      <ProSitePublicationControls
        active={active}
        unsaved={unsaved} draftReady={draftReady}
        galleryBusy={gallery.busy} galleryLoading={gallery.loading}
      />
      <div className={"premium-site premium-theme-" + draft.theme + " premium-site-" + draft.accent}>
        <header className="premium-site-nav">
          <Link href="/" className="premium-site-brand"><span className="premium-site-signal"><Music2 size={20}/></span> STAGE FLOW</Link>
          <nav aria-label="Seções do perfil de cantor">
            {visibleOrder.map(section =>
              <a href={sectionAnchor[section]} key={section}>
                {SECTION_LABELS[section]}
              </a>
            )}
          </nav>
          <span className="premium-site-example"><Sparkles size={13}/> PRÉVIA DO PERFIL ÚNICO</span>
        </header>

        <section className="premium-site-hero">
          <div className="premium-site-photo">
            {artist.cover_path && <img src={imageUrl(artist.cover_path)} alt="" className="premium-site-cover" />}
            {artist.avatar_path && <img src={imageUrl(artist.avatar_path)} alt={"Foto de " + firstName} className="premium-site-portrait"/>}
            {!artist.cover_path && !artist.avatar_path && <span className="premium-site-initials" aria-label="Foto não adicionada">{firstName.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("")}</span>}
            <span className="premium-site-photo-caption">SUA IDENTIDADE. SEU PALCO.</span>
          </div>

          <div className="premium-site-identity">
            <div className="premium-site-small-label"><span/> ARTISTA / PERFIL STAGEFLOW</div>
            <div className="premium-site-name-row">
              <h1>{firstName}</h1>
              <p className="premium-site-signature">
                {artist.headline || "Sua música, sua história, seu próximo palco."}
              </p>
            </div>
            {artist.city && <p className="premium-site-city"><MapPin size={16}/> {artist.city}</p>}
            <p className="premium-site-intro">{biography
              ?biography.length>210?biography.slice(0,207)+"…":biography
              :"Conheça os shows, o repertório e as novidades deste artista."}</p>

            <div className="premium-site-socials">
              {artist.instagram_url && <a href={artist.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Instagram size={19}/></a>}
              {artist.youtube_url && <a href={artist.youtube_url} target="_blank" rel="noopener noreferrer" aria-label="YouTube"><Youtube size={19}/></a>}
              {artist.spotify_url && <a href={artist.spotify_url} target="_blank" rel="noopener noreferrer" aria-label="Spotify"><Music2 size={19}/></a>}
              {!artist.instagram_url && !artist.youtube_url && !artist.spotify_url && <span>Redes sociais aparecem aqui quando cadastradas.</span>}
            </div>

            <div className="premium-site-actions">
              {draft.visible_sections.includes("contact") && <a href="#premium-contato" className="premium-site-main-action"><Mic2 size={17}/> Solicitar contratação <ArrowUpRight size={16}/></a>}
              {draft.visible_sections.includes("agenda") && <a href="#premium-agenda" className="premium-site-secondary-action"><CalendarDays size={17}/> Próximos shows</a>}
            </div>
            <div className="premium-site-identity-foot">
              <span><CheckCircle2 size={15}/> Dados do seu perfil Stage Flow</span>
              <span>{events.length} {events.length === 1 ? "show público futuro" : "shows públicos futuros"}</span>
            </div>

          </div>
        </section>

        <div className="premium-site-tabs" aria-label="Navegação por seções">
          {visibleOrder.map(section =>
            <a href={sectionAnchor[section]} key={section}>
              {SECTION_LABELS[section]}
            </a>
          )}
        </div>
        <div className="premium-site-sections">
        {draft.visible_sections.includes("about") && <section id="premium-sobre" className="premium-site-about" style={{order:draft.section_order.indexOf("about")}}>
          <div>
            <span className="premium-site-section-overline">{String(draft.section_order.indexOf("about") + 1).padStart(2,"0")} / A HISTÓRIA POR TRÁS DO SOM</span>
            <h2>Sobre <em>o artista.</em></h2>
            <p>{biography || "Escreva sua história na aba Dados e publicação. Sua assinatura fica apenas abaixo do nome."}</p>
          </div>
          <div className="premium-site-summary">
            <span className="premium-site-summary-icon"><Instagram size={22}/></span>
            <div><small>INSTAGRAM DO ARTISTA</small><strong>{instagram?.handle||"Redes do artista"}</strong></div>
            <p>{instagram?"O Instagram informado será exibido aos visitantes com link direto.":"Cadastre seu Instagram na aba Dados para mostrar o @ e seu perfil social."}</p>
            {instagram&&<a href={instagram.url} target="_blank" rel="noopener noreferrer">Abrir Instagram <ArrowUpRight size={15}/></a>}
          </div>
        </section>}

        {draft.visible_sections.includes("photos") && <section
          id="premium-fotos" className="premium-site-work premium-site-media-section"
          style={{order:draft.section_order.indexOf("photos")}}>
          <div className="premium-site-section-head">
            <div>
              <span className="premium-site-section-overline">
                {String(draft.section_order.indexOf("photos")+1).padStart(2,"0")} / ÁLBUM DO ARTISTA
              </span>
              <h2>Galeria de <em>fotos.</em></h2>
              <p>Shows, ensaios e momentos especiais, em um álbum só de fotografias.</p>
            </div>
            <span className="premium-site-section-icon"><Instagram size={25}/></span>
          </div>
          <PremiumGalleryShowcase
            items={gallery.items} section="photos" showEmpty showHeading={false}
          />
        </section>}

        {draft.visible_sections.includes("videos") && <section
          id="premium-videos" className="premium-site-work premium-site-media-section"
          style={{order:draft.section_order.indexOf("videos")}}>
          <div className="premium-site-section-head">
            <div>
              <span className="premium-site-section-overline">
                {String(draft.section_order.indexOf("videos")+1).padStart(2,"0")} / APRESENTAÇÕES
              </span>
              <h2>Vídeos <em>& apresentações.</em></h2>
              <p>Uma área exclusiva para vídeos de shows e músicas do artista.</p>
            </div>
            <span className="premium-site-section-icon"><PlayCircle size={25}/></span>
          </div>
          <PremiumGalleryShowcase
            items={gallery.items} section="videos" showEmpty showHeading={false}
            youtubeUrl={artist.youtube_url} spotifyUrl={artist.spotify_url}
          />
        </section>}

        {draft.visible_sections.includes("agenda") && <section id="premium-agenda" className="premium-site-agenda" style={{order:draft.section_order.indexOf("agenda")}}>
          <div className="premium-site-section-head">
            <div>
              <span className="premium-site-section-overline">{String(draft.section_order.indexOf("agenda") + 1).padStart(2,"0")} / PRÓXIMAS APRESENTAÇÕES</span>
              <h2>Agenda <em>de shows.</em></h2>
              <p>Somente shows marcados como públicos e publicados no Stage Flow.</p>
            </div>
            <CalendarDays size={28}/>
          </div>

          <div className="premium-site-schedule">
            <div className="premium-site-calendar">
              <div className="premium-site-calendar-heading">
                <h3>{monthTitle(month)}</h3>
                <div>
                  <button type="button" aria-label="Mês anterior" onClick={() => {setMonth(current => new Date(current.getFullYear(), current.getMonth()-1, 1)); setSelectedDate(null);}}><ChevronLeft size={18}/></button>
                  <button type="button" aria-label="Próximo mês" onClick={() => {setMonth(current => new Date(current.getFullYear(), current.getMonth()+1, 1)); setSelectedDate(null);}}><ChevronRight size={18}/></button>
                </div>
              </div>
              <div className="premium-site-daynames">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(label => <span key={label}>{label}</span>)}</div>
              <div className="premium-site-daygrid">
                {monthCells(month).map((date, index) => {
                  if (!date) return <div key={"empty" + index} className="premium-site-day-empty"/>;
                  const key = dayCode(date);
                  const hasShow = datesWithShows.has(key);
                  const chosen = selectedDate === key;
                  return <button type="button" key={key}
                    aria-label={date.toLocaleDateString("pt-BR") + (hasShow ? ", show agendado" : ", sem show")}
                    aria-pressed={chosen}
                    className={(hasShow ? "premium-site-day-hasshow " : "") + (chosen ? "premium-site-day-selected" : "")}
                    onClick={() => setSelectedDate(current => current === key ? null : key)}>
                    {date.getDate()}
                    {hasShow && <Mic2 size={12}/>}
                  </button>;
                })}
              </div>
              <p className="premium-site-calendar-legend"><Mic2 size={15}/> Dia com apresentação pública</p>
            </div>

            <div className="premium-site-showlist">
              <div className="premium-site-showlist-head">
                <h3>{selectedDate ? "Shows do dia" : "Próximos shows"}</h3>
                {selectedDate && <button type="button" onClick={() => setSelectedDate(null)}>Ver todos <ArrowRight size={14}/></button>}
              </div>
              {selectedShows.length > 0 ?
                <ProShowCards shows={selectedShows} artistName={firstName} preview/> :
                <div className="premium-site-no-shows">
                <CalendarDays size={25}/>
                <strong>{selectedDate ? "Nenhum show público nesse dia." : "Nenhum show público futuro."}</strong>
                <span>Você pode cadastrar uma apresentação e marcá-la como pública.</span>
              </div>}
              <Link className="premium-site-agenda-link" href="/eventos">Gerenciar meus shows <ArrowRight size={16}/></Link>
            </div>
          </div>
        </section>}

        {draft.visible_sections.includes("contact") && <section id="premium-contato" className="premium-site-contact" style={{order:draft.section_order.indexOf("contact")}}>
          <div className="premium-site-contact-icon"><Mic2 size={27}/></div>
          <div>
            <h2>Leve {firstName} para seu evento.</h2>
            <p>Pedidos de contratação aparecem neste mesmo perfil quando você os habilita na aba Dados e publicação.</p>
          </div>
          {artist.username && artist.is_public
            ? <Link href={"/" + artist.username + "#premium-contato"} target="_blank" className="premium-site-main-action">
                <Mic2 size={17}/> Ver pedidos no perfil público <ArrowUpRight size={16}/>
              </Link>
            : artist.instagram_url
              ? <a href={artist.instagram_url} target="_blank" rel="noopener noreferrer" className="premium-site-main-action"><Instagram size={17}/> Falar pelo Instagram <ArrowUpRight size={16}/></a>
              : <span className="premium-site-contact-pending"><LockKeyhole size={16}/> Publique o perfil na aba Dados para receber pedidos</span>}
        </section>}
        </div>

        <footer className="premium-site-footer">
          <span><Music2 size={18}/> STAGE FLOW <small>Conectando artistas, músicos e produtores</small></span>
          <span>Prévia privada do editor · para publicar, use os controles acima</span>
        </footer>
      </div>

      <section className="premium-preview-upgrade">
        <div className="premium-preview-upgrade-icon"><Crown size={22}/></div>
        <div>
          <span>RECURSOS ADICIONAIS NO MESMO PERFIL</span>
          <h2><LockKeyhole size={20} style={{display:"inline",verticalAlign:"middle",marginRight:8}}/> Recursos Pro do perfil único de cantor</h2>
          <p>Agenda, apresentação, redes sociais e contatos continuam gratuitos. Os recursos Pro acrescentam temas especiais e galerias ao mesmo perfil público. Você pode preparar o rascunho; a publicação das opções pagas exige autorização da conta. O subdomínio e a cobrança ainda não estão ativados.</p><p>Quando autorizado, os recursos Pro aparecem no seu endereço único <strong>/{artist.username || "seuusuario"}</strong>. O link antigo com /pro/ apenas redireciona para esse perfil.</p>
          <p className="premium-preview-protection"><LockKeyhole size={16}/> Não há cobrança automática. Desativar a publicação Pro não despublica o perfil gratuito.</p>
          <p>Os contatos enviados pelo perfil público ficam na sua <Link href="/meu-perfil-artistico/solicitacoes" style={{ color: "#d8c0ff", textDecoration: "underline" }}>caixa privada de pedidos de contratação</Link>.</p>
        </div>
        <Link href="/meu-perfil-artistico?aba=dados" className="btn btn-quiet"
          onClick={onEditData ? event => { event.preventDefault(); onEditData(); } : undefined}>Editar dados e publicação <ArrowUpRight size={15}/></Link>
      </section>
    </>}
  </div>;
}
