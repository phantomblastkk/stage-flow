"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import {
  ArrowDown, ArrowUp, Check, Edit3, ExternalLink,
  ImagePlus, LoaderCircle, PlayCircle, Star, Trash2, X, Youtube
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./premium-media-gallery.css";

const BUCKET = "stage-premium-drafts";
const MAX_ITEMS = 20;
const PHOTO_SIZE_LIMIT = 5 * 1024 * 1024;

export type PremiumMediaItem = {
  id: string;
  media_kind: "photo" | "youtube";
  title: string;
  storage_path: string | null;
  youtube_id: string | null;
  featured: boolean;
  display_order: number;
  preview_url?: string;
};

function parseYouTubeId(input: string): string | null {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);
    let id: string | null = null;
    if (host === "youtu.be" || host === "www.youtu.be") {
      id = parts[0] || null;
    } else if (
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com"
    ) {
      if (parts[0] === "watch") id = url.searchParams.get("v");
      else if (["shorts", "live", "embed"].includes(parts[0])) id = parts[1] || null;
    }
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function usePremiumGallery(enabled: boolean) {
  const [items, setItems] = useState<PremiumMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data, error: loadError } = await supabase.rpc("stage_my_premium_site_media");
    if (loadError) {
      setError("Ative premium_site_media_gallery_migration.sql no Supabase para usar a galeria. " + loadError.message);
      setLoading(false);
      return;
    }
    const rows = Array.isArray(data) ? data as PremiumMediaItem[] : [];
    const withUrls = await Promise.all(rows.map(async item => {
      if (item.media_kind !== "photo" || !item.storage_path) return item;
      const { data: signed, error: signError } = await supabase.storage
        .from(BUCKET).createSignedUrl(item.storage_path, 3600);
      return { ...item, preview_url: signError ? "" : (signed?.signedUrl || "") };
    }));
    setItems(withUrls);
    setLoading(false);
    setError("");
  }, []);

  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);

  async function call(name: string, params: Record<string, unknown>, success: string) {
    if (busy) return false;
    setBusy(true);
    setError("");
    setMessage("");
    const { data, error: rpcError } = await createClient().rpc(name, params);
    if (rpcError || data !== "saved") {
      const reasons: Record<string, string> = {
        limit_reached: "Você atingiu o limite de 20 trabalhos no rascunho.",
        invalid_title: "O título deve ter de 1 a 90 caracteres.",
        invalid_video: "Esse vídeo do YouTube não tem um identificador válido.",
        invalid_order: "A ordem dos trabalhos mudou. Recarregue a galeria e tente novamente.",
        not_found: "Este trabalho não foi encontrado na sua conta.",
        duplicate: "Esta foto já está na galeria."
      };
      setError(rpcError?.message || reasons[String(data)] || "Não foi possível concluir a operação.");
      setBusy(false);
      return false;
    }
    await reload();
    setMessage(success);
    setBusy(false);
    return true;
  }

  async function addPhoto(file: File, title: string) {
    if (busy) return;
    const exts: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"
    };
    if (!exts[file.type] || file.size <= 0 || file.size > PHOTO_SIZE_LIMIT) {
      setError("Envie JPG, PNG ou WebP de até 5 MB.");
      return;
    }
    if (items.length >= MAX_ITEMS) {
      setError("Limite de 20 trabalhos. Remova um item antes de enviar outro.");
      return;
    }
    const name = title.trim() || file.name.replace(/\.[^.]+$/, "");
    if (!name || name.length > 90) {
      setError("O título da foto deve ter até 90 caracteres.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      setError("Sua sessão expirou. Entre novamente.");
      setBusy(false);
      return;
    }
    const path = user.id + "/" + crypto.randomUUID() + "." + exts[file.type];
    const { error: uploadError } = await supabase.storage.from(BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type, cacheControl: "3600" });
    if (uploadError) {
      setError("Não foi possível enviar a foto: " + uploadError.message);
      setBusy(false);
      return;
    }
    const { data, error: insertError } = await supabase.rpc("stage_add_premium_site_media", {
      p_kind: "photo", p_title: name, p_storage_path: path, p_youtube_id: null
    });
    if (insertError || data !== "saved") {
      await supabase.storage.from(BUCKET).remove([path]);
      setError(insertError?.message ||
        (data === "limit_reached" ? "Limite de 20 trabalhos atingido." : "Não foi possível cadastrar a foto."));
      setBusy(false);
      return;
    }
    await reload();
    setMessage("Foto salva no seu rascunho privado.");
    setBusy(false);
  }

  async function addVideo(title: string, url: string) {
    const id = parseYouTubeId(url);
    if (!id) {
      setError("Cole um link HTTPS válido de vídeo, Shorts ou live do YouTube.");
      return false;
    }
    if (!title.trim() || title.trim().length > 90) {
      setError("Dê um título ao vídeo com até 90 caracteres.");
      return false;
    }
    return call("stage_add_premium_site_media", {
      p_kind: "youtube", p_title: title.trim(),
      p_youtube_id: id, p_storage_path: null
    }, "Vídeo adicionado ao rascunho.");
  }

  async function remove(item: PremiumMediaItem) {
    const ok = await call("stage_remove_premium_site_media", { p_id: item.id }, "Trabalho removido da galeria.");
    if (ok && item.media_kind === "photo" && item.storage_path) {
      const { error: removeError } = await createClient().storage.from(BUCKET).remove([item.storage_path]);
      if (removeError) {
        setError("O item foi removido da galeria, mas não foi possível excluir seu arquivo privado: " + removeError.message);
      }
    }
  }

  async function reorder(id: string, delta: -1 | 1) {
    const index = items.findIndex(item => item.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= items.length) return;
    const ordered = items.map(item => item.id);
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    await call("stage_reorder_premium_site_media", { p_ids: ordered }, "Ordem atualizada.");
  }

  return {
    items, loading, busy, error, message,
    reload, addPhoto, addVideo, remove, reorder,
    feature: (id: string) => call("stage_feature_premium_site_media",
      { p_id: id }, "Trabalho definido como destaque."),
    rename: (id: string, title: string) => call("stage_rename_premium_site_media",
      { p_id: id, p_title: title }, "Título atualizado.")
  };
}

