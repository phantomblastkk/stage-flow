"use client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Plus, MapPin, Clock3, LoaderCircle, Trash2, ChevronLeft, ChevronRight, Mic, Search, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type EventRow = { id:string; title:string; description:string|null; venue:string|null; city:string|null; starts_at:string; ends_at:string|null; status:"draft"|"published"|"cancelled"|"completed"; show_publicly:boolean };
const formatDate = (value:string) => new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));

export default function EventosPage() {
 const router=useRouter();
 const [events,setEvents]=useState<EventRow[]>([]);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[ownerId,setOwnerId]=useState("");
 const [message,setMessage]=useState(""),[isError,setIsError]=useState(false);
 const [calendarMonth,setCalendarMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
 const [selectedDate,setSelectedDate]=useState<string|null>(null);
 const [title,setTitle]=useState(""),[description,setDescription]=useState(""),[venue,setVenue]=useState(""),[city,setCity]=useState(""),[startsAt,setStartsAt]=useState(""),[endsAt,setEndsAt]=useState(""),[publicly,setPublicly]=useState(true);
 const [venueSuggestions,setVenueSuggestions]=useState<{id:string;name:string;address:string|null;city_name:string|null;state_code:string|null}[]>([]);
 const [citySuggestions,setCitySuggestions]=useState<{id:number;name:string;state_code:string}[]>([]);
 const [showVenueSuggestions,setShowVenueSuggestions]=useState(false),[showCitySuggestions,setShowCitySuggestions]=useState(false);
 const [catalogReady,setCatalogReady]=useState(false);

 const loadEvents=useCallback(async()=>{
  const supabase=createClient(); const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user){router.replace("/login");return;}
  setOwnerId(user.id);
  const {data,error}=await supabase.from("events").select("id,title,description,venue,city,starts_at,ends_at,status,show_publicly").eq("producer_id",user.id).order("starts_at",{ascending:true});
  if(error){setIsError(true);setMessage("Não foi possível carregar a agenda. Confira se executou a consulta SQL de eventos no Supabase.");}
  else setEvents((data??[]) as EventRow[]);
  setLoading(false);
 },[router]);
 useEffect(()=>{void loadEvents();},[loadEvents]);

 useEffect(()=>{let cancelled=false;async function loadCatalog(){const {error}=await createClient().from("cities").select("id").limit(1);if(!cancelled)setCatalogReady(!error);}void loadCatalog();return()=>{cancelled=true};},[]);
 useEffect(()=>{let cancelled=false;const timer=setTimeout(async()=>{if(!venue.trim()||!catalogReady){setVenueSuggestions([]);return;}const supabase=createClient();let query=supabase.from("venues").select("id,name,address,cities(name,state_code)").eq("active",true).ilike("name","%"+venue.trim()+"%");const cityParts=city.trim().split(" - ");if(cityParts[0]){let cityQuery=supabase.from("cities").select("id").eq("active",true).ilike("name",cityParts[0].trim());if(cityParts[1])cityQuery=cityQuery.eq("state_code",cityParts[1].trim());const {data:cityRows}=await cityQuery.limit(1);if(cityRows?.[0])query=query.eq("city_id",cityRows[0].id);}const {data}=await query.order("name").limit(8);if(cancelled)return;setVenueSuggestions((data??[]).map((v:any)=>({id:v.id,name:v.name,address:v.address,city_name:v.cities?.name??null,state_code:v.cities?.state_code??null})));},220);return()=>{cancelled=true;clearTimeout(timer)};},[venue,city,catalogReady]);
 useEffect(()=>{let cancelled=false;const timer=setTimeout(async()=>{if(!city.trim()||!catalogReady){setCitySuggestions([]);return;}const {data}=await createClient().from("cities").select("id,name,state_code").eq("active",true).ilike("name","%"+city.trim()+"%").order("name").limit(8);if(!cancelled)setCitySuggestions(data??[]);},180);return()=>{cancelled=true;clearTimeout(timer)};},[city,catalogReady]);

 async function createEvent(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setSaving(true);setMessage("");setIsError(false);
  const supabase=createClient();const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user){router.replace("/login");return;}
  const start=new Date(startsAt),end=endsAt?new Date(endsAt):null;
  if(end&&end<start){setIsError(true);setMessage("O término precisa ser depois do início.");setSaving(false);return;}
  const {error}=await supabase.from("events").insert({producer_id:user.id,title:title.trim(),description:description.trim()||null,venue:venue.trim()||null,city:city.trim()||null,starts_at:start.toISOString(),ends_at:end?end.toISOString():null,status:publicly?"published":"draft",show_publicly:publicly});
  if(error){setIsError(true);setMessage("Não foi possível salvar: "+(error.message.includes("row-level security")?"o banco ainda bloqueia a criação. Execute a consulta SQL de eventos no Supabase.":error.message));}
  else {setMessage("Evento salvo com sucesso!");setTitle("");setDescription("");setVenue("");setCity("");setStartsAt("");setEndsAt("");setPublicly(true);await loadEvents();}
  setSaving(false);
 }
 async function deleteEvent(id:string){
  if(!window.confirm("Tem certeza de que deseja excluir este evento?"))return;
  const {error}=await createClient().from("events").delete().eq("id",id).eq("producer_id",ownerId);
  if(error){setIsError(true);setMessage("Não foi possível excluir: "+error.message);}else{setEvents(rows=>rows.filter(item=>item.id!==id));setMessage("Evento excluído.");setIsError(false);}
 }
 const labels={draft:"Privado",published:"Publicado",cancelled:"Cancelado",completed:"Concluído"};
 const monthLabel=calendarMonth.toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
 const firstWeekday=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1).getDay();
 const daysInMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,0).getDate();
 const eventDays=new Set(events.map(event=>{const d=new Date(event.starts_at);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}));
 const dateKey=(day:number)=>calendarMonth.getFullYear()+"-"+String(calendarMonth.getMonth()+1).padStart(2,"0")+"-"+String(day).padStart(2,"0");
 const visibleEvents=selectedDate?events.filter(event=>{const d=new Date(event.starts_at);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")===selectedDate}):events;

 return <main><div className="container">
  <nav className="nav"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link><Link className="btn btn-quiet" href="/painel"><ArrowLeft size={15}/> Voltar ao painel</Link></nav>
  <section style={{padding:"42px 0 24px"}}><div className="eyebrow"><span className="dot"/> AGENDA PROFISSIONAL</div><h1 style={{fontSize:"clamp(34px,5vw,46px)"}}>Seus <span className="accent">eventos.</span></h1><p className="lead">Cadastre apresentações, organize horários e acompanhe sua agenda.</p></section>
  <section className="feature" style={{marginBottom:28}}><h2 style={{fontFamily:"Manrope,sans-serif",marginTop:0}}><Plus size={19} style={{display:"inline",verticalAlign:"middle"}}/> Novo evento</h2>
   <form onSubmit={createEvent}>
    <div className="field"><label htmlFor="event-title">Nome do show / evento *</label><input id="event-title" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Pagode ao vivo" required maxLength={120}/></div>
    <div className="cards" style={{gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))"}}><div className="field"><label htmlFor="event-start">Data e horário de início *</label><input id="event-start" type="datetime-local" value={startsAt} onChange={e=>setStartsAt(e.target.value)} required/></div><div className="field"><label htmlFor="event-end">Data e horário de término</label><input id="event-end" type="datetime-local" value={endsAt} onChange={e=>setEndsAt(e.target.value)}/></div></div>
    <div className="cards" style={{gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))"}}>
     <div className="field" style={{position:"relative"}}><label htmlFor="event-venue">Local / estabelecimento</label><div style={{position:"relative"}}><input id="event-venue" value={venue} autoComplete="off" onFocus={()=>setShowVenueSuggestions(true)} onBlur={()=>setTimeout(()=>setShowVenueSuggestions(false),160)} onChange={e=>{setVenue(e.target.value);setShowVenueSuggestions(true)}} placeholder="Pesquise uma casa ou digite o local..."/><Search size={15} style={{position:"absolute",right:12,top:14,color:"var(--muted)",pointerEvents:"none"}}/></div>
      {showVenueSuggestions&&venue.trim()&&venueSuggestions.length>0&&<div role="listbox" aria-label="Casas de shows encontradas" style={{position:"absolute",zIndex:10,top:"100%",left:0,right:0,background:"var(--panel)",border:"1px solid var(--line)",borderRadius:10,boxShadow:"0 12px 28px #0003",overflow:"hidden"}}>{venueSuggestions.map(item=><button type="button" key={item.id} onMouseDown={e=>e.preventDefault()} onClick={()=>{setVenue(item.name);if(item.city_name)setCity(item.city_name+(item.state_code?" - "+item.state_code:""));setShowVenueSuggestions(false)}} style={{display:"block",width:"100%",textAlign:"left",padding:"11px 13px",border:0,borderBottom:"1px solid var(--line)",background:"transparent",color:"var(--text)",cursor:"pointer"}}><strong>{item.name}</strong><span style={{display:"block",fontSize:12,color:"var(--muted)",marginTop:3}}>{[item.address,item.city_name,item.state_code].filter(Boolean).join(" · ")}</span></button>)}</div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginTop:5}}><p style={{fontSize:11,color:"var(--muted)",margin:0}}>Você pode digitar qualquer local; ele será salvo no evento mesmo sem estar no catálogo.</p><Link href="/locais" style={{fontSize:12,color:"var(--lime)",textDecoration:"underline"}}>Cadastrar local no catálogo</Link></div>{showVenueSuggestions&&venue.trim()&&venueSuggestions.length===0&&catalogReady&&<p style={{fontSize:12,color:"var(--muted)",marginTop:8}}>Nenhum local cadastrado com esse nome. Você pode manter o texto digitado ou cadastrar esse estabelecimento no catálogo.</p>}
     </div>
     <div className="field" style={{position:"relative"}}><label htmlFor="event-city">Cidade</label><input id="event-city" value={city} autoComplete="off" onFocus={()=>setShowCitySuggestions(true)} onBlur={()=>setTimeout(()=>setShowCitySuggestions(false),160)} onChange={e=>{setCity(e.target.value);setShowCitySuggestions(true)}} placeholder="Comece a digitar a cidade..."/>
      {showCitySuggestions&&city.trim()&&citySuggestions.length>0&&<div role="listbox" aria-label="Cidades encontradas" style={{position:"absolute",zIndex:10,top:"100%",left:0,right:0,background:"var(--panel)",border:"1px solid var(--line)",borderRadius:10,boxShadow:"0 12px 28px #0003",overflow:"hidden"}}>{citySuggestions.map(item=><button type="button" key={item.id} onMouseDown={e=>e.preventDefault()} onClick={()=>{setCity(item.name+" - "+item.state_code);setShowCitySuggestions(false)}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,width:"100%",textAlign:"left",padding:"11px 13px",border:0,borderBottom:"1px solid var(--line)",background:"transparent",color:"var(--text)",cursor:"pointer"}}><span>{item.name} - {item.state_code}</span>{city===item.name+" - "+item.state_code&&<Check size={15}/>}</button>)}</div>}
      <p style={{fontSize:11,color:"var(--muted)",marginTop:5}}>{catalogReady?"Selecione uma sugestão ou mantenha sua própria descrição.":"O catálogo será ativado após executar a migração SQL no Supabase."}</p>
     </div>
    </div>
    <div className="field"><label htmlFor="event-description">Descrição e observações</label><textarea id="event-description" value={description} onChange={e=>setDescription(e.target.value)} placeholder="Detalhes do evento..." rows={3} style={{width:"100%",padding:13,border:"1px solid var(--line)",background:"var(--panel)",borderRadius:11,color:"var(--text)",resize:"vertical"}}/></div>
    <label style={{display:"flex",gap:10,alignItems:"flex-start",margin:"8px 0 20px",fontSize:13,color:"var(--muted)"}}><input type="checkbox" checked={publicly} onChange={e=>setPublicly(e.target.checked)} style={{accentColor:"var(--lime)",marginTop:2}}/><span><strong style={{color:"var(--text)"}}>Mostrar publicamente</strong><br/>O evento fica marcado como publicado para futura exibição no portfólio.</span></label>
    {message&&<div className="coming" role="status" style={isError?{borderColor:"#754343",background:"#281919",color:"#ffb5b5"}:{}}>{message}</div>}
    <button className="btn btn-primary" type="submit" disabled={saving||!ownerId}><Plus size={16}/>{saving?"Salvando...":"Salvar evento"}</button>
   </form>
  </section>
  <section className="feature" style={{marginBottom:28}}>
   <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:18}}>
    <div><div className="eyebrow"><span className="dot"/> CALENDÁRIO</div><h2 style={{textTransform:"capitalize",margin:"8px 0 0"}}>{monthLabel}</h2></div>
    <div style={{display:"flex",gap:8}}><button type="button" className="btn btn-quiet" aria-label="Mês anterior" onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1))}><ChevronLeft size={18}/></button><button type="button" className="btn btn-quiet" aria-label="Próximo mês" onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1))}><ChevronRight size={18}/></button></div>
   </div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:6,textAlign:"center",fontSize:12,color:"var(--muted)",marginBottom:8}}>{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(day=><div key={day} style={{padding:"6px 0"}}>{day}</div>)}</div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:6}}>
    {Array.from({length:firstWeekday},(_,i)=><div key={"empty-"+i} aria-hidden="true"/>)}
    {Array.from({length:daysInMonth},(_,i)=>{const day=i+1,key=dateKey(day),hasShow=eventDays.has(key),selected=selectedDate===key;return <button type="button" key={key} onClick={()=>setSelectedDate(selected?null:key)} aria-label={day+" de "+monthLabel+(hasShow?", tem show":"")} style={{minHeight:58,padding:"7px 2px",borderRadius:10,border:selected?"1px solid var(--lime)":"1px solid var(--line)",background:selected?"rgba(198,243,107,.12)":"var(--panel)",color:"var(--text)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,cursor:"pointer"}}><span>{day}</span>{hasShow&&<Mic size={14} color="#c6f36b" aria-label="Dia com show"/>}</button>})}
   </div>
   <p style={{fontSize:12,color:"var(--muted)",marginBottom:0}}><Mic size={13} style={{display:"inline",verticalAlign:"middle"}} color="#c6f36b"/> Dia com show. Clique em uma data para filtrar a lista; clique novamente para mostrar todos.</p>
  </section>
  <section className="section" style={{paddingTop:12}}><div className="section-heading"><h2><CalendarDays size={25} style={{display:"inline",verticalAlign:"middle"}}/> Sua agenda</h2><p>{selectedDate ? "Shows do dia " + new Date(selectedDate+"T12:00:00").toLocaleDateString("pt-BR") : "Eventos salvos na sua conta, em ordem de data."}</p></div>
   {loading?<p style={{color:"var(--muted)"}}><LoaderCircle size={16} style={{display:"inline",verticalAlign:"middle"}}/> Carregando agenda...</p>:visibleEvents.length===0?<div className="feature"><p style={{margin:0,color:"var(--muted)"}}>Você ainda não cadastrou eventos. Use o formulário acima para criar o primeiro.</p></div>:<div className="feature">{visibleEvents.map(event=><article className="event" key={event.id} style={{alignItems:"flex-start"}}><div className="event-date"><div><strong>{new Date(event.starts_at).toLocaleDateString("pt-BR",{day:"2-digit"})}</strong><br/><span>{new Date(event.starts_at).toLocaleDateString("pt-BR",{month:"short"}).replace(".","").toUpperCase()}</span></div></div><div className="event-info"><strong>{event.title}</strong><span style={{display:"block",marginTop:5}}><Clock3 size={12} style={{display:"inline",verticalAlign:"middle"}}/> {formatDate(event.starts_at)}</span>{(event.venue||event.city)&&<span style={{display:"block",marginTop:5}}><MapPin size={12} style={{display:"inline",verticalAlign:"middle"}}/> {[event.venue,event.city].filter(Boolean).join(" · ")}</span>}{event.description&&<p style={{color:"var(--muted)",fontSize:13,margin:"8px 0"}}>{event.description}</p>}<span className="event-pill" style={{display:"inline-block",marginTop:7}}>{labels[event.status]}</span></div><button className="btn btn-quiet" aria-label={"Excluir "+event.title} title="Excluir evento" onClick={()=>void deleteEvent(event.id)} style={{padding:9}}><Trash2 size={15}/></button></article>)}</div>}
  </section>
 </div></main>;
}
