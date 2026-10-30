"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowUpRight, Eye, EyeOff,
  ExternalLink, Globe2, Inbox, LockKeyhole, Mic2, Music2, Palette, Save
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {prepareProfilePortrait} from "@/lib/profile-photo";
import SingerProEditor from "@/components/singer-pro-editor";
import BookingContactSettings from "@/components/booking-contact-settings";
import MobileEditorWizard from "@/components/mobile-editor-wizard";
import {useSessionProfileDraft} from "@/src/domains/artists/hooks/use-session-profile-draft";
import ProfileDraftBanner from "@/src/domains/artists/components/profile-draft-banner";
import {revealMobileEditorField,useMobileEditorKeyboardVisibility} from "@/components/mobile-editor-focus";
import "@/app/meu-perfil-artistico/singer-unified-editor.css";
import {Button,Input,Textarea,InlineNotice,LoadingState} from "@/src/components/ui";
import {showSaveFeedback} from "@/src/components/ui/save-feedback";

type ArtistConfig = {
  name: string;
  username: string | null;
  bio: string;
  city: string;
  instagram_url: string | null;
  youtube_url: string | null;
  spotify_url: string | null;
  is_public: boolean;
  custom_subdomain_enabled: boolean;
  headline?: string;
  accent?: "violet" | "lime" | "cyan";
  avatar_path?: string | null;
  cover_path?: string | null;
};

