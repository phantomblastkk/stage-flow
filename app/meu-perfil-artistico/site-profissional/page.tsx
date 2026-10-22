"use client";

import "./premium-preview.css";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2,
  ChevronLeft, ChevronRight, Crown, ExternalLink, Globe2, Instagram,
  LockKeyhole, LoaderCircle, MapPin, Mic2, Music2, PlayCircle,
  Sparkles, Youtube, Palette, Save, Eye, EyeOff, RotateCcw, ArrowUp, ArrowDown
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PremiumGalleryEditor, PremiumGalleryShowcase, usePremiumGallery } from "./premium-media-gallery";
import ProSitePublicationControls from "./pro-publish-controls";

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
  { id: "lime", name: "Verde", color: "#b2e65f" },
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

export default function SiteProfissionalPreview() {
  const router = useRouter();
  const [artist, setArtist] = useState<ArtistPreview | null>(null);
  const [events, setEvents] = useState<PublicShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState("");
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [draft, setDraft] = useState<PremiumDraft>(defaultDraft);
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
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!active) return;
      if (userError || !user) {
        router.replace("/login");
        return;
      }

      // Dados do próprio artista: preview autenticada, não rota pública premium.
      const { data: owner, error: ownerError } = await supabase.rpc("stage_my_artist_page");
      if (!active) return;
      if (ownerError) {
        setProblem("Não foi possível abrir a prévia. Confira se free_artist_pages_migration.sql e free_artist_visuals_migration.sql foram executados. " + ownerError.message);
        setLoading(false);
        return;
      }
      if (!owner) {
        setProblem("Esta prévia é destinada a contas com função de cantor ou artista.");
        setLoading(false);
        return;
      }
      setArtist(owner as ArtistPreview);

      const { data: savedDesign, error: designError } = await supabase.rpc("stage_my_premium_site_draft");
      if (!active) return;
      if (designError) {
        setDraftError("Para salvar seu rascunho, execute premium_site_draft_editor_migration.sql no Supabase. Você pode testar as opções enquanto isso.");
      } else if (savedDesign) {
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
        const legacySections = Array.isArray(saved.section_order) &&
          saved.section_order.includes("portfolio" as SectionId);
        if (legacySections) {
          setDraftError("Para organizar Fotos e Vídeos separadamente, execute a nova migração pro_artist_independent_media_sections_migration.sql no Supabase. Seus dados continuam preservados.");
        }
        // Um design antigo ainda exige migracao antes da publicacao com 5 secoes.
        setDraftReady(Boolean((savedDesign as {updated_at?:string|null}).updated_at) &&
          !legacySections);
      } else {
        setDraftError("Não foi possível carregar o rascunho profissional. Confira a configuração do Supabase.");
      }

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
      if (eventsError) setProblem("A agenda não pôde ser carregada. " + eventsError.message);
      else setEvents((ownerEvents || []) as PublicShow[]);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [router]);

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
    if (!artist || savingDraft) return;
    setSavingDraft(true);
    setDraftMessage("");
    const { data, error: saveError } = await createClient().rpc("stage_save_premium_site_draft", {
      p_theme: draft.theme,
      p_accent: draft.accent,
      p_section_order: draft.section_order,
      p_visible_sections: draft.visible_sections
    });
    if (saveError || data !== "saved") {
      setDraftError(saveError
        ? "Não foi possível salvar (" + saveError.code + "): " + saveError.message +
          ". Confira a migração pro_artist_independent_media_sections_migration.sql."
        : "Não foi possível salvar. Execute pro_artist_independent_media_sections_migration.sql no Supabase.");
      setDraftMessage("Rascunho ainda não salvo. Suas escolhas permanecem na prévia aberta.");
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
    setSavingDraft(false);
  }

  const imageUrl = (path?: string | null) =>
    path ? createClient().storage.from("stage-artist-public").getPublicUrl(path).data.publicUrl : "";

  if (loading) {
    return <main className="container" style={{ minHeight: "85vh", display: "grid", placeItems: "center" }}>
      <p style={{ display: "flex", gap: 9, alignItems: "center", color: "var(--muted)" }}>
        <LoaderCircle size={19}/> Preparando a prévia do seu site profissional...
      </p>
    </main>;
  }

  return <main className="premium-preview-app">
    <div className="premium-preview-toolbar">
      <Link href="/meu-perfil-artistico" className="premium-preview-back"><ArrowLeft size={17}/> Voltar à minha página</Link>
      <span className="premium-preview-label"><LockKeyhole size={15}/> EDITOR PRIVADO · VISUAL DO RASCUNHO</span>
      <Link href="/painel" className="premium-preview-back">Meu painel <ArrowUpRight size={15}/></Link>
    </div>

    {problem && <div className="premium-preview-problem" role="alert">{problem}</div>}

    {!artist ? <div className="premium-preview-empty">
      <Mic2 size={28}/>
      <h1>Seu site profissional começa aqui.</h1>
      <p>Entre com uma conta artística e configure sua página gratuita antes de experimentar a prévia.</p>
      <Link href="/meu-perfil-artistico" className="btn btn-primary">Configurar meu perfil <ArrowRight size={16}/></Link>
    </div> : <>
      <section className="premium-design-editor" aria-label="Personalização do site profissional">
        <div className="premium-design-heading">
          <div>
            <span className="premium-design-eyebrow"><Palette size={15}/> PERSONALIZAÇÃO DO SITE PROFISSIONAL</span>
            <h2>Seu estilo, seu palco.</h2>
            <p>Personalize seu site Pro. Organize Galeria de fotos e Vídeos separadamente, escolha quais aparecem e mude a ordem livremente.</p>
          </div>
          <button type="button" className="premium-design-collapse"
            onClick={() => setEditorOpen(current => !current)}
            aria-expanded={editorOpen}>{editorOpen ? "Ocultar opções" : "Personalizar"} <ArrowRight size={15}/></button>
        </div>
        {editorOpen && <div className="premium-design-controls">
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
              disabled={savingDraft || (!unsaved && draftReady)}>
              {savingDraft ? <LoaderCircle size={16}/> : <Save size={16}/>}
              {savingDraft ? "Salvando..." : "Salvar rascunho"}
            </button>
          </div>
        </div>}
        {draftError && <p className="premium-design-feedback premium-design-error" role="alert">{draftError}</p>}
        {draftMessage && <p className="premium-design-feedback" role="status">{draftMessage}</p>}
      </section>
      <PremiumGalleryEditor gallery={gallery}/>
      <ProSitePublicationControls
        unsaved={unsaved} draftReady={draftReady}
        galleryBusy={gallery.busy} galleryLoading={gallery.loading}
      />
      <div className={"premium-site premium-theme-" + draft.theme + " premium-site-" + draft.accent}>
        <header className="premium-site-nav">
          <Link href="/" className="premium-site-brand"><span className="premium-site-signal"><Music2 size={20}/></span> STAGE FLOW</Link>
          <nav aria-label="Seções do site profissional">
            {visibleOrder.map(section =>
              <a href={sectionAnchor[section]} key={section}>
                {SECTION_LABELS[section]}
              </a>
            )}
          </nav>
          <span className="premium-site-example"><Sparkles size={13}/> PRÉVIA DO SEU SITE PRO</span>
        </header>

        <section className="premium-site-hero">
          <div className="premium-site-photo">
            {artist.cover_path && <img src={imageUrl(artist.cover_path)} alt="" className="premium-site-cover" />}
            {artist.avatar_path && <img src={imageUrl(artist.avatar_path)} alt={"Foto de " + firstName} className="premium-site-portrait"/>}
            {!artist.cover_path && !artist.avatar_path && <span className="premium-site-initials" aria-label="Foto não adicionada">{firstName.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("")}</span>}
            <span className="premium-site-photo-caption">SUA IDENTIDADE. SEU PALCO.</span>
          </div>

          <div className="premium-site-identity">
            <div className="premium-site-small-label"><span/> ARTISTA / SITE PROFISSIONAL</div>
            <h1>{firstName}</h1>
            {artist.city && <p className="premium-site-city"><MapPin size={16}/> {artist.city}</p>}
            <p className="premium-site-intro">{artist.bio?.trim()
              ? artist.bio.length > 320 ? artist.bio.slice(0, 317) + "…" : artist.bio
              : "Apresente ao público a sua identidade musical, suas experiências e o que torna cada show especial. Complete a biografia no editor gratuito para atualizar esta prévia."}</p>

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
            <div className="premium-site-signature-area">
              <p className="premium-site-signature">
                {artist.headline || "Sua música, sua história, seu próximo palco."}
              </p>
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
            <p>{artist.bio || "Sua biografia ficará aqui. Escreva sua trajetória na página gratuita de cantor para ver como ela aparece no site profissional."}</p>
          </div>
          <div className="premium-site-summary">
            <span className="premium-site-summary-icon"><Mic2 size={22}/></span>
            <div><small>PERFIL OFICIAL</small><strong>@{artist.username || "seuusuario"}</strong></div>
            <p>Seu endereço gratuito continua existindo mesmo que você contrate um site profissional no futuro.</p>
            {artist.username && artist.is_public && <Link href={"/" + artist.username} target="_blank">
              Abrir meu perfil gratuito <ArrowUpRight size={15}/>
            </Link>}
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
              {selectedShows.length > 0 ? selectedShows.slice(0, 6).map(event => <div className="premium-site-show" key={event.id}>
                <div className="premium-site-showdate"><strong>{new Date(event.starts_at).toLocaleDateString("pt-BR", { day: "2-digit" })}</strong><small>{new Date(event.starts_at).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase()}</small></div>
                <div className="premium-site-showinfo">
                  <strong>{event.title}</strong>
                  <span><MapPin size={13}/> {[event.venue, event.city].filter(Boolean).join(" · ") || "Local a confirmar"}</span>
                  <span><CalendarDays size={13}/> {fullDate(event.starts_at)}</span>
                </div>
                <span className="premium-site-showpill">Publicado</span>
              </div>) : <div className="premium-site-no-shows">
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
            <p>Na publicação Pro, o pedido de contratação aparece aqui quando você o habilita na sua página gratuita.</p>
          </div>
          {artist.username && artist.is_public
            ? <Link href={"/" + artist.username + "#contratar"} target="_blank" className="premium-site-main-action">
                <Mic2 size={17}/> Testar pedido no perfil gratuito <ArrowUpRight size={16}/>
              </Link>
            : artist.instagram_url
              ? <a href={artist.instagram_url} target="_blank" rel="noopener noreferrer" className="premium-site-main-action"><Instagram size={17}/> Falar pelo Instagram <ArrowUpRight size={16}/></a>
              : <span className="premium-site-contact-pending"><LockKeyhole size={16}/> Publique sua página gratuita para receber pedidos</span>}
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
          <span>UM PASSO ALÉM DO PERFIL GRATUITO</span>
          <h2>Seu site Pro já pode ser publicado.</h2>
          <p>O site profissional agora pode funcionar publicamente no endereço <strong>/pro/{artist.username || "seuusuario"}</strong>, quando o artista tiver acesso Pro autorizado e clicar em Publicar. Tema, galeria, agenda e contratação usam somente os dados divulgados.</p>
          <p className="premium-preview-protection"><LockKeyhole size={16}/> Não há cobrança automática ou subdomínio ativo nesta fase. Seu perfil gratuito continua independente.</p>
          <p>Os contatos enviados pela página gratuita ficam na sua <Link href="/meu-perfil-artistico/solicitacoes" style={{ color: "#d8c0ff", textDecoration: "underline" }}>caixa privada de pedidos de contratação</Link>.</p>
        </div>
        <Link href="/meu-perfil-artistico" className="btn btn-quiet">Editar meus dados <ArrowUpRight size={15}/></Link>
      </section>
    </>}
  </main>;
}
