"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import Link from "next/link";
import {
 ArrowUpRight,CalendarCheck2,CalendarDays,CheckCircle2,
 CircleDollarSign,Clock3,Inbox,MessageCircle,Plus,RefreshCw,
 Sparkles,Wallet
} from "lucide-react";
import {createClient} from "@/lib/supabase/client";
import {Button,Card,EmptyState,LoadingState,StatCard,StatusChip} from "@/src/components/ui";
import WorkspaceNextStep from "./workspace-next-step";

type Show={id:string;title:string;starts_at:string;venue:string|null;city:string|null;kind:"organized"|"participation"};
type Activity={id:string;type:string;title:string;summary:string;created_at:string;read:boolean;href:string};
type Metrics={shows_week:number;pending_invites:number;unread_conversations:number;pending_contacts:number;received_month:number};
type Overview={status:string;metrics:Metrics;upcoming:Show[];activity:Activity[];updated_at:string};

const brl=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:2});
const date=new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"America/Sao_Paulo"});
const day=new Intl.DateTimeFormat("pt-BR",{day:"2-digit",timeZone:"America/Sao_Paulo"});
const month=new Intl.DateTimeFormat("pt-BR",{month:"short",timeZone:"America/Sao_Paulo"});
const relative=new Intl.RelativeTimeFormat("pt-BR",{numeric:"auto"});

function timeAgo(value:string){
 const when=new Date(value).getTime();
 if(!Number.isFinite(when))return "";
 const delta=Math.round((when-Date.now())/60000);
 if(Math.abs(delta)<60)return relative.format(delta,"minute");
 if(Math.abs(delta)<1440)return relative.format(Math.round(delta/60),"hour");
 return relative.format(Math.round(delta/1440),"day");
}
function safeCount(value:unknown){
 const n=Number(value);
 return Number.isSafeInteger(n)&&n>=0?n:0;
}
function ActivitySymbol({type}:{type:string}){
 if(type.includes("invite"))return <Inbox size={17}/>;
 if(type.includes("chat")||type.includes("message")||type.includes("conversation"))return <MessageCircle size={17}/>;
 if(type.includes("booking")||type.includes("proposal"))return <CalendarCheck2 size={17}/>;
 if(type.includes("pro_"))return <Sparkles size={17}/>;
 return <CheckCircle2 size={17}/>;
}