export default function MeuPerfilArtistico() {
  const router = useRouter();
  useMobileEditorKeyboardVisibility();
  const [config, setConfig] = useState<ArtistConfig | null>(null);
  const [activeTab, setActiveTab] = useState<"dados" | "pro">("dados");
  const [mobileStep,setMobileStep]=useState(0);
  const [proVisited, setProVisited] = useState(false);

  useEffect(() => {
    const updateFromUrl = () => {
      const next = ["pro","midia"].includes(new URLSearchParams(window.location.search).get("aba")||"") ? "pro" : "dados";
      setActiveTab(next);
      if (next === "pro") setProVisited(true);
    };
    updateFromUrl();
    window.addEventListener("popstate", updateFromUrl);
    return () => window.removeEventListener("popstate", updateFromUrl);
  }, []);

  function switchTab(next: "dados" | "pro") {
    setActiveTab(next);
    if (next === "pro") setProVisited(true);
    const url = new URL(window.location.href);
    if (next === "pro") url.searchParams.set("aba", "midia");
    else url.searchParams.delete("aba");
    window.history.pushState(null, "", url.pathname + url.search + url.hash);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const [bio, setBio] = useState("");
  const [headline, setHeadline] = useState("");
  const [accent, setAccent] = useState<"violet" | "lime" | "cyan">("violet");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const [city, setCity] = useState("");
  const [instagram, setInstagram] = useState("");
  const [youtube, setYoutube] = useState("");
  const [spotify, setSpotify] = useState("");
  const [published, setPublished] = useState(false);
  const [savedPublished, setSavedPublished] = useState(false);
  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [bookingAvailable, setBookingAvailable] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingNotice, setBookingNotice] = useState("");
  const [requestedUsername, setRequestedUsername] = useState("");
  const [claimingUsername, setClaimingUsername] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draftOwner,setDraftOwner]=useState<string|null>(null);
  const [draftReady,setDraftReady]=useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadIssue, setLoadIssue] = useState<"failed" | "role" | null>(null);
  const [bookingAttempt, setBookingAttempt] = useState(0);
  const [bookingLoading, setBookingLoading] = useState(false);
  const profileReady = Boolean(config);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const draft=useSessionProfileDraft(draftOwner?"sf:artist:tabdraft:v1:"+draftOwner:null,
    draftReady&&Boolean(config),
    {bio,headline,accent,city,instagram,youtube,spotify},
    value=>{
      if(typeof value.bio==="string")setBio(value.bio.slice(0,1000));
      if(typeof value.headline==="string")setHeadline(value.headline.slice(0,100));
      if(value.accent==="violet"||value.accent==="lime"||value.accent==="cyan")setAccent(value.accent);
      if(typeof value.city==="string")setCity(value.city.slice(0,120));
      if(typeof value.instagram==="string")setInstagram(value.instagram.slice(0,500));
      if(typeof value.youtube==="string")setYoutube(value.youtube.slice(0,500));
      if(typeof value.spotify==="string")setSpotify(value.spotify.slice(0,500));
    });

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setDraftReady(false);
      setLoadIssue(null);
      try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!active) return;
        if (authError?.name === "AuthSessionMissingError") { router.replace("/login"); return; }
        if (authError) { setLoadIssue("failed"); return; }
        if (!user) { router.replace("/login"); return; }
        const { data, error: requestError } = await supabase.rpc("stage_my_artist_page");
        if (!active) return;
        if (requestError) { setLoadIssue("failed"); return; }
        if (!data) { setLoadIssue("role"); return; }
        const p = data as ArtistConfig;
        setConfig(p);
        setBio(p.bio || "");
        setHeadline(p.headline || "");
        setAccent(p.accent === "lime" || p.accent === "cyan" ? p.accent : "violet");
        setAvatarPath(p.avatar_path || null);
        setCoverPath(p.cover_path || null);
        setCity(p.city || "");
        setInstagram(p.instagram_url || "");
        setYoutube(p.youtube_url || "");
        setSpotify(p.spotify_url || "");
        setPublished(Boolean(p.is_public));
        setSavedPublished(Boolean(p.is_public));
        setDraftOwner(user.id);
        setDraftReady(true);
      } catch {
        if (active) setLoadIssue("failed");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [router, loadAttempt]);

  // Retrying this preference must never reload the profile or replace its draft.
  useEffect(() => {
    if (!profileReady) return;
    let active = true;
    async function loadBooking() {
      setBookingLoading(true);
      setBookingAvailable(false);
      try {
        const { data, error: requestError } = await createClient().rpc("stage_my_artist_booking_settings");
        if (!active) return;
        if (!requestError && typeof data === "boolean") {
          setBookingEnabled(data);
          setBookingAvailable(true);
        }
      } catch {
        // The editor stays usable and offers an independent retry below.
      } finally {
        if (active) setBookingLoading(false);
      }
    }
    void loadBooking();
    return () => { active = false; };
  }, [profileReady, bookingAttempt]);

  async function changeBookingEnabled(nextValue: boolean) {
    if (!bookingAvailable || bookingBusy) return;
    setBookingBusy(true);
    setBookingNotice("");
    try {
      const { data, error: preferenceError } = await createClient().rpc(
        "stage_set_artist_bookings_enabled", { p_enabled: nextValue }
      );
      if (preferenceError || data !== "saved") {
        setBookingNotice("Não foi possível alterar esta preferência. Tente novamente; sua escolha anterior foi mantida.");
      } else {
        setBookingEnabled(nextValue);
        showSaveFeedback(nextValue?"Preferência salva: pedidos habilitados.":"Preferência salva: pedidos desativados.");
        setBookingNotice(nextValue
          ? "Pedidos habilitados. O formulário aparece assim que seu perfil gratuito estiver publicado."
          : "Pedidos desativados. O formulário não aparece mais na página pública.");
      }
    } catch {
      setBookingNotice("Não foi possível alterar esta preferência. Tente novamente; sua escolha anterior foi mantida.");
    } finally {
      setBookingBusy(false);
    }
  }

  async function claimUsername(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!config || config.username || claimingUsername) return;
    setClaimingUsername(true);
    setError(false);
    setMessage("");
    const clean = requestedUsername.trim().toLowerCase();
    const { data, error: claimError } = await createClient().rpc(
      "stage_claim_artist_username", { p_username: clean }
    );
    if (claimError || (data !== "claimed" && data !== "unchanged")) {
      const reasons: Record<string,string> = {
        invalid: "Use de 3 a 30 caracteres: letras minúsculas, números ou hífens.",
        reserved: "Este @ é reservado para uma área do Stage Flow. Escolha outro.",
        taken: "Este @ já pertence a outro artista. Escolha outro.",
        already_set: "Sua conta já possui um @. Reabra a página para conferir."
      };
      setError(true);
      setMessage((!claimError && reasons[String(data)]) || "Não foi possível definir seu @. Tente novamente.");
    } else {
      setConfig(prev => prev ? { ...prev, username: clean } : prev);
      showSaveFeedback("Endereço @ salvo com sucesso! Agora você pode publicar.");
      setMessage("Seu @ gratuito foi registrado! Agora você já pode publicar seu perfil.");
    }
    setClaimingUsername(false);
  }

  async function uploadPhoto(kind: "avatar" | "cover", event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || uploading || saving) return;
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"
    };
    if (!extensions[file.type] || file.size > 5 * 1024 * 1024) {
      setError(true);
      setMessage("Selecione um arquivo JPG, PNG ou WebP com até 5 MB.");
      return;
    }
    setUploading(kind);
    setMessage("");
    setError(false);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError(true);
      setMessage("Entre novamente na sua conta para enviar imagens.");
      setUploading(null);
      return;
    }
    const prepared=kind==="avatar"?await prepareProfilePortrait(file):file;
    const imagePath = user.id + "/" + crypto.randomUUID() + "." + extensions[prepared.type];
    const { error: uploadError } = await supabase.storage.from("stage-artist-public").upload(
      imagePath, prepared, { upsert: false, contentType: prepared.type, cacheControl: "3600" }
    );
    if (uploadError) {
      setError(true);
      setMessage("Não foi possível enviar a imagem. Tente novamente; a imagem anterior foi mantida.");
    } else {
      if (kind === "avatar") setAvatarPath(imagePath);
      else setCoverPath(imagePath);
      setMessage("Imagem enviada! Clique em Salvar para aplicar na sua página pública.");
    }
    setUploading(null);
  }

  function photoUrl(path: string | null) {
    return path ? createClient().storage.from("stage-artist-public").getPublicUrl(path).data.publicUrl : "";
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || uploading) return;
    setSaving(true);
    setError(false);
    setMessage("");
    const { data, error: requestError } = await createClient().rpc(
      "stage_save_artist_page_v2", {
        p_bio: bio,
        p_city: city,
        p_instagram_url: instagram || null,
        p_youtube_url: youtube || null,
        p_spotify_url: spotify || null,
        p_is_public: published,
        p_headline: headline,
        p_accent: accent,
        p_avatar_path: avatarPath,
        p_cover_path: coverPath
      }
    );
    const messages: Record<string,string> = {
      username_required: "Defina seu @ gratuito no formulário acima antes de publicar.",
      invalid_accent: "Escolha uma das três cores gratuitas disponíveis.",
      invalid_avatar: "A foto de perfil precisa ter sido enviada por esta página.",
      invalid_cover: "A capa precisa ter sido enviada por esta página.",
      text_too_long: "A apresentação ou a cidade ultrapassou o limite permitido.",
      invalid_link: "Use links HTTPS completos do Instagram, YouTube ou Spotify, conforme o campo.",
      artist_required: "Esta conta não tem a função de artista habilitada."
    };
    if (requestError || data !== "saved") {
      setError(true);
      setMessage((!requestError && messages[String(data)]) || "Não foi possível salvar. Seus dados continuam aqui para tentar novamente.");
    } else {
      setConfig(previous=>previous?{...previous,instagram_url:instagram||null}:previous);
      setSavedPublished(published);
      draft.savedToAccount();
      showSaveFeedback(published?"Perfil Artístico salvo e publicado com sucesso!":"Etapa salva com sucesso! Seu perfil continua privado.");
      setMessage(published
        ? "Sua página gratuita foi publicada. Agora é só compartilhar o seu endereço!"
        : "Perfil salvo em modo privado. A página não aparece publicamente.");
    }
    setSaving(false);
  }

  if (loading) return <main className="container artist-editor-loading">
    <LoadingState label="Carregando perfil artístico..."/>
  </main>;

  if (!config) return <main className="singer-unified-editor">
    <div className="container artist-editor-container">
      <section className="artist-editor-recovery" aria-label="Recuperação do perfil artístico">
        <h2>Não foi possível abrir o editor</h2>
        <InlineNotice tone="danger">{loadIssue === "role"
          ? "Esta conta não tem a função de artista habilitada. Confira suas funções na conta."
          : "Não foi possível carregar seu perfil artístico. Tente novamente."}</InlineNotice>
        <div className="artist-editor-recovery-actions">
          <Button onClick={() => setLoadAttempt(attempt => attempt + 1)}>Tentar novamente</Button>
          <Link href={loadIssue === "role" ? "/minha-conta" : "/painel"}
            className="sf-ui-button sf-ui-button-secondary">
            {loadIssue === "role" ? "Conferir minha conta" : "Voltar ao painel"}
          </Link>
        </div>
      </section>
    </div>
  </main>;

  return <main className="singer-unified-editor" onFocusCapture={event=>revealMobileEditorField(event.target)}>
    <div className="container artist-editor-container">
      <nav className="nav">
        <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
        <Link href="/painel" className="sf-ui-button sf-ui-button-secondary"><ArrowLeft size={15}/> Meu painel</Link>
      </nav>
      <section className="singer-editor-intro">
        <div className="eyebrow"><span className="dot"/> PERFIL ARTÍSTICO</div>
        <h1>Seu perfil. <span className="accent">Seu palco.</span></h1>
        <p className="lead">Seu trabalho em um único perfil: sua história, fotos, agenda e contato gratuitos. Personalize os recursos Pro no mesmo endereço, quando disponíveis no seu plano.</p>
      </section>

      <nav className="singer-editor-tabs" aria-label="Áreas do Perfil Artístico">
        <button type="button" aria-current={activeTab === "dados" ? "page" : undefined}
          aria-pressed={activeTab === "dados"} className={activeTab === "dados" ? "is-active" : ""}
          onClick={() => switchTab("dados")}>
          <Mic2 size={17}/> Dados e publicação <span>Gratuito</span>
        </button>
        <button type="button" aria-current={activeTab === "pro" ? "page" : undefined}
          aria-pressed={activeTab === "pro"} className={activeTab === "pro" ? "is-active" : ""}
          onClick={() => switchTab("pro")}>
          <Palette size={17}/> Aparência e galerias <span>Recursos Pro</span>
        </button>
      </nav>
      {config?.username && <div className="singer-editor-canonical">
        <Globe2 size={17}/>
        <span>Seu único endereço público: <strong>/{config.username}</strong></span>
        {savedPublished && <Link href={"/" + encodeURIComponent(config.username)} target="_blank" rel="noopener noreferrer">
          Ver página <ArrowUpRight size={14}/>
        </Link>}
      </div>}

      <div className="singer-editor-data-panel" hidden={activeTab !== "dados"}>
      {message && <div className="artist-editor-feedback"><InlineNotice tone={error?"danger":"success"}>{message}</InlineNotice></div>}
      <ProfileDraftBanner pending={draft.pending} saveState={draft.saveState} restore={draft.restore} discard={draft.discard} published={savedPublished}/>

      {config && <div className="artist-free-editor artist-wizard-mode" data-editor-active={mobileStep}>
        <section className="feature">
          <div data-editor-step="0" className="artist-wizard-identity">
          <h2 className="artist-editor-identity-title"><Globe2 size={19} className="artist-editor-heading-icon"/> Seu único endereço público</h2>
          <p>Seu nome público: <strong className="artist-editor-emphasis">{config.name}</strong></p>
          <div className="artist-free-address">
            <strong>/{config.username || "seu-usuario"}</strong>
            <span>{config.username ? "Este caminho é usado no domínio StageFlow" : "Você ainda não cadastrou um nome de usuário"}</span>
          </div>
          <p className="fine">Você não precisa pagar para ter esse endereço. O @ é único e pertence à sua conta.</p>
          {!config.username && <form onSubmit={claimUsername} className="artist-editor-claim-form">
            <Input label="Escolher meu @ gratuito *" id="claim-artist-username" value={requestedUsername}
                onChange={e => setRequestedUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                minLength={3} maxLength={30} required pattern="[a-z0-9-]{3,30}"
                placeholder="ex.: cantorsousa" hint={"Você poderá escolher o @ uma vez. Ele será a parte final do seu endereço."}/>
            <Button type="submit" loading={claimingUsername}>
              {!claimingUsername&&<Globe2 size={16}/>}
              {claimingUsername ? "Registrando..." : "Reservar meu @"}
            </Button>
          </form>}

          </div>
          <button type="button" className="sf-artist-preview-shortcut sf-ui-button sf-ui-button-secondary" onClick={()=>setMobileStep(3)}>
            <Eye size={16}/> Ver prévia antes de publicar
          </button>
          <MobileEditorWizard
            steps={[{value:0,label:"Identidade e fotos"},{value:1,label:"Apresentação"},
              {value:2,label:"Redes sociais"},{value:3,label:"Publicar e contratar"}]}
            active={mobileStep} onChange={setMobileStep} formId="artist-main-form"
            disabled={saving||Boolean(uploading)}
            saveDisabled={published&&!config.username}
          />
          <form id="artist-main-form" onSubmit={save} className="artist-editor-main-form">
            <div data-editor-step="0" className="artist-wizard-group">
            <details className="sf-editor-extra"><summary>Personalização opcional: frase e cores</summary>
            <Input label="Frase de assinatura" id="artist-headline" maxLength={100} value={headline}
                onChange={e => setHeadline(e.target.value)}
                placeholder="Ex.: Pagode, samba e muita energia em cada show" hint={"Aparece apenas uma vez, em fonte de assinatura logo abaixo do seu nome. Até 100 caracteres. A biografia é independente."}/>
            <fieldset className="artist-editor-colors">
              <legend><Palette size={15}/> Cor do perfil gratuito</legend>
              <div className="artist-free-color-options">
                {([
                  ["violet", "Roxo", "#a99bff"],
                  ["lime", "Rosa", "#e6a3c8"],
                  ["cyan", "Azul", "#72dce7"]
                ] as const).map(([value, label, color]) =>
                  <Button variant="secondary" key={value} aria-pressed={accent === value}
                    onClick={() => setAccent(value)} className="artist-free-color"
                    aria-label={"Selecionar " + label}>
                    <span style={{ background: color }}/>
                    {label}
                  </Button>
                )}
              </div>
              <p className="artist-editor-hint">Temas e layouts adicionais farão parte do Perfil Artístico premium.</p>
            </fieldset>
            </details>
            <div id="artist-edit-photo" className="artist-free-photo-fields">
              <div className="artist-editor-photo-control">
                <Input label="Foto de perfil" id="artist-avatar-upload" type="file"
                  accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading) || saving}
                  aria-busy={uploading === "avatar"} onChange={e => void uploadPhoto("avatar", e)}
                  hint={uploading === "avatar" ? "Enviando foto..." : "JPG, PNG ou WebP de até 5 MB. O retrato é ajustado para um formato quadrado."}/>
                {avatarPath && <Button variant="secondary" onClick={() => setAvatarPath(null)}>Remover foto</Button>}
              </div>
              <div className="artist-editor-photo-control">
                <Input label="Imagem de capa" id="artist-cover-upload" type="file"
                  accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading) || saving}
                  aria-busy={uploading === "cover"} onChange={e => void uploadPhoto("cover", e)}
                  hint={uploading === "cover" ? "Enviando capa..." : "Imagem horizontal em JPG, PNG ou WebP de até 5 MB."}/>
                {coverPath && <Button variant="secondary" onClick={() => setCoverPath(null)}>Remover capa</Button>}
              </div>
            </div>
            <p className="artist-editor-hint">Fotos são arquivos públicos de divulgação, mesmo quando o perfil ainda está em rascunho. Não envie documentos ou imagens privadas.</p>
            </div>
            <div data-editor-step="1" className="artist-wizard-group">
            <div id="artist-edit-bio" className="artist-editor-bio-field">
              <Textarea label="Apresentação artística" id="artist-bio" value={bio} onChange={e => setBio(e.target.value)}
                maxLength={1000} rows={5}
                placeholder="Conte sua história, estilo musical e o que faz seus shows especiais..." hint={`${bio.length}/1000 caracteres. Conte sua história sem repetir a frase de assinatura. Se os textos forem idênticos, o site exibirá a assinatura apenas uma vez.`}/>
            </div>
            <Input label="Cidade de atuação" id="artist-city" value={city} onChange={e => setCity(e.target.value)} maxLength={120} placeholder="Ex.: Rio de Janeiro - RJ"/>
            </div>
            <div data-editor-step="2" className="artist-wizard-group">
            <Input label="Instagram (opcional)" id="artist-instagram" type="url" value={instagram}
                onChange={e => setInstagram(e.target.value)} placeholder="https://www.instagram.com/seuusuario"/>
            <Input label="YouTube (opcional)" id="artist-youtube" type="url" value={youtube}
                onChange={e => setYoutube(e.target.value)} placeholder="https://www.youtube.com/@seuusuario"/>
            <Input label="Spotify (opcional)" id="artist-spotify" type="url" value={spotify}
                onChange={e => setSpotify(e.target.value)} placeholder="https://open.spotify.com/artist/..."/>
            </div>
            <div data-editor-step="3" className="artist-wizard-group">
            <label id="artist-edit-publicacao" className="artist-editor-publication">
              <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)}
                className="artist-editor-publication-checkbox" aria-describedby="artist-publication-help"/>
              <span><strong>Publicar meu perfil artístico</strong>
                <span id="artist-publication-help" className="artist-editor-muted">
                  Esta opção só é aplicada ao salvar. Visitantes poderão ver o perfil publicado e os eventos marcados como públicos.
                </span>
              </span>
            </label>
            <p className="sf-editor-publication-explain">{published?"Ao salvar, suas alterações ficarão públicas.":savedPublished?"Para deixar sua página privada, desmarque a publicação e salve.":"Para manter tudo privado, deixe a publicação desmarcada e toque em Salvar."}</p>
            <Button type="submit" loading={saving} disabled={Boolean(uploading) || (published && !config.username)}>
              {!saving&&<Save size={16}/>}
              {saving ? "Salvando..." : published ? "Salvar e publicar" : "Salvar rascunho"}
            </Button>
            </div>
          </form>
          <div data-editor-step="3" className="artist-wizard-extras">
          <section id="artist-edit-booking" className="artist-booking-setting" aria-label="Recebimento de pedidos de contratação">
            <div className="artist-free-label artist-editor-booking-label">CONTATO COM CONTRATANTES</div>
            <label className="artist-booking-setting-toggle">
              <input type="checkbox" checked={bookingEnabled}
                disabled={!bookingAvailable || bookingBusy}
                onChange={event => void changeBookingEnabled(event.target.checked)}/>
              <span>
                <strong>Receber pedidos de contratação pelo meu perfil</strong>
                <small>Se ativado, o público poderá enviar propostas pelo formulário da página gratuita. Seus dados pessoais não aparecem no site; você receberá os contatos na sua caixa privada.</small>
              </span>
            </label>
            {bookingLoading && <p role="status" className="artist-editor-hint">Carregando preferência de contratação...</p>}
            {!bookingAvailable && !bookingLoading && <InlineNotice tone="warning">
              Não foi possível carregar esta preferência. Você pode continuar editando seu perfil.
              <Button variant="secondary" onClick={() => setBookingAttempt(attempt => attempt + 1)}>
                Tentar carregar preferência
              </Button>
            </InlineNotice>}
            {bookingAvailable && !savedPublished && <p className="field-help">O formulário ficará visível somente depois de publicar sua página gratuita.</p>}
            {bookingNotice && <p className="field-help" role="status">{bookingNotice}</p>}
          </section>
          <BookingContactSettings kind="singer"
            instagramConfigured={Boolean(config.instagram_url)}
            formEnabled={bookingEnabled}/>
          {savedPublished && config.username && <Link href={"/" + config.username} target="_blank" className="sf-ui-button sf-ui-button-secondary artist-editor-public-link">
            <ExternalLink size={16}/> Visualizar página pública <ArrowUpRight size={15}/>
          </Link>}
          <Link href="/meu-perfil-artistico/solicitacoes" className="sf-ui-button sf-ui-button-secondary artist-editor-inbox-link">
            <Inbox size={17}/> Pedidos de contratação <ArrowUpRight size={15}/>
          </Link>
          </div>
        </section>

        <aside className="artist-wizard-preview">
          <section className="feature">
            <div className="eyebrow"><span className="dot"/> PRÉVIA EM TEMPO REAL</div>
            <div className="artist-free-editor-preview" style={{ "--artist-free-accent": accent === "lime" ? "#e6a3c8" : accent === "cyan" ? "#72dce7" : "#a99bff" } as CSSProperties}>
              <div className="artist-free-editor-cover" style={coverPath ? { backgroundImage: `linear-gradient(0deg,#0e1420cc,#10121b66),url("${photoUrl(coverPath)}")` } : {}}>
                <div className="artist-free-editor-avatar">
                  {avatarPath ? <img src={photoUrl(avatarPath)} alt="Sua foto de perfil"/> : (config.name.trim().split(/\s+/).slice(0,2).map(n=>n[0]?.toUpperCase()).join("") || "SF")}
                </div>
              </div>
              <div className="artist-free-editor-preview-info">
                <span>@{config.username || "seuusuario"}</span>
                <strong>{config.name}</strong>
                <p className="artist-free-editor-preview-signature">{headline || "Sua assinatura artística"}</p>
                {city && <p className="artist-free-editor-preview-city">{city}</p>}
              </div>
            </div>
            <p className="artist-editor-hint artist-editor-preview-caption">Sua capa, foto e cor são mostradas aqui antes de publicar.</p>
          </section>
          <section className="feature">
          <div className="eyebrow"><span className="dot"/> RECURSO PROFISSIONAL</div>
          <h2 className="artist-editor-professional-title">Seu perfil já tem visual profissional</h2>
          <p>Seu endereço público é <strong className="artist-editor-emphasis">/{config.username || "seuusuario"}</strong>, com o mesmo visual do Perfil Artístico. Agenda, apresentação e contatos permanecem gratuitos. Galerias, temas exclusivos e destaques ficam bloqueados até a assinatura Pro ser habilitada.</p>
          {config.username&&savedPublished&&<Link href={"/"+encodeURIComponent(config.username)} target="_blank" rel="noopener noreferrer"
            className="sf-ui-button sf-ui-button-secondary artist-editor-full-link">
            <ExternalLink size={16}/> Ver meu perfil público <ArrowUpRight size={14}/>
          </Link>}
          <Button onClick={() => switchTab("pro")} className="artist-editor-appearance-action">
            <Palette size={17}/> Aparência e galerias deste perfil <ArrowUpRight size={15}/>
          </Button>
          <p className="artist-editor-pro-hint">
            Editor privado. A publicação é manual e exige acesso Pro autorizado. Não há cobrança automática.
          </p>
          <div className="artist-free-premium-note">
            <LockKeyhole size={18}/>
            <span>{config.custom_subdomain_enabled
              ? "O direito ao subdomínio está marcado na sua conta; a configuração de domínio ainda será implementada."
              : "Recurso adicional. Ainda não disponível para contratação."}</span>
          </div>
          <div className="artist-free-mini-status">
            {savedPublished ? <Eye size={17}/> : <EyeOff size={17}/>}
            {savedPublished ? "Perfil gratuito publicado" : "Perfil gratuito em modo privado"}
          </div>
          <p className="artist-editor-hint">O mesmo perfil público permanece disponível quando os recursos Pro estão desativados.</p>

          </section>
        </aside>
      </div>}
      </div>
      {proVisited && <div className="singer-editor-pro-panel" hidden={activeTab !== "pro"}>
        <SingerProEditor active={activeTab === "pro"} onEditData={() => switchTab("dados")}/>
      </div>}
    </div>
  </main>;
}
