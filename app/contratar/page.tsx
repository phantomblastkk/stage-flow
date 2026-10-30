"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowRight,CalendarDays,CheckCircle2,MessageCircle,Search,UserRoundSearch,RefreshCw} from "lucide-react";
import {createClient} from "@/lib/supabase/client";
import {useAccount} from "@/src/domains/account/account-context";
import {Button,Card,LoadingState} from "@/src/components/ui";
import "@/app/perfis/perfis.css";
import "./contratar.css";

type EventChoice={id:string;title:string;venue:string|null;starts_at:string};
const isUuid=(value:string)=>/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

export default function Hire(){
 const {snapshot:{user,status}}=useAccount();
 const [events,setEvents]=useState<EventChoice[]>([]);
 const [eventId,setEventId]=useState("");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [attempt,setAttempt]=useState(0);
 useEffect(()=>{
  if(status!=="ready"||!user){setLoading(false);return;}
  const request=new AbortController();setLoading(true);setError("");
  void Promise.resolve(createClient().from("events")
   .select("id,title,venue,starts_at").eq("producer_id",user.id)
   .in("status",["draft","published"]).gte("starts_at",new Date().toISOString())
   .order("starts_at").limit(100).abortSignal(request.signal))
   .then(({data,error:loadError})=>{
    if(request.signal.aborted)return;
    if(loadError)throw loadError;
    const available=(data??[]) as EventChoice[];
    setEvents(available);
    const target=new URLSearchParams(window.location.search).get("evento")||"";
    setEventId(previous=>available.some(item=>item.id===previous)?previous:
     isUuid(target)&&available.some(item=>item.id===target)?target:"");
   }).catch(()=>{
    if(!request.signal.aborted)setError("Não foi possível carregar sua agenda. Você ainda pode explorar o Marketplace sem selecionar um evento.");
   }).finally(()=>{if(!request.signal.aborted)setLoading(false);});
  return()=>request.abort();
 },[user?.id,status,attempt]);

 const selected=events.find(item=>item.id===eventId);
 const marketplace=selected?"/marketplace?evento="+encodeURIComponent(selected.id):"/marketplace";
 return <main className="sf-profiles sf-hire-flow">
  <header><div>
   <span className="eyebrow">CONTRATAÇÃO SEM COMPLICAÇÃO</span>
   <h1>Encontre profissionais para seu show</h1>
   <p>Escolha um evento, encontre o músico e converse antes de confirmar a contratação.</p>
  </div></header>
  <div className="sf-hire-steps" aria-label="Como contratar no StageFlow">
   <span><CalendarDays size={17}/> 1. Escolher evento</span>
   <span><UserRoundSearch size={17}/> 2. Encontrar profissional</span>
   <span><MessageCircle size={17}/> 3. Conversar e propor</span>
  </div>
  {status==="loading"?<LoadingState label="Verificando sua conta…"/>:
   status!=="ready"||!user?<Card>
    <h2>Entre na sua conta para organizar uma contratação</h2>
    <p>É possível conhecer os músicos no Marketplace sem entrar. Para enviar convites e acompanhar propostas, use sua conta.</p>
    <Link href="/login">Entrar no StageFlow <ArrowRight size={17}/></Link>
    <Link href="/marketplace">Explorar Marketplace</Link>
   </Card>:<>
    <Card>
     <div className="sf-hire-section-head"><CalendarDays size={20}/><h2>1. Para qual evento?</h2></div>
     <p>O evento ajuda o músico a avaliar a data e receber o convite com as informações corretas. Você pode explorar o catálogo antes de criar um.</p>
     {loading?<LoadingState label="Buscando eventos da sua agenda…"/>:
      <label className="sf-profiles-form sf-hire-select">Seu evento
       <select className="sf-ui-input" value={eventId} onChange={e=>setEventId(e.target.value)}>
        <option value="">Ainda não escolhi um evento</option>
        {events.map(event=><option key={event.id} value={event.id}>
         {event.title} · {new Date(event.starts_at).toLocaleDateString("pt-BR")} · {event.venue||"Local a definir"}
        </option>)}
       </select>
      </label>}
     {error&&<div className="sf-hire-error" role="alert">{error}
      <Button variant="secondary" onClick={()=>setAttempt(value=>value+1)}><RefreshCw size={15}/> Tentar novamente</Button>
     </div>}
     {selected&&<p className="sf-hire-selected"><CheckCircle2 size={16}/> Evento selecionado: <strong>{selected.title}</strong></p>}
     {!loading&&events.length===0&&!error&&<p className="sf-hire-muted">Você ainda não tem eventos futuros. Pode conhecer artistas antes de criar seu primeiro show.</p>}
     <Link href="/eventos?novo=1&continuar=contratar" className="sf-hire-secondary-link">Criar novo evento <ArrowRight size={16}/></Link>
    </Card>
    <Card>
     <div className="sf-hire-section-head"><Search size={20}/><h2>2. Encontre o artista certo</h2></div>
     <p>Pesquise no Marketplace por cidade, instrumento, estilo e disponibilidade. Consulte o perfil antes de convidar.</p>
     <Link className="sf-hire-primary-link" href={marketplace}>
      {selected?"Buscar músicos para este evento":"Explorar artistas no Marketplace"}
      <ArrowRight size={18}/>
     </Link>
     <p className="sf-hire-muted">{selected
       ?"A data e o evento selecionados serão levados para o fluxo de convite no Marketplace."
       :"Sem evento definido, você pode explorar os perfis e iniciar uma conversa; o convite formal requer as informações da apresentação."}</p>
    </Card>
    <Card>
     <div className="sf-hire-section-head"><MessageCircle size={20}/><h2>3. Converse, negocie e acompanhe</h2></div>
     <p>O chat permite alinhar cachê e disponibilidade. A contratação só é confirmada com as etapas de aceite correspondentes — abrir a conversa não reserva o músico.</p>
     <div className="sf-hire-links">
      <Link href="/conversas">Minhas conversas <ArrowRight size={16}/></Link>
      <Link href="/convites">Convites enviados <ArrowRight size={16}/></Link>
     </div>
    </Card>
   </>}
 </main>;
}