export default function WorkspaceOverview({isMusician,isSinger,isProducer}:{
 isMusician:boolean;isSinger:boolean;isProducer:boolean
}){
 const [data,setData]=useState<Overview|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const latestRequest=useRef(0);
 const refresh=useCallback(async(showLoader=false)=>{
  const request=++latestRequest.current;
  if(showLoader)setLoading(true);
  const {data:result,error:rpcError}=await createClient().rpc("stage_workspace_overview");
  if(request!==latestRequest.current)return;
  const snapshot=result as Overview|null;
  if(rpcError||snapshot?.status!=="ok"||!snapshot.metrics||
   !Array.isArray(snapshot.upcoming)||!Array.isArray(snapshot.activity)){
    setError("Não foi possível atualizar seu resumo agora. Seus dados continuam preservados.");
  }else{setData(snapshot);setError("");}
  setLoading(false);
 },[]);
 useEffect(()=>{
  void refresh(true);
  // Refresh upon returning to StageFlow; no expensive interval / duplicate polling.
  let lastUpdate=Date.now();
  const visible=()=>{
   if(document.visibilityState==="visible"&&Date.now()-lastUpdate>60000){
    lastUpdate=Date.now();void refresh(false);
   }
  };
  document.addEventListener("visibilitychange",visible);
  return()=>{latestRequest.current++;document.removeEventListener("visibilitychange",visible);};
 },[refresh]);

 const metrics=data?.metrics;
 return <div className="sf-workspace-overview">
  <div className="sf-workspace-pane-head">
   <div><h2>Visão geral</h2><p>Prioridades do dia, sem navegar por dez páginas.</p></div>
   <Button variant="ghost" disabled={loading} onClick={()=>void refresh(true)}>
    <RefreshCw size={15} aria-hidden="true"/>Atualizar
   </Button>
  </div>
  {error&&<div className="sf-workspace-error" role="alert">{error}
    <button type="button" onClick={()=>void refresh(true)} className="sf-workspace-retry">Tentar novamente</button>
  </div>}
  {loading&&!data?<LoadingState label="Preparando seu resumo personalizado…"/>:
   metrics&&<div className="sf-workspace-stat-grid">
    <StatCard label="Shows nos próximos 7 dias"
     value={safeCount(metrics.shows_week)}
     icon={<CalendarDays size={20}/>}
     description="Agenda própria e participações confirmadas."
     action={<Link href="/eventos">Ver agenda <ArrowUpRight size={12}/></Link>}/>
    <StatCard label="Convites pendentes"
     value={safeCount(metrics.pending_invites)}
     icon={<Inbox size={20}/>}
     description="Convites recebidos que aguardam sua resposta."
     action={<Link href="/meus-convites">Responder convites <ArrowUpRight size={12}/></Link>}/>
    <StatCard label="Conversas não lidas"
     value={safeCount(metrics.unread_conversations)}
     icon={<MessageCircle size={20}/>}
     description="Contagem de conversas, não de mensagens individuais."
     action={<Link href="/conversas">Abrir conversas <ArrowUpRight size={12}/></Link>}/>
    <StatCard label="Recebido registrado no mês"
     value={brl.format(Math.max(0,Number(metrics.received_month)||0))}
     icon={<Wallet size={20}/>}
     description="Registros manuais de shows do mês; não confirma liquidação bancária."
     action={<Link href="/financeiro">Ver financeiro <ArrowUpRight size={12}/></Link>}/>
   </div>}
  {metrics&&safeCount(metrics.pending_contacts)>0&&<Link href="/meu-perfil-artistico/solicitacoes"
   className="sf-workspace-contact-alert"><Inbox size={18}/>Você tem
   <strong>{safeCount(metrics.pending_contacts)} pedido(s) de contratação</strong>
   aguardando resposta. <ArrowUpRight size={15}/></Link>}
  {metrics&&<WorkspaceNextStep
   metrics={{
    shows_week:safeCount(metrics.shows_week),
    pending_invites:safeCount(metrics.pending_invites),
    unread_conversations:safeCount(metrics.unread_conversations),
    pending_contacts:safeCount(metrics.pending_contacts)
   }}
   isMusician={isMusician} isSinger={isSinger} isProducer={isProducer}/>}
  {data&&<div className="sf-workspace-columns">
   <Card>
    <div className="sf-workspace-pane-head">
     <div><h2>Próximas atividades</h2><p>Seus próximos compromissos confirmados e organizados.</p></div>
     <Link href="/eventos">Agenda <ArrowUpRight size={15}/></Link>
    </div>
    {data?.upcoming?.length?<div className="sf-workspace-show-list">
     {data.upcoming.map(show=><Link href={"/eventos?evento="+encodeURIComponent(show.id)}
      className="sf-workspace-show-link" key={show.id}>
      <span className="sf-workspace-show-date">
       <strong>{day.format(new Date(show.starts_at))}</strong>
       <small>{month.format(new Date(show.starts_at)).replace(".","").toLocaleUpperCase("pt-BR")}</small>
      </span>
      <span className="sf-workspace-show-desc">
       <strong>{show.title}</strong>
       <span>{date.format(new Date(show.starts_at))}{show.venue?" · "+show.venue:show.city?" · "+show.city:""}</span>
       <span>{show.kind==="organized"?"Você organiza este show":"Você participa deste show"}</span>
      </span><ArrowUpRight size={16}/>
     </Link>)}
    </div>:<EmptyState icon={<CalendarDays size={24}/>}
      title="Sua próxima apresentação começa aqui"
      description="Nenhum show futuro cadastrado. Organize uma data ou acompanhe os convites recebidos."
      action={<Link href="/eventos" className="sf-workspace-empty-action"><Plus size={16}/> Abrir agenda</Link>}/>}
   </Card>
   <Card>
    <div className="sf-workspace-pane-head">
     <div><h2>Atividade recente</h2><p>Convites, mensagens e contatos ligados à sua conta.</p></div>
     <Link href="/notificacoes">Tudo <ArrowUpRight size={15}/></Link>
    </div>
    {data?.activity?.length?<div className="sf-workspace-activity-list">
     {data.activity.map(item=><Link className={"sf-workspace-activity-link"+(!item.read?" is-unread":"")}
      href={item.href.startsWith("/")&&!item.href.startsWith("//")?item.href:"/notificacoes"}
      key={item.type+"-"+item.id}>
      <span className="sf-workspace-activity-icon"><ActivitySymbol type={item.type}/></span>
      <span className="sf-workspace-activity-copy">
       <strong>{item.title}</strong>
       <small>{item.summary}</small>
       <span className="sf-workspace-activity-time">{timeAgo(item.created_at)}</span>
      </span>
      {!item.read&&<StatusChip label="Novo" status="warning"/>}
     </Link>)}
    </div>:<EmptyState icon={<Clock3 size={24}/>}
     title="Tudo em dia"
     description="Novas propostas, avisos e pedidos reais aparecerão aqui automaticamente."/>}
   </Card>
  </div>}
  {data&&<Card className="sf-workspace-action-card">
   <div className="sf-workspace-pane-head">
    <div><h2>Acessos rápidos</h2><p>Suas ações mais comuns, sem passar por vários menus.</p></div>
   </div>
   <div className="sf-workspace-quick-actions">
    <Link href="/eventos"><Plus size={16}/>Organizar show</Link>
    {isMusician&&<Link href="/meus-convites"><Inbox size={16}/>Responder convites</Link>}
    {isMusician&&<Link href="/meu-portfolio"><Sparkles size={16}/>Editar portfólio</Link>}
    {isSinger&&<Link href="/meu-perfil-artistico"><Sparkles size={16}/>Editar perfil de cantor</Link>}
    {isProducer&&<Link href="/convites"><MessageCircle size={16}/>Convidar músicos</Link>}
    <Link href="/financeiro"><CircleDollarSign size={16}/>Ver financeiro</Link>
   </div>
  </Card>}
  {data&&<p className="sf-workspace-asof">Resumo de dados reais, atualizado {timeAgo(data.updated_at)}.
   A atividade não é marcada como lida ao entrar no painel.</p>}
 </div>;
}
