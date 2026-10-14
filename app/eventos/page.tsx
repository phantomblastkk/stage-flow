"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Plus, MapPin, Clock3, LoaderCircle, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type EventRow = { id:string; title:string; description:string|null; venue:string|null; city:string|null; starts_at:string; ends_at:string|null; status:"draft"|"published"|"cancelled"|"completed"; show_publicly:boolean };
const formatDate = (value:string) => new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));

export default function EventosPage() {
 const router=useRouter();
 const [events,setEvents]=useState<EventRow[]>([]);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[ownerId,setOwnerId]=useState("");
 const [message,setMessage]=useState(""),[isError,setIsError]=useState(false);
 const [title,setTitle]=useState(""),[description,setDescription]=useState(""),[venue,setVenue]=useState(""),[city,setCity]=useState(""),[startsAt,setStartsAt]=useState(""),[endsAt,setEndsAt]=useState(""),[publicly,setPublicly]=useState(true);

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
 return <main><div className="container">
  <nav className="nav"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link><Link className="btn btn-quiet" href="/painel"><ArrowLeft size={15}/> Voltar ao painel</Link></nav>
  <section style={{padding:"42px 0 24px"}}><div className="eyebrow"><span className="dot"/> AGENDA PROFISSIONAL</div><h1 style={{fontSize:"clamp(34px,5vw,46px)"}}>Seus <span className="accent">eventos.</span></h1><p className="lead">Cadastre apresentações, organize horários e acompanhe sua agenda.</p></section>
  <section className="feature" style={{marginBottom:28}}><h2 style={{fontFamily:"Manrope,sans-serif",marginTop:0}}><Plus size={19} style={{display:"inline",verticalAlign:"middle"}}/> Novo evento</h2>
   <form onSubmit={createEvent}>
    <div className="field"><label htmlFor="event-title">Nome do show / evento *</label><input id="event-title" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Pagode ao vivo" required maxLength={120}/></div>
    <div className="cards" style={{gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))"}}><div className="field"><label htmlFor="event-start">Data e horário de início *</label><input id="event-start" type="datetime-local" value={startsAt} onChange={e=>setStartsAt(e.target.value)} required/></div><div className="field"><label htmlFor="event-end">Data e horário de término</label><input id="event-end" type="datetime-local" value={endsAt} onChange={e=>setEndsAt(e.target.value)}/></div></div>
    <div className="cards" style={{gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))"}}><div className="field"><label htmlFor="event-venue">Local / estabelecimento</label><input id="event-venue" value={venue} onChange={e=>setVenue(e.target.value)} placeholder="Nome do bar, casa de shows..."/></div><div className="field"><label htmlFor="event-city">Cidade</label><input id="event-city" value={city} onChange={e=>setCity(e.target.value)} placeholder="Ex.: São Paulo - SP"/></div></div>
    <div className="field"><label htmlFor="event-description">Descrição e observações</label><textarea id="event-description" value={description} onChange={e=>setDescription(e.target.value)} placeholder="Detalhes do evento..." rows={3} style={{width:"100%",padding:13,border:"1px solid var(--line)",background:"var(--panel)",borderRadius:11,color:"var(--text)",resize:"vertical"}}/></div>
    <label style={{display:"flex",gap:10,alignItems:"flex-start",margin:"8px 0 20px",fontSize:13,color:"var(--muted)"}}><input type="checkbox" checked={publicly} onChange={e=>setPublicly(e.target.checked)} style={{accentColor:"var(--lime)",marginTop:2}}/><span><strong style={{color:"var(--text)"}}>Mostrar publicamente</strong><br/>O evento fica marcado como publicado para futura exibição no portfólio.</span></label>
    {message&&<div className="coming" role="status" style={isError?{borderColor:"#754343",background:"#281919",color:"#ffb5b5"}:{}}>{message}</div>}
    <button className="btn btn-primary" type="submit" disabled={saving||!ownerId}><Plus size={16}/>{saving?"Salvando...":"Salvar evento"}</button>
   </form>
  </section>
  <section className="section" style={{paddingTop:12}}><div className="section-heading"><h2><CalendarDays size={25} style={{display:"inline",verticalAlign:"middle"}}/> Sua agenda</h2><p>Eventos salvos na sua conta, em ordem de data.</p></div>
   {loading?<p style={{color:"var(--muted)"}}><LoaderCircle size={16} style={{display:"inline",verticalAlign:"middle"}}/> Carregando agenda...</p>:events.length===0?<div className="feature"><p style={{margin:0,color:"var(--muted)"}}>Você ainda não cadastrou eventos. Use o formulário acima para criar o primeiro.</p></div>:<div className="feature">{events.map(event=><article className="event" key={event.id} style={{alignItems:"flex-start"}}><div className="event-date"><div><strong>{new Date(event.starts_at).toLocaleDateString("pt-BR",{day:"2-digit"})}</strong><br/><span>{new Date(event.starts_at).toLocaleDateString("pt-BR",{month:"short"}).replace(".","").toUpperCase()}</span></div></div><div className="event-info"><strong>{event.title}</strong><span style={{display:"block",marginTop:5}}><Clock3 size={12} style={{display:"inline",verticalAlign:"middle"}}/> {formatDate(event.starts_at)}</span>{(event.venue||event.city)&&<span style={{display:"block",marginTop:5}}><MapPin size={12} style={{display:"inline",verticalAlign:"middle"}}/> {[event.venue,event.city].filter(Boolean).join(" · ")}</span>}{event.description&&<p style={{color:"var(--muted)",fontSize:13,margin:"8px 0"}}>{event.description}</p>}<span className="event-pill" style={{display:"inline-block",marginTop:7}}>{labels[event.status]}</span></div><button className="btn btn-quiet" aria-label={"Excluir "+event.title} title="Excluir evento" onClick={()=>void deleteEvent(event.id)} style={{padding:9}}><Trash2 size={15}/></button></article>)}</div>}
  </section>
 </div></main>;
}
