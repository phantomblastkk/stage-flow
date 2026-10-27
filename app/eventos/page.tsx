"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Plus, MapPin, Clock3, Trash2, ImagePlus, ChevronLeft, ChevronRight, Mic, Users, Search, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import EventTeamInvites from "@/components/event-team-invites";
import dynamic from "next/dynamic";
import { Button, Dialog, EmptyState, Input, LoadingState, StatusChip, Textarea } from "@/src/components/ui";
import { AgendaSessionRequired, agendaWindow, catalogAvailable, loadAgenda, loadAgendaEvent, loadAgendaMarkers, loadMoreAgenda, removeEvent, saveEvent, searchCities, searchVenues } from "@/src/domains/events/services/agenda-service";
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
 const [calendarMonth,setCalendarMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
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
 const [ownNext,setOwnNext]=useState<AgendaCursor|null>(null),[guestNext,setGuestNext]=useState<AgendaCursor|null>(null);
 const [ownMoreLoading,setOwnMoreLoading]=useState(false),[guestMoreLoading,setGuestMoreLoading]=useState(false);
 const [ownMoreError,setOwnMoreError]=useState(""),[guestMoreError,setGuestMoreError]=useState("");
 const ownMoreRequest=useRef<AbortController|null>(null),guestMoreRequest=useRef<AbortController|null>(null);
 const [markers,setMarkers]=useState<{own:string[];guest:string[]}>({own:[],guest:[]});
 const [markerMessage,setMarkerMessage]=useState("");
 const [markerNonce,setMarkerNonce]=useState(0);
 const monthRange=agendaWindow(calendarMonth);
 const listRange=agendaWindow(calendarMonth,selectedDate);
 const monthFrom=monthRange.from,monthTo=monthRange.to;
 const listFrom=listRange.from,listTo=listRange.to;
 function changeMonth(delta:number){
  setSelectedDate(null);
  setCalendarMonth(value=>new Date(value.getFullYear(),value.getMonth()+delta,1));
 }
 useEffect(()=>{
  const request=new AbortController();setMarkers({own:[],guest:[]});setMarkerMessage("");
  void loadAgendaMarkers(createClient(),request.signal,{from:monthFrom,to:monthTo}).then(result=>{
   if(request.signal.aborted)return;
   setMarkers({own:result.own,guest:result.guest});
   if(result.partial)setMarkerMessage("Este mês tem muitos shows. Algumas marcações podem não aparecer; selecione a data para consultar a lista completa.");
  }).catch(error=>{if(!request.signal.aborted&&!(error instanceof AgendaSessionRequired))setMarkerMessage(error instanceof Error?error.message:"Marcações indisponíveis.");});
  return()=>request.abort();
 },[monthFrom,monthTo,markerNonce]);

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
 useEffect(()=>{void loadEvents();return()=>{
  loadRequest.current?.abort();ownMoreRequest.current?.abort();guestMoreRequest.current?.abort();
 };},[loadEvents]);
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
 // A direct link is resolved independently of month and page, with owner scoping.
 useEffect(()=>{
  const eventId=new URLSearchParams(window.location.search).get("evento");
  if(!eventId||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(eventId))return;
  const request=new AbortController();setSpotlightEventId(eventId);
  if(new URLSearchParams(window.location.search).get("equipe")==="1")setOpenTeamEventId(eventId);
  void loadAgendaEvent(createClient(),request.signal,eventId).then(event=>{
   if(request.signal.aborted)return;
   setSpotlightEvent(event);setSelectedDate(null);
   const date=new Date(event.starts_at);setCalendarMonth(new Date(date.getFullYear(),date.getMonth(),1));
  }).catch(error=>{if(!request.signal.aborted){setIsError(true);setMessage(error instanceof Error?error.message:"Não foi possível abrir o show.");}});
  return()=>request.abort();
 },[]);
 useEffect(()=>{
  if(loading||!spotlightEventId||(!events.some(event=>event.id===spotlightEventId)&&spotlightEvent?.id!==spotlightEventId))return;
  if(focusScrolled.current===spotlightEventId)return;
  const target=document.getElementById("stage-event-"+spotlightEventId);
  if(!target)return;
  focusScrolled.current=spotlightEventId;
  target.scrollIntoView({behavior:"smooth",block:"center"});
 },[loading,spotlightEventId,events,spotlightEvent]);

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
 const visibleGuestShows=guestShows;

 return <main className="agenda-page"><div className="container">
  <nav className="nav"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link><Link className="btn btn-quiet" href="/painel"><ArrowLeft size={15}/> Voltar ao painel</Link></nav>
  <section className="agenda-hero"><div className="eyebrow"><span className="dot"/> AGENDA PROFISSIONAL</div><h1 style={{fontSize:"clamp(34px,5vw,46px)"}}>Seus <span className="accent">eventos.</span></h1><p className="lead">Seus próprios shows e as participações confirmadas em outras equipes, todos no mesmo calendário.</p><div className="agenda-primary-actions">
   <button ref={createTrigger} type="button" className="sf-ui-button sf-ui-button-primary" onClick={()=>setShowCreateForm(open=>!open)} aria-expanded={showCreateForm} aria-controls="agenda-create-form"><Plus size={16}/>{showCreateForm?"Fechar cadastro":"Novo show"}</button>
   <Link href="/shows-recorrentes" className="btn btn-quiet"><CalendarDays size={16}/> Programação semanal</Link>
  </div></section>
  {message&&<div className={"coming"+(isError?" agenda-error":"")} role={isError?"alert":"status"}>{message}</div>}
  <section id="agenda-create-form" hidden={!showCreateForm} className="feature agenda-create"><h2 style={{fontFamily:"Manrope,sans-serif",marginTop:0}}><Plus size={19} style={{display:"inline",verticalAlign:"middle"}}/> Novo evento</h2>
   <form onSubmit={createEvent} aria-label="Novo show">
    <Input id="event-title" label="Nome do show / evento *" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Pagode ao vivo" required maxLength={120}/>
    <div className="agenda-field-grid"><Input id="event-start" label="Data e horário de início *" type="datetime-local" value={startsAt} onChange={e=>setStartsAt(e.target.value)} required/><Input id="event-end" label="Data e horário de término" type="datetime-local" value={endsAt} onChange={e=>setEndsAt(e.target.value)}/></div>
    <div className="agenda-field-grid">
     <div className="field" style={{position:"relative"}}><label htmlFor="event-venue">Local / estabelecimento</label><div style={{position:"relative"}}><input id="event-venue" value={venue} autoComplete="off" onFocus={()=>setShowVenueSuggestions(true)} onBlur={()=>setTimeout(()=>setShowVenueSuggestions(false),160)} onChange={e=>{setVenue(e.target.value);setSelectedVenueId(null);setShowVenueSuggestions(true)}} placeholder="Pesquise uma casa ou digite o local..."/><Search size={15} style={{position:"absolute",right:12,top:14,color:"var(--muted)",pointerEvents:"none"}}/></div>
      {showVenueSuggestions&&venue.trim()&&venueSuggestions.length>0&&<div role="listbox" aria-label="Casas de shows encontradas" style={{position:"absolute",zIndex:10,top:"100%",left:0,right:0,background:"var(--panel)",border:"1px solid var(--line)",borderRadius:10,boxShadow:"0 12px 28px #0003",overflow:"hidden"}}>{venueSuggestions.map(item=><button type="button" key={item.id} onMouseDown={e=>e.preventDefault()} onClick={()=>{setVenue(item.name);setSelectedVenueId(item.id);if(item.city_name)setCity(item.city_name+(item.state_code?" - "+item.state_code:""));setShowVenueSuggestions(false)}} style={{display:"block",width:"100%",textAlign:"left",padding:"11px 13px",border:0,borderBottom:"1px solid var(--line)",background:"transparent",color:"var(--text)",cursor:"pointer"}}><strong>{item.name}</strong><span style={{display:"block",fontSize:12,color:"var(--muted)",marginTop:3}}>{[item.address,item.city_name,item.state_code].filter(Boolean).join(" · ")}</span></button>)}</div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginTop:5}}><p style={{fontSize:11,color:"var(--muted)",margin:0}}>Você pode digitar qualquer local; ele será salvo no evento mesmo sem estar no catálogo.</p><Link href="/locais" style={{fontSize:12,color:"var(--lime)",textDecoration:"underline"}}>Cadastrar local no catálogo</Link></div>{showVenueSuggestions&&venue.trim()&&venueSuggestions.length===0&&catalogReady&&<p style={{fontSize:12,color:"var(--muted)",marginTop:8}}>Nenhum local cadastrado com esse nome. Você pode manter o texto digitado ou cadastrar esse estabelecimento no catálogo.</p>}
     </div>
     <div className="field" style={{position:"relative"}}><label htmlFor="event-city">Cidade</label><input id="event-city" value={city} autoComplete="off" onFocus={()=>setShowCitySuggestions(true)} onBlur={()=>setTimeout(()=>setShowCitySuggestions(false),160)} onChange={e=>{setCity(e.target.value);setSelectedVenueId(null);setShowCitySuggestions(true)}} placeholder="Comece a digitar a cidade..."/>
      {showCitySuggestions&&city.trim()&&citySuggestions.length>0&&<div role="listbox" aria-label="Cidades encontradas" style={{position:"absolute",zIndex:10,top:"100%",left:0,right:0,background:"var(--panel)",border:"1px solid var(--line)",borderRadius:10,boxShadow:"0 12px 28px #0003",overflow:"hidden"}}>{citySuggestions.map(item=><button type="button" key={item.id} onMouseDown={e=>e.preventDefault()} onClick={()=>{setCity(item.name+" - "+item.state_code);setSelectedVenueId(null);setShowCitySuggestions(false)}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,width:"100%",textAlign:"left",padding:"11px 13px",border:0,borderBottom:"1px solid var(--line)",background:"transparent",color:"var(--text)",cursor:"pointer"}}><span>{item.name} - {item.state_code}</span>{city===item.name+" - "+item.state_code&&<Check size={15}/>}</button>)}</div>}
      <p style={{fontSize:11,color:"var(--muted)",marginTop:5}}>{catalogReady?"Selecione uma sugestão ou mantenha sua própria descrição.":"Busca de cidades indisponível. Você pode digitar a cidade."}</p>
     </div>
    </div>
    <Textarea id="event-description" label="Descrição e observações" value={description} onChange={e=>setDescription(e.target.value)} placeholder="Detalhes do evento..." rows={3}/>
    <p style={{fontSize:12,color:"var(--muted)",lineHeight:1.6,margin:"10px 0"}}>Depois de salvar o show, use <strong>Flyer para Instagram/WhatsApp</strong> no card do evento para enviar a arte e gerar os dois tamanhos.</p>
    <label style={{display:"flex",gap:10,alignItems:"flex-start",margin:"8px 0 20px",fontSize:13,color:"var(--muted)"}}><input type="checkbox" checked={publicly} onChange={e=>setPublicly(e.target.checked)} style={{accentColor:"var(--lime)",marginTop:2}}/><span><strong style={{color:"var(--text)"}}>Mostrar publicamente</strong><br/>O evento fica marcado como publicado para futura exibição no portfólio.</span></label>
    <div className="agenda-primary-actions"><Button type="submit" loading={saving} disabled={!ownerId}><Plus size={16}/>{saving?"Salvando...":"Salvar evento"}</Button><Button variant="ghost" disabled={saving} onClick={closeCreateForm}>Cancelar</Button></div>
   </form>
  </section>
  <section className="feature agenda-calendar" aria-label="Calendário de shows">
   <div className="agenda-calendar-heading">
    <div><div className="eyebrow"><span className="dot"/> CALENDÁRIO</div><h2 aria-live="polite" style={{textTransform:"capitalize",margin:"8px 0 0"}}>{monthLabel}</h2></div>
    <div style={{display:"flex",gap:8}}><button type="button" className="btn btn-quiet" aria-label="Mês anterior" onClick={()=>changeMonth(-1)}><ChevronLeft size={18}/></button><button type="button" className="btn btn-quiet" aria-label="Próximo mês" onClick={()=>changeMonth(1)}><ChevronRight size={18}/></button></div>
   </div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:6,textAlign:"center",fontSize:12,color:"var(--muted)",marginBottom:8}}>{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(day=><div key={day} style={{padding:"6px 0"}}>{day}</div>)}</div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:6}}>
    {Array.from({length:firstWeekday},(_,i)=><div key={"empty-"+i} aria-hidden="true"/>)}
    {Array.from({length:daysInMonth},(_,i)=>{const day=i+1,key=dateKey(day),hasOwn=ownShowDays.has(key),hasGuest=guestShowDays.has(key),hasShow=hasOwn||hasGuest,selected=selectedDate===key;return <button type="button" key={key} onClick={()=>setSelectedDate(selected?null:key)} aria-pressed={selected} aria-label={day+" de "+monthLabel+(hasOwn?", show próprio":"")+(hasGuest?", participação confirmada":"")} style={{minHeight:58,padding:"7px 2px",borderRadius:10,border:selected?"1px solid var(--lime)":"1px solid var(--line)",background:selected?"#b997ee26":"var(--panel)",color:"var(--text)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,cursor:"pointer"}}><span>{day}</span>{hasShow&&<span style={{display:"flex",gap:3,alignItems:"center"}}>{hasOwn&&<Mic size={14} color="var(--sf-ui-brand)" aria-label="Show próprio"/>}{hasGuest&&<Users size={14} color="#a99bff" aria-label="Participação confirmada"/>}</span>}</button>})}
   </div>
   {markerMessage&&<p role="status" className="agenda-marker-note">{markerMessage}</p>}
   {selectedDate&&<Button variant="ghost" onClick={()=>setSelectedDate(null)} className="agenda-clear-date">Limpar filtro de data</Button>}
   <p style={{fontSize:12,color:"var(--muted)",marginBottom:0}}><Mic size={13} style={{display:"inline",verticalAlign:"middle"}} color="var(--sf-ui-brand)"/> Show próprio · <Users size={13} style={{display:"inline",verticalAlign:"middle"}} color="#a99bff"/> Participação confirmada. Toque na data para filtrar; toque de novo para voltar ao mês.</p>
  </section>
  <section className="section" style={{paddingTop:12}}><div className="section-heading"><h2><CalendarDays size={25} style={{display:"inline",verticalAlign:"middle"}}/> Shows próprios</h2><p>{selectedDate ? "Shows próprios do dia " + new Date(selectedDate+"T12:00:00").toLocaleDateString("pt-BR") : "Shows do mês selecionado, em ordem de data."}</p></div>
   {loading?<LoadingState label="Carregando agenda…"/>:agendaError?<div className="coming agenda-error" role="alert">{agendaError}<Button variant="ghost" onClick={()=>void loadEvents()}>Tentar novamente</Button></div>:visibleEvents.length===0?<EmptyState title={selectedDate?"Nenhum show próprio nesta data":"Nenhum show próprio neste mês"} description="Cadastre um show para organizar sua equipe e seus horários." action={<Button onClick={()=>setShowCreateForm(true)}><Plus size={16}/> Novo show</Button>}/>:<div className="agenda-event-list">{visibleEvents.map(event=><article
    className="event"
    id={"stage-event-"+event.id}
    key={event.id}
    style={{
     alignItems:"flex-start",
     scrollMarginTop:30,
     border:event.id===spotlightEventId?"1px solid var(--lime)":undefined,
     background:event.id===spotlightEventId?"rgba(198,243,107,.07)":undefined,
     borderRadius:12
    }}><div className="event-date"><div><strong>{new Date(event.starts_at).toLocaleDateString("pt-BR",{day:"2-digit"})}</strong><br/><span>{new Date(event.starts_at).toLocaleDateString("pt-BR",{month:"short"}).replace(".","").toUpperCase()}</span></div></div><div className="event-info"><strong>{event.title}</strong>{event.id===spotlightEventId&&
    <span style={{display:"block",color:"var(--lime)",fontSize:11,marginTop:5}}>
     Show em destaque · {event.status==="draft"?"rascunho privado":labels[event.status]}
    </span>}<span style={{display:"block",marginTop:5}}><Clock3 size={12} style={{display:"inline",verticalAlign:"middle"}}/> {formatDate(event.starts_at)}</span>{(event.venue||event.city)&&<span style={{display:"block",marginTop:5}}><MapPin size={12} style={{display:"inline",verticalAlign:"middle"}}/> {[event.venue,event.city].filter(Boolean).join(" · ")}</span>}{event.description&&<p style={{color:"var(--muted)",fontSize:13,margin:"8px 0"}}>{event.description}</p>}<StatusChip label={labels[event.status]} status={event.status==="cancelled"?"danger":event.status==="published"||event.status==="completed"?"success":"neutral"}/>
      <div className="agenda-event-actions">
       <button className={openTeamEventId===event.id?"btn btn-primary":"btn btn-quiet"} type="button"
        aria-expanded={openTeamEventId===event.id}
        onClick={()=>setOpenTeamEventId(current=>current===event.id?null:event.id)}
        style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:12}}>
        <Users size={16}/>{openTeamEventId===event.id?"Fechar painel":"Equipe, convites e financeiro"}
       </button>
       <button className={openFlyerEventId===event.id?"btn btn-primary":"btn btn-quiet"}
        type="button" aria-expanded={openFlyerEventId===event.id}
        onClick={()=>setOpenFlyerEventId(current=>current===event.id?null:event.id)}
        style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:12}}>
        <ImagePlus size={16}/>{openFlyerEventId===event.id?"Fechar flyer":"Flyer para Instagram/WhatsApp"}
       </button>
       <Link className="btn btn-quiet" style={{fontSize:12}}
         href={"/eventos/operacao?evento="+encodeURIComponent(event.id)}>
         <Check size={15}/> Operação e checklist
       </Link>
       {event.id===spotlightEventId&&<span style={{fontSize:11,color:"var(--muted)"}}>
        Organize músicos e confira os cachês sem publicar este show.
       </span>}
      </div>
      {openTeamEventId===event.id&&<EventTeamInvites
       eventId={event.id} eventTitle={event.title} eventStatus={event.status}/>}
      {openFlyerEventId===event.id&&<ShowFlyerManager eventId={event.id} title={event.title}/>}
     </div><button aria-label={"Excluir "+event.title} title="Excluir evento" type="button" onClick={()=>setDeleteTarget(event)} className="btn btn-quiet agenda-delete"><Trash2 size={15}/></button></article>)}</div>}
  </section>
  {!loading&&!agendaError&&<div className="agenda-pagination">
   <span>{visibleEvents.length} shows próprios carregados neste período</span>
   {ownMoreError&&<p role="alert">{ownMoreError}</p>}
   {ownNext&&<Button variant="secondary" loading={ownMoreLoading} onClick={()=>void loadMore("owned")}>Carregar mais shows próprios</Button>}
  </div>}
  <section className="section" style={{paddingTop:6}}>
   <div className="section-heading">
    <h2><Users size={25} style={{display:"inline",verticalAlign:"middle",color:"#a99bff"}}/> Participações em outros artistas</h2>
    <p>Shows que você aceitou como músico convidado. Eles aparecem automaticamente aqui e no calendário, sem criar eventos duplicados.</p>
    <Link href="/meus-convites" className="btn btn-quiet" style={{marginTop:12}}><Users size={16}/> Ver meus convites</Link>
   </div>
   {guestError&&<div className="coming agenda-error" role="alert">{guestError}<Button variant="ghost" onClick={()=>void loadEvents()}>Tentar novamente</Button></div>}
   {!loading&&!guestError&&visibleGuestShows.length===0&&<div className="feature"><p style={{margin:0,color:"var(--muted)"}}>{selectedDate?"Nenhuma participação aceita nesta data.":"Você ainda não confirmou participações. Aceite um show em Meus convites para vê-lo na agenda."}</p></div>}
   {!loading&&!guestError&&visibleGuestShows.length>0&&<div className="agenda-event-list">
    {visibleGuestShows.map(show=><article className="event" key={show.event_id} style={{alignItems:"flex-start"}}>
     <div className="event-date"><div><strong>{new Date(show.starts_at).toLocaleDateString("pt-BR",{day:"2-digit"})}</strong><br/><span>{new Date(show.starts_at).toLocaleDateString("pt-BR",{month:"short"}).replace(".","").toUpperCase()}</span></div></div>
     <div className="event-info">
      <strong>{show.title}</strong>
      <span style={{display:"block",marginTop:5}}><Clock3 size={12} style={{display:"inline",verticalAlign:"middle"}}/> {formatDate(show.starts_at)}</span>
      {(show.venue||show.city)&&<span style={{display:"block",marginTop:5}}><MapPin size={12} style={{display:"inline",verticalAlign:"middle"}}/> {[show.venue,show.city].filter(Boolean).join(" · ")}</span>}
      <span style={{display:"block",marginTop:5}}>Organização: {show.organizer_name}</span>
      <span className="event-pill" style={{display:"inline-block",marginTop:7,color:show.event_status==="cancelled"?"#ffb5b5":"#d3c9ff"}}>{show.event_status==="cancelled"?"Cancelado pelo organizador":"Participação confirmada"}</span>
       {show.event_status!=="cancelled"&&<Link href={"/eventos/operacao?evento="+encodeURIComponent(show.event_id)}
         className="btn btn-quiet" style={{display:"inline-flex",marginTop:9,fontSize:11}}>
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
