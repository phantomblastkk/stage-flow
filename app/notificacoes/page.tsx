"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
 ArrowLeft, ArrowRight, Bell, BellRing, Check, CheckCheck,
 Clock3, Inbox, LoaderCircle, MessageCircle, RefreshCw, ShieldCheck,
 UserRoundCheck, UserRoundX, XCircle, Gift, Crown, Star, CheckCircle2
} from "lucide-react";
import {createClient} from "@/lib/supabase/client";
import "./notificacoes.css";

type Kind="invitation"|"proposal"|"conversation"|"operations"|"account"|"booking"|"review"|"verification"|"finance";
type Notice={
 id:string;source_type:Kind;source_id:string;event_code:string;
 event_id:string|null;thread_id:string|null;title:string;summary:string;
 created_at:string;read_at:string|null;
};
type Filter="all"|"unread";
const fmt=new Intl.DateTimeFormat("pt-BR",{
 timeZone:"America/Sao_Paulo",day:"2-digit",month:"short",year:"numeric",
 hour:"2-digit",minute:"2-digit"
});
const categories:Record<string,string>={
 invite_received:"Convite",invite_accepted:"Confirmação",invite_declined:"Recusa",
 invite_cancelled:"Cancelamento",proposal_received:"Proposta",
 proposal_accepted:"Proposta aceita",proposal_declined:"Proposta recusada",
 proposal_withdrawn:"Proposta retirada",chat_message:"Mensagem",
 show_briefing_changed:"Atualização da operação",
 booking_received:"Pedido de contratação",review_received:"Nova avaliação",
 profile_verified:"Perfil verificado",finance_received:"Recebimento atualizado",
 pro_courtesy_granted:"Cortesia Pro recebida",pro_courtesy_revoked:"Cortesia Pro encerrada"
};
function destination(n:Notice){
 if(n.source_type==="booking")return "/meu-perfil-artistico/solicitacoes?pedido="+encodeURIComponent(n.source_id);
 if(n.source_type==="review")return "/marketplace";
 if(n.source_type==="verification")return "/perfil-artistico";
 if(n.source_type==="finance")return "/financeiro";
 if(n.source_type==="account")return n.event_code==="pro_courtesy_granted"
   ?"/meu-perfil-artistico?aba=pro":"/minha-conta?aba=cantor";
 if(n.source_type==="operations")return n.event_id?"/eventos/operacao?evento="+encodeURIComponent(n.event_id):"/eventos";
 if(n.source_type==="conversation"||n.source_type==="proposal"){
  return n.thread_id?"/conversas?conversa="+encodeURIComponent(n.thread_id):"/conversas";
 }
 if(n.event_code==="invite_received"||n.event_code==="invite_cancelled"){
  return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(n.source_id)
   ?"/meus-convites?convite="+encodeURIComponent(n.source_id):"/meus-convites";
 }
 return n.event_id?"/convites?evento="+encodeURIComponent(n.event_id):"/convites";
}
function glyph(code:string){
 if(code==="booking_received")return <Inbox size={18}/>;
 if(code==="review_received")return <Star size={18}/>;
 if(code==="profile_verified")return <ShieldCheck size={18}/>;
 if(code==="finance_received")return <CheckCircle2 size={18}/>;
 if(code==="pro_courtesy_granted")return <Gift size={18}/>;
 if(code==="pro_courtesy_revoked")return <Crown size={18}/>;
 if(code==="show_briefing_changed")return <Clock3 size={18}/>;
 if(code==="chat_message")return <MessageCircle size={18}/>;
 if(code==="invite_accepted"||code==="proposal_accepted")return <UserRoundCheck size={18}/>;
 if(code==="invite_declined"||code==="proposal_declined")return <UserRoundX size={18}/>;
 if(code==="invite_cancelled"||code==="proposal_withdrawn")return <XCircle size={18}/>;
 return <BellRing size={18}/>;
}
export default function NotificationsPage(){
 const router=useRouter();
 const [notifications,setNotifications]=useState<Notice[]>([]);
 const [unread,setUnread]=useState(0);
 const [filter,setFilter]=useState<Filter>("unread");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [realtimeConnected,setRealtimeConnected]=useState(false);

 const refresh=useCallback(async(currentFilter:Filter)=>{
  const {data,error:rpcError}=await createClient().rpc("stage_notifications_list",{
   p_filter:currentFilter,p_limit:100
  });
  if(rpcError)throw rpcError;
  if(data?.status!=="ok"||!Array.isArray(data.items)){
   throw Error("Não foi possível carregar as notificações da sua conta.");
  }
  setNotifications(data.items as Notice[]);
  setUnread(Number(data.unread)||0);
 },[]);
 useEffect(()=>{
  let alive=true;setLoading(true);
  async function boot(){
   try{
    const authClient=createClient();
    const {data:{user},error:authError}=await authClient.auth.getUser();
    if(authError){
     const {data:{session}}=await authClient.auth.getSession();
     if(session)throw Error("Não foi possível validar sua sessão agora. Sua conta não foi desconectada; tente novamente.");
    }
    if(!user){router.replace("/login");return;}
    await refresh(filter);
   }catch(e){if(alive)setError(e instanceof Error?e.message:"Falha ao carregar.");}
   finally{if(alive)setLoading(false);}
  }
  void boot();
  const ticker=setInterval(()=>{
   if(alive&&document.visibilityState==="visible")void refresh(filter).catch(()=>{});
  },realtimeConnected?60000:20000);
  const onNoticesChanged=()=>{
   if(alive&&document.visibilityState==="visible")
    void refresh(filter).catch(()=>setError("Não foi possível atualizar os avisos."));
  };
  window.addEventListener("stageflow:notifications-updated",onNoticesChanged);
  return()=>{alive=false;clearInterval(ticker);
   window.removeEventListener("stageflow:notifications-updated",onNoticesChanged);};
 },[filter,refresh,router,realtimeConnected]);
 useEffect(()=>{
  const update=(event:Event)=>setRealtimeConnected(
    Boolean((event as CustomEvent<{connected:boolean}>).detail?.connected)
  );
  setRealtimeConnected(document.documentElement.dataset.stageflowRealtime==="connected");
  window.addEventListener("stageflow:realtime-status",update);
  return()=>window.removeEventListener("stageflow:realtime-status",update);
 },[]);
 const grouped=useMemo(()=>{
  const result=new Map<string,Notice[]>();
  for(const item of notifications){
   const key=new Date(item.created_at).toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"medium"});
   result.set(key,[...(result.get(key)??[]),item]);
  }
  return [...result.entries()];
 },[notifications]);
 async function mark(ids:string[]|null,all=false){
  const {data,error:rpcError}=await createClient().rpc("stage_notifications_mark",{
   p_ids:ids,p_all:all
  });
  if(rpcError||data?.status!=="ok")throw Error("Não foi possível marcar como lida.");
 }
 async function markAll(){
  if(busy||unread===0)return;
  setBusy(true);setError("");setNotice("");
  try{await mark(null,true);await refresh(filter);window.dispatchEvent(new Event("stageflow:notifications-updated"));setNotice("Todas as notificações foram marcadas como lidas.");}
  catch(e){setError(e instanceof Error?e.message:"Falha ao atualizar.");}
  finally{setBusy(false);}
 }
 async function open(item:Notice){
  if(busy)return;setBusy(true);setError("");setNotice("");
  try{
   if(!item.read_at){
    try{
     await mark([item.id]);
     setNotifications(items=>filter==="unread"
       ?items.filter(n=>n.id!==item.id)
       :items.map(n=>n.id===item.id?{...n,read_at:new Date().toISOString()}:n));
     setUnread(count=>Math.max(0,count-1));
     window.dispatchEvent(new Event("stageflow:notifications-updated"));
    }catch{
     // Mark-as-read failures must not block the musician from the event briefing.
    }
   }
   router.push(destination(item));
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível abrir.");setBusy(false);}
 }
 async function markOne(item:Notice){
  if(busy||item.read_at)return;
  setBusy(true);setError("");setNotice("");
  try{await mark([item.id]);await refresh(filter);window.dispatchEvent(new Event("stageflow:notifications-updated"));}
  catch(e){setError(e instanceof Error?e.message:"Erro ao atualizar.");}
  finally{setBusy(false);}
 }

 return <main className="notifications-page"><div className="container">
  <nav className="nav">
   <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
   <Link className="btn btn-quiet" href="/painel"><ArrowLeft size={15}/> Meu painel</Link>
  </nav>
  <header className="notifications-hero">
   <span className="eyebrow"><ShieldCheck size={14}/> AVISOS PRIVADOS · DENTRO DO SITE</span>
   <h1>Minhas <span className="accent">notificações.</span></h1>
   <p>Pedidos de contratação, convites, respostas, avaliações, mensagens, recebimentos e outros avisos importantes em uma única caixa de entrada. Quando você abre um aviso, ele sai das pendências; o histórico continua disponível na aba Todas.</p>
   <div className="notifications-metrics">
    <span><Bell size={16}/><strong>{unread>99?"99+":unread}</strong> não lida{unread===1?"":"s"}</span>
    <span><Inbox size={16}/>{notifications.length} aviso{notifications.length===1?"":"s"} neste filtro</span>
   </div>
  </header>
  {error&&<div className="notifications-feedback is-error" role="alert">{error}
   <button type="button" className="btn btn-quiet" disabled={loading||busy}
    onClick={()=>{setError("");void refresh(filter).catch(e=>setError(e instanceof Error?e.message:"Falha ao carregar."));}}>
    <RefreshCw size={15}/> Tentar novamente</button></div>}
  {notice&&<p className="notifications-feedback" role="status">{notice}</p>}
  <section className="notifications-body" aria-label="Caixa de entrada de notificações">
   <div className="notifications-toolbar">
    <div role="group" aria-label="Filtrar notificações" className="notifications-filters">
     <button type="button" aria-pressed={filter==="all"} onClick={()=>setFilter("all")}>Todas</button>
     <button type="button" aria-pressed={filter==="unread"} onClick={()=>setFilter("unread")}>
      Não lidas {unread>0?"("+unread+")":""}
     </button>
    </div>
    <div className="notifications-actions">
     <button type="button" className="btn btn-quiet" disabled={loading||busy}
      onClick={()=>{setError("");void refresh(filter).catch(e=>setError(e instanceof Error?e.message:"Erro ao atualizar."));}}>
      <RefreshCw size={15}/> Atualizar
     </button>
     <button type="button" className="btn btn-quiet" disabled={loading||busy||unread===0}
      onClick={()=>void markAll()}><CheckCheck size={15}/> Marcar todas como lidas</button>
    </div>
   </div>
   {loading?<p className="notifications-loading"><LoaderCircle size={18}/> Buscando seus avisos...</p>:
   notifications.length===0?<div className="notifications-empty">
    <Bell size={28}/>
    <h2>{filter==="unread"?"Tudo em dia!":"Sua caixa de entrada está vazia"}</h2>
    <p>{filter==="unread"?"Você não tem avisos pendentes.":"Pedidos de contratação e atividades importantes da sua conta aparecerão aqui automaticamente."}</p>
    <Link className="btn btn-quiet" href="/painel">Voltar ao painel <ArrowRight size={15}/></Link>
   </div>:
   <div className="notifications-feed">
    {grouped.map(([date,items])=><section key={date} aria-label={"Notificações de "+date}>
     <h2>{date}</h2>
     <div className="notifications-list">
      {items.map(item=><article key={item.id}
        className={"notifications-item"+(item.read_at?"":" is-unread")}>
       <div className={"notifications-icon "+item.event_code}>{glyph(item.event_code)}</div>
       <div className="notifications-content">
        <div className="notifications-item-title">
         <strong>{item.title}</strong>
         {!item.read_at&&<span className="notifications-unread-dot" aria-label="Não lida"/>}
        </div>
        <p>{item.summary}</p>
        <div className="notifications-item-meta">
         <span>{categories[item.event_code]||"Atualização"}</span>
         <span><Clock3 size={12}/>{fmt.format(new Date(item.created_at))}</span>
        </div>
        <div className="notifications-item-actions">
         <button type="button" className="btn btn-primary" disabled={busy}
          onClick={()=>void open(item)}>Abrir assunto <ArrowRight size={14}/></button>
         {!item.read_at&&<button type="button" className="btn btn-quiet"
          disabled={busy} onClick={()=>void markOne(item)}><Check size={14}/> Marcar como lida</button>}
        </div>
       </div>
      </article>)}
     </div>
    </section>)}
   </div>}
  </section>
  <p className="notifications-footer">Atualização ao vivo quando a conexão privada estiver ativa, com atualização periódica de segurança enquanto a página estiver aberta. Os avisos são privados e não representam envio de push ou WhatsApp. A listagem mostra até 100 registros mais recentes por filtro.</p>
 </div></main>;
}
