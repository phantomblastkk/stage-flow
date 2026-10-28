"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import Link from "next/link";
import {
 ArrowUpRight,CalendarCheck2,CalendarDays,CheckCircle2,
 Clock3,Inbox,MessageCircle,Plus,RefreshCw,
 Sparkles,Store,UserRound
} from "lucide-react";
import {createClient} from "@/lib/supabase/client";
import {Button,Card,EmptyState,LoadingState,StatusChip} from "@/src/components/ui";
import OperationalFinance from "./operational-finance";
import ProfileReadiness from "./profile-readiness";

type Show={id:string;title:string;starts_at:string;venue:string|null;city:string|null;kind:"organized"|"participation"};
type Activity={id:string;type:string;title:string;summary:string;created_at:string;read:boolean;href:string};
type Metrics={shows_week:number;pending_invites:number;unread_conversations:number;pending_contacts:number;received_month:number};
type Overview={status:string;metrics:Metrics;upcoming:Show[];activity:Activity[];updated_at:string};

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
 const nextShow=data?.upcoming?.[0];
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
  {loading&&!data?<LoadingState label="Preparando seu resumo personalizado…"/>:metrics&&<>
   <p className="sf-operations-summary">Você tem <Link href="/eventos"><strong>{safeCount(metrics.shows_week)} shows</strong> nos próximos 7 dias</Link>, <Link href="/meus-convites"><strong>{safeCount(metrics.pending_invites)} convites</strong> aguardando resposta</Link> e <Link href="/conversas"><strong>{safeCount(metrics.unread_conversations)} conversas</strong> para acompanhar</Link>.</p>
   <div className="sf-operations-hero">
    <Card className="sf-operations-next-show"><span className="eyebrow">PRÓXIMO SHOW</span>
     {nextShow?<><h2>{nextShow.title}</h2><p>{nextShow.venue||"Local a definir"}{nextShow.city?" · "+nextShow.city:""}</p><p>{date.format(new Date(nextShow.starts_at))}</p><Link className="sf-ui-button sf-ui-button-primary" href={"/eventos?evento="+encodeURIComponent(nextShow.id)}>Ver detalhes <ArrowUpRight size={16}/></Link></>:<><h2>Seu próximo palco está por vir</h2><p>Confira os convites ou organize um novo show.</p><Link className="sf-ui-button sf-ui-button-primary" href="/eventos?novo=1">Criar evento</Link></>}
    </Card>
    <Card className="sf-operations-market"><span className="eyebrow">MARKETPLACE</span><h2>Seu próximo encontro começa aqui.</h2><p>Descubra profissionais, consulte disponibilidade e conecte seu evento a novos talentos.</p><Link className="sf-ui-button sf-ui-button-primary" href="/marketplace"><Store size={18}/> Abrir marketplace <ArrowUpRight size={16}/></Link><small>Aberto para explorar. Novidades em desenvolvimento aparecem em destaque no catálogo.</small></Card>
   </div>
   <div className="sf-operations-status"><Link href="/meus-convites"><strong>{safeCount(metrics.pending_invites)}</strong> convites pendentes · Responder →</Link><ProfileReadiness/></div>
   <OperationalFinance revision={latestRequest.current}/>
   <Card className="sf-operations-opportunities"><div className="sf-workspace-pane-head"><div><h2>Oportunidades para você</h2><p>Explore músicos por estilo, região e disponibilidade diretamente no Marketplace.</p></div><Store size={20}/></div><div className="sf-workspace-quick-actions"><Link href="/marketplace?estilo=Pagode">Pagode</Link><Link href="/marketplace?estilo=Sertanejo">Sertanejo</Link><Link href="/marketplace?aba=favoritos">Favoritos</Link><Link href="/contratar">Artistas e grupos</Link></div><p className="sf-operations-muted">Ainda não há uma fonte de vagas de casas e eventos publicada. Estes acessos abrem buscas reais no catálogo; não representam ofertas de trabalho.</p></Card>
  </>}
  {metrics&&safeCount(metrics.pending_contacts)>0&&<Link href="/meu-perfil-artistico/solicitacoes"
   className="sf-workspace-contact-alert"><Inbox size={18}/>Você tem
   <strong>{safeCount(metrics.pending_contacts)} pedido(s) de contratação</strong>
   aguardando resposta. <ArrowUpRight size={15}/></Link>}
  {data&&<div className="sf-workspace-columns">
   <Card>
    <div className="sf-workspace-pane-head">
     <div><h2>Sua agenda</h2><p>Seus próximos compromissos confirmados e organizados.</p></div>
     <Link href="/eventos">Agenda <ArrowUpRight size={15}/></Link>
    </div>
    {(data?.upcoming?.length??0)>1?<div className="sf-workspace-show-list">
     {data.upcoming.slice(1,4).map(show=><Link href={"/eventos?evento="+encodeURIComponent(show.id)}
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
      title="Sua agenda está em dia"
      description="Os demais shows confirmados aparecerão aqui."
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
    <div><h2>Ações rápidas</h2><p>Suas ações mais comuns, sem passar por vários menus.</p></div>
   </div>
   <div className="sf-workspace-quick-actions">
    <Link href="/minha-disponibilidade"><CalendarDays size={16}/>Atualizar disponibilidade</Link>
    <Link href="/perfil-artistico"><UserRound size={16}/>Editar perfil</Link>
    <Link href="/marketplace"><Store size={16}/>Abrir marketplace</Link>
    <Link href="/eventos"><CalendarDays size={16}/>Ver agenda</Link>
    <Link href="/eventos?novo=1"><Plus size={16}/>Criar evento</Link>
   </div>
  </Card>}
  {data&&<p className="sf-workspace-asof">Resumo de dados reais, atualizado {timeAgo(data.updated_at)}.
   A atividade não é marcada como lida ao entrar no painel.</p>}
 </div>;
}
