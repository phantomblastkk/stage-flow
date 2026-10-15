"use client";

import "./premium-preview.css";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2,
  ChevronLeft, ChevronRight, Crown, ExternalLink, Globe2, Instagram,
  LockKeyhole, LoaderCircle, MapPin, Mic2, Music2, PlayCircle,
  Sparkles, Youtube
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
  const accent = artist?.accent === "lime" ? "lime" : artist?.accent === "cyan" ? "cyan" : "violet";
  const firstName = artist?.name || "Seu nome artístico";

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
      <span className="premium-preview-label"><LockKeyhole size={15}/> PRÉVIA PRIVADA · NÃO PUBLICADA</span>
      <Link href="/painel" className="premium-preview-back">Meu painel <ArrowUpRight size={15}/></Link>
    </div>

    {problem && <div className="premium-preview-problem" role="alert">{problem}</div>}

    {!artist ? <div className="premium-preview-empty">
      <Mic2 size={28}/>
      <h1>Seu site profissional começa aqui.</h1>
      <p>Entre com uma conta artística e configure sua página gratuita antes de experimentar a prévia.</p>
      <Link href="/meu-perfil-artistico" className="btn btn-primary">Configurar meu perfil <ArrowRight size={16}/></Link>
    </div> : <>
      <div className={"premium-site premium-site-" + accent}>
        <header className="premium-site-nav">
          <Link href="/" className="premium-site-brand"><span className="premium-site-signal"><Music2 size={20}/></span> STAGE FLOW</Link>
          <nav aria-label="Seções do site profissional">
            <a href="#premium-sobre">Sobre</a>
            <a href="#premium-agenda">Agenda</a>
            <a href="#premium-portfolio">Portfólio</a>
            <a href="#premium-contato">Contato</a>
          </nav>
          <span className="premium-site-example"><Sparkles size={13}/> CONCEITO PREMIUM</span>
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
            <p className="premium-site-lead">{artist.headline || "Sua música, sua história, seu próximo palco."}</p>
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
              <a href="#premium-contato" className="premium-site-main-action"><Mic2 size={17}/> Solicitar contratação <ArrowUpRight size={16}/></a>
              <a href="#premium-agenda" className="premium-site-secondary-action"><CalendarDays size={17}/> Próximos shows</a>
            </div>
            <div className="premium-site-identity-foot">
              <span><CheckCircle2 size={15}/> Dados do seu perfil Stage Flow</span>
              <span>{events.length} {events.length === 1 ? "show público futuro" : "shows públicos futuros"}</span>
            </div>
          </div>
        </section>

        <div className="premium-site-tabs" aria-label="Navegação por seções">
          <a href="#premium-sobre">Sobre</a>
          <a href="#premium-portfolio">Portfólio</a>
          <a href="#premium-agenda">Agenda</a>
          <a href="#premium-contato">Contato</a>
        </div>

        <section id="premium-sobre" className="premium-site-about">
          <div>
            <span className="premium-site-section-overline">01 / A HISTÓRIA POR TRÁS DO SOM</span>
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
        </section>

        <section id="premium-portfolio" className="premium-site-work">
          <div className="premium-site-section-head">
            <div>
              <span className="premium-site-section-overline">02 / MINHA MÚSICA</span>
              <h2>Portfólio <em>& vídeos.</em></h2>
            </div>
            <span className="premium-site-section-icon"><PlayCircle size={25}/></span>
          </div>
          <div className="premium-site-work-grid">
            <div className="premium-site-work-tile premium-site-work-featured">
              <span><PlayCircle size={28}/></span>
              <strong>Apresentações ao vivo</strong>
              <p>Galeria com seus vídeos e momentos marcantes.</p>
              {artist.youtube_url ? <a href={artist.youtube_url} target="_blank" rel="noopener noreferrer">Ver no YouTube <ArrowUpRight size={14}/></a> : <small>Adicione seu YouTube para mostrar seus trabalhos.</small>}
            </div>
            <div className="premium-site-work-tile">
              <span><Music2 size={26}/></span>
              <strong>Meu som</strong>
              <p>Divulgue lançamentos e músicas que fazem parte da sua trajetória.</p>
              {artist.spotify_url ? <a href={artist.spotify_url} target="_blank" rel="noopener noreferrer">Ouvir no Spotify <ArrowUpRight size={14}/></a> : <small>Adicione seu Spotify para divulgar músicas.</small>}
            </div>
            <div className="premium-site-work-tile">
              <span><Instagram size={26}/></span>
              <strong>Bastidores & fotos</strong>
              <p>Uma futura galeria para imagens de shows e projetos.</p>
              {artist.instagram_url ? <a href={artist.instagram_url} target="_blank" rel="noopener noreferrer">Ver Instagram <ArrowUpRight size={14}/></a> : <small>Galeria de fotos: planejada para o site pago.</small>}
            </div>
          </div>
        </section>

        <section id="premium-agenda" className="premium-site-agenda">
          <div className="premium-site-section-head">
            <div>
              <span className="premium-site-section-overline">03 / PRÓXIMAS APRESENTAÇÕES</span>
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
        </section>

        <section id="premium-contato" className="premium-site-contact">
          <div className="premium-site-contact-icon"><Mic2 size={27}/></div>
          <div>
            <h2>Leve {firstName} para seu evento.</h2>
            <p>Um futuro formulário de contratação poderá receber solicitações direto pelo site.</p>
          </div>
          {artist.instagram_url
            ? <a href={artist.instagram_url} target="_blank" rel="noopener noreferrer" className="premium-site-main-action"><Instagram size={17}/> Falar pelo Instagram <ArrowUpRight size={16}/></a>
            : <span className="premium-site-contact-pending"><LockKeyhole size={16}/> Contato pelo site em preparação</span>}
        </section>

        <footer className="premium-site-footer">
          <span><Music2 size={18}/> STAGE FLOW <small>Conectando artistas, músicos e produtores</small></span>
          <span>Prévia ilustrativa · nenhum site premium foi publicado</span>
        </footer>
      </div>

      <section className="premium-preview-upgrade">
        <div className="premium-preview-upgrade-icon"><Crown size={22}/></div>
        <div>
          <span>UM PASSO ALÉM DO PERFIL GRATUITO</span>
          <h2>Seu site profissional, quando você quiser.</h2>
          <p>Esta é uma prévia privada usando informações da sua conta. A experiência completa — com galeria avançada, agenda pública, contratação e subdomínio do tipo <strong>{artist.username || "seuusuario"}.stageflow.com</strong> — será oferecida como adicional pago em uma etapa futura.</p>
          <p className="premium-preview-protection"><LockKeyhole size={16}/> Prévia gratuita. Sem cobrança, sem ativação de plano e sem publicação de subdomínio.</p>
        </div>
        <Link href="/meu-perfil-artistico" className="btn btn-quiet">Editar meus dados <ArrowUpRight size={15}/></Link>
      </section>
    </>}
  </main>;
}
