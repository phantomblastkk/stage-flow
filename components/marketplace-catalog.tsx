"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Check,
  ChevronLeft, ChevronRight, CircleHelp, Clock3, ExternalLink,
  Filter, Guitar, Heart, LoaderCircle, MapPin, MessageCircle,
  Music2, Search, Send, ShieldCheck, SlidersHorizontal, Sparkles,
  Star, Trophy, Users, Flag, UserRound, X
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { trackMarketplaceExposure } from "@/lib/musician-metrics";
import WorkspaceMobileNav from "@/src/domains/navigation/components/workspace-mobile-nav";
import "./marketplace-catalog.css";
import MarketplaceReportDialog, { type ReportTarget } from "./marketplace-report-dialog";

type MarketMusician = {
  musician_id: string;
  name: string;
  slug: string;
  headline: string;
  city: string;
  instruments: string[];
  genres: string[];
  avatar_url: string | null;
  cover_url: string | null;
  price_mode: "consult" | "from";
  reference_fee: number | null;
  experience_years: number | null;
  performance_types: string[];
  availability_note: string;
  availability_mode: "ask" | "accepting" | "unavailable";
  date_blocked: boolean;
  rating_avg: number;
  rating_count: number;
  is_favorite: boolean;
};
type MarketIdentity = {is_singer: boolean; avatar_path: string | null};
type MarketResponse = {
  status: "ok" | "not_released" | "invalid" | "login_required";
  items: MarketMusician[];
  total: number;
  limit: number;
  offset: number;
};
type EventOption = { id: string; title: string; starts_at: string; city: string | null };
type Review = { id: string; organizer_name: string; rating: number; comment: string; created_at: string };
type ReviewableEvent = {
  event_id: string; event_title: string; starts_at: string; reviewed: boolean;
};
type Sort = "recent" | "name" | "experience" | "rating";
type FilterState = {
  query: string; city: string; instrument: string; genre: string;
  maxFee: string; date: string; available: boolean; favorites: boolean; sort: Sort;
};
const defaultFilters: FilterState = {
  query: "", city: "", instrument: "", genre: "", maxFee: "", date: "",
  available: false, favorites: false, sort: "recent"
};
const instruments = [
  "Cavaquinho","Violão","Guitarra","Baixo","Bateria","Pandeiro",
  "Tantã","Repique de mão","Surdo","Teclado","Piano","Saxofone",
  "Trompete","Percussão","Voz","Flauta","Acordeão","Violino"
];
const genres = [
  "Pagode","Samba","Sertanejo","MPB","Pop","Rock","Forró",
  "Gospel","Jazz","Funk","Axé","Reggae","Choro","Rap","R&B"
];
function localDateISO(){
  const d = new Date();
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),
    String(d.getDate()).padStart(2,"0")].join("-");
}
function lastSelectableDate(){
  const d = new Date();
  d.setDate(d.getDate()+366);
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),
    String(d.getDate()).padStart(2,"0")].join("-");
}
const money = (n: number) =>
  new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n);
const dateBR = (date: string) => {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? date :
    d.toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"});
};
function initials(name: string) {
  return name.split(/\s+/).slice(0,2).map(x => x[0]?.toUpperCase()).join("") || "SF";
}
function Fee({musician}:{musician:MarketMusician}) {
  return <span>{musician.price_mode === "from" && musician.reference_fee !== null
    ? <><small>A PARTIR DE</small><strong>{money(musician.reference_fee)}</strong></>
    : <><small>CACHÊ DE REFERÊNCIA</small><strong>Sob consulta</strong></>}</span>;
}
function Rating({musician}:{musician:MarketMusician}) {
  if (!musician.rating_count) return <span className="market-unrated"><Star size={14}/> Ainda sem avaliações</span>;
  return <span className="market-rating"><Star size={14} fill="currentColor"/>
    <strong>{Number(musician.rating_avg).toLocaleString("pt-BR",{maximumFractionDigits:1})}</strong>
    <span>({musician.rating_count})</span></span>;
}
function Availability({musician,date}:{musician:MarketMusician;date:string}) {
  if (musician.availability_mode === "unavailable") {
    return <span className="market-availability is-unavailable"><Clock3 size={13}/> Não recebe propostas no momento</span>;
  }
  if (date && musician.date_blocked) {
    return <span className="market-availability is-unavailable"><CalendarDays size={13}/> Data informada indisponível</span>;
  }
  if (musician.availability_mode === "accepting") {
    return <span className="market-availability is-accepting"><Check size={13}/>
      {date ? "Sem bloqueio declarado nessa data" : "Recebendo propostas"}</span>;
  }
  return <span className="market-availability"><CircleHelp size={13}/> Disponibilidade sob consulta</span>;
}

