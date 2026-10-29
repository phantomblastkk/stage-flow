"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, Check, Edit3, ExternalLink,
  ChevronLeft, ChevronRight, Images, ImagePlus, LoaderCircle, PlayCircle, Star, Trash2, X, Youtube
} from "lucide-react";
import {Button,Input,LoadingState} from "@/src/components/ui";
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

  const [available, setAvailable] = useState(false);
  const [readError, setReadError] = useState("");
  const [previewWarning, setPreviewWarning] = useState(false);
  const mounted = useRef(false);
  const readVersion = useRef(0);
  const reading = useRef(false);
  const mutating = useRef(false);
  const availableRef = useRef(false);

  const reload = useCallback(async () => {
    if (!enabled || reading.current) return false;
    reading.current = true;
    const version = ++readVersion.current;
    const current = () => mounted.current && version === readVersion.current;
    setLoading(true);
    setAvailable(false);
    availableRef.current = false;
    setReadError("");
    setMessage("");
    try {
      const supabase = createClient();
      const { data, error: loadError } = await supabase.rpc("stage_my_premium_site_media");
      if (!current()) return false;
      if (loadError || !Array.isArray(data)) throw new Error("gallery_read_failed");
      let missingPreview = false;
      const withUrls = await Promise.all((data as PremiumMediaItem[]).map(async item => {
        if (item.media_kind !== "photo" || !item.storage_path) return item;
        try {
          const { data: signed, error: signError } = await supabase.storage
            .from(BUCKET).createSignedUrl(item.storage_path, 3600);
          if (signError || !signed?.signedUrl) throw new Error("preview_unavailable");
          return { ...item, preview_url: signed.signedUrl };
        } catch {
          missingPreview = true;
          return { ...item, preview_url: "" };
        }
      }));
      if (!current()) return false;
      setItems(withUrls);
      setPreviewWarning(missingPreview);
      setAvailable(true);
      availableRef.current = true;
      setError("");
      return true;
    } catch {
      if (current()) setReadError("Não foi possível atualizar sua galeria. Os itens já carregados foram mantidos. Tente novamente.");
      return false;
    } finally {
      if (current()) { setLoading(false); reading.current = false; }
    }
  }, [enabled]);

  useEffect(() => {
    mounted.current = true;
    if (enabled) void reload();
    return () => { mounted.current = false; readVersion.current++; reading.current = false; availableRef.current = false; };
  }, [enabled, reload]);

  const reasons: Record<string, string> = {
    limit_reached: "Você atingiu o limite de mídias.",
    limit_photos: "Você atingiu o limite de 3 fotos. Remova uma foto para adicionar outra.",
    limit_videos: "Você atingiu o limite de 3 vídeos. Remova um vídeo para adicionar outro.",
    invalid_title: "O título deve ter de 1 a 90 caracteres.",
    invalid_video: "Esse vídeo do YouTube não tem um identificador válido.",
    invalid_order: "A ordem dos trabalhos mudou. Atualize a galeria e tente novamente.",
    not_found: "Este trabalho não foi encontrado na sua conta.",
    duplicate: "Esta foto já está na galeria.",
    published_media_in_use: "Esta foto está no Perfil Artístico publicado. Desative os recursos Pro antes de removê-la da galeria."
  };

  function uncertain() {
    setAvailable(false);
    availableRef.current = false;
    setError("Não foi possível confirmar a operação. Seus campos foram mantidos. Atualize a galeria antes de tentar novamente.");
  }

  async function mutate(operation: () => Promise<boolean>, success: string, cleanup?: () => Promise<void>) {
    if (!availableRef.current || loading || mutating.current || reading.current) return false;
    mutating.current = true;
    setBusy(true); setError(""); setMessage("");
    try {
      if (!await operation() || !mounted.current) return false;
      const refreshed = await reload();
      if (!mounted.current) return false;
      setMessage(success + (refreshed ? "" : " Atualize a galeria para conferir a lista."));
      if (cleanup) await cleanup();
      return true;
    } catch {
      if (mounted.current) uncertain();
      return false;
    } finally {
      mutating.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function call(name: string, params: Record<string, unknown>, success: string, cleanup?: () => Promise<void>) {
    return mutate(async () => {
      const { data, error: rpcError } = await createClient().rpc(name, params);
      if (rpcError) { uncertain(); return false; }
      if (data !== "saved") {
        setError(reasons[String(data)] || "Não foi possível concluir a operação. Suas escolhas foram mantidas.");
        return false;
      }
      return true;
    }, success, cleanup);
  }

  async function addPhoto(file: File, title: string) {
    if (!available || loading || busy) return false;
    const exts: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"
    };
    if (!exts[file.type] || file.size <= 0 || file.size > PHOTO_SIZE_LIMIT) {
      setError("Envie JPG, PNG ou WebP de até 5 MB.");
      return false;
    }
    if (items.filter(item => item.media_kind === "photo").length >= MAX_PER_TYPE) {
      setError("Limite de 3 fotos atingido. Remova uma foto antes de enviar outra.");
      return false;
    }
    const name = title.trim() || file.name.replace(/\.[^.]+$/, "");
    if (!name || name.length > 90) {
      setError("O título da foto deve ter até 90 caracteres.");
      return false;
    }
    return mutate(async () => {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { setError("Entre novamente na sua conta para enviar a foto."); return false; }
      const path = user.id + "/" + crypto.randomUUID() + "." + exts[file.type];
      const { error: uploadError } = await supabase.storage.from(BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type, cacheControl: "3600" });
      if (uploadError) { setError("Não foi possível enviar a foto. O título foi mantido para tentar novamente."); return false; }
      const { data, error: insertError } = await supabase.rpc("stage_add_premium_site_media", {
        p_kind: "photo", p_title: name, p_storage_path: path, p_youtube_id: null
      });
      // A failed response cannot prove the insert was rolled back. Keep the private file.
      if (insertError) { uncertain(); return false; }
      if (data !== "saved") {
        setError(reasons[String(data)] || "Não foi possível cadastrar a foto. O título foi mantido.");
        return false;
      }
      return true;
    }, "Foto salva no seu rascunho privado.");
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
    return call("stage_remove_premium_site_media", { p_id: item.id }, "Trabalho removido da galeria.", async () => {
      if (item.media_kind !== "photo" || !item.storage_path) return;
      try {
        const { error: removeError } = await createClient().storage.from(BUCKET).remove([item.storage_path]);
        if (removeError) throw new Error("private_file_cleanup_failed");
      } catch {
        setError("O item foi removido da galeria, mas seu arquivo privado não pôde ser excluído agora.");
      }
    });
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
    items, loading, busy, available, readError, previewWarning, error, message,
    reload: () => mutating.current ? Promise.resolve(false) : reload(), addPhoto, addVideo, remove, reorder,
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
  const blocked = gallery.busy || gallery.loading || !gallery.available;
  const photoFull = photoCount >= MAX_PER_TYPE;
  const videoFull = videoCount >= MAX_PER_TYPE;

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (await gallery.addPhoto(file, photoTitle)) setPhotoTitle("");
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
        <span className="premium-design-eyebrow"><ImagePlus aria-hidden="true" size={15}/> FOTOS E VÍDEOS</span>
        <h2>Fotos e vídeos, cada um no seu espaço.</h2>
        <p>O Perfil Artístico permite até 3 fotos e 3 vídeos, com espaços separados para cada tipo de mídia.</p>
      </div>
      <div className="premium-media-limit-counts" aria-label="Limites da galeria" hidden={!gallery.available}>
        <span className={photoFull ? "is-full" : ""}>Fotos: {photoCount}/{MAX_PER_TYPE}</span>
        <span className={videoFull ? "is-full" : ""}>Vídeos: {videoCount}/{MAX_PER_TYPE}</span>
      </div>
    </div>

    {gallery.readError && <div className="premium-media-feedback is-error" role="alert">
      <p>{gallery.readError}</p>
    </div>}
    {gallery.error && <p className="premium-media-feedback is-error" role="alert">{gallery.error}</p>}
    {gallery.previewWarning && <p className="premium-media-feedback" role="status">Algumas miniaturas não carregaram. Seus arquivos continuam na galeria.</p>}
    <Button variant="secondary" disabled={gallery.loading || gallery.busy} onClick={() => void gallery.reload()}>
      {gallery.loading ? "Atualizando galeria..." : "Atualizar galeria"}
    </Button>
    <fieldset className="premium-media-inputs" aria-label="Adicionar mídias" disabled={blocked}>
      <div className="premium-media-add-box">
        <h3><ImagePlus aria-hidden="true" size={17}/> Adicionar foto de show</h3>
        {photoFull && <p className="premium-media-cap-notice">
          Limite de 3 fotos atingido. Remova uma foto antes de enviar outra.
        </p>}
        <Input label="Nome da foto (opcional)" id="premium-photo-name" value={photoTitle} maxLength={90}
          onChange={event => setPhotoTitle(event.target.value)}
          placeholder="Ex.: Show no Rio de Janeiro"/>
        <Input label="Foto de show" id="premium-photo-file" type="file"
          accept="image/jpeg,image/png,image/webp" disabled={blocked || photoFull}
          hint="JPG, PNG ou WebP de até 5 MB."
          onChange={event => void upload(event)}/>
        <small>Foto salva em área privada. Use apenas imagens que você tem autorização para divulgar.</small>
      </div>
      <form className="premium-media-add-box" onSubmit={event => void addVideo(event)}>
        <h3><Youtube aria-hidden="true" size={17}/> Adicionar vídeo do YouTube</h3>
        {videoFull && <p className="premium-media-cap-notice">
          Limite de 3 vídeos atingido. Remova um vídeo antes de adicionar outro.
        </p>}
        <Input label="Título do vídeo" id="premium-video-name" required maxLength={90}
          value={videoTitle} onChange={event => setVideoTitle(event.target.value)}
          placeholder="Ex.: Pagode ao vivo"/>
        <Input label="Link do vídeo" id="premium-video-link" type="url" required
          value={videoUrl} onChange={event => setVideoUrl(event.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."/>
        <Button type="submit"
          disabled={blocked || videoFull}>
          <PlayCircle aria-hidden="true" size={16}/> Adicionar vídeo
        </Button>
        <small>O vídeo será reproduzido dentro do Perfil Artístico. Também haverá um link direto para o YouTube.</small>
      </form>
    </fieldset>
    {gallery.message && <p className="premium-media-feedback" role="status">{gallery.message}</p>}
    {(photoCount > MAX_PER_TYPE || videoCount > MAX_PER_TYPE) &&
      <p className="premium-media-cap-notice" role="status">
        Você possui mídias cadastradas antes do novo limite. Nenhum arquivo foi apagado;
        somente as 3 primeiras fotos e os 3 primeiros vídeos (priorizando o destaque)
        aparecerão na prévia e no Perfil Artístico. Os demais continuam no seu rascunho
        para você organizar ou remover.
      </p>}
    {gallery.loading ? <LoadingState label="Carregando galeria..."/> :
      gallery.items.length === 0
        ? (gallery.available ? <div className="premium-media-empty">Sua galeria está vazia. Comece com fotos de shows ou vídeos do YouTube.</div> : null)
        : <div className="premium-media-groups">
          {(["photo", "youtube"] as const).map(kind => {
            const grouped = gallery.items.filter(item => item.media_kind === kind);
            if (!grouped.length) return null;
            return <section className="premium-media-group" key={kind}
              aria-label={kind === "photo" ? "Fotos cadastradas" : "Vídeos cadastrados"}>
              <div className="premium-media-group-heading">
                {kind === "photo" ? <Images aria-hidden="true" size={19}/> : <Youtube aria-hidden="true" size={19}/>}
                <div><h3>{kind === "photo" ? "Galeria de fotos" : "Vídeos do YouTube"}</h3>
                  <p>{kind === "photo" ? "Escolha a ordem das imagens no álbum." : "Organize seus vídeos de apresentações."}</p>
                </div>
                <span>{grouped.length} {kind === "photo" ? "foto(s)" : "vídeo(s)"}</span>
              </div>
              <div className="premium-media-list">
              {grouped.map((item, index) =>
            <article className="premium-media-list-item" key={item.id} aria-label={item.title}>
              <div className="premium-media-list-photo"><MediaThumbnail item={item}/></div>
              <div className="premium-media-item-info">
                <div className="premium-media-item-flags">
                  <span>{item.media_kind === "photo" ? "FOTO" : "YOUTUBE"}</span>
                  {item.featured && <span className="premium-media-featured"><Star aria-hidden="true" size={12} fill="currentColor"/> DESTAQUE</span>}
                </div>
                {editingId === item.id ?
                  <form className="premium-media-rename" onSubmit={event => void rename(event, item)}>
                    <Input label={"Novo título de " + item.title} disabled={blocked} value={editingTitle} maxLength={90} required
                      onChange={event => setEditingTitle(event.target.value)}/>
                    <Button variant="secondary" type="submit" disabled={blocked} aria-label="Salvar título"><Check aria-hidden="true" size={16}/></Button>
                    <Button variant="secondary" type="button" disabled={blocked} onClick={() => setEditingId(null)} aria-label="Cancelar edição"><X aria-hidden="true" size={16}/></Button>
                  </form> : <strong>{item.title}</strong>}
                <div className="premium-media-actions">
                  <Button variant="secondary" type="button" disabled={blocked || item.featured}
                    onClick={() => void gallery.feature(item.id)}>
                    <Star aria-hidden="true" size={14}/>{item.featured ? "Destaque" : "Destacar"}
                  </Button>
                  <Button variant="secondary" type="button" disabled={blocked}
                    onClick={() => {setEditingId(item.id);setEditingTitle(item.title);}}>
                    <Edit3 aria-hidden="true" size={14}/> Título
                  </Button>
                  <Button variant="secondary" type="button" disabled={blocked || index === 0}
                    onClick={() => void gallery.reorder(item.id, -1)} aria-label={"Subir " + item.title}>
                    <ArrowUp aria-hidden="true" size={14}/> Subir
                  </Button>
                  <Button variant="secondary" type="button" disabled={blocked || index === grouped.length - 1}
                    onClick={() => void gallery.reorder(item.id, 1)} aria-label={"Descer " + item.title}>
                    <ArrowDown aria-hidden="true" size={14}/> Descer
                  </Button>
                  {deleteId === item.id ?
                    <Button variant="danger" type="button"
                      disabled={blocked} onClick={() => void gallery.remove(item).then(ok => {if (ok) setDeleteId(null);})}>
                      Confirmar remoção
                    </Button>
                    : <Button variant="secondary" type="button" disabled={blocked}
                      onClick={() => setDeleteId(item.id)}><Trash2 aria-hidden="true" size={14}/> Remover</Button>}
                  {deleteId === item.id && <Button variant="secondary" type="button" disabled={blocked} onClick={() => setDeleteId(null)}>Cancelar</Button>}
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
      <strong>Galeria do rascunho:</strong> suas fotos ficam em uma área privada.
      Ao ativar ou republicar os recursos Pro, as fotos selecionadas poderão ser vistas
      no seu perfil público. As demais fotos e os dados dos convites continuam privados.
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
