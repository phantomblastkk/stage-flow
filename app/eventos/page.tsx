"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Plus, MapPin, Clock3, Trash2, ImagePlus, ChevronLeft, ChevronRight, Mic, Users, Search, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import EventTeamInvites from "@/components/event-team-invites";
import dynamic from "next/dynamic";
import { Button, Dialog, EmptyState, InlineNotice, Input, LoadingState, StatusChip, Textarea } from "@/src/components/ui";
import { AgendaSessionRequired, agendaWindow, catalogAvailable, loadAgenda, loadAgendaTarget, loadAgendaMarkers, loadMoreAgenda, removeEvent, saveEvent, searchCities, searchVenues } from "@/src/domains/events/services/agenda-service";
import type { AgendaCursor, AgendaSource, CitySuggestion, EventRow, GuestShow, VenueSuggestion } from "@/src/domains/events/types";
import "./agenda.css";

const ShowFlyerManager = dynamic(() => import("./show-flyer-manager"), {
 loading: () => <LoadingState label="Carregando editor do flyer…"/>,
});

const dateOf = (dateString:string) => { const d=new Date(dateString); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const formatDate = (value:string) => new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));

export default function EventosPage() {
 const router=useRouter();
 const [events,setEvents]=useState<EventRow[]>([]);
 const [guestShows,setGuestShows]=useState<GuestShow[]>([]);
 const [guestError,setGuestError]=useState("");
 const [agendaError,setAgendaError]=useState("");
 const [showCreateForm,setShowCreateForm]=useState(false);
 const [deleting,setDeleting]=useState(false);
 const [deleteTarget,setDeleteTarget]=useState<EventRow|null>(null);
 const loadRequest=useRef<AbortController|null>(null);
 const createTrigger=useRef<HTMLButtonElement>(null);
 const focusScrolled=useRef<string|null>(null);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[ownerId,setOwnerId]=useState("");
 const [message,setMessage]=useState(""),[isError,setIsError]=useState(false);
 const [calendarMonth,setCalendarMonth]=useState(()=>new Date(2000,0,1));
 const calendarView=useRef(calendarMonth);calendarView.current=calendarMonth;
 const [calendarReady,setCalendarReady]=useState(false);
 useEffect(()=>{
  const today=new Date();setCalendarMonth(new Date(today.getFullYear(),today.getMonth(),1));
  setCalendarReady(true);
 },[]);
 const [selectedDate,setSelectedDate]=useState<string|null>(null);
 const [spotlightEventId,setSpotlightEventId]=useState<string|null>(null);
 const [openTeamEventId,setOpenTeamEventId]=useState<string|null>(null);
 const [openFlyerEventId,setOpenFlyerEventId]=useState<string|null>(null);
 const [title,setTitle]=useState(""),[description,setDescription]=useState(""),[venue,setVenue]=useState(""),[city,setCity]=useState(""),[startsAt,setStartsAt]=useState(""),[endsAt,setEndsAt]=useState(""),[publicly,setPublicly]=useState(true);
 const [selectedVenueId,setSelectedVenueId]=useState<string|null>(null);
 const [venueSuggestions,setVenueSuggestions]=useState<VenueSuggestion[]>([]);
 const [citySuggestions,setCitySuggestions]=useState<CitySuggestion[]>([]);
 const [showVenueSuggestions,setShowVenueSuggestions]=useState(false),[showCitySuggestions,setShowCitySuggestions]=useState(false);
 const [catalogReady,setCatalogReady]=useState(false);
 const [spotlightEvent,setSpotlightEvent]=useState<EventRow|null>(null);
 const [spotlightGuest,setSpotlightGuest]=useState<GuestShow|null>(null);
 const [ownNext,setOwnNext]=useState<AgendaCursor|null>(null),[guestNext,setGuestNext]=useState<AgendaCursor|null>(null);
 const [ownMoreLoading,setOwnMoreLoading]=useState(false),[guestMoreLoading,setGuestMoreLoading]=useState(false);
 const [ownMoreError,setOwnMoreError]=useState(""),[guestMoreError,setGuestMoreError]=useState("");
 const ownMoreRequest=useRef<AbortController|null>(null),guestMoreRequest=useRef<AbortController|null>(null);
 const [markers,setMarkers]=useState<{own:string[];guest:string[]}>({own:[],guest:[]});
 const [markerMessage,setMarkerMessage]=useState("");
 const [markerNonce,setMarkerNonce]=useState(0);
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  if(params.get("novo")==="1")setShowCreateForm(true);
  const house=params.get("casa");
  if(!house)return;
  const request=new AbortController();
  void createClient().auth.getUser().then(async({data:{user}})=>{
   if(!user||request.signal.aborted)return;
   const {data}=await createClient().from("stage_performance_profiles").select("name,city,venue_id").eq("id",house).eq("account_id",user.id).eq("kind","venue").abortSignal(request.signal).maybeSingle();
   if(!data||request.signal.aborted)return;setVenue(data.name);setCity(data.city);setSelectedVenueId(data.venue_id);
  });
  return()=>request.abort();
 },[]);
 const monthRange=agendaWindow(calendarMonth);
 const listRange=agendaWindow(calendarMonth,selectedDate);
 const monthFrom=monthRange.from,monthTo=monthRange.to;
 const listFrom=listRange.from,listTo=listRange.to;
 function changeMonth(delta:number){
  setSelectedDate(null);
  setCalendarMonth(value=>new Date(value.getFullYear(),value.getMonth()+delta,1));
 }
 useEffect(()=>{
  if(!calendarReady)return;
  const request=new AbortController();setMarkers({own:[],guest:[]});setMarkerMessage("");
  void loadAgendaMarkers(createClient(),request.signal,{from:monthFrom,to:monthTo}).then(result=>{
   if(request.signal.aborted)return;
   setMarkers({own:result.own,guest:result.guest});
   if(result.partial)setMarkerMessage("Este mês tem muitos shows. Algumas marcações podem não aparecer; selecione a data para consultar a lista completa.");
  }).catch(error=>{if(!request.signal.aborted&&!(error instanceof AgendaSessionRequired))setMarkerMessage(error instanceof Error?error.message:"Marcações indisponíveis.");});
  return()=>request.abort();
 },[monthFrom,monthTo,markerNonce,calendarReady]);

 const loadEvents=useCallback(async()=>{
  loadRequest.current?.abort();ownMoreRequest.current?.abort();guestMoreRequest.current?.abort();
  setEvents([]);setGuestShows([]);setOwnNext(null);setGuestNext(null);
  setOwnMoreError("");setGuestMoreError("");setOwnMoreLoading(false);setGuestMoreLoading(false);
  const request=new AbortController();
  loadRequest.current=request;
  setLoading(true);setAgendaError("");setGuestError("");
  try{
   const result=await loadAgenda(createClient(),request.signal,{from:listFrom,to:listTo});
   if(request.signal.aborted)return;
   setOwnerId(result.ownerId);setOwnNext(result.ownNext);setGuestNext(result.guestNext);
   if(result.events)setEvents(result.events);
   else setAgendaError("Não foi possível carregar seus shows. Tente atualizar a agenda.");
   if(result.guestShows)setGuestShows(result.guestShows);
   else setGuestError("Não foi possível carregar suas participações. Tente atualizar a agenda.");
  }catch(error){
   if(request.signal.aborted)return;
   if(error instanceof AgendaSessionRequired){router.replace("/login");return;}
   const text=error instanceof Error?error.message:"Não foi possível carregar a agenda. Tente novamente.";
   setAgendaError(text);setGuestError(text);
  }finally{if(!request.signal.aborted)setLoading(false);}
 },[router,listFrom,listTo]);
 useEffect(()=>{if(!calendarReady)return;void loadEvents();return()=>{
  loadRequest.current?.abort();ownMoreRequest.current?.abort();guestMoreRequest.current?.abort();
 };},[loadEvents,calendarReady]);
 async function loadMore(source:AgendaSource){
  const own=source==="owned",cursor=own?ownNext:guestNext;
  const ref=own?ownMoreRequest:guestMoreRequest;
  if(!cursor||(own?ownMoreLoading:guestMoreLoading))return;
  const request=new AbortController();ref.current?.abort();ref.current=request;
  if(own){setOwnMoreLoading(true);setOwnMoreError("");}else{setGuestMoreLoading(true);setGuestMoreError("");}
  try{
   const result=await loadMoreAgenda(createClient(),request.signal,{from:listFrom,to:listTo},source,cursor);
   if(request.signal.aborted)return;
   if(result.ownerId!==ownerId){await loadEvents();return;}
   if(own){
    setEvents(rows=>{const ids=new Set(rows.map(row=>row.id));return [...rows,...(result.items as EventRow[]).filter(row=>!ids.has(row.id))];});
    setOwnNext(result.next);
   }else{
    setGuestShows(rows=>{const ids=new Set(rows.map(row=>row.event_id));return [...rows,...(result.items as GuestShow[]).filter(row=>!ids.has(row.event_id))];});
    setGuestNext(result.next);
   }
  }catch(error){
   if(request.signal.aborted)return;
   if(error instanceof AgendaSessionRequired){router.replace("/login");return;}
   const message=error instanceof Error?error.message:"Não foi possível carregar mais shows.";
   if(own)setOwnMoreError(message);else setGuestMoreError(message);
  }finally{if(!request.signal.aborted){if(own)setOwnMoreLoading(false);else setGuestMoreLoading(false);}}
 }
 useEffect(()=>{
  if(showCreateForm)document.getElementById("event-title")?.focus();
 },[showCreateForm]);
 const closeCreateForm=()=>{setShowCreateForm(false);createTrigger.current?.focus();};
 const closeDelete=useCallback(()=>{if(!deleting)setDeleteTarget(null);},[deleting]);
 // Direct booking links retain the show outside the current month/page and check participation on the server.
 useEffect(()=>{
  const eventId=new URLSearchParams(window.location.search).get("evento");
  if(!eventId||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(eventId))return;
  const request=new AbortController();setSpotlightEventId(eventId);
  void loadAgendaTarget(createClient(),request.signal,eventId).then(target=>{
   if(request.signal.aborted)return;
   const date=new Date(target.event.starts_at);
   // Start the loading state in this render, before the new month's query effect runs.
   if(date.getFullYear()!==calendarView.current.getFullYear()||date.getMonth()!==calendarView.current.getMonth()){
    loadRequest.current?.abort();ownMoreRequest.current?.abort();guestMoreRequest.current?.abort();
    setLoading(true);
   }
   if(target.kind==="owned"){
    setSpotlightEvent(target.event);setSpotlightGuest(null);
    if(new URLSearchParams(window.location.search).get("equipe")==="1")setOpenTeamEventId(eventId);
   }else{setSpotlightGuest(target.event);setSpotlightEvent(null);}
   setSelectedDate(null);
   setCalendarMonth(new Date(date.getFullYear(),date.getMonth(),1));
  }).catch(error=>{if(!request.signal.aborted){setIsError(true);setMessage(error instanceof Error?error.message:"Não foi possível abrir o show.");}});
  return()=>request.abort();
 },[]);
 useEffect(()=>{
  if(loading||!spotlightEventId||(!events.some(event=>event.id===spotlightEventId)&&spotlightEvent?.id!==spotlightEventId&&
   !guestShows.some(show=>show.event_id===spotlightEventId)&&spotlightGuest?.event_id!==spotlightEventId))return;
  if(focusScrolled.current===spotlightEventId)return;
  const target=document.getElementById("stage-event-"+spotlightEventId);
  if(!target)return;
  focusScrolled.current=spotlightEventId;
  target.scrollIntoView({behavior:"smooth",block:"center"});
  target.focus({preventScroll:true});
 },[loading,spotlightEventId,events,spotlightEvent,guestShows,spotlightGuest]);

 useEffect(()=>{
  const request=new AbortController();
  void catalogAvailable(createClient(),request.signal)
   .then(ready=>{if(!request.signal.aborted)setCatalogReady(ready);}).catch(()=>{});
  return()=>request.abort();
 },[]);
 useEffect(()=>{
  const request=new AbortController();
  if(!venue.trim()||!catalogReady){setVenueSuggestions([]);return;}
  const timer=setTimeout(()=>{
   void searchVenues(createClient(),venue,city,request.signal)
    .then(rows=>{if(!request.signal.aborted)setVenueSuggestions(rows);}).catch(()=>{});
  },220);
  return()=>{request.abort();clearTimeout(timer);};
 },[venue,city,catalogReady]);
 useEffect(()=>{
  const request=new AbortController();
  if(!city.trim()||!catalogReady){setCitySuggestions([]);return;}
  const timer=setTimeout(()=>{
   void searchCities(createClient(),city,request.signal)
    .then(rows=>{if(!request.signal.aborted)setCitySuggestions(rows);}).catch(()=>{});
  },180);
  return()=>{request.abort();clearTimeout(timer);};
 },[city,catalogReady]);

 async function createEvent(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(saving)return;
  setSaving(true);setMessage("");setIsError(false);
  try{
   const created=await saveEvent(createClient(),{title,description,venue,venueId:selectedVenueId,city,startsAt,endsAt,publicly});
   if(new URLSearchParams(window.location.search).get("continuar")==="contratar"){router.push("/contratar?evento="+created.id);return;}
   setSpotlightEvent(created);setSpotlightEventId(created.id);setSelectedDate(null);
   const date=new Date(created.starts_at);setCalendarMonth(new Date(date.getFullYear(),date.getMonth(),1));
   setMarkerNonce(value=>value+1);
   setMessage("Evento salvo com sucesso!");
   setTitle("");setDescription("");setVenue("");setSelectedVenueId(null);setCity("");setStartsAt("");setEndsAt("");setPublicly(true);
   closeCreateForm();
   await loadEvents();
  }catch(error){
   if(error instanceof AgendaSessionRequired)router.replace("/login");
   else {setIsError(true);setMessage(error instanceof Error?error.message:"Não foi possível salvar o show.");}
  }finally{setSaving(false);}
 }
 async function deleteEvent(){
  if(!deleteTarget||deleting)return;
  setDeleting(true);setMessage("");setIsError(false);
  try{
   await removeEvent(createClient(),deleteTarget.id);
   setEvents(rows=>rows.filter(item=>item.id!==deleteTarget.id));
   if(spotlightEvent?.id===deleteTarget.id)setSpotlightEvent(null);
   setMarkerNonce(value=>value+1);
   setDeleteTarget(null);setMessage("Evento excluído.");
  }catch(error){
   if(error instanceof AgendaSessionRequired)router.replace("/login");
   else {setIsError(true);setMessage(error instanceof Error?error.message:"Não foi possível excluir o show.");setDeleteTarget(null);}
  }finally{setDeleting(false);}
 }
 const labels={draft:"Privado",published:"Publicado",cancelled:"Cancelado",completed:"Concluído"};
 const monthLabel=calendarMonth.toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
 const firstWeekday=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1).getDay();
 const daysInMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,0).getDate();
 const ownShowDays=new Set(markers.own.map(dateOf));
 const guestShowDays=new Set(markers.guest.map(dateOf));
 const dateKey=(day:number)=>calendarMonth.getFullYear()+"-"+String(calendarMonth.getMonth()+1).padStart(2,"0")+"-"+String(day).padStart(2,"0");
 const pin=spotlightEvent&&Date.parse(spotlightEvent.starts_at)>=Date.parse(listFrom)&&Date.parse(spotlightEvent.starts_at)<Date.parse(listTo)&&!events.some(event=>event.id===spotlightEvent.id)?spotlightEvent:null;
 const visibleEvents=pin?[pin,...events]:events;
 const guestPin=spotlightGuest&&Date.parse(spotlightGuest.starts_at)>=Date.parse(listFrom)&&Date.parse(spotlightGuest.starts_at)<Date.parse(listTo)&&!guestShows.some(show=>show.event_id===spotlightGuest.event_id)?spotlightGuest:null;
 const visibleGuestShows=guestPin?[guestPin,...guestShows]:guestShows;

 if(!calendarReady)return <main className="agenda-page"><LoadingState label="Abrindo sua agenda…"/></main>;
 return <main className="agenda-page"><div className="container">
  <nav className="nav"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link><Link className="sf-ui-button sf-ui-button-ghost" href="/painel"><ArrowLeft size={15}/> Voltar ao painel</Link></nav>
  <section className="agenda-hero"><div className="eyebrow"><span className="dot"/> AGENDA PROFISSIONAL</div><h1 className="agenda-hero-title">Seus <span className="accent">eventos.</span></h1><p className="lead">Seus próprios shows e as participações confirmadas em outras equipes, todos no mesmo calendário.</p><div className="agenda-primary-actions">
   <button ref={createTrigger} type="button" className="sf-ui-button sf-ui-button-primary" onClick={()=>setShowCreateForm(open=>!open)} aria-expanded={showCreateForm} aria-controls="agenda-create-form"><Plus size={16}/>{showCreateForm?"Fechar cadastro":"Novo show"}</button>
   <Link href="/shows-recorrentes" className="sf-ui-button sf-ui-button-ghost"><CalendarDays size={16}/> Programação semanal</Link>
  </div></section>
  {message&&<div className="agenda-notice"><InlineNotice tone={isError?"danger":"success"}>{message}</InlineNotice></div>}
  <section id="agenda-create-form" hidden={!showCreateForm} className="sf-ui-card agenda-create"><h2 className="agenda-create-title"><Plus size={19} className="agenda-inline-icon"/> Novo evento</h2>
   <form onSubmit={createEvent} aria-label="Novo show">
    <Input id="event-title" label="Nome do show / evento *" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Pagode ao vivo" required maxLength={120}/>
    <div className="agenda-field-grid"><Input id="event-start" label="Data e horário de início *" type="datetime-local" value={startsAt} onChange={e=>setStartsAt(e.target.value)} required/><Input id="event-end" label="Data e horário de término" type="datetime-local" value={endsAt} onChange={e=>setEndsAt(e.target.value)}/></div>
    <div className="agenda-field-grid">
     <div className="sf-ui-field agenda-relative" ><label htmlFor="event-venue">Local / estabelecimento</label><div className="agenda-relative"><input className="sf-ui-input" id="event-venue" value={venue} autoComplete="off" onFocus={()=>setShowVenueSuggestions(true)} onBlur={()=>setTimeout(()=>setShowVenueSuggestions(false),160)} onChange={e=>{setVenue(e.target.value);setSelectedVenueId(null);setShowVenueSuggestions(true)}} placeholder="Pesquise uma casa ou digite o local..."/><Search size={15} className="agenda-search-icon"/></div>
      {showVenueSuggestions&&venue.trim()&&venueSuggestions.length>0&&<div role="listbox" aria-label="Casas de shows encontradas" className="agenda-suggestions">{venueSuggestions.map(item=><button type="button" key={item.id} onMouseDown={e=>e.preventDefault()} onClick={()=>{setVenue(item.name);setSelectedVenueId(item.id);if(item.city_name)setCity(item.city_name+(item.state_code?" - "+item.state_code:""));setShowVenueSuggestions(false)}} className="agenda-suggestion"><strong>{item.name}</strong><span className="agenda-suggestion-detail">{[item.address,item.city_name,item.state_code].filter(Boolean).join(" · ")}</span></button>)}</div>}
      <div className="agenda-venue-help"><p className="agenda-hint">Você pode digitar qualquer local; ele será salvo no evento mesmo sem estar no catálogo.</p><Link href="/locais" className="agenda-catalog-link">Cadastrar local no catálogo</Link></div>{showVenueSuggestions&&venue.trim()&&venueSuggestions.length===0&&catalogReady&&<p className="agenda-suggestion-empty">Nenhum local cadastrado com esse nome. Você pode manter o texto digitado ou cadastrar esse estabelecimento no catálogo.</p>}
     </div>
     <div className="sf-ui-field agenda-relative" ><label htmlFor="event-city">Cidade</label><input className="sf-ui-input" id="event-city" value={city} autoComplete="off" onFocus={()=>setShowCitySuggestions(true)} onBlur={()=>setTimeout(()=>setShowCitySuggestions(false),160)} onChange={e=>{setCity(e.target.value);setSelectedVenueId(null);setShowCitySuggestions(true)}} placeholder="Comece a digitar a cidade..."/>
      {showCitySuggestions&&city.trim()&&citySuggestions.length>0&&<div role="listbox" aria-label="Cidades encontradas" className="agenda-suggestions">{citySuggestions.map(item=><button type="button" key={item.id} onMouseDown={e=>e.preventDefault()} onClick={()=>{setCity(item.name+" - "+item.state_code);setSelectedVenueId(null);setShowCitySuggestions(false)}} className="agenda-city-suggestion"><span>{item.name} - {item.state_code}</span>{city===item.name+" - "+item.state_code&&<Check size={15}/>}</button>)}</div>}
      <p className="agenda-city-hint">{catalogReady?"Selecione uma sugestão ou mantenha sua própria descrição.":"Busca de cidades indisponível. Você pode digitar a cidade."}</p>
     </div>
    </div>
    <Textarea id="event-description" label="Descrição e observações" value={description} onChange={e=>setDescription(e.target.value)} placeholder="Detalhes do evento..." rows={3}/>
    <p className="agenda-form-hint">Depois de salvar o show, use <strong>Flyer para Instagram/WhatsApp</strong> no card do evento para enviar a arte e gerar os dois tamanhos.</p>
    <label className="agenda-public-option"><input type="checkbox" checked={publicly} onChange={e=>setPublicly(e.target.checked)} className="agenda-public-checkbox"/><span><strong className="agenda-strong">Mostrar publicamente</strong><br/>O evento fica marcado como publicado para futura exibição no portfólio.</span></label>
    <div className="agenda-primary-actions"><Button type="submit" loading={saving} disabled={!ownerId}><Plus size={16}/>{saving?"Salvando...":"Salvar evento"}</Button><Button variant="ghost" disabled={saving} onClick={closeCreateForm}>Cancelar</Button></div>
   </form>
  </section>
  <section className="sf-ui-card agenda-calendar" aria-label="Calendário de shows">
   <div className="agenda-calendar-heading">
    <div><div className="eyebrow"><span className="dot"/> CALENDÁRIO</div><h2 aria-live="polite" className="agenda-month-title">{monthLabel}</h2></div>
    <div className="agenda-month-actions"><button type="button" className="sf-ui-button sf-ui-button-ghost" aria-label="Mês anterior" onClick={()=>changeMonth(-1)}><ChevronLeft size={18}/></button><button type="button" className="sf-ui-button sf-ui-button-ghost" aria-label="Próximo mês" onClick={()=>changeMonth(1)}><ChevronRight size={18}/></button></div>
   </div>
   <div className="agenda-weekdays">{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(day=><div key={day} className="agenda-weekday">{day}</div>)}</div>
   <div className="agenda-days">
    {Array.from({length:firstWeekday},(_,i)=><div key={"empty-"+i} aria-hidden="true"/>)}
    {Array.from({length:daysInMonth},(_,i)=>{const day=i+1,key=dateKey(day),hasOwn=ownShowDays.has(key),hasGuest=guestShowDays.has(key),hasShow=hasOwn||hasGuest,selected=selectedDate===key;return <button type="button" key={key} onClick={()=>setSelectedDate(selected?null:key)} aria-pressed={selected} aria-label={day+" de "+monthLabel+(hasOwn?", show próprio":"")+(hasGuest?", participação confirmada":"")} className="agenda-day"><span>{day}</span>{hasShow&&<span className="agenda-day-markers">{hasOwn&&<Mic size={14} color="var(--sf-ui-brand)" aria-label="Show próprio"/>}{hasGuest&&<Users size={14} className="agenda-guest-icon" aria-label="Participação confirmada"/>}</span>}</button>})}
   </div>
   {markerMessage&&<p role="status" className="agenda-marker-note">{markerMessage}</p>}
   {selectedDate&&<Button variant="ghost" onClick={()=>setSelectedDate(null)} className="agenda-clear-date">Limpar filtro de data</Button>}
   <p className="agenda-legend"><Mic size={13} className="agenda-inline-icon" color="var(--sf-ui-brand)"/> Show próprio · <Users size={13}  className="agenda-guest-icon agenda-inline-icon"/> Participação confirmada. Toque na data para filtrar; toque de novo para voltar ao mês.</p>
  </section>
  <section className="section agenda-owned-section" ><div className="section-heading"><h2><CalendarDays size={25} className="agenda-inline-icon"/> Shows próprios</h2><p>{selectedDate ? "Shows próprios do dia " + new Date(selectedDate+"T12:00:00").toLocaleDateString("pt-BR") : "Shows do mês selecionado, em ordem de data."}</p></div>
   {loading?<LoadingState label="Carregando agenda…"/>:agendaError?<InlineNotice tone="danger">{agendaError}<div className="agenda-notice-action"><Button variant="ghost" onClick={()=>void loadEvents()}>Tentar novamente</Button></div></InlineNotice>:visibleEvents.length===0?<EmptyState title={selectedDate?"Nenhum show próprio nesta data":"Nenhum show próprio neste mês"} description="Cadastre um show para organizar sua equipe e seus horários." action={<Button onClick={()=>setShowCreateForm(true)}><Plus size={16}/> Novo show</Button>}/>:<div className="agenda-event-list">{visibleEvents.map(event=><article
    className={"event"+(event.id===spotlightEventId?" is-highlighted":"")}
    id={"stage-event-"+event.id}
    key={event.id}
    ><div className="event-date"><div><strong>{new Date(event.starts_at).toLocaleDateString("pt-BR",{day:"2-digit"})}</strong><br/><span>{new Date(event.starts_at).toLocaleDateString("pt-BR",{month:"short"}).replace(".","").toUpperCase()}</span></div></div><div className="event-info"><strong>{event.title}</strong>{event.id===spotlightEventId&&
    <span className="agenda-highlight-label">
     Show em destaque · {event.status==="draft"?"rascunho privado":labels[event.status]}
    </span>}<span className="agenda-event-meta"><Clock3 size={12} className="agenda-inline-icon"/> {formatDate(event.starts_at)}</span>{(event.venue||event.city)&&<span className="agenda-event-meta"><MapPin size={12} className="agenda-inline-icon"/> {[event.venue,event.city].filter(Boolean).join(" · ")}</span>}{event.description&&<p className="agenda-event-description">{event.description}</p>}<StatusChip label={labels[event.status]} status={event.status==="cancelled"?"danger":event.status==="published"||event.status==="completed"?"success":"neutral"}/>
      <div className="agenda-event-actions">
       <button className={(openTeamEventId===event.id?"sf-ui-button sf-ui-button-primary":"sf-ui-button sf-ui-button-ghost")+" agenda-event-action"} type="button"
        aria-expanded={openTeamEventId===event.id}
        onClick={()=>setOpenTeamEventId(current=>current===event.id?null:event.id)}
        >
        <Users size={16}/>{openTeamEventId===event.id?"Fechar painel":"Equipe, convites e financeiro"}
       </button>
       <button className={(openFlyerEventId===event.id?"sf-ui-button sf-ui-button-primary":"sf-ui-button sf-ui-button-ghost")+" agenda-event-action"}
        type="button" aria-expanded={openFlyerEventId===event.id}
        onClick={()=>setOpenFlyerEventId(current=>current===event.id?null:event.id)}
        >
        <ImagePlus size={16}/>{openFlyerEventId===event.id?"Fechar flyer":"Flyer para Instagram/WhatsApp"}
       </button>
       <Link className="sf-ui-button sf-ui-button-ghost agenda-action-text"
         href={"/eventos/operacao?evento="+encodeURIComponent(event.id)}>
         <Check size={15}/> Operação e checklist
       </Link>
       {event.id===spotlightEventId&&<span className="agenda-muted">
        Organize músicos e confira os cachês sem publicar este show.
       </span>}
      </div>
      {openTeamEventId===event.id&&<EventTeamInvites
       eventId={event.id} eventTitle={event.title} eventStatus={event.status}/>}
      {openFlyerEventId===event.id&&<ShowFlyerManager eventId={event.id} title={event.title}/>}
     </div><button aria-label={"Excluir "+event.title} title="Excluir evento" type="button" onClick={()=>setDeleteTarget(event)} className="sf-ui-button sf-ui-button-ghost agenda-delete"><Trash2 size={15}/></button></article>)}</div>}
  </section>
  {!loading&&!agendaError&&<div className="agenda-pagination">
   <span>{visibleEvents.length} shows próprios carregados neste período</span>
   {ownMoreError&&<p role="alert">{ownMoreError}</p>}
   {ownNext&&<Button variant="secondary" loading={ownMoreLoading} onClick={()=>void loadMore("owned")}>Carregar mais shows próprios</Button>}
  </div>}
  <section className="section agenda-guest-section" >
   <div className="section-heading">
    <h2><Users size={25} className="agenda-guest-icon"/> Participações em outros artistas</h2>
    <p>Shows que você aceitou como músico convidado. Eles aparecem automaticamente aqui e no calendário, sem criar eventos duplicados.</p>
    <Link href="/meus-convites" className="sf-ui-button sf-ui-button-ghost agenda-invite-link" ><Users size={16}/> Ver meus convites</Link>
   </div>
   {guestError&&<InlineNotice tone="danger">{guestError}<div className="agenda-notice-action"><Button variant="ghost" onClick={()=>void loadEvents()}>Tentar novamente</Button></div></InlineNotice>}
   {!loading&&!guestError&&visibleGuestShows.length===0&&<div className="feature"><p className="agenda-empty-text">{selectedDate?"Nenhuma participação aceita nesta data.":"Você ainda não confirmou participações. Aceite um show em Meus convites para vê-lo na agenda."}</p></div>}
   {!loading&&!guestError&&visibleGuestShows.length>0&&<div className="agenda-event-list">
    {visibleGuestShows.map(show=><article className={"event agenda-guest-event"+(show.event_id===spotlightEventId?" is-highlighted":"")} key={show.event_id} id={"stage-event-"+show.event_id} tabIndex={-1}
      >
     <div className="event-date"><div><strong>{new Date(show.starts_at).toLocaleDateString("pt-BR",{day:"2-digit"})}</strong><br/><span>{new Date(show.starts_at).toLocaleDateString("pt-BR",{month:"short"}).replace(".","").toUpperCase()}</span></div></div>
     <div className="event-info">
      <strong>{show.title}</strong>
      {show.event_id===spotlightEventId&&<StatusChip status="success" label="Show selecionado"/>}
      <span className="agenda-event-meta"><Clock3 size={12} className="agenda-inline-icon"/> {formatDate(show.starts_at)}</span>
      {(show.venue||show.city)&&<span className="agenda-event-meta"><MapPin size={12} className="agenda-inline-icon"/> {[show.venue,show.city].filter(Boolean).join(" · ")}</span>}
      <span className="agenda-event-meta">Organização: {show.organizer_name}</span>
      <StatusChip status={show.event_status==="cancelled"?"danger":"success"} label={show.event_status==="cancelled"?"Cancelado pelo organizador":"Participação confirmada"}/>
       {show.event_status!=="cancelled"&&<Link href={"/eventos/operacao?evento="+encodeURIComponent(show.event_id)}
         className="sf-ui-button sf-ui-button-ghost agenda-briefing-link" >
         <Clock3 size={14}/> Horários e briefing
       </Link>}
     </div>
    </article>)}
   </div>}
  </section>
  {!loading&&!guestError&&<div className="agenda-pagination">
   <span>{visibleGuestShows.length} participações carregadas neste período</span>
   {guestMoreError&&<p role="alert">{guestMoreError}</p>}
   {guestNext&&<Button variant="secondary" loading={guestMoreLoading} onClick={()=>void loadMore("accepted")}>Carregar mais participações</Button>}
  </div>}
  <Dialog open={Boolean(deleteTarget)} onClose={closeDelete} title="Excluir show?"
   description={deleteTarget?.title} destructive confirmLabel="Excluir show" busy={deleting} onConfirm={()=>void deleteEvent()}>
   Essa ação remove o show e seus registros vinculados. Confira o evento antes de confirmar.
  </Dialog>
 </div></main>;
}
