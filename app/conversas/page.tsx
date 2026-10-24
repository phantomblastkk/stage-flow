"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, CalendarDays, CheckCircle2, Clock3, LoaderCircle, MessageCircle, RefreshCw, Send, ShieldCheck, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import HiringProposals from "@/components/hiring-proposals";
import "./conversas.css";

type Thread = {
 id:string; requested_date:string|null;event_id:string|null;
 availability:"awaiting"|"available"|"unavailable"|"ask_later";
 last_message_at:string;other_id:string;other_name:string;
 acting_as:"requester"|"musician";unread:number;last_message:string|null
};
type Message = {id:string;body:string;is_mine:boolean;created_at:string};
type PhoneSettings = {status:string;opted_in:boolean;phone:string|null};
const availabilityLabels:Record<Thread["availability"],string>={
 awaiting:"Aguardando resposta",available:"Disponível",unavailable:"Indisponível",ask_later:"A combinar"
};
function dateBR(day:string){return new Date(day+"T12:00:00").toLocaleDateString("pt-BR");}
function timeBR(day:string){return new Date(day).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});}

export default function HiringConversations(){
 const router=useRouter();
 const [threads,setThreads]=useState<Thread[]>([]);
 const [activeId,setActiveId]=useState<string|null>(null);
 const [messages,setMessages]=useState<Message[]>([]);
 const [text,setText]=useState("");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [settings,setSettings]=useState<PhoneSettings|null>(null);
 const [phone,setPhone]=useState("");
 const [consent,setConsent]=useState(false);
 const [savingSettings,setSavingSettings]=useState(false);
 const [showSettings,setShowSettings]=useState(false);

 const loadThreads=useCallback(async()=>{
  const {data,error:rpcError}=await createClient().rpc("stage_hiring_list");
  if(rpcError)throw rpcError;
  if(!Array.isArray(data))throw Error("Não foi possível abrir a lista de conversas.");
  setThreads(data as Thread[]);
 },[]);
 const loadMessages=useCallback(async(id:string)=>{
  const {data,error:rpcError}=await createClient().rpc("stage_hiring_messages",{p_thread_id:id});
  if(rpcError)throw rpcError;
  if(data?.status!=="ok")throw Error("Você não tem acesso a esta conversa.");
  setMessages((data.messages||[]) as Message[]);
 },[]);
 const loadPrefs=useCallback(async()=>{
  const {data,error:rpcError}=await createClient().rpc("stage_hiring_whatsapp_settings");
  if(rpcError)throw rpcError;
  const next=data as PhoneSettings;
  if(next?.status!=="ok")return;
  setSettings(next);setConsent(Boolean(next.opted_in));setPhone(next.phone||"");
 },[]);
 useEffect(()=>{
  let active=true;
  async function firstLoad(){
   try{
    const db=createClient();
    const {data:{user}}=await db.auth.getUser();
    if(!user){router.replace("/login");return;}
    await Promise.all([loadThreads(),loadPrefs()]);
    if(!active)return;
    const query=new URLSearchParams(window.location.search);
    const musician=query.get("musico");
    const requestedDate=query.get("data")||null;
    const eventId=query.get("evento");
    if(musician){
      if(!/^[a-f0-9-]{36}$/i.test(musician))throw Error("Identificador do músico inválido.");
      if(requestedDate&&!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate))throw Error("Data inválida.");
      const {data,error:openError}=await db.rpc("stage_hiring_start",{
        p_musician_id:musician,p_date:requestedDate,p_event_id:eventId||null
      });
      if(openError)throw openError;
      if(data?.status!=="ok"){
        throw Error(data?.status==="not_released"?
         "O chat de contratação ainda está disponível somente para contas autorizadas de homologação.":
         data?.status==="invalid_musician"?"Este músico não possui conta elegível para receber pedidos.":
         "Não foi possível iniciar essa conversa.");
      }
      if(active){setActiveId(data.thread_id);await loadThreads();await loadMessages(data.thread_id);}
    }
   }catch(e){if(active)setError(e instanceof Error?e.message:"Não foi possível carregar.");}
   finally{if(active)setLoading(false);}
  }
  void firstLoad();
  return()=>{active=false};
 },[router,loadThreads,loadMessages,loadPrefs]);

 useEffect(()=>{
  if(!activeId)return;
  void loadMessages(activeId).catch(()=>{});
  const timer=setInterval(()=>{void loadMessages(activeId).catch(()=>{});},8000);
  return()=>clearInterval(timer);
 },[activeId,loadMessages]);
 useEffect(()=>{
  const timer=setInterval(()=>{void loadThreads().catch(()=>{});},22000);
  return()=>clearInterval(timer);
 },[loadThreads]);

 const active=threads.find(t=>t.id===activeId);
 async function send(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!activeId||busy||!text.trim())return;
  setBusy(true);setError("");setNotice("");
  try{
    const {data,error:rpcError}=await createClient().rpc("stage_hiring_send",{
      p_thread_id:activeId,p_body:text.trim()
    });
    if(rpcError)throw rpcError;
    if(data?.status!=="ok")throw Error(data?.status==="rate_limited"?
      "Você enviou muitas mensagens seguidas. Tente novamente daqui a pouco.":"Não foi possível enviar esta mensagem.");
    setText("");await loadMessages(activeId);await loadThreads();
  }catch(e){setError(e instanceof Error?e.message:"Erro ao enviar.");}
  finally{setBusy(false);}
 }
 async function setAvailability(response:"available"|"unavailable"|"ask_later"){
  if(!activeId||busy)return;setBusy(true);setError("");
  try{
    const {data,error:rpcError}=await createClient().rpc("stage_hiring_availability",{
      p_thread_id:activeId,p_response:response
    });
    if(rpcError||data!=="saved")throw Error("Não foi possível registrar sua disponibilidade.");
    await loadThreads();setNotice("Disponibilidade atualizada.");
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível atualizar.");}
  finally{setBusy(false);}
 }
 async function savePrefs(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(savingSettings)return;setSavingSettings(true);setError("");setNotice("");
  try{
    const {data,error:rpcError}=await createClient().rpc("stage_hiring_whatsapp_settings",{
      p_phone:consent?phone:null,p_consent:consent
    });
    if(rpcError||data?.status!=="ok")throw Error(data?.status==="invalid_phone"?
      "Informe um WhatsApp válido com DDD.":"Não foi possível salvar as preferências.");
    await loadPrefs();
    setNotice(consent?
      "Consentimento salvo. Os avisos começarão somente após a conexão oficial da API do WhatsApp.":
      "Avisos de WhatsApp desativados.");
    setShowSettings(false);
  }catch(err){setError(err instanceof Error?err.message:"Erro ao salvar.");}
  finally{setSavingSettings(false);}
 }

 return <main className="hiring-page"><div className="container">
  <nav className="nav"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
   <Link className="btn btn-quiet" href="/painel"><ArrowLeft size={15}/> Painel</Link></nav>
  <header className="hiring-heading">
    <span className="eyebrow"><ShieldCheck size={14}/> NEGOCIAÇÃO PRIVADA</span>
    <h1>Conversas de <span className="accent">contratação.</span></h1>
    <p>Consulte datas, converse com músicos e formalize uma proposta de apresentação. Seu WhatsApp pessoal não é divulgado aqui.</p>
    <button className="btn btn-quiet" type="button" aria-expanded={showSettings}
      onClick={()=>setShowSettings(v=>!v)}><Bell size={15}/> Avisos por WhatsApp (opcional)</button>
  </header>
  {error&&<p role="alert" className="hiring-feedback is-error">{error}</p>}
  {notice&&<p role="status" className="hiring-feedback">{notice}</p>}
  {showSettings&&<form className="hiring-settings" onSubmit={e=>void savePrefs(e)}>
   <h2>Notificações no WhatsApp</h2>
   <p>Quando a API oficial estiver conectada, podemos avisar sobre novas mensagens com um modelo aprovado, direcionando você de volta ao Stage Flow. Sem compartilhar o telefone com outros usuários.</p>
   <label className="hiring-accept"><input type="checkbox" checked={consent}
     onChange={e=>setConsent(e.target.checked)}/> Autorizo receber notificações transacionais deste chat pelo WhatsApp. Posso cancelar a qualquer momento.</label>
   {consent&&<label className="hiring-input">WhatsApp com DDD
     <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="11 99999-9999" required/></label>}
   <button className="btn btn-primary" disabled={savingSettings} type="submit">Salvar preferência</button>
   {settings?.opted_in&&<small>Consentimento ativo. O envio automático ainda não foi habilitado.</small>}
  </form>}
  {loading?<div className="hiring-loading"><LoaderCircle size={20}/> Carregando conversas...</div>:
    <div className="hiring-layout">
     <aside className="hiring-sidebar" aria-label="Suas conversas">
      <div className="hiring-sidebar-heading"><strong>Caixa de entrada</strong>
       <button title="Atualizar conversas" onClick={()=>void loadThreads()} aria-label="Atualizar conversas"><RefreshCw size={15}/></button></div>
      {threads.map(thread=><button key={thread.id} type="button"
       className={"hiring-thread"+(thread.id===activeId?" is-selected":"")}
       aria-pressed={thread.id===activeId} onClick={()=>{setActiveId(thread.id);setError("");setNotice("");}}>
       <span className="hiring-avatar"><UserRound size={20}/></span>
       <span className="hiring-thread-detail"><strong>{thread.other_name}</strong>
        <small>{thread.acting_as==="requester"?"Músico":"Contratante"} · {thread.requested_date?dateBR(thread.requested_date):"Data a combinar"}</small>
        <small>{thread.last_message||"Conversa iniciada — envie sua pergunta"}</small>
       </span>{thread.unread>0&&<span className="hiring-unread">{thread.unread}</span>}
      </button>)}
      {!threads.length&&<p className="hiring-empty">Nenhuma conversa por enquanto. Abra um perfil no marketplace de testes para consultar a disponibilidade do músico.</p>}
     </aside>
     <section className="hiring-main" aria-label="Mensagens da conversa">
      {active?<><div className="hiring-chat-header">
        <div><h2>{active.other_name}</h2>
        <p><CalendarDays size={14}/> {active.requested_date?dateBR(active.requested_date):"Data a combinar"}
         <span className={"hiring-availability "+active.availability}>{availabilityLabels[active.availability]}</span></p></div>
        {active.event_id&&active.acting_as==="requester"&&<Link className="btn btn-quiet"
          href={"/eventos?evento="+encodeURIComponent(active.event_id)+"&equipe=1"}>Abrir evento</Link>}
      </div>
      {active.acting_as==="musician"&&<div className="hiring-answers">
       <span><Clock3 size={14}/> Sua disponibilidade:</span>
       <button type="button" disabled={busy} onClick={()=>void setAvailability("available")}><CheckCircle2 size={14}/> Disponível</button>
       <button type="button" disabled={busy} onClick={()=>void setAvailability("unavailable")}>Indisponível</button>
       <button type="button" disabled={busy} onClick={()=>void setAvailability("ask_later")}>A combinar</button>
      </div>}
      <HiringProposals key={active.id} thread={active} onUpdate={()=>{
        void loadThreads();void loadMessages(active.id);
       }}/>
      <div className="hiring-messages">
       {!messages.length&&<p className="hiring-empty">Conversa privada. Pergunte sobre disponibilidade, repertório e cachê. A contratação só acontece após os dois confirmarem os detalhes.</p>}
       {messages.map(message=><article key={message.id}
         className={"hiring-bubble "+(message.is_mine?"mine":"theirs")}>
         <p>{message.body}</p><small>{timeBR(message.created_at)}</small>
       </article>)}
      </div>
      <form className="hiring-composer" onSubmit={e=>void send(e)}>
       <label htmlFor="hiring-message">Sua mensagem</label>
       <div><textarea id="hiring-message" placeholder="Ex.: Você está disponível para tocar neste sábado? Qual seria seu cachê?"
        value={text} onChange={e=>setText(e.target.value)} maxLength={1500} rows={3}
        disabled={busy} required/>
        <button type="submit" className="btn btn-primary" disabled={busy||!text.trim()}>
         <Send size={16}/> Enviar</button></div>
       <small>O chat não compartilha seu telefone. Use uma proposta formal para confirmar o show; o financeiro continua privado.</small>
      </form></>:<div className="hiring-start-prompt">
       <MessageCircle size={30}/>
       <h2>Selecione uma conversa</h2><p>Escolha uma conversa à esquerda para ver as mensagens e responder.</p>
       <Link href="/marketplace/preview" className="btn btn-quiet">Marketplace de testes</Link>
      </div>}
     </section>
    </div>}
 </div></main>;
}
