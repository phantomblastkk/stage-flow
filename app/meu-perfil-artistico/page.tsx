"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowUpRight, CheckCircle2, Eye, EyeOff,
  ExternalLink, Globe2, ImagePlus, LoaderCircle, LockKeyhole, Music2, Palette, Save, Upload
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
  const [config, setConfig] = useState<ArtistConfig | null>(null);
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
  const [requestedUsername, setRequestedUsername] = useState("");
  const [claimingUsername, setClaimingUsername] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) { router.replace("/login"); return; }
      const { data, error: requestError } = await supabase.rpc("stage_my_artist_page");
      if (!active) return;
      if (requestError) {
        setError(true);
        setMessage("Para configurar sua página de cantor, execute free_artist_pages_migration.sql no Supabase. " + requestError.message);
      } else if (!data) {
        setError(true);
        setMessage("Você precisa ter uma conta com função de artista para configurar esta página.");
      } else {
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
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [router]);

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
      setMessage(claimError?.message || reasons[String(data)] || "Não foi possível definir seu @.");
    } else {
      setConfig(prev => prev ? { ...prev, username: clean } : prev);
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
    const imagePath = user.id + "/" + crypto.randomUUID() + "." + extensions[file.type];
    const { error: uploadError } = await supabase.storage.from("stage-artist-public").upload(
      imagePath, file, { upsert: false, contentType: file.type, cacheControl: "3600" }
    );
    if (uploadError) {
      setError(true);
      setMessage("Falha ao enviar. Execute free_artist_visuals_migration.sql no Supabase. Detalhes: " + uploadError.message);
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
      setMessage(requestError?.message || messages[String(data)] || "Não foi possível salvar.");
    } else {
      setSavedPublished(published);
      setMessage(published
        ? "Sua página gratuita foi publicada. Agora é só compartilhar o seu endereço!"
        : "Perfil salvo em modo privado. A página não aparece publicamente.");
    }
    setSaving(false);
  }

  if (loading) return <main className="container" style={{ minHeight: "75vh", display: "grid", placeItems: "center" }}>
    <p style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: 9 }}><LoaderCircle size={18}/> Carregando perfil artístico...</p>
  </main>;

  return <main>
    <div className="container" style={{ paddingBottom: 60 }}>
      <nav className="nav">
        <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
        <Link href="/painel" className="btn btn-quiet"><ArrowLeft size={15}/> Meu painel</Link>
      </nav>
      <section style={{ padding: "42px 0 23px" }}>
        <div className="eyebrow"><span className="dot"/> PERFIL PÚBLICO DO CANTOR</div>
        <h1 style={{ fontSize: "clamp(32px,5vw,46px)", margin: "15px 0" }}>Seu @. <span className="accent">Seu palco.</span></h1>
        <p className="lead">Tenha uma página pública com sua identidade, apresentação, redes sociais e shows publicados, sem pagar por subdomínio.</p>
      </section>

      {message && <div role={error ? "alert" : "status"} className="coming"
        style={error ? { borderColor: "#754343", background: "#281919", color: "#ffb5b5", maxWidth: 770 } : { maxWidth: 770 }}>
        {!error && <CheckCircle2 size={15} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }}/>}
        {message}
      </div>}

      {config && <div className="artist-free-editor">
        <section className="feature">
          <h2 style={{ fontSize: 21, marginBottom: 12 }}><Globe2 size={19} style={{ display: "inline", verticalAlign: "middle", marginRight: 7 }}/> Endereço gratuito</h2>
          <p>Seu nome público: <strong style={{ color: "var(--text)" }}>{config.name}</strong></p>
          <div className="artist-free-address">
            <strong>stageflow.com/{config.username || "seu-usuario"}</strong>
            <span>{config.username ? "No domínio oficial, quando estiver disponível" : "Você ainda não cadastrou um nome de usuário"}</span>
          </div>
          <p className="fine">Você não precisa pagar para ter esse endereço. O @ é único e pertence à sua conta.</p>
          {!config.username && <form onSubmit={claimUsername} style={{ marginTop: 17 }}>
            <div className="field">
              <label htmlFor="claim-artist-username">Escolher meu @ gratuito *</label>
              <input id="claim-artist-username" value={requestedUsername}
                onChange={e => setRequestedUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                minLength={3} maxLength={30} required pattern="[a-z0-9-]{3,30}"
                placeholder="ex.: cantorsousa"/>
              <span className="field-help">Você poderá escolher o @ uma vez. Ele será a parte final do seu endereço.</span>
            </div>
            <button type="submit" className="btn btn-primary" disabled={claimingUsername}>
              {claimingUsername ? <LoaderCircle size={16}/> : <Globe2 size={16}/>}
              {claimingUsername ? "Registrando..." : "Reservar meu @"}
            </button>
          </form>}

          <form onSubmit={save} style={{ display: "grid", gap: 12, marginTop: 21 }}>
            <div className="field">
              <label htmlFor="artist-headline">Frase de destaque</label>
              <input id="artist-headline" maxLength={100} value={headline}
                onChange={e => setHeadline(e.target.value)}
                placeholder="Ex.: Pagode, samba e muita energia em cada show"/>
              <span className="field-help">Aparece abaixo do nome. Até 100 caracteres.</span>
            </div>
            <div className="field">
              <label><Palette size={15} style={{ display: "inline", verticalAlign: "middle" }}/> Cor do perfil gratuito</label>
              <div className="artist-free-color-options">
                {([
                  ["violet", "Roxo", "#a99bff"],
                  ["lime", "Verde", "#c6f36b"],
                  ["cyan", "Azul", "#72dce7"]
                ] as const).map(([value, label, color]) =>
                  <button type="button" key={value} aria-pressed={accent === value}
                    onClick={() => setAccent(value)} className="artist-free-color"
                    aria-label={"Selecionar " + label}>
                    <span style={{ background: color }}/>
                    {label}
                  </button>
                )}
              </div>
              <span className="field-help">Temas e layouts adicionais farão parte do site profissional premium.</span>
            </div>
            <div className="artist-free-photo-fields">
              <div className="field">
                <label htmlFor="artist-avatar-upload">Foto de perfil</label>
                <label className="mp-file-upload"><Upload size={16}/>
                  {uploading === "avatar" ? "Enviando..." : "Enviar foto"}
                  <input id="artist-avatar-upload" type="file"
                    accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading) || saving}
                    onChange={e => void uploadPhoto("avatar", e)}/>
                </label>
                {avatarPath && <button type="button" className="btn btn-quiet" onClick={() => setAvatarPath(null)}>Remover foto</button>}
              </div>
              <div className="field">
                <label htmlFor="artist-cover-upload">Imagem de capa</label>
                <label className="mp-file-upload"><ImagePlus size={16}/>
                  {uploading === "cover" ? "Enviando..." : "Enviar capa"}
                  <input id="artist-cover-upload" type="file"
                    accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading) || saving}
                    onChange={e => void uploadPhoto("cover", e)}/>
                </label>
                {coverPath && <button type="button" className="btn btn-quiet" onClick={() => setCoverPath(null)}>Remover capa</button>}
              </div>
            </div>
            <p className="field-help">Fotos são arquivos públicos de divulgação, mesmo quando o perfil ainda está em rascunho. Não envie documentos ou imagens privadas.</p>
            <div className="field">
              <label htmlFor="artist-bio">Apresentação artística</label>
              <textarea id="artist-bio" value={bio} onChange={e => setBio(e.target.value)}
                maxLength={1000} rows={5}
                placeholder="Conte sua história, estilo musical e o que faz seus shows especiais..."
                style={{ width: "100%", padding: 13, background: "var(--panel)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: 11, resize: "vertical" }}/>
              <span className="field-help">{bio.length}/1000 caracteres</span>
            </div>
            <div className="field">
              <label htmlFor="artist-city">Cidade de atuação</label>
              <input id="artist-city" value={city} onChange={e => setCity(e.target.value)} maxLength={120} placeholder="Ex.: Rio de Janeiro - RJ"/>
            </div>
            <div className="field">
              <label htmlFor="artist-instagram">Instagram (opcional)</label>
              <input id="artist-instagram" type="url" value={instagram}
                onChange={e => setInstagram(e.target.value)} placeholder="https://www.instagram.com/seuusuario"/>
            </div>
            <div className="field">
              <label htmlFor="artist-youtube">YouTube (opcional)</label>
              <input id="artist-youtube" type="url" value={youtube}
                onChange={e => setYoutube(e.target.value)} placeholder="https://www.youtube.com/@seuusuario"/>
            </div>
            <div className="field">
              <label htmlFor="artist-spotify">Spotify (opcional)</label>
              <input id="artist-spotify" type="url" value={spotify}
                onChange={e => setSpotify(e.target.value)} placeholder="https://open.spotify.com/artist/..."/>
            </div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>
              <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)}
                style={{ marginTop: 4, accentColor: "var(--lime)" }}/>
              <span><strong>{published ? "Publicação ativada" : "Publicar minha página gratuita"}</strong>
                <span style={{ display: "block", color: "var(--muted)" }}>
                  Apenas quando estiver publicado, visitantes poderão ver seu perfil. Somente eventos marcados como públicos aparecem na agenda.
                </span>
              </span>
            </label>
            <button type="submit" className="btn btn-primary" disabled={saving || Boolean(uploading) || (published && !config.username)} style={{ justifyContent: "center" }}>
              {saving ? <LoaderCircle size={16}/> : <Save size={16}/>}
              {saving ? "Salvando..." : published ? "Salvar e publicar" : "Salvar rascunho"}
            </button>
          </form>
          {savedPublished && config.username && <Link href={"/" + config.username} target="_blank" className="btn btn-quiet" style={{ marginTop: 16 }}>
            <ExternalLink size={16}/> Visualizar página pública <ArrowUpRight size={15}/>
          </Link>}
        </section>

        <aside style={{ alignSelf: "start", display: "grid", gap: 17 }}>
          <section className="feature">
            <div className="eyebrow"><span className="dot"/> PRÉVIA EM TEMPO REAL</div>
            <div className="artist-free-editor-preview" style={{ "--artist-free-accent": accent === "lime" ? "#c6f36b" : accent === "cyan" ? "#72dce7" : "#a99bff" } as CSSProperties}>
              <div className="artist-free-editor-cover" style={coverPath ? { backgroundImage: `linear-gradient(0deg,#0e1420cc,#10121b66),url("${photoUrl(coverPath)}")` } : {}}>
                <div className="artist-free-editor-avatar">
                  {avatarPath ? <img src={photoUrl(avatarPath)} alt="Sua foto de perfil"/> : (config.name.trim().split(/\s+/).slice(0,2).map(n=>n[0]?.toUpperCase()).join("") || "SF")}
                </div>
              </div>
              <div className="artist-free-editor-preview-info">
                <span>@{config.username || "seuusuario"}</span>
                <strong>{config.name}</strong>
                <p>{headline || "Música ao vivo"}{city && " · " + city}</p>
              </div>
            </div>
            <p className="field-help" style={{ marginTop: 12 }}>Sua capa, foto e cor são mostradas aqui antes de publicar.</p>
          </section>
          <section className="feature">
          <div className="eyebrow"><span className="dot"/> RECURSO PROFISSIONAL</div>
          <h2 style={{ fontSize: 22, marginTop: 19 }}>Site próprio e subdomínio</h2>
          <p>O site profissional completo, com visual como o de um grande artista, galeria, vídeos, agenda avançada e endereço do tipo <strong style={{ color: "var(--text)" }}>{config.username || "seuusuario"}.stageflow.com</strong>, será uma contratação adicional.</p>
          <Link href="/meu-perfil-artistico/site-profissional" className="btn btn-primary" style={{ marginTop: 16, width: "100%", justifyContent: "center" }}>
            <Globe2 size={17}/> Ver prévia do site profissional <ArrowUpRight size={15}/>
          </Link>
          <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.6, marginTop: 10 }}>
            Prévia privada e gratuita usando seus dados. Não ativa subdomínio ou assinatura.
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
          <p style={{ fontSize: 12, color: "var(--muted)" }}>O site comum permanece disponível mesmo que o subdomínio premium não esteja habilitado.</p>
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 15, marginTop: 18 }}>
            <Link href="/meu-portfolio" className="btn btn-quiet" style={{ width: "100%", justifyContent: "center" }}>
              <Music2 size={16}/> Ver portfólio simples de músico
            </Link>
          </div>
          </section>
        </aside>
      </div>}
    </div>
  </main>;
}
