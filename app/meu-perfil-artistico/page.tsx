"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowUpRight, CheckCircle2, Eye, EyeOff,
  ExternalLink, Globe2, Instagram, LoaderCircle, LockKeyhole, Music2, Save
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
};

export default function MeuPerfilArtistico() {
  const router = useRouter();
  const [config, setConfig] = useState<ArtistConfig | null>(null);
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [instagram, setInstagram] = useState("");
  const [youtube, setYoutube] = useState("");
  const [spotify, setSpotify] = useState("");
  const [published, setPublished] = useState(false);
  const [savedPublished, setSavedPublished] = useState(false);
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

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(false);
    setMessage("");
    const { data, error: requestError } = await createClient().rpc(
      "stage_save_artist_page", {
        p_bio: bio,
        p_city: city,
        p_instagram_url: instagram || null,
        p_youtube_url: youtube || null,
        p_spotify_url: spotify || null,
        p_is_public: published
      }
    );
    const messages: Record<string,string> = {
      username_required: "Você ainda não possui um @ artístico. Por enquanto, ele precisa ser definido na criação da conta.",
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

          <form onSubmit={save} style={{ display: "grid", gap: 12, marginTop: 21 }}>
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
            <button type="submit" className="btn btn-primary" disabled={saving || (published && !config.username)} style={{ justifyContent: "center" }}>
              {saving ? <LoaderCircle size={16}/> : <Save size={16}/>}
              {saving ? "Salvando..." : published ? "Salvar e publicar" : "Salvar rascunho"}
            </button>
          </form>
          {savedPublished && config.username && <Link href={"/" + config.username} target="_blank" className="btn btn-quiet" style={{ marginTop: 16 }}>
            <ExternalLink size={16}/> Visualizar página pública <ArrowUpRight size={15}/>
          </Link>}
        </section>

        <aside className="feature" style={{ alignSelf: "start" }}>
          <div className="eyebrow"><span className="dot"/> RECURSO PROFISSIONAL</div>
          <h2 style={{ fontSize: 22, marginTop: 19 }}>Site próprio e subdomínio</h2>
          <p>O site profissional completo, com visual como o de um grande artista, galeria, vídeos, agenda avançada e endereço do tipo <strong style={{ color: "var(--text)" }}>{config.username || "seuusuario"}.stageflow.com</strong>, será uma contratação adicional.</p>
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
        </aside>
      </div>}
    </div>
  </main>;
}