export type PremiumGallery = ReturnType<typeof usePremiumGallery>;

function MediaThumbnail({ item }: { item: PremiumMediaItem }) {
  if (item.media_kind === "photo") {
    return item.preview_url ?
      <img src={item.preview_url} alt={item.title} loading="lazy"/> :
      <div className="premium-media-missing"><ImagePlus size={22}/> Foto indisponível</div>;
  }
  return <img src={"https://i.ytimg.com/vi/" + item.youtube_id + "/hqdefault.jpg"}
    alt={"Miniatura do vídeo: " + item.title} loading="lazy"/>;
}

export function PremiumGalleryEditor({ gallery }: { gallery: PremiumGallery }) {
  const [photoTitle, setPhotoTitle] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await gallery.addPhoto(file, photoTitle);
    setPhotoTitle("");
  }

  async function addVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await gallery.addVideo(videoTitle, videoUrl);
    if (ok) { setVideoTitle(""); setVideoUrl(""); }
  }

  async function rename(event: FormEvent<HTMLFormElement>, item: PremiumMediaItem) {
    event.preventDefault();
    if (await gallery.rename(item.id, editingTitle.trim())) setEditingId(null);
  }

  return <section className="premium-media-editor" aria-label="Galeria do seu site profissional">
    <div className="premium-media-editor-heading">
      <div>
        <span className="premium-design-eyebrow"><ImagePlus size={15}/> GALERIA DO SITE PROFISSIONAL</span>
        <h2>Seus melhores momentos.</h2>
        <p>Fotos de shows e vídeos do YouTube organizados na prévia. Até {MAX_ITEMS} trabalhos.</p>
      </div>
      <span className="premium-media-count">{gallery.items.length}/{MAX_ITEMS} trabalhos</span>
    </div>

    <div className="premium-media-inputs">
      <div className="premium-media-add-box">
        <h3><ImagePlus size={17}/> Adicionar foto de show</h3>
        <label htmlFor="premium-photo-title">Nome da foto (opcional)</label>
        <input id="premium-photo-title" value={photoTitle} maxLength={90}
          onChange={event => setPhotoTitle(event.target.value)}
          placeholder="Ex.: Show no Rio de Janeiro"/>
        <label className={"premium-media-upload" + (gallery.busy || gallery.items.length >= MAX_ITEMS ? " is-disabled" : "")}
          htmlFor="premium-photo-file">
          {gallery.busy ? <LoaderCircle size={16}/> : <ImagePlus size={16}/>}
          {gallery.busy ? "Aguarde..." : "Escolher foto (até 5 MB)"}
        </label>
        <input id="premium-photo-file" className="premium-media-file" type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={gallery.busy || gallery.items.length >= MAX_ITEMS}
          onChange={event => void upload(event)}/>
        <small>Foto salva em área privada. Use apenas imagens que você tem autorização para divulgar.</small>
      </div>
      <form className="premium-media-add-box" onSubmit={event => void addVideo(event)}>
        <h3><Youtube size={17}/> Adicionar vídeo do YouTube</h3>
        <label htmlFor="premium-video-title">Título do vídeo</label>
        <input id="premium-video-title" required maxLength={90}
          value={videoTitle} onChange={event => setVideoTitle(event.target.value)}
          placeholder="Ex.: Pagode ao vivo"/>
        <label htmlFor="premium-video-link">Link do vídeo</label>
        <input id="premium-video-link" type="url" required
          value={videoUrl} onChange={event => setVideoUrl(event.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."/>
        <button type="submit" className="premium-media-upload"
          disabled={gallery.busy || gallery.items.length >= MAX_ITEMS}>
          <PlayCircle size={16}/> Adicionar vídeo
        </button>
        <small>A prévia exibe a miniatura e abre o vídeo no YouTube.</small>
      </form>
    </div>

    {gallery.error && <p className="premium-media-feedback is-error" role="alert">{gallery.error}</p>}
    {gallery.message && <p className="premium-media-feedback" role="status">{gallery.message}</p>}
    {gallery.loading ? <p className="premium-media-loading"><LoaderCircle size={16}/> Carregando trabalhos...</p> :
      gallery.items.length === 0
        ? <div className="premium-media-empty">Sua galeria está vazia. Comece com a foto de um show ou um vídeo.</div>
        : <div className="premium-media-list">
          {gallery.items.map((item, index) =>
            <article className="premium-media-list-item" key={item.id}>
              <div className="premium-media-list-photo"><MediaThumbnail item={item}/></div>
              <div className="premium-media-item-info">
                <div className="premium-media-item-flags">
                  <span>{item.media_kind === "photo" ? "FOTO" : "YOUTUBE"}</span>
                  {item.featured && <span className="premium-media-featured"><Star size={12} fill="currentColor"/> DESTAQUE</span>}
                </div>
                {editingId === item.id ?
                  <form className="premium-media-rename" onSubmit={event => void rename(event, item)}>
                    <input value={editingTitle} maxLength={90} required
                      onChange={event => setEditingTitle(event.target.value)}/>
                    <button type="submit" disabled={gallery.busy} aria-label="Salvar título"><Check size={16}/></button>
                    <button type="button" onClick={() => setEditingId(null)} aria-label="Cancelar edição"><X size={16}/></button>
                  </form> : <strong>{item.title}</strong>}
                <div className="premium-media-actions">
                  <button type="button" disabled={gallery.busy || item.featured}
                    onClick={() => void gallery.feature(item.id)}>
                    <Star size={14}/>{item.featured ? "Destaque" : "Destacar"}
                  </button>
                  <button type="button" disabled={gallery.busy}
                    onClick={() => {setEditingId(item.id);setEditingTitle(item.title);}}>
                    <Edit3 size={14}/> Título
                  </button>
                  <button type="button" disabled={gallery.busy || index === 0}
                    onClick={() => void gallery.reorder(item.id, -1)} aria-label={"Subir " + item.title}>
                    <ArrowUp size={14}/> Subir
                  </button>
                  <button type="button" disabled={gallery.busy || index === gallery.items.length - 1}
                    onClick={() => void gallery.reorder(item.id, 1)} aria-label={"Descer " + item.title}>
                    <ArrowDown size={14}/> Descer
                  </button>
                  {deleteId === item.id ?
                    <button type="button" className="premium-media-delete-confirm"
                      disabled={gallery.busy} onClick={() => {setDeleteId(null);void gallery.remove(item);}}>
                      Confirmar remoção
                    </button>
                    : <button type="button" disabled={gallery.busy}
                      onClick={() => setDeleteId(item.id)}><Trash2 size={14}/> Remover</button>}
                  {deleteId === item.id && <button type="button" onClick={() => setDeleteId(null)}>Cancelar</button>}
                </div>
              </div>
            </article>
          )}
        </div>
    }
    <p className="premium-media-privacy">
      <strong>Rascunho privado:</strong> as imagens ficam protegidas no Supabase e são mostradas aqui com links temporários.
      Links e miniaturas do YouTube são públicos no YouTube. Esta galeria não publica um site pago nem altera seu perfil gratuito.
    </p>
  </section>;
}

export function PremiumGalleryShowcase({ items }: { items: PremiumMediaItem[] }) {
  if (items.length === 0) return null;
  const featured = items.find(item => item.featured);
  const ordered = featured ? [featured, ...items.filter(item => item.id !== featured.id)] : items;
  return <div className="premium-media-showcase">
    {ordered.map((item, index) => {
      const href = item.youtube_id ? "https://www.youtube.com/watch?v=" + item.youtube_id : "";
      const visual = <div className="premium-media-showcase-photo">
        <MediaThumbnail item={item}/>
        {item.media_kind === "youtube" && <span className="premium-media-play"><PlayCircle size={32}/></span>}
      </div>;
      return <article className={"premium-media-showcase-card" + (index === 0 ? " is-featured" : "")} key={item.id}>
        {href ? <a href={href} target="_blank" rel="noopener noreferrer"
          aria-label={"Assistir no YouTube: " + item.title}>{visual}</a> : visual}
        <div className="premium-media-showcase-details">
          <span>{item.featured ? "EM DESTAQUE" : item.media_kind === "youtube" ? "VÍDEO" : "FOTO"}</span>
          <h3>{item.title}</h3>
          {href && <a href={href} target="_blank" rel="noopener noreferrer">Assistir no YouTube <ExternalLink size={13}/></a>}
        </div>
      </article>;
    })}
  </div>;
}
