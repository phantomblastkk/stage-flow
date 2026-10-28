"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, Check, Edit3, ExternalLink,
  ChevronLeft, ChevronRight, Images, ImagePlus, LoaderCircle, PlayCircle, Star, Trash2, X, Youtube
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./premium-media-gallery.css";

const BUCKET = "stage-premium-drafts";
const MAX_PER_TYPE = 3;
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
        limit_reached: "Você atingiu o limite de mídias.",
        limit_photos: "Você atingiu o limite de 3 fotos. Remova uma foto para adicionar outra.",
        limit_videos: "Você atingiu o limite de 3 vídeos. Remova um vídeo para adicionar outro.",
        invalid_title: "O título deve ter de 1 a 90 caracteres.",
        invalid_video: "Esse vídeo do YouTube não tem um identificador válido.",
        invalid_order: "A ordem dos trabalhos mudou. Recarregue a galeria e tente novamente.",
        not_found: "Este trabalho não foi encontrado na sua conta.",
        duplicate: "Esta foto já está na galeria.",
        published_media_in_use: "Esta foto está no Perfil Artístico publicado. Retire o Perfil Artístico do ar antes de excluí-la da galeria; depois publique novamente."
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
    if (items.filter(item => item.media_kind === "photo").length >= MAX_PER_TYPE) {
      setError("Limite de 3 fotos atingido. Remova uma foto antes de enviar outra.");
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
        (data === "limit_photos" || data === "limit_reached"
          ? "Limite de 3 fotos atingido. Remova uma foto antes de enviar outra."
          : "Não foi possível cadastrar a foto."));
      setBusy(false);
      return;
    }
    await reload();
    setMessage("Foto salva no seu rascunho privado.");
    setBusy(false);
  }

  async function addVideo(title: string, url: string) {
    if (items.filter(item => item.media_kind === "youtube").length >= MAX_PER_TYPE) {
      setError("Limite de 3 vídeos atingido. Remova um vídeo antes de adicionar outro.");
      return false;
    }
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
    // Fotos e vídeos têm listas independentes no editor, mas a RPC mantém
    // uma ordem global; trocamos apenas itens do MESMO tipo.
    const current = items.find(item => item.id === id);
    if (!current) return;
    const sameKind = items.filter(item => item.media_kind === current.media_kind);
    const index = sameKind.findIndex(item => item.id === id);
    const neighbor = sameKind[index + delta];
    if (!neighbor) return;
    const ordered = items.map(item => item.id);
    const indexA = ordered.indexOf(id);
    const indexB = ordered.indexOf(neighbor.id);
    [ordered[indexA], ordered[indexB]] = [ordered[indexB], ordered[indexA]];
    await call("stage_reorder_premium_site_media", { p_ids: ordered }, "Ordem atualizada na seção.");
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
  const photoCount = gallery.items.filter(item => item.media_kind === "photo").length;
  const videoCount = gallery.items.filter(item => item.media_kind === "youtube").length;
  const photoFull = photoCount >= MAX_PER_TYPE;
  const videoFull = videoCount >= MAX_PER_TYPE;

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

  return <section className="premium-media-editor" aria-label="Galeria do seu Perfil Artístico">
    <div className="premium-media-editor-heading">
      <div>
        <span className="premium-design-eyebrow"><ImagePlus size={15}/> GALERIA DO Perfil Artístico</span>
        <h2>Fotos e vídeos, cada um no seu espaço.</h2>
        <p>O Perfil Artístico permite até 3 fotos e 3 vídeos, com espaços separados para cada tipo de mídia.</p>
      </div>
      <div className="premium-media-limit-counts" aria-label="Limites da galeria">
        <span className={photoFull ? "is-full" : ""}>Fotos: {photoCount}/{MAX_PER_TYPE}</span>
        <span className={videoFull ? "is-full" : ""}>Vídeos: {videoCount}/{MAX_PER_TYPE}</span>
      </div>
    </div>

    <div className="premium-media-inputs">
      <div className="premium-media-add-box">
        <h3><ImagePlus size={17}/> Adicionar foto de show</h3>
        {photoFull && <p className="premium-media-cap-notice">
          Limite de 3 fotos atingido. Remova uma foto antes de enviar outra.
        </p>}
        <label htmlFor="premium-photo-title">Nome da foto (opcional)</label>
        <input id="premium-photo-title" value={photoTitle} maxLength={90}
          onChange={event => setPhotoTitle(event.target.value)}
          placeholder="Ex.: Show no Rio de Janeiro"/>
        <label className={"premium-media-upload" + (gallery.busy || photoFull ? " is-disabled" : "")}
          htmlFor="premium-photo-file">
          {gallery.busy ? <LoaderCircle size={16}/> : <ImagePlus size={16}/>}
          {gallery.busy ? "Aguarde..." : "Escolher foto (até 5 MB)"}
        </label>
        <input id="premium-photo-file" className="premium-media-file" type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={gallery.busy || photoFull}
          onChange={event => void upload(event)}/>
        <small>Foto salva em área privada. Use apenas imagens que você tem autorização para divulgar.</small>
      </div>
      <form className="premium-media-add-box" onSubmit={event => void addVideo(event)}>
        <h3><Youtube size={17}/> Adicionar vídeo do YouTube</h3>
        {videoFull && <p className="premium-media-cap-notice">
          Limite de 3 vídeos atingido. Remova um vídeo antes de adicionar outro.
        </p>}
        <label htmlFor="premium-video-title">Título do vídeo</label>
        <input id="premium-video-title" required maxLength={90}
          value={videoTitle} onChange={event => setVideoTitle(event.target.value)}
          placeholder="Ex.: Pagode ao vivo"/>
        <label htmlFor="premium-video-link">Link do vídeo</label>
        <input id="premium-video-link" type="url" required
          value={videoUrl} onChange={event => setVideoUrl(event.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."/>
        <button type="submit" className="premium-media-upload"
          disabled={gallery.busy || videoFull}>
          <PlayCircle size={16}/> Adicionar vídeo
        </button>
        <small>O vídeo será reproduzido dentro do Perfil Artístico. Também haverá um link direto para o YouTube.</small>
      </form>
    </div>

    {gallery.error && <p className="premium-media-feedback is-error" role="alert">{gallery.error}</p>}
    {gallery.message && <p className="premium-media-feedback" role="status">{gallery.message}</p>}
    {(photoCount > MAX_PER_TYPE || videoCount > MAX_PER_TYPE) &&
      <p className="premium-media-cap-notice" role="status">
        Você possui mídias cadastradas antes do novo limite. Nenhum arquivo foi apagado;
        somente as 3 primeiras fotos e os 3 primeiros vídeos (priorizando o destaque)
        aparecerão na prévia e no Perfil Artístico. Os demais continuam no seu rascunho
        para você organizar ou remover.
      </p>}
    {gallery.loading ? <p className="premium-media-loading"><LoaderCircle size={16}/> Carregando trabalhos...</p> :
      gallery.items.length === 0
        ? <div className="premium-media-empty">Sua galeria está vazia. Comece com fotos de shows ou vídeos do YouTube.</div>
        : <div className="premium-media-groups">
          {(["photo", "youtube"] as const).map(kind => {
            const grouped = gallery.items.filter(item => item.media_kind === kind);
            if (!grouped.length) return null;
            return <section className="premium-media-group" key={kind}
              aria-label={kind === "photo" ? "Fotos cadastradas" : "Vídeos cadastrados"}>
              <div className="premium-media-group-heading">
                {kind === "photo" ? <Images size={19}/> : <Youtube size={19}/>}
                <div><h3>{kind === "photo" ? "Galeria de fotos" : "Vídeos do YouTube"}</h3>
                  <p>{kind === "photo" ? "Escolha a ordem das imagens no álbum." : "Organize seus vídeos de apresentações."}</p>
                </div>
                <span>{grouped.length} {kind === "photo" ? "foto(s)" : "vídeo(s)"}</span>
              </div>
              <div className="premium-media-list">
              {grouped.map((item, index) =>
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
                  <button type="button" disabled={gallery.busy || index === grouped.length - 1}
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
            </section>;
          })}
        </div>
    }
    <p className="premium-media-privacy">
      <strong>Galeria do rascunho:</strong> os arquivos permanecem privados no Supabase.
      Só as fotos que você escolher publicar com o botão <strong>Publicar Perfil Artístico</strong>
      poderão ser baixadas por visitantes, enquanto o site estiver no ar.
      As demais fotos e os dados dos convites continuam privados.
      O player do YouTube só é carregado quando alguém pede para reproduzir.
    </p>
  </section>;
}

export function PremiumGalleryShowcase({
  items, showEmpty = false, youtubeUrl, spotifyUrl,
  section = "both", showHeading = true
}: {
  items: PremiumMediaItem[];
  showEmpty?: boolean;
  youtubeUrl?: string | null;
  spotifyUrl?: string | null;
  section?: "photos" | "videos" | "both";
  showHeading?: boolean;
}) {
  const photos = section === "videos" ? [] : items.filter(item => item.media_kind === "photo");
  const videos = section === "photos" ? [] : items.filter(item => item.media_kind === "youtube");
  const featuredPhoto = photos.find(item => item.featured);
  const orderedPhotos = (featuredPhoto
    ? [featuredPhoto, ...photos.filter(item => item.id !== featuredPhoto.id)]
    : photos).slice(0, MAX_PER_TYPE);
  const featuredVideo = videos.find(item => item.featured);
  const orderedVideos = (featuredVideo
    ? [featuredVideo, ...videos.filter(item => item.id !== featuredVideo.id)]
    : videos).slice(0, MAX_PER_TYPE);
  const [activePhoto, setActivePhoto] = useState<number | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const playerRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const currentVideo = orderedVideos.find(item => item.id === selectedVideoId)
    ?? orderedVideos[0] ?? null;

  function playVideo(id: string) {
    setSelectedVideoId(id);
    setVideoPlaying(true);
    // No celular, traz o player à vista após o clique na miniatura.
    // Não há redirecionamento externo.
    if (typeof window !== "undefined" && window.innerWidth <= 760) {
      playerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  useEffect(() => {
    if (activePhoto === null) return;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActivePhoto(null);
      if (event.key === "ArrowRight") {
        setActivePhoto(i => i === null ? null : (i + 1) % orderedPhotos.length);
      }
      if (event.key === "ArrowLeft") {
        setActivePhoto(i => i === null ? null :
          (i - 1 + orderedPhotos.length) % orderedPhotos.length);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePhoto, orderedPhotos.length]);

  if (!items.length && !showEmpty) return null;

  const selected = activePhoto === null ? null : orderedPhotos[activePhoto] ?? null;
  return <div className={"premium-separated-media" +
    (section === "photos" ? " only-photos" : section === "videos" ? " only-videos" : "")}>
    {section !== "videos" && <section className="premium-photo-gallery"
      id={section === "both" ? "premium-fotos" : undefined}
      aria-labelledby={showHeading ? "premium-photo-title" : undefined}>
      {showHeading && <div className="premium-media-section-heading">
        <div>
          <span className="premium-media-section-label"><Images size={15}/> IMAGENS E BASTIDORES</span>
          <h3 id="premium-photo-title">Galeria de <em>fotos.</em></h3>
          <p>Momentos do palco, registros de shows e bastidores.</p>
        </div>
        {orderedPhotos.length > 0 && <span className="premium-media-section-count">
          {orderedPhotos.length} {orderedPhotos.length === 1 ? "foto" : "fotos"}
        </span>}
      </div>}
      {orderedPhotos.length > 0
        ? <div className="premium-photo-grid">
          {orderedPhotos.map((item, index) =>
            <button key={item.id} type="button"
              disabled={!item.preview_url}
              className={"premium-photo-tile" + (index === 0 && orderedPhotos.length >= 3 ? " is-featured" : "")}
              onClick={() => setActivePhoto(index)}
              aria-label={"Abrir foto " + (index + 1) + " de " + orderedPhotos.length + ": " + item.title}>
              <MediaThumbnail item={item}/>
              <span className="premium-photo-caption">
                <span>{item.title}</span>
                <ImagePlus size={16}/>
              </span>
              {item.featured && <span className="premium-photo-featured"><Star size={13} fill="currentColor"/> DESTAQUE</span>}
            </button>)}
        </div>
        : <div className="premium-media-blank">
            <Images size={24}/>
            <p>As fotos dos shows e bastidores aparecerão aqui.</p>
          </div>}
    </section>}

    {section !== "photos" && <section className="premium-video-gallery"
      id={section === "both" ? "premium-videos" : undefined}
      aria-labelledby={showHeading ? "premium-video-title" : undefined}>
      {showHeading && <div className="premium-media-section-heading">
        <div>
          <span className="premium-media-section-label"><Youtube size={15}/> SHOWS E APRESENTAÇÕES</span>
          <h3 id="premium-video-title">Meus <em>vídeos.</em></h3>
          <p>Assista aos melhores momentos e apresentações no YouTube.</p>
        </div>
        {orderedVideos.length > 0 && <span className="premium-media-section-count">
          {orderedVideos.length} {orderedVideos.length === 1 ? "vídeo" : "vídeos"}
        </span>}
      </div>}
      {orderedVideos.length > 0 ?
        <div className="premium-video-player-layout">
          {currentVideo && <div className="premium-video-theater" ref={playerRef}>
            <div className="premium-video-screen">
              {videoPlaying ? <iframe key={currentVideo.youtube_id}
                src={"https://www.youtube-nocookie.com/embed/" + currentVideo.youtube_id +
                  "?autoplay=1&playsinline=1&rel=0"}
                title={"Reproduzindo: " + currentVideo.title}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen/> :
                <button type="button" className="premium-video-stage-poster"
                  onClick={() => playVideo(currentVideo.id)}
                  aria-label={"Reproduzir na página: " + currentVideo.title}>
                  <img
                    src={"https://i.ytimg.com/vi/" + currentVideo.youtube_id + "/hqdefault.jpg"}
                    alt={"Miniatura de " + currentVideo.title} loading="lazy"/>
                  <span className="premium-video-stage-play"><PlayCircle size={43}/></span>
                  <span className="premium-video-stage-start">Reproduzir neste site</span>
                </button>}
            </div>
            <div className="premium-video-stage-details">
              <div>
                <span>APRESENTAÇÃO SELECIONADA</span>
                <h4>{currentVideo.title}</h4>
              </div>
              <div className="premium-video-stage-actions">
                {videoPlaying && <button type="button"
                  onClick={() => setVideoPlaying(false)}>
                  <X size={15}/> Fechar player
                </button>}
                <a href={"https://www.youtube.com/watch?v=" + currentVideo.youtube_id}
                  target="_blank" rel="noopener noreferrer"
                  aria-label={"Abrir " + currentVideo.title + " no YouTube"}>
                  <ExternalLink size={15}/> Abrir no YouTube
                </a>
              </div>
            </div>
          </div>}
          {orderedVideos.length > 1 && <div className="premium-video-choices-heading">
            <strong>Outras apresentações</strong>
            <span>Selecione uma miniatura para assistir aqui mesmo</span>
          </div>}
          <div className="premium-video-grid" aria-label="Escolha um vídeo para assistir">
            {orderedVideos.map(item => {
              const active = item.id === currentVideo?.id;
              return <button type="button" key={item.id}
                className={"premium-video-tile" + (active ? " is-selected" : "")}
                onClick={() => playVideo(item.id)}
                aria-pressed={active}
                aria-label={"Assistir na página: " + item.title}>
                <div className="premium-video-thumbnail">
                  <MediaThumbnail item={item}/>
                  <span className="premium-video-play"><PlayCircle size={33}/></span>
                </div>
                <div className="premium-video-copy">
                  <div>
                    {item.featured && <small><Star size={12} fill="currentColor"/> EM DESTAQUE</small>}
                    <h4>{item.title}</h4>
                    <span>{active && videoPlaying ? "Reproduzindo aqui" : "Assistir neste site"}</span>
                  </div>
                  <PlayCircle size={18}/>
                </div>
              </button>;
            })}
          </div>
          <p className="premium-video-privacy-note">
            O player do YouTube é carregado somente quando você clica em reproduzir.
            Se o vídeo não permitir reprodução incorporada, use “Abrir no YouTube”.
          </p>
        </div>
        : <div className="premium-media-blank">
            <PlayCircle size={24}/>
            <p>Os vídeos e apresentações aparecerão aqui.</p>
            {youtubeUrl && <a href={youtubeUrl} target="_blank" rel="noopener noreferrer">
              Ver canal no YouTube <ExternalLink size={14}/>
            </a>}
          </div>}
      {spotifyUrl && <a className="premium-video-music-link" href={spotifyUrl}
        target="_blank" rel="noopener noreferrer">
        Ouvir minhas músicas no Spotify <ExternalLink size={14}/>
      </a>}
    </section>}

    {selected?.preview_url && <div className="premium-photo-lightbox"
      role="presentation" onClick={() => setActivePhoto(null)}>
      <div className="premium-photo-lightbox-panel" role="dialog"
        aria-modal="true" aria-label={"Foto ampliada: " + selected.title}
        onClick={event => event.stopPropagation()}>
        <div className="premium-photo-lightbox-toolbar">
          <span>{(activePhoto ?? 0) + 1} / {orderedPhotos.length}</span>
          <button ref={closeRef} type="button" onClick={() => setActivePhoto(null)}
            aria-label="Fechar galeria"><X size={21}/></button>
        </div>
        <img src={selected.preview_url} alt={selected.title}/>
        <div className="premium-photo-lightbox-bottom">
          <strong>{selected.title}</strong>
          {orderedPhotos.length > 1 && <div>
            <button type="button" aria-label="Foto anterior"
              onClick={() => setActivePhoto(i => i === null ? null :
                (i - 1 + orderedPhotos.length) % orderedPhotos.length)}>
              <ChevronLeft size={21}/>
            </button>
            <button type="button" aria-label="Próxima foto"
              onClick={() => setActivePhoto(i => i === null ? null :
                (i + 1) % orderedPhotos.length)}>
              <ChevronRight size={21}/>
            </button>
          </div>}
        </div>
      </div>
    </div>}
  </div>;
}
