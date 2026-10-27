"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, CalendarDays, CheckCircle2, ExternalLink, Images, Instagram,
  MapPin, MessageCircle, Music2, Send, ShieldCheck, Sparkles, Ticket, X, ChevronLeft, ChevronRight, Copy
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import VenueMonthCalendar, {
  venueDayOfMonth, venueDayKey, venueMonthKey, venueMonthStart
} from "@/components/venue-month-calendar";
import { VenueFeaturedEvent, VenueShowCard, VenueFlyerCard, type VenuePublicShow } from "@/components/venue-show-visuals";
import "./venue-public.css";

type HouseShow = VenuePublicShow;
type Gallery = { id: string; media_path: string; caption: string };
type House = {
  id: string; name: string; slug: string; description: string; address: string | null;
  city: string | null; state: string | null; instagram_url: string | null;
  whatsapp: string | null; logo_path: string | null; cover_path: string | null;
  is_partner: boolean; gallery: Gallery[];
};
type Mode = "agenda" | "flyers";

function mediaUrl(path: string) {
  return createClient().storage.from("stage-venue-media").getPublicUrl(path).data.publicUrl;
}
function showDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR",{
    day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit",
    timeZone:"America/Sao_Paulo"
  }).format(new Date(date));
}

export default function CasaPublicaPage() {
  const params = useParams<{slug:string}>();
  const slug = params.slug;
  const [venue,setVenue] = useState<House|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [month,setMonth] = useState(venueMonthStart);
  const [monthLoading,setMonthLoading] = useState(true);
  const [monthError,setMonthError] = useState("");
  const [events,setEvents] = useState<HouseShow[]>([]);
  const [highlights,setHighlights] = useState<HouseShow[]>([]);
  const [day,setDay] = useState<number|null>(null);
  const [mode,setMode] = useState<Mode>("agenda");
  const [focusedShow,setFocusedShow] = useState<HouseShow|null>(null);
  const [linkedShow,setLinkedShow] = useState<{id:string;month:string}|null>(null);
  const [shareStatus,setShareStatus] = useState("");
  const [focusedPhoto,setFocusedPhoto] = useState<Gallery|null>(null);
  const [suggestOpen,setSuggestOpen] = useState(false);
  const [artist,setArtist] = useState("");
  const [visitor,setVisitor] = useState("");
  const [message,setMessage] = useState("");
  const [website,setWebsite] = useState("");
  const [suggestBusy,setSuggestBusy] = useState(false);
  const [suggestDone,setSuggestDone] = useState(false);
  const [suggestError,setSuggestError] = useState("");

  // A shared show link may only resolve against the PUBLIC month RPC.
  // Never query private calendar/admin data to resolve a show identifier.
  useEffect(()=>{
    const query=new URLSearchParams(window.location.search);
    const id=query.get("show")||"";
    const monthKey=query.get("mes")||"";
    if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)
      || !/^(20[0-9]{2}|2100)-(0[1-9]|1[0-2])$/.test(monthKey))return;
    setMonth(new Date(Date.UTC(Number(monthKey.slice(0,4)),Number(monthKey.slice(5,7))-1,1)));
    setDay(null);setMode("agenda");setLinkedShow({id:id.toLowerCase(),month:monthKey});
  },[slug]);

  useEffect(()=>{
    let active=true;
    async function load(){
      if(!slug||!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)){
        setError("Página não encontrada.");setLoading(false);return;
      }
      try{
        const {data,error:queryError}=await createClient().rpc("stage_public_venue",{p_slug:slug});
        if(!active)return;
        if(queryError)throw queryError;
        if(!data){setError("Esta casa ainda não possui uma página oficial publicada.");return;}
        setVenue(data as House);
      }catch(e){if(active)setError(e instanceof Error?e.message:"Não foi possível abrir esta página.");}
      finally{if(active)setLoading(false);}
    }
    void load();
    return ()=>{active=false};
  },[slug]);

  useEffect(()=>{
    if(!venue)return;
    const venueSlug=venue.slug;
    let active=true;
    async function loadMonth(){
      setMonthLoading(true);setMonthError("");
      try{
        const {data,error:queryError}=await createClient().rpc("stage_venue_public_month",{
          p_slug:venueSlug,p_month:venueMonthKey(month)+"-01"
        });
        if(!active)return;
        if(queryError)throw queryError;
        const result=data as {status:string;events?:HouseShow[]};
        if(result.status!=="ok")throw new Error("Não foi possível carregar o calendário.");
        setEvents(result.events||[]);
      }catch(e){if(active){setEvents([]);setMonthError(e instanceof Error?e.message:"Erro ao carregar mês.");}}
      finally{if(active)setMonthLoading(false);}
    }
    void loadMonth();
    return ()=>{active=false};
  },[venue,month]);

  useEffect(()=>{
    if(!venue) return;
    let active=true;
    async function loadHighlights() {
      const {data,error:queryError}=await createClient().rpc(
        "stage_venue_public_highlights",{p_slug:venue!.slug}
      );
      if(!active)return;
      if(queryError){setHighlights([]);return;}
      const payload=data as {status:string;events?:HouseShow[]};
      setHighlights(payload.status==="ok"?(payload.events||[]):[]);
    }
    void loadHighlights();
    return ()=>{active=false;};
  },[venue]);

  useEffect(()=>{
    if(!linkedShow||monthLoading||monthError||venueMonthKey(month)!==linkedShow.month)return;
    // The public RPC returns published entries only, so drafts and cancellations
    // can never be opened merely by knowing an event UUID.
    const show=events.find(e=>e.id===linkedShow.id&&e.status==="published");
    if(show){setFocusedShow(show);setDay(venueDayOfMonth(show.starts_at));}
    setLinkedShow(null);
  },[events,linkedShow,month,monthLoading,monthError]);

  useEffect(()=>{setShareStatus("");},[focusedShow?.id]);

  async function copyShowLink(show:HouseShow){
    if(!venue)return;
    const url=new URL("/casa/"+venue.slug,window.location.origin);
    url.searchParams.set("mes",venueDayKey(show.starts_at).slice(0,7));
    url.searchParams.set("show",show.id);
    try{
      if(!navigator.clipboard?.writeText)throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url.toString());
      setShareStatus("Link do show copiado.");
    }catch{
      setShareStatus("Não foi possível copiar automaticamente. Use a opção Compartilhar do navegador.");
    }
  }

  const visible=useMemo(()=>events.filter(e=>day===null||venueDayOfMonth(e.starts_at)===day),
    [events,day]);
  const flyers=useMemo(()=>visible.filter(e=>!!e.flyer_path),[visible]);
  useEffect(()=>{
    if(!focusedShow&&!focusedPhoto)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    function onKey(event:KeyboardEvent){
      if(event.key==="Escape"){
        setFocusedShow(null);setFocusedPhoto(null);
      }
    }
    window.addEventListener("keydown",onKey);
    return ()=>{
      document.body.style.overflow=previous;
      window.removeEventListener("keydown",onKey);
    };
  },[focusedShow,focusedPhoto]);

  const photoIndex=focusedPhoto?venue?.gallery?.findIndex(p=>p.id===focusedPhoto.id)??-1:-1;
  function switchPhoto(direction:number){
    if(!venue?.gallery?.length || photoIndex<0)return;
    const next=(photoIndex+direction+venue.gallery.length)%venue.gallery.length;
    setFocusedPhoto(venue.gallery[next]);
  }

  const featured=highlights[0] || null;
  function goToShow(event:HouseShow){
    const key=venueDayKey(event.starts_at);
    setMonth(new Date(Date.UTC(Number(key.slice(0,4)), Number(key.slice(5,7))-1, 1)));
    setDay(Number(key.slice(-2)));
    setMode("agenda");
    document.getElementById("house-calendar")?.scrollIntoView({behavior:"smooth",block:"start"});
  }

  async function suggest(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!venue)return;
    setSuggestBusy(true);setSuggestError("");
    try{
      const {data,error:rpcError}=await createClient().rpc("stage_venue_suggest_artist",{
        p_slug:venue.slug,p_artist_name:artist.trim(),p_visitor_name:visitor.trim(),
        p_message:message.trim(),p_website:website
      });
      if(rpcError)throw rpcError;
      if(data==="limit_reached")throw new Error("Recebemos muitas sugestões hoje. Tente novamente mais tarde.");
      if(data!=="ok")throw new Error("Revise o nome da atração e tente novamente.");
      setSuggestDone(true);setArtist("");setVisitor("");setMessage("");
    }catch(e){setSuggestError(e instanceof Error?e.message:"Não foi possível enviar sua sugestão.");}
    finally{setSuggestBusy(false);}
  }

  return <main className="venue-public"><div className="container">
    <nav className="nav venue-public-nav">
      <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
      <Link href="/" className="btn btn-quiet"><ArrowLeft size={16}/> Stage Flow</Link>
    </nav>
    {loading?<div className="venue-public-empty">Carregando casa...</div>:
      !venue?<section className="venue-public-empty">
        <Music2 size={35}/><h1>Casa não encontrada.</h1><p>{error}</p>
        <Link href="/" className="btn btn-primary">Voltar ao Stage Flow</Link>
      </section>:<>
        <div className="venue-public-cover">
          {venue.cover_path?<img src={mediaUrl(venue.cover_path)} alt={"Capa de "+venue.name}/>:
            <div className="venue-public-cover-pattern"><Music2 size={52}/></div>}
        </div>
        <section className="venue-public-identity">
          <div className="venue-public-logo">
            {venue.logo_path?<img src={mediaUrl(venue.logo_path)} alt={"Logotipo de "+venue.name}/>:
              <Music2 size={32}/>}
          </div>
          <div className="venue-public-identity-copy">
            <div className="venue-public-tags">
              <span><ShieldCheck size={13}/> Perfil oficial</span>
              {venue.is_partner&&<span className="partner"><Sparkles size={13}/> Parceiro Stage Flow</span>}
            </div>
            <h1>{venue.name}</h1>
            <p><MapPin size={15}/>{[venue.city,venue.state].filter(Boolean).join(" · ")}
              {venue.address?" — "+venue.address:""}</p>
          </div>
        </section>

        {featured&&<VenueFeaturedEvent show={featured} houseName={venue.name}
          onOpen={setFocusedShow} onGoToCalendar={goToShow}/>}
        <div className="venue-public-layout">
          <div className="venue-public-main">
            <section className="venue-public-section venue-public-calendar" id="house-calendar">
              <div className="venue-public-heading"><CalendarDays size={20}/><h2>Programação da casa</h2></div>
              <p className="venue-public-subtitle">Encontre os shows por data e reveja os flyers de meses anteriores.</p>
              <VenueMonthCalendar month={month} events={events} selectedDay={day}
                onDayChange={setDay} onMonthChange={setMonth}/>
              <div className="venue-public-modes" role="group" aria-label="Visualizar programação">
                <button type="button" className={mode==="agenda"?"active":""}
                  onClick={()=>setMode("agenda")}><Ticket size={15}/> Shows</button>
                <button type="button" className={mode==="flyers"?"active":""}
                  onClick={()=>setMode("flyers")}><Images size={15}/> Flyers do mês</button>
              </div>
              {monthLoading?<p className="venue-public-placeholder">Carregando programação...</p>:
                monthError?<p className="venue-public-placeholder" role="alert">{monthError}</p>:
                mode==="agenda"?<div className="venue-public-events">
                  {visible.map(event=><VenueShowCard key={event.id} show={event} onOpen={setFocusedShow}/>)}
                  {!visible.length&&<p className="venue-public-placeholder">
                    Nenhum show divulgado para {day?"este dia":"este mês"}.
                    Consulte outro período para ver o histórico da casa.
                  </p>}
                </div>:<div className="venue-public-flyers">
                  {flyers.map(event=><VenueFlyerCard key={event.id} show={event} onOpen={setFocusedShow}/>)}
                  {!flyers.length&&<p className="venue-public-placeholder">
                    Não há flyers publicados neste período. Escolha outro mês no calendário.
                  </p>}
                </div>}
              <p className="fine">Calendário exclusivo de {venue.name}. Apenas apresentações publicadas pela casa aparecem aqui.</p>
            </section>

            <section className="venue-public-section">
              <div className="venue-public-heading"><Images size={20}/><h2>Conheça nosso espaço</h2></div>
              {venue.gallery?.length?<div className="venue-public-gallery">
                {venue.gallery.map(photo=><button type="button" key={photo.id}
                  onClick={()=>setFocusedPhoto(photo)} aria-label={"Ampliar "+(photo.caption||"foto do espaço")}>
                  <img src={mediaUrl(photo.media_path)} alt={photo.caption||"Foto do espaço"}/>
                  {photo.caption&&<span>{photo.caption}</span>}
                </button>)}
              </div>:<p className="venue-public-placeholder">
                As fotos deste espaço estarão disponíveis em breve.
              </p>}
            </section>
          </div>

          <aside className="venue-public-side">
            <section className="venue-public-section">
              <h2>Sobre a casa</h2>
              <p>{venue.description||"Explore os shows e conheça a programação deste espaço."}</p>
              <div className="venue-public-links">
                {venue.instagram_url&&<a href={venue.instagram_url} target="_blank" rel="noopener noreferrer">
                  <Instagram size={17}/> Instagram <ExternalLink size={14}/></a>}
                {venue.whatsapp&&<a href={"https://wa.me/"+venue.whatsapp.replace(/\D/g,"")}
                  target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={17}/> WhatsApp <ExternalLink size={14}/></a>}
              </div>
            </section>

            <section className="venue-public-section venue-public-suggest">
              <span className="venue-public-kicker"><Music2 size={17}/> O próximo palco pode ser seu favorito</span>
              <h2>Quem você quer ver por aqui?</h2>
              <p>Tem um cantor ou grupo que combina com a casa? Conta pra gente!</p>
              {!suggestOpen?<button className="btn btn-primary" type="button"
                onClick={()=>setSuggestOpen(true)}>
                <Send size={16}/> Sugerir atração
              </button>:suggestDone?<div className="venue-public-suggest-ok" role="status">
                <CheckCircle2 size={25}/>
                <strong>Sugestão recebida!</strong>
                <p>Obrigado por participar. A equipe da casa poderá conferir sua ideia.</p>
                <button className="btn btn-quiet" type="button"
                  onClick={()=>{setSuggestDone(false);setSuggestOpen(false);}}>
                  Fechar
                </button>
              </div>:<form onSubmit={suggest} className="venue-public-suggest-form">
                <div className="field"><label htmlFor="suggest-artist">Qual artista ou grupo? *</label>
                  <input id="suggest-artist" value={artist} onChange={e=>setArtist(e.target.value)}
                    maxLength={100} minLength={2} required
                    placeholder="Ex.: seu grupo favorito"/></div>
                <div className="field"><label htmlFor="suggest-name">Seu nome <span>(opcional)</span></label>
                  <input id="suggest-name" value={visitor} onChange={e=>setVisitor(e.target.value)}
                    maxLength={60} placeholder="Como podemos te chamar?"/></div>
                <div className="field"><label htmlFor="suggest-message">Quer contar mais? <span>(opcional)</span></label>
                  <textarea id="suggest-message" rows={3} maxLength={360} value={message}
                    onChange={e=>setMessage(e.target.value)}
                    placeholder="Por que essa atração seria legal aqui?"/></div>
                <div className="venue-public-trap" aria-hidden="true">
                  <label htmlFor="suggest-website">Website</label><input tabIndex={-1} id="suggest-website"
                    value={website} autoComplete="off" onChange={e=>setWebsite(e.target.value)}/>
                </div>
                {suggestError&&<p className="venue-public-suggest-error" role="alert">{suggestError}</p>}
                <div className="venue-public-suggest-actions">
                  <button type="submit" className="btn btn-primary" disabled={suggestBusy}>
                    <Send size={15}/>{suggestBusy?"Enviando...":"Enviar sugestão"}
                  </button>
                  <button type="button" className="btn btn-quiet" onClick={()=>setSuggestOpen(false)}
                    disabled={suggestBusy}>Cancelar</button>
                </div>
                <p className="fine">As sugestões são privadas e não representam confirmação de show.</p>
              </form>}
            </section>
          </aside>
        </div>
        <footer className="venue-public-footer">Página oficial de {venue.name} · Feito com Stage Flow</footer>
      </>}

    {(focusedShow||focusedPhoto)&&<div className="venue-public-overlay" role="presentation"
      onClick={()=>{setFocusedShow(null);setFocusedPhoto(null);}}>
      <div className="venue-public-modal" role="dialog" aria-modal="true"
        aria-label={focusedShow?.title||focusedPhoto?.caption||"Imagem da casa"}
        onClick={e=>e.stopPropagation()}>
        <button type="button" className="venue-public-modal-close" aria-label="Fechar"
          onClick={()=>{setFocusedShow(null);setFocusedPhoto(null);}}><X size={21}/></button>
        {focusedShow?<>
          {focusedShow.flyer_path&&<img src={mediaUrl(focusedShow.flyer_path)}
            alt={"Flyer de "+focusedShow.title}/>}
          <h2>{focusedShow.title}</h2>
          <p className="venue-public-modal-date">{showDate(focusedShow.starts_at)}</p>
          {focusedShow.description&&<p>{focusedShow.description}</p>}
          <button type="button" className="venue-public-share-show"
            onClick={()=>void copyShowLink(focusedShow)}>
            <Copy size={16}/> Copiar link deste show
          </button>
          {shareStatus&&<p className="venue-public-share-message" role="status">{shareStatus}</p>}
        </>:focusedPhoto&&<>
          <img src={mediaUrl(focusedPhoto.media_path)} alt={focusedPhoto.caption||"Foto ampliada"}/>
          {focusedPhoto.caption&&<p>{focusedPhoto.caption}</p>}
          {venue&&venue.gallery.length>1&&<div className="venue-public-photo-controls">
            <button type="button" onClick={()=>switchPhoto(-1)} aria-label="Foto anterior"><ChevronLeft size={19}/> Anterior</button>
            <span>{photoIndex+1} / {venue.gallery.length}</span>
            <button type="button" onClick={()=>switchPhoto(1)} aria-label="Próxima foto">Próxima <ChevronRight size={19}/></button>
          </div>}
        </>}
      </div>
    </div>}
  </div></main>;
}