function MarketplaceMusicianCard({ musician, identity, date, rank, ownProfile, favoriteBusy, onFavorite, onInvite, onReport }: {
  musician: MarketMusician; identity?: MarketIdentity; date: string; rank?: number;
  ownProfile: boolean; favoriteBusy: boolean; onFavorite: () => void; onInvite: () => void; onReport: () => void;
}) {
  const singerPhoto = identity?.is_singer && identity.avatar_path
    ? createClient().storage.from("stage-artist-public").getPublicUrl(identity.avatar_path).data.publicUrl
    : null;
  const photo = singerPhoto || musician.avatar_url;
  const role = identity?.is_singer ? "Cantor • Músico" : "Músico";
  return <article className={"market-card market-artist-card"+(rank ? " is-featured" : "")}>
    <div className="market-artist-main">
      <div className="market-artist-head">
        <div className="market-artist-avatar">
          {photo ? <img src={photo} loading="lazy" alt={"Foto de "+musician.name}/>
            : <span>{initials(musician.name)}</span>}
        </div>
        <div className="market-artist-identification">
          {rank && <span className="market-artist-rank"><Trophy size={12}/> DESTAQUE #{rank}</span>}
          <h3>{musician.name}</h3>
          <p>{role}</p>
        </div>
        {ownProfile
          ? <span className="market-own-profile" title="Este é o seu anúncio no Marketplace">
              <UserRound size={15} aria-hidden="true"/> Seu perfil
            </span>
          : <button type="button" className={"market-favorite"+(musician.is_favorite?" is-saved":"")}
              disabled={favoriteBusy} onClick={onFavorite} aria-pressed={musician.is_favorite}
              aria-label={musician.is_favorite?"Remover dos favoritos":"Adicionar aos favoritos"}
              title={musician.is_favorite?"Remover dos favoritos":"Salvar músico"}>
              {favoriteBusy?<LoaderCircle size={18} className="market-favorite-spinner" aria-hidden="true"/>
                :<Heart size={18} fill={musician.is_favorite?"currentColor":"none"}/>}
            </button>}
      </div>
      <div className="market-artist-proof"><Rating musician={musician}/>
        <span className="market-artist-city"><MapPin size={14}/>{musician.city||"Região não informada"}</span>
      </div>
      <div className="market-artist-tags" aria-label="Instrumentos e estilos">
        {(musician.instruments||[]).slice(0,3).map(t=><span key={t}>{t}</span>)}
        {(musician.instruments||[]).length>3&&<span className="market-artist-extra">+{musician.instruments.length-3}</span>}
      </div>
    </div>
    <div className="market-artist-bottom">
      <Availability musician={musician} date={date}/>
      <div className="market-artist-fee"><Fee musician={musician}/></div>
      <div className="market-card-actions">
        <Link href={"/musico/"+encodeURIComponent(musician.slug)}
          onClick={()=>void trackMarketplaceExposure([musician.musician_id],"profile_open")}>
          Ver perfil <ArrowUpRight size={15}/></Link>
        <button type="button" onClick={onInvite}>Convidar <ArrowRight size={16}/></button>
      </div>
      <button type="button" className="market-report-link" onClick={onReport}>
        <Flag size={12}/> Denunciar perfil
      </button>
    </div>
  </article>;
}

type Props = { preview?: boolean };
export default function MarketplaceCatalog({preview=false}:Props) {
  const [filters,setFilters] = useState<FilterState>(defaultFilters);
  const [applied,setApplied] = useState<FilterState>(defaultFilters);
  const [page,setPage] = useState(0);
  const [items,setItems] = useState<MarketMusician[]>([]);
  const [identities,setIdentities] = useState<Record<string,MarketIdentity>>({});
  const [total,setTotal] = useState(0);
  const [featured,setFeatured] = useState<MarketMusician[]>([]);
  const [featuredLoading,setFeaturedLoading] = useState(true);
  const [featuredError,setFeaturedError] = useState("");
  const featuredRail=useRef<HTMLDivElement|null>(null);
  const [loading,setLoading] = useState(true);
  const [gate,setGate] = useState<"loading"|"allowed"|"denied">("loading");
  const [notice,setNotice] = useState("");
  const [error,setError] = useState("");
  const [mobileFilters,setMobileFilters] = useState(false);
  const [authUser,setAuthUser] = useState(false);
  const [authUserId,setAuthUserId] = useState<string|null>(null);
  const [canModerate,setCanModerate] = useState(false);
  const [reportTarget,setReportTarget] = useState<ReportTarget|null>(null);
  const [selected,setSelected] = useState<MarketMusician|null>(null);
  const [events,setEvents] = useState<EventOption[]>([]);
  const [loadingEvents,setLoadingEvents] = useState(false);
  const [inviting,setInviting] = useState(false);
  const [selectedEvent,setSelectedEvent] = useState("");
  const [inviteMessage,setInviteMessage] = useState("");
  const [reviews,setReviews] = useState<Review[]>([]);
  const [reviewable,setReviewable] = useState<ReviewableEvent[]>([]);
  const [reviewEvent,setReviewEvent] = useState("");
  const [reviewRating,setReviewRating] = useState(5);
  const [reviewComment,setReviewComment] = useState("");
  const [savingReview,setSavingReview] = useState(false);
  const [favoriteBusy,setFavoriteBusy] = useState<string|null>(null);
  const [refreshNonce,setRefreshNonce] = useState(0);
  const [discoveryView,setDiscoveryView]=useState<"recommended"|"favorites"|"history">("recommended");
  const [history,setHistory]=useState<{id:string;other_name:string}[]>([]);
  const [historyError,setHistoryError]=useState("");
  const limit = 12;
  useEffect(()=>{
   const params=new URLSearchParams(window.location.search);
   const next={...defaultFilters,query:params.get("busca")?.slice(0,100)||"",city:params.get("cidade")?.slice(0,100)||"",genre:params.get("estilo")||"",favorites:params.get("aba")==="favoritos"};
   setFilters(next);setApplied(next);
   if(next.favorites)setDiscoveryView("favorites");
   if(params.get("aba")==="historico")setDiscoveryView("history");
   if(params.get("evento"))setSelectedEvent(params.get("evento")!);
  },[]);
  useEffect(()=>{
   if(gate!=="allowed"||discoveryView!=="history")return;
   let active=true;setHistoryError("");
   void Promise.resolve(createClient().rpc("stage_hiring_list")).then(({data,error})=>{
    if(!active)return;if(error||!Array.isArray(data)){setHistoryError("Não foi possível atualizar o histórico de conversas.");return;}
    setHistory(data.slice(0,30));
   }).catch(()=>{if(active)setHistoryError("Não foi possível atualizar o histórico de conversas.");});
   return()=>{active=false;};
  },[gate,discoveryView]);
  function discovery(view:"recommended"|"favorites"|"history"){
   setDiscoveryView(view);setPage(0);setFilters(current=>({...current,favorites:view==="favorites"}));setApplied(current=>({...current,favorites:view==="favorites"}));
  }


  useEffect(()=>{
    let active=true;
    async function checkAccess() {
      const client=createClient();
      const {data:{user}}=await client.auth.getUser();
      if(!active)return;
      setAuthUser(Boolean(user));
      setAuthUserId(user?.id||null);
      if(preview) {
        if(!user){setGate("denied");return;}
        const {data,error:rpcError}=await client.rpc("stage_marketplace_preview_status");
        if(!active)return;
        setGate(!rpcError && data?.allowed===true ? "allowed" : "denied");
        if (!rpcError && data?.allowed === true) {
          const {data:moderator} = await client.rpc("stage_marketplace_moderator_status");
          if(active) setCanModerate(moderator === true);
        }
      } else {
        // Marketplace público autorizado pelo proprietário; o backend mantém as políticas de segurança.
        setGate("allowed");
      }
    }
    void checkAccess();
    return()=>{active=false;};
  },[preview]);

  useEffect(()=>{
    if(gate!=="allowed")return;
    let active=true;
    async function search() {
      setLoading(true);
      setError("");
      const maxFee = applied.maxFee.trim() ?
        Number(applied.maxFee.replace(",",".")) : null;
      if(maxFee!==null && (!Number.isFinite(maxFee)||maxFee<0||maxFee>999999.99)) {
        setError("Informe um cachê máximo válido.");
        setLoading(false);return;
      }
      const {data,error:searchError}=await createClient().rpc("stage_marketplace_search",{
        p_query:applied.query.trim(),p_city:applied.city.trim(),
        p_instrument:applied.instrument,p_genre:applied.genre,
        p_max_fee:maxFee,p_date:applied.date||null,
        p_only_available:applied.available,p_only_favorites:applied.favorites,
        p_sort:applied.sort,p_limit:limit,p_offset:page*limit
      });
      if(!active)return;
      const response = data as MarketResponse|null;
      if(searchError || !response || response.status!=="ok") {
        setItems([]);setTotal(0);
        setError(searchError?.message ||
          (response?.status==="not_released"
            ? "O catálogo ainda está sendo habilitado. Tente novamente em instantes."
            : response?.status==="login_required"
              ? "Entre na sua conta para consultar os favoritos."
              : "Não foi possível consultar os músicos. Confira a migração do Supabase."));
      } else {
        const results=Array.isArray(response.items)?response.items:[];
        setItems(results);
        setTotal(response.total||0);
        // Contabiliza cartões retornados pela busca, sem dados pessoais do visitante.
        if(results.length>0)void trackMarketplaceExposure(
          results.map(m=>m.musician_id),"search"
        );
      }
      setLoading(false);
    }
    void search();
    return()=>{active=false;};
  },[gate,applied,page,refreshNonce]);

  // Destaques são globais: independem dos filtros e da paginação do catálogo.
  // A RPC usa a mesma trava de lançamento / allowlist das outras consultas.
  useEffect(()=>{
    if(gate!=="allowed")return;
    let active=true;
    async function fetchFeatured(){
      setFeaturedLoading(true);
      setFeaturedError("");
      const {data,error:rpcError}=await createClient().rpc("stage_marketplace_featured");
      if(!active)return;
      const result=data as {status?:string;items?:MarketMusician[]}|null;
      if(rpcError || result?.status!=="ok"){
        setFeatured([]);
        setFeaturedError(
          rpcError?.code==="PGRST202" || rpcError?.code==="42883"
            ? "Os destaques estão em preparação. Execute marketplace_featured_musicians_migration.sql no Supabase."
            : rpcError?.message
              ? "Não foi possível carregar os destaques. Tente atualizar a página."
              : result?.status==="not_released"
                ? "Os destaques só estão disponíveis na prévia autorizada."
                : "Não foi possível carregar os músicos em destaque."
        );
      }else{
        const shown=Array.isArray(result?.items)?result.items.slice(0,6):[];
        setFeatured(shown);
        // Vitrine de destaques é contada separadamente da busca.
        if(shown.length>0)void trackMarketplaceExposure(
          shown.map(m=>m.musician_id),"featured"
        );
      }
      setFeaturedLoading(false);
    }
    void fetchFeatured();
    return()=>{active=false;};
  },[gate,refreshNonce]);

  useEffect(()=>{
    if(gate!=="allowed" || !authUser)return;
    let active=true;
    async function getEvents(){
      setLoadingEvents(true);
      const {data,error:eventError}=await createClient().rpc("stage_marketplace_my_events");
      if(!active)return;
      if(!eventError && Array.isArray(data)) setEvents(data as EventOption[]);
      setLoadingEvents(false);
    }
    void getEvents();
    return()=>{active=false;};
  },[gate,authUser]);

  useEffect(()=>{
    if(!selected || gate!=="allowed")return;
    let active=true;
    async function loadDetails(){
      const client=createClient();
      const requests=[client.rpc("stage_marketplace_reviews_for_musician",
        {p_musician_id:selected!.musician_id})];
      if(authUser) requests.push(client.rpc("stage_marketplace_my_reviewable",
        {p_musician_id:selected!.musician_id}));
      const replies=await Promise.all(requests);
      if(!active)return;
      setReviews(Array.isArray(replies[0]?.data)?replies[0].data as Review[]:[]);
      setReviewable(Array.isArray(replies[1]?.data)?replies[1].data as ReviewableEvent[]:[]);
    }
    setReviews([]);setReviewable([]);setReviewEvent("");setReviewComment("");
    void loadDetails();
    return()=>{active=false;};
  },[selected?.musician_id,gate,authUser]);

  const pages = Math.max(1,Math.ceil(total/limit));
  useEffect(()=>{
    const ids=[...new Set([...items,...featured].map(m=>m.musician_id))];
    if(!ids.length)return;
    let active=true;
    void createClient().rpc("stage_public_marketplace_identity",{p_ids:ids.slice(0,48)})
      .then(({data,error})=>{
        if(!active||error||!data||typeof data!=="object"||Array.isArray(data))return;
        setIdentities(current=>({...current,...data as Record<string,MarketIdentity>}));
      },()=>{});
    return()=>{active=false;};
  },[items,featured]);

  const selectedReviewable = useMemo(()=>reviewable.filter(r=>!r.reviewed),[reviewable]);
  function apply(e?:FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    setPage(0);setApplied({...filters});setMobileFilters(false);setNotice("");
  }
  function clear(){
    setFilters({...defaultFilters});setApplied({...defaultFilters});setPage(0);
    setMobileFilters(false);
  }
  async function toggleFavorite(m:MarketMusician) {
    if(!authUser){
      setNotice("Entre na sua conta para salvar músicos nos favoritos.");
      return;
    }
    if(authUserId===m.musician_id){
      setNotice("Este é seu próprio perfil. Você pode vê-lo em “Ver perfil”, sem precisar favoritar.");
      return;
    }
    if(favoriteBusy)return;
    setFavoriteBusy(m.musician_id);setError("");setNotice("");
    try{
      const nextFavorite=!m.is_favorite;
      const {data,error:rpcError}=await createClient().rpc("stage_marketplace_toggle_favorite",{
        p_musician_id:m.musician_id,p_favorite:nextFavorite
      });
      if(rpcError || data!=="saved"){
        const reason=rpcError?.code==="42501"||data==="login_required"
          ?"Sua sessão não está válida. Entre novamente para salvar favoritos."
          :data==="not_listed"||data==="not_released"
            ?"Este anúncio não está mais disponível para favoritar. Atualize a lista."
            :data==="invalid"
              ?"Não é possível adicionar este perfil aos favoritos."
              :"Não foi possível salvar o favorito. Verifique a conexão e tente novamente.";
        setNotice(reason);
        return;
      }
      setItems(old=>old.map(x=>x.musician_id===m.musician_id
        ? {...x,is_favorite:nextFavorite}:x));
      setFeatured(old=>old.map(x=>x.musician_id===m.musician_id
        ? {...x,is_favorite:nextFavorite}:x));
      setSelected(old=>old?.musician_id===m.musician_id
        ? {...old,is_favorite:nextFavorite}:old);
      setNotice(nextFavorite
        ?"Músico adicionado aos favoritos. Veja seus salvos na aba Favoritos."
        :"Músico removido dos favoritos.");
      if(applied.favorites)setRefreshNonce(n=>n+1);
    }catch{
      setNotice("Não foi possível conectar aos favoritos. Verifique sua conexão.");
    }finally{
      setFavoriteBusy(null);
    }
  }
  function scrollFeatured(direction:-1|1){
    const rail=featuredRail.current;
    if(!rail)return;
    const firstCard=rail.querySelector<HTMLElement>(".market-artist-card");
    const offset=(firstCard?.getBoundingClientRect().width||270)+14;
    rail.scrollBy({left:direction*offset,behavior:"smooth"});
  }
  function openMusician(m:MarketMusician){
    setSelected(m);setSelectedEvent("");setInviteMessage("");setError("");setNotice("");
  }
  async function sendInvite(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if(!selected || !selectedEvent || inviting)return;
    if(!window.confirm("Registrar convite individual para "+selected.name+
      "? O músico poderá aceitar ou recusar no Stage Flow. Nenhuma mensagem externa será enviada automaticamente."))return;
    setInviting(true);setError("");setNotice("");
    const {data,error:rpcError}=await createClient().rpc("stage_marketplace_invite_musician",{
      p_event_id:selectedEvent,p_musician_id:selected.musician_id,
      p_message:inviteMessage.trim()||null
    });
    const res=data as {status?:string}|null;
    if(rpcError || !["sent","already_exists"].includes(res?.status||"")){
      const reasons:Record<string,string>={
        event_not_found:"O show não está disponível na sua conta ou já terminou.",
        not_listed:"O músico não está recebendo propostas no marketplace.",
        date_unavailable:"O músico marcou a data do show como indisponível no marketplace.",
        invalid_message:"A mensagem deve ter até 500 caracteres.",
        not_released:"Marketplace não liberado para a sua conta."
      };
      setError(rpcError?.message || reasons[res?.status||""] ||
        "Não foi possível registrar o convite.");
    }else{
      setNotice(res?.status==="already_exists"
        ? "Você já convidou esse músico para esse show. Acompanhe o convite existente."
        : "Convite registrado! O músico verá a proposta em Meus convites. A contratação ainda depende da resposta dele.");
      setInviteMessage("");
    }
    setInviting(false);
  }
  async function submitReview(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!selected || !reviewEvent || savingReview)return;
    setSavingReview(true);setError("");setNotice("");
    const {data,error:rpcError}=await createClient().rpc("stage_marketplace_submit_review",{
      p_event_id:reviewEvent,p_musician_id:selected.musician_id,
      p_rating:reviewRating,p_comment:reviewComment.trim()
    });
    if(rpcError||data!=="saved"){
      setError(rpcError?.message || (data==="already_reviewed"
        ? "Você já avaliou esse músico nesse show."
        : "Não foi possível registrar a avaliação. É necessário ter um show concluído com convite aceito."));
    }else{
      setNotice("Avaliação registrada com base no trabalho concluído.");
      setReviewEvent("");setReviewComment("");
      const client=createClient();
      const [{data:reviewData},{data:reviewableData}]=await Promise.all([
        client.rpc("stage_marketplace_reviews_for_musician",{p_musician_id:selected.musician_id}),
        client.rpc("stage_marketplace_my_reviewable",{p_musician_id:selected.musician_id})
      ]);
      setReviews(Array.isArray(reviewData)?reviewData as Review[]:[]);
      setReviewable(Array.isArray(reviewableData)?reviewableData as ReviewableEvent[]:[]);
      setRefreshNonce(n=>n+1);
    }
    setSavingReview(false);
  }

  if(gate==="loading")return <div className="market-gate">
    <LoaderCircle size={22}/><h2>{preview?"Verificando acesso ao laboratório...":"Preparando seu Marketplace..."}</h2>
  </div>;
  if(gate==="denied")return <section className="market-gate">
    <ShieldCheck size={34}/>
    <h2>Laboratório privado</h2>
    <p>Esta área está restrita às contas autorizadas pelo administrador do Stage Flow.
      O catálogo continua oculto do público.</p>
    <Link href="/marketplace" className="btn btn-primary">Ir para o Marketplace</Link>
  </section>;

  return <main className={"market-shell"+(authUser&&!preview?" has-mobile-workspace-nav":"")}>
    <div className="market-container">
      <header className="market-nav">
        <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
        <nav aria-label="Navegação do marketplace">
          <Link href="/painel" className="market-nav-link">Meu painel</Link>
          <Link href="/marketplace" className="market-nav-soon">
            <ShieldCheck size={14}/> {preview?"PRÉVIA PRIVADA":"MARKETPLACE"}
          </Link>
        </nav>
      </header>

      <section className="market-hero">
        <div className="market-hero-copy">
          <span className="market-eyebrow"><Sparkles size={15}/> ENCONTRE SEU PRÓXIMO TALENTO</span>
          <h1>O músico certo.<br/><span>Para cada palco.</span></h1>
          <p>Descubra profissionais por instrumento, região e estilo musical.
            Explore portfólios, salve favoritos e faça convites diretamente para seus shows.</p>
          <div className="market-hero-stats">
            <span><strong>{loading?"—":total}</strong> profissionais encontrados</span>
            <span><ShieldCheck size={15}/> Cachês negociados individualmente</span>
          </div>
        </div>
        <div className="market-hero-visual" aria-hidden="true">
          <Music2 size={92}/>
          <span>STAGE</span><strong>FLOW.</strong><small>MUSIC CONNECTS US</small>
        </div>
      </section>

      {!preview&&<section className="market-development-banner" aria-label="Novidade em desenvolvimento">
        <div className="market-development-copy">
          <span className="market-development-label"><Sparkles size={16}/> MARKETPLACE ABERTO</span>
          <h2>Encontre o músico certo para seu próximo show.</h2>
          <p>Pesquise profissionais, compare especialidades e converse diretamente com músicos disponíveis. Novas melhorias continuam chegando.</p>
        </div>
        <div className="market-development-actions">
          <Link href="/perfil-artistico?aba=instrumentista" className="market-development-primary">
            <Guitar size={17}/> Preparar meu portfólio <ArrowRight size={16}/>
          </Link>
          <Link href="#market-results" className="market-development-secondary">
            Explorar músicos <ArrowRight size={16}/>
          </Link>
        </div>
      </section>}

      {preview&&<div className="market-preview-ribbon">
        <ShieldCheck size={17}/>
        <span><strong>Ambiente de testes restrito.</strong> O marketplace público continua em “Em breve”.
          Nenhuma ativação comercial foi realizada.
          {canModerate&&<>{" "}<Link href="/marketplace/moderacao"
            style={{color:"#d9c6f5",fontWeight:900,textDecoration:"underline"}}>
            <Flag size={13} style={{display:"inline",verticalAlign:"middle"}}/> Central de moderação
          </Link></>}</span>
      </div>}

      <nav className="market-discovery-tabs" aria-label="Descobrir no Marketplace">
       <button type="button" aria-pressed={discoveryView==="recommended"} onClick={()=>discovery("recommended")}>Recomendados</button>
       <button type="button" aria-pressed={discoveryView==="favorites"} onClick={()=>discovery("favorites")}>Favoritos</button>
       <button type="button" aria-pressed={discoveryView==="history"} onClick={()=>discovery("history")}>Histórico</button>
       <Link href={"/contratar"+(selectedEvent?"?evento="+encodeURIComponent(selectedEvent):"")}>Buscar artistas e grupos</Link>
      </nav>
      {discoveryView==="history"&&<section className="market-history"><h2>Seu histórico de contatos</h2><p>Conversas reais da sua conta, ordenadas pela atividade mais recente.</p>{historyError?<p role="alert">{historyError}</p>:history.length?history.map(item=><Link key={item.id} href={"/conversas?conversa="+encodeURIComponent(item.id)}>{item.other_name} · Continuar conversa</Link>):<p>Nenhum contato anterior encontrado.</p>}</section>}
      <div className="market-discovery-body" hidden={discoveryView==="history"}>
      <section className="market-featured" aria-labelledby="market-featured-title">
        <div className="market-featured-heading">
          <div>
            <div className="market-featured-eyebrow">
              <Trophy size={15}/> SELEÇÃO POR AVALIAÇÕES VERIFICADAS
            </div>
            <h2 id="market-featured-title">Recomendados <span>para explorar.</span></h2>
            <p>Profissionais com mais avaliações de shows realizados no Stage Flow.
              Empates são decididos pela nota média. Nenhuma posição é comprada.</p>
          </div>
          {featured.length>3 && <div className="market-featured-arrows" role="group" aria-label="Navegar pelos músicos em destaque">
            <button type="button" onClick={()=>scrollFeatured(-1)}
              aria-label="Voltar nos destaques"><ChevronLeft size={19}/></button>
            <button type="button" onClick={()=>scrollFeatured(1)}
              aria-label="Avançar nos destaques"><ChevronRight size={19}/></button>
          </div>}
        </div>
        {featuredLoading
          ? <div className="market-featured-rail" role="status" aria-label="Carregando músicos em destaque">
              {[0,1,2].map(index=><div key={index} className="market-featured-skeleton"/>)}
            </div>
          : featuredError
            ? <p className="market-featured-empty" role="status">
                <CircleHelp size={16}/>{featuredError}
              </p>
            : featured.length===0
              ? <p className="market-featured-empty">
                  <Star size={17}/> Os primeiros destaques aparecerão aqui quando os músicos
                  começarem a receber avaliações verificadas.
                </p>
              : <>
                <div className="market-featured-rail" ref={featuredRail}
                  role="region" aria-label="Carrossel dos músicos mais avaliados" tabIndex={0}>
                  {featured.map((m,index)=><MarketplaceMusicianCard key={m.musician_id}
                    musician={m} identity={identities[m.musician_id]} date={applied.date}
                    rank={index+1} ownProfile={authUserId===m.musician_id}
                    favoriteBusy={favoriteBusy===m.musician_id}
                    onFavorite={()=>void toggleFavorite(m)} onInvite={()=>openMusician(m)}
                    onReport={()=>setReportTarget({type:"musician",id:m.musician_id,label:m.name})}/>)}
                </div>
                <p className="market-featured-swipe"><ArrowRight size={14}/>
                  Deslize para conhecer mais músicos em destaque.
                </p>
              </>}
      </section>

      <div className="market-content">
        <aside className={"market-sidebar"+(mobileFilters?" is-open":"")}>
          <div className="market-sidebar-head">
            <strong><SlidersHorizontal size={17}/> Filtrar músicos</strong>
            <button type="button" onClick={()=>setMobileFilters(false)}
              className="market-mobile-close" aria-label="Fechar filtros"><X size={19}/></button>
          </div>
          <form onSubmit={apply} className="market-filter-form">
            <label htmlFor="market-city">Cidade ou região</label>
            <div className="market-input-icon"><MapPin size={15}/>
              <input id="market-city" value={filters.city} maxLength={90}
                onChange={e=>setFilters(f=>({...f,city:e.target.value}))}
                placeholder="Ex.: São Paulo"/></div>

            <label htmlFor="market-instrument">Instrumento</label>
            <select id="market-instrument" value={filters.instrument}
              onChange={e=>setFilters(f=>({...f,instrument:e.target.value}))}>
              <option value="">Todos os instrumentos</option>
              {instruments.map(i=><option key={i} value={i}>{i}</option>)}
            </select>

            <label htmlFor="market-genre">Estilo musical</label>
            <select id="market-genre" value={filters.genre}
              onChange={e=>setFilters(f=>({...f,genre:e.target.value}))}>
              <option value="">Todos os estilos</option>
              {genres.map(g=><option key={g} value={g}>{g}</option>)}
            </select>

            <label htmlFor="market-fee">Cachê máximo divulgado (R$)</label>
            <input id="market-fee" type="text" inputMode="decimal" maxLength={10}
              value={filters.maxFee} placeholder="Ex.: 800"
              onChange={e=>setFilters(f=>({...f,maxFee:e.target.value}))}/>
            <small>Mostra apenas músicos que informaram um valor “a partir de”. Não é orçamento garantido.</small>

            <label htmlFor="market-date">Data desejada (opcional)</label>
            <div className="market-input-icon"><CalendarDays size={15}/>
              <input id="market-date" type="date" value={filters.date}
                min={localDateISO()} max={lastSelectableDate()}
                onChange={e=>setFilters(f=>({...f,date:e.target.value}))}/></div>
            <label className="market-check">
              <input type="checkbox" checked={filters.available}
                onChange={e=>setFilters(f=>({...f,available:e.target.checked}))}/>
              <span>Apenas recebendo propostas</span>
            </label>
            <label className="market-check">
              <input type="checkbox" checked={filters.favorites}
                onChange={e=>setFilters(f=>({...f,favorites:e.target.checked}))}/>
              <span><Heart size={14}/> Somente meus favoritos</span>
            </label>

            <button type="submit" className="market-apply"><Filter size={16}/> Aplicar filtros</button>
            <button type="button" className="market-clear" onClick={clear}>Limpar filtros</button>
          </form>
          <p className="market-filter-note"><CircleHelp size={15}/>
            Disponibilidade declarada pelo músico, sujeita à confirmação.
            Nenhum compromisso privado é exibido.</p>
        </aside>

        <section className="market-results" id="market-results">
          <form className="market-search-bar" onSubmit={apply}>
            <Search size={19}/>
            <input aria-label="Buscar músicos" placeholder="Busque por nome, instrumento ou especialidade..."
              value={filters.query} maxLength={90}
              onChange={e=>setFilters(f=>({...f,query:e.target.value}))}/>
            <button type="submit" aria-label="Pesquisar músicos">Pesquisar <ArrowRight size={15}/></button>
          </form>
          <div className="market-results-toolbar">
            <div>
              <strong>{loading?"Procurando músicos...":total+" músico(s) encontrado(s)"}</strong>
              <span>Portfólios publicados e autorizados pelo próprio músico</span>
            </div>
            <div className="market-sort-controls">
              <button type="button" className="market-filters-open"
                onClick={()=>setMobileFilters(v=>!v)}>
                <SlidersHorizontal size={16}/> Filtros
              </button>
              <label htmlFor="market-sort">Ordenar por</label>
              <select id="market-sort" value={filters.sort}
                onChange={e=>{
                  const sort=e.target.value as Sort;
                  setFilters(f=>({...f,sort}));
                  setApplied(f=>({...f,sort}));
                  setPage(0);
                }}>
                <option value="recent">Atualizados recentemente</option>
                <option value="rating">Melhor avaliação</option>
                <option value="experience">Experiência</option>
                <option value="name">Nome (A–Z)</option>
              </select>
            </div>
          </div>

          {notice&&<div className="market-notice" role="status"><Check size={17}/>{notice}</div>}
          {error&&<div className="market-error" role="alert"><CircleHelp size={17}/>{error}</div>}

          {loading?<div className="market-empty"><LoaderCircle size={28}/><h3>Buscando talentos...</h3></div>:
            items.length===0?<div className="market-empty">
              <Music2 size={36}/><h3>Nenhum músico encontrado</h3>
              <p>Altere os filtros ou aguarde novos músicos publicarem e autorizarem a exibição dos seus portfólios.</p>
              <button type="button" className="market-apply" onClick={clear}>Ver todos os músicos</button>
            </div>:
            <div className="market-card-grid">
              {items.map(m=><MarketplaceMusicianCard key={m.musician_id}
                musician={m} identity={identities[m.musician_id]} date={applied.date}
                ownProfile={authUserId===m.musician_id}
                favoriteBusy={favoriteBusy===m.musician_id}
                onFavorite={()=>void toggleFavorite(m)} onInvite={()=>openMusician(m)}
                onReport={()=>setReportTarget({type:"musician",id:m.musician_id,label:m.name})}/>)}
            </div>}

          {!loading&&total>limit&&<nav className="market-pagination" aria-label="Páginas do marketplace">
            <button type="button" disabled={page===0}
              onClick={()=>setPage(v=>v-1)}><ChevronLeft size={17}/> Anterior</button>
            <span>Página {page+1} de {pages}</span>
            <button type="button" disabled={page+1>=pages}
              onClick={()=>setPage(v=>v+1)}>Próxima <ChevronRight size={17}/></button>
          </nav>}
          <div className="market-results-footer"><ShieldCheck size={16}/>
            Avaliações são permitidas apenas após apresentações concluídas,
            com convite aceito no Stage Flow. Nenhum cachê privado é divulgado.
          </div>
        </section>
      </div>
      </div>
    </div>

    {selected&&<div className="market-modal-backdrop" onClick={()=>setSelected(null)}>
      <section className="market-modal" role="dialog" aria-modal="true"
        aria-label={"Convidar e avaliar "+selected.name} onClick={e=>e.stopPropagation()}>
        <header className="market-modal-head">
          <div className="market-modal-person">
            <div className="market-modal-avatar">{selected.avatar_url?
              <img src={selected.avatar_url} alt=""/>:<span>{initials(selected.name)}</span>}</div>
            <div><small>PERFIL DO MARKETPLACE</small><h2>{selected.name}</h2>
              <p><MapPin size={13}/>{selected.city||"Local não informado"}</p></div>
          </div>
          <button type="button" className="market-modal-close"
            onClick={()=>{setSelected(null);setError("");setNotice("");}}
            aria-label="Fechar painel"><X size={20}/></button>
        </header>
        <div className="market-modal-content">
          <div className="market-modal-tabs">
            <Link href={"/musico/"+encodeURIComponent(selected.slug)} target="_blank"
              rel="noopener noreferrer"
              onClick={()=>void trackMarketplaceExposure([selected.musician_id],"profile_open")}>
              Ver perfil completo <ArrowUpRight size={14}/></Link>
            <Rating musician={selected}/>
          </div>
          <Availability musician={selected} date={applied.date}/>
          {authUser&&<Link className="market-apply" style={{display:"inline-flex",alignItems:"center",gap:8,marginTop:12}}
            href={"/conversas?musico="+encodeURIComponent(selected.musician_id)+
              (applied.date?"&data="+encodeURIComponent(applied.date):"")+
              (selectedEvent?"&evento="+encodeURIComponent(selectedEvent):"")}>
            <MessageCircle size={16}/> Iniciar chat privado · Consultar disponibilidade
          </Link>}
          <p className="fine" style={{marginTop:10}}>
            Fale no chat antes de convidar. Seu WhatsApp pessoal permanece privado.
          </p>
          <button type="button" className="market-report-link"
            onClick={()=>setReportTarget({
              type:"musician",id:selected.musician_id,label:selected.name
            })}><Flag size={13}/> Denunciar este perfil</button>
          <div className="market-modal-block">
            <h3><Send size={17}/> Convite para show</h3>
            <p>O músico recebe um convite individual. Você acompanha a resposta e negocia o cachê em particular.</p>
            {!authUser?<div className="market-login-note">
              <p>Entre na conta de organizador para escolher um show e convidar este músico.</p>
              <Link href="/login" className="market-apply">Entrar na minha conta <ArrowRight size={15}/></Link>
            </div>:events.length===0?<div className="market-login-note">
              <p>Você precisa ter um show futuro cadastrado na agenda.</p>
              <Link className="market-apply" href="/eventos">Criar show <ArrowRight size={15}/></Link>
            </div>:selected.availability_mode==="unavailable"?
              <p className="market-modal-warning">O músico declarou que não está recebendo propostas neste momento.</p>:
              <form className="market-invite-form" onSubmit={e=>void sendInvite(e)}>
                <label htmlFor="market-invite-event">Escolha o show *</label>
                <select id="market-invite-event" required value={selectedEvent}
                  onChange={e=>setSelectedEvent(e.target.value)}>
                  <option value="">{loadingEvents?"Carregando shows...":"Selecione um evento"}</option>
                  {events.map(ev=><option value={ev.id} key={ev.id}>
                    {ev.title} · {dateBR(ev.starts_at)}</option>)}
                </select>
                <label htmlFor="market-invite-message">Mensagem ao músico (opcional)</label>
                <textarea id="market-invite-message" maxLength={500} rows={3}
                  value={inviteMessage} onChange={e=>setInviteMessage(e.target.value)}
                  placeholder="Ex.: gostaria de convidar você para tocar no nosso próximo show."/>
                <button type="submit" disabled={!selectedEvent||inviting}
                  className="market-apply"><Send size={15}/>
                  {inviting?"Registrando convite...":"Confirmar convite individual"}</button>
                <small>Nenhum WhatsApp, e-mail ou pagamento é enviado automaticamente.</small>
              </form>}
          </div>
          <div className="market-modal-block">
            <h3><Star size={18}/> Avaliações verificadas</h3>
            {reviews.length===0?<p>Este profissional ainda não possui avaliações de shows concluídos.</p>:
              <div className="market-review-list">{reviews.map(r=><article key={r.id}>
                <div><strong>{r.organizer_name}</strong>
                  <span>{Array.from({length:r.rating},(_,i)=><Star key={i} size={12} fill="currentColor"/>)}</span></div>
                {r.comment&&<p>{r.comment}</p>}
                <small>{dateBR(r.created_at)} · Show concluído no Stage Flow</small>
                <div className="market-modal-review-report">
                  <button type="button" className="market-report-link"
                    onClick={()=>setReportTarget({
                      type:"review",id:r.id,label:"avaliação sobre "+selected.name
                    })}><Flag size={12}/> Denunciar avaliação</button>
                </div>
              </article>)}</div>}
            {selectedReviewable.length>0&&<form className="market-review-form"
              onSubmit={e=>void submitReview(e)}>
              <h4>Avaliar um trabalho realizado</h4>
              <label htmlFor="market-review-event">Apresentação concluída</label>
              <select id="market-review-event" required value={reviewEvent}
                onChange={e=>setReviewEvent(e.target.value)}>
                <option value="">Selecione a apresentação</option>
                {selectedReviewable.map(r=><option key={r.event_id} value={r.event_id}>
                  {r.event_title} · {dateBR(r.starts_at)}</option>)}
              </select>
              <label htmlFor="market-rating-value">Nota</label>
              <select id="market-rating-value" value={reviewRating}
                onChange={e=>setReviewRating(Number(e.target.value))}>
                {[5,4,3,2,1].map(n=><option key={n} value={n}>{n} de 5 estrelas</option>)}
              </select>
              <label htmlFor="market-review-comment">Comentário (opcional)</label>
              <textarea id="market-review-comment" maxLength={450} rows={3}
                value={reviewComment} onChange={e=>setReviewComment(e.target.value)}
                placeholder="Como foi trabalhar com este músico?"/>
              <button type="submit" disabled={savingReview||!reviewEvent}
                className="market-apply">{savingReview?"Salvando...":"Publicar avaliação verificada"}</button>
            </form>}
            <p className="market-review-note"><ShieldCheck size={14}/>
              Não aceitamos avaliações sem participação confirmada em um show concluído.</p>
          </div>
          {error&&<p className="market-error" role="alert">{error}</p>}
          {notice&&<p className="market-notice" role="status">{notice}</p>}
        </div>
      </section>
    </div>}
    {reportTarget&&<MarketplaceReportDialog
      key={reportTarget.type+":"+reportTarget.id}
      target={reportTarget} signedIn={authUser}
      onClose={()=>setReportTarget(null)}/>}
    {authUser&&!preview&&!selected&&!reportTarget&&<WorkspaceMobileNav/>}
  </main>;
}
