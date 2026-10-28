"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, CalendarDays, CheckCircle2, Clock3, LoaderCircle, MessageCircle, RefreshCw, Send, ShieldCheck, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import HiringProposals from "@/components/hiring-proposals";
import { useAccount } from "@/src/domains/account/account-context";
import { Button, LoadingState,Input,Textarea,InlineNotice,StatusChip,Badge,Avatar } from "@/src/components/ui";
import { useConversationMessages } from "@/src/domains/booking/hooks/use-conversation-messages";
import { conversationHref } from "@/src/domains/booking/model/booking-links";
import { BookingSessionRequired, loadThreads as readThreads, saveThreadAvailability, sendThreadMessage, startConversation } from "@/src/domains/booking/services/booking-service";
import type { Thread } from "@/src/domains/booking/types";
import {historyWindow,snapshotMayBeLimited,THREAD_SNAPSHOT_LIMIT,MESSAGE_SNAPSHOT_LIMIT,THREAD_RENDER_STEP,MESSAGE_RENDER_STEP} from "@/src/domains/booking/model/recent-history";
import "./conversas.css";

type PhoneSettings = {status:string;opted_in:boolean;phone:string|null};
const availabilityLabels:Record<Thread["availability"],string>={
 awaiting:"Aguardando resposta",available:"Disponível",unavailable:"Indisponível",ask_later:"A combinar"
};
function dateBR(day:string){return new Date(day+"T12:00:00").toLocaleDateString("pt-BR");}
function timeBR(day:string){return new Date(day).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});}

export default function HiringConversations(){
 const router=useRouter();
 const {snapshot:account}=useAccount();
 const accountId=account.user?.id??"";
 const [threads,setThreads]=useState<Thread[]>([]);
 const [activeId,setActiveId]=useState<string|null>(null);
 const [visibleThreads,setVisibleThreads]=useState(THREAD_RENDER_STEP);
 const [messageWindow,setMessageWindow]=useState({id:"",count:MESSAGE_RENDER_STEP});
 const {messages,messagesLoading,messagesError,text,setText,loadMessages}=useConversationMessages(activeId);
 const selected=useRef(activeId);selected.current=activeId;
 const alive=useRef(false);
 const threadRequest=useRef<AbortController|null>(null);
 const prefsRequest=useRef<AbortController|null>(null);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [settings,setSettings]=useState<PhoneSettings|null>(null);
 const [prefsError,setPrefsError]=useState("");
 const [phone,setPhone]=useState("");
 const [consent,setConsent]=useState(false);
 const [savingSettings,setSavingSettings]=useState(false);
 const [showSettings,setShowSettings]=useState(false);

 useEffect(()=>{alive.current=true;return()=>{alive.current=false;threadRequest.current?.abort();prefsRequest.current?.abort();};},[]);
 const selectThread=useCallback((id:string|null)=>{
  selected.current=id;setActiveId(id);setError("");setNotice("");
  window.history.replaceState(null,"",id?conversationHref(id):"/conversas");
 },[]);

 const loadThreads=useCallback(async()=>{
  if(!alive.current)return [];
  threadRequest.current?.abort();const request=new AbortController();threadRequest.current=request;
  try{
   const result=await readThreads(createClient(),request.signal);
   if(alive.current&&!request.signal.aborted)setThreads(result);
   return result;
  }finally{if(threadRequest.current===request)threadRequest.current=null;}
 },[]);
 const loadPrefs=useCallback(async()=>{
  prefsRequest.current?.abort();const request=new AbortController();prefsRequest.current=request;
  const {data,error:rpcError}=await createClient().rpc("stage_hiring_whatsapp_settings").abortSignal(request.signal);
  if(!alive.current||request.signal.aborted)return;
  const next=data as PhoneSettings;
  if(rpcError||next?.status!=="ok"){setPrefsError("Não foi possível carregar as preferências de WhatsApp. Suas conversas continuam disponíveis.");return;}
  setPrefsError("");
  setSettings(next);setConsent(Boolean(next.opted_in));setPhone(next.phone||"");
 },[]);
 useEffect(()=>{
  let active=true;
  async function firstLoad(){
   try{
    const openedThreads=await loadThreads();
    if(!active)return;
    const query=new URLSearchParams(window.location.search);
    const conversation=query.get("conversa");
    if(conversation){
      if(!/^[a-f0-9-]{36}$/i.test(conversation))throw Error("Conversa inválida.");
      if(!openedThreads.some(item=>item.id===conversation))throw Error(snapshotMayBeLimited(openedThreads.length,THREAD_SNAPSHOT_LIMIT)?"Esta conversa não está na lista recente disponível. O histórico de conversas pode estar limitado.":"Conversa não encontrada nesta conta.");
      selectThread(conversation);return;
    }
    const musician=query.get("musico");
    const requestedDate=query.get("data")||null;
    const eventId=query.get("evento");
    if(musician){
      if(!/^[a-f0-9-]{36}$/i.test(musician))throw Error("Identificador do músico inválido.");
      if(requestedDate&&!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate))throw Error("Data inválida.");
      const id=await startConversation(createClient(),accountId,musician,requestedDate,eventId||null);
      if(active){await loadThreads();if(active)selectThread(id);}
    }
   }catch(e){if(active)setError(e instanceof Error?e.message:"Não foi possível carregar.");}
   finally{if(active)setLoading(false);}
  }
  void firstLoad();
  return()=>{active=false};
 },[accountId,loadThreads,selectThread]);

 useEffect(()=>{
  void loadPrefs().catch(()=>{if(alive.current)setPrefsError("Não foi possível carregar as preferências de WhatsApp.");});
 },[loadPrefs]);
 const refreshThreads=useCallback(async()=>{
  try{await loadThreads();if(alive.current)setError("");}
  catch(e){if(alive.current&&!(e instanceof Error&&e.name==="AbortError"))setError(e instanceof Error?e.message:"Não foi possível atualizar as conversas.");}
 },[loadThreads]);
 useEffect(()=>{
  const refresh=()=>{if(document.visibilityState==="visible"&&!threadRequest.current)void refreshThreads();};
  const timer=setInterval(refresh,22000);document.addEventListener("visibilitychange",refresh);
  return()=>{clearInterval(timer);document.removeEventListener("visibilitychange",refresh);};
 },[refreshThreads]);

 const active=threads.find(t=>t.id===activeId);
 const threadView=historyWindow(threads,visibleThreads,"start");
 const threadRows=active&&!threadView.items.some(thread=>thread.id===active.id)?[active,...threadView.items]:threadView.items;
 const hiddenThreads=threads.length-threadRows.length;
 const messageView=historyWindow(messages,messageWindow.id===activeId?messageWindow.count:MESSAGE_RENDER_STEP,"end");
 async function send(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!activeId||busy||!text.trim())return;
  setBusy(true);setError("");setNotice("");
  try{
    await sendThreadMessage(createClient(),accountId,activeId,text);
    if(!alive.current)return;
    setText("");await loadMessages(activeId);await refreshThreads();
  }catch(e){if(alive.current&&selected.current===activeId){if(e instanceof BookingSessionRequired)router.replace("/login");else setError(e instanceof Error?e.message:"Erro ao enviar.");}}
  finally{if(alive.current)setBusy(false);}
 }
 async function setAvailability(response:"available"|"unavailable"|"ask_later"){
  if(!activeId||busy)return;setBusy(true);setError("");
  try{
    await saveThreadAvailability(createClient(),accountId,activeId,response);
    if(!alive.current)return;
    await refreshThreads();if(selected.current===activeId)setNotice("Disponibilidade atualizada.");
  }catch(e){if(alive.current&&selected.current===activeId){if(e instanceof BookingSessionRequired)router.replace("/login");else setError(e instanceof Error?e.message:"Não foi possível atualizar.");}}
  finally{if(alive.current)setBusy(false);}
 }
 async function savePrefs(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(savingSettings||!settings)return;setSavingSettings(true);setError("");setNotice("");
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
   <Link className="sf-ui-button sf-ui-button-ghost" href="/painel"><ArrowLeft size={15}/> Painel</Link></nav>
  <header className="hiring-heading">
    <span className="eyebrow"><ShieldCheck size={14}/> NEGOCIAÇÃO PRIVADA</span>
    <h1>Conversas de <span className="accent">contratação.</span></h1>
    <p>Consulte datas, converse com músicos e formalize uma proposta de apresentação. Seu WhatsApp pessoal não é divulgado aqui.</p>
    <Link className="sf-ui-button sf-ui-button-ghost" href="/meus-convites">Ver convites de shows</Link>{" "}
    <Button variant="ghost" type="button" aria-expanded={showSettings}
      onClick={()=>setShowSettings(v=>!v)}><Bell size={15}/> Avisos por WhatsApp (opcional)</Button>
  </header>
  {error&&<InlineNotice tone="danger">{error}{" "}
    <Button variant="ghost" onClick={()=>void refreshThreads()}>Atualizar conversas</Button></InlineNotice>}
  {notice&&<InlineNotice tone="success">{notice}</InlineNotice>}
  {showSettings&&<form className="hiring-settings" onSubmit={e=>void savePrefs(e)}>
   <h2>Notificações no WhatsApp</h2>
   {prefsError&&<InlineNotice tone="danger">{prefsError}{" "}<Button variant="ghost" onClick={()=>void loadPrefs().catch(()=>{})}>Tentar novamente</Button></InlineNotice>}
   <p>Quando a API oficial estiver conectada, podemos avisar sobre novas mensagens com um modelo aprovado, direcionando você de volta ao Stage Flow. Sem compartilhar o telefone com outros usuários.</p>
   <label className="hiring-accept"><input type="checkbox" checked={consent} disabled={!settings||savingSettings}
     onChange={e=>setConsent(e.target.checked)}/> Autorizo receber notificações transacionais deste chat pelo WhatsApp. Posso cancelar a qualquer momento.</label>
   {consent&&<Input label="WhatsApp com DDD" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="11 99999-9999" required/>}
   <Button  disabled={savingSettings||!settings} type="submit">Salvar preferência</Button>
   {settings?.opted_in&&<small>Consentimento ativo. O envio automático ainda não foi habilitado.</small>}
  </form>}
  {loading?<div className="hiring-loading"><LoaderCircle size={20}/> Carregando conversas...</div>:
    <div className={"hiring-layout"+(active?" has-active":"")}>
     <aside className="hiring-sidebar" aria-label="Suas conversas">
      <div className="hiring-sidebar-heading"><strong>Caixa de entrada</strong>
       <Button variant="ghost" title="Atualizar conversas" onClick={()=>void refreshThreads()} aria-label="Atualizar conversas"><RefreshCw size={15}/></Button></div>
      <p className="hiring-empty" role="status">{threadRows.length} de {threads.length} conversas recebidas nesta consulta</p>
      {snapshotMayBeLimited(threads.length,THREAD_SNAPSHOT_LIMIT)&&<InlineNotice tone="warning">A consulta atingiu o limite de conversas recentes. Conversas mais antigas podem não aparecer nesta lista.</InlineNotice>}
      {threadRows.map(thread=><button key={thread.id} type="button"
       className={"hiring-thread"+(thread.id===activeId?" is-selected":"")}
       aria-label={"Abrir conversa com "+thread.other_name}
       aria-pressed={thread.id===activeId} onClick={()=>selectThread(thread.id)}>
       <Avatar name={thread.other_name} size="sm"/>
       <span className="hiring-thread-detail"><strong>{thread.other_name}</strong>
        <small>{thread.acting_as==="requester"?"Músico":"Contratante"} · {thread.requested_date?dateBR(thread.requested_date):"Data a combinar"}</small>
        <small>{thread.last_message||"Conversa iniciada — envie sua pergunta"}</small>
       </span>{thread.unread>0&&<Badge tone="warning">{thread.unread}</Badge>}
      </button>)}
      {hiddenThreads>0&&<Button variant="ghost" onClick={()=>setVisibleThreads(n=>n+THREAD_RENDER_STEP)}>Mostrar mais conversas recebidas ({hiddenThreads})</Button>}
      {!threads.length&&!error&&<p className="hiring-empty">Nenhuma conversa por enquanto. Abra um perfil no marketplace de testes para consultar a disponibilidade do músico.</p>}
     </aside>
     <section className="hiring-main" aria-label="Mensagens da conversa">
      {active?<><div className="hiring-chat-header">
        <Button className="hiring-back" variant="ghost" onClick={()=>selectThread(null)}><ArrowLeft size={15}/> Todas as conversas</Button>
        <div><h2>{active.other_name}</h2>
        <p><CalendarDays size={14}/> {active.requested_date?dateBR(active.requested_date):"Data a combinar"}
         <StatusChip label={availabilityLabels[active.availability]} status={active.availability==="available"?"success":active.availability==="unavailable"?"danger":active.availability==="ask_later"?"warning":"neutral"}/></p></div>
        <Button variant="ghost" disabled={messagesLoading} onClick={()=>void loadMessages(active.id)}><RefreshCw size={15}/> Atualizar mensagens</Button>
        {active.event_id&&active.acting_as==="requester"&&<Link className="sf-ui-button sf-ui-button-ghost"
          href={"/eventos?evento="+encodeURIComponent(active.event_id)+"&equipe=1"}>Abrir evento</Link>}
      </div>
      {active.acting_as==="musician"&&<div className="hiring-answers">
       <span><Clock3 size={14}/> Sua disponibilidade:</span>
       <Button variant="ghost" disabled={busy} onClick={()=>void setAvailability("available")}><CheckCircle2 size={14}/> Disponível</Button>
       <Button variant="ghost" disabled={busy} onClick={()=>void setAvailability("unavailable")}>Indisponível</Button>
       <Button variant="ghost" disabled={busy} onClick={()=>void setAvailability("ask_later")}>A combinar</Button>
      </div>}
      <HiringProposals key={active.id} thread={active} onUpdate={()=>{
        void refreshThreads();void loadMessages(active.id);
       }}/>
      <div className="hiring-messages" aria-busy={messagesLoading}>
       {messages.length>0&&<p className="hiring-empty" role="status">{messageView.items.length} de {messages.length} mensagens recebidas nesta consulta</p>}
       {snapshotMayBeLimited(messages.length,MESSAGE_SNAPSHOT_LIMIT)&&<InlineNotice tone="warning">A consulta atingiu o limite de mensagens recentes. Mensagens anteriores podem não estar disponíveis nesta tela.</InlineNotice>}
       {messageView.hidden>0&&<Button variant="ghost" onClick={()=>setMessageWindow({id:active.id,count:(messageWindow.id===active.id?messageWindow.count:MESSAGE_RENDER_STEP)+MESSAGE_RENDER_STEP})}>Mostrar mensagens anteriores recebidas ({messageView.hidden})</Button>}
       {messagesLoading&&<LoadingState label="Carregando mensagens…"/>}
       {messagesError&&<InlineNotice tone="danger">{messagesError}{" "}<Button variant="ghost" onClick={()=>void loadMessages(active.id)}>Tentar novamente</Button></InlineNotice>}
       {!messagesLoading&&!messagesError&&!messages.length&&<p className="hiring-empty">Conversa privada. Pergunte sobre disponibilidade, repertório e cachê. A contratação só acontece após os dois confirmarem os detalhes.</p>}
       {messageView.items.map(message=><article key={message.id}
         className={"hiring-bubble "+(message.is_mine?"mine":"theirs")}>
         <p>{message.body}</p><small>{timeBR(message.created_at)}</small>
       </article>)}
      </div>
      <form className="hiring-composer" onSubmit={e=>void send(e)}>
       <div><Textarea label="Sua mensagem" id="hiring-message" placeholder="Ex.: Você está disponível para tocar neste sábado? Qual seria seu cachê?"
        value={text} onChange={e=>setText(e.target.value)} maxLength={1500} rows={3}
        disabled={busy||messagesLoading} required/>
        <Button type="submit"  disabled={busy||messagesLoading||!text.trim()}>
         <Send size={16}/> Enviar</Button></div>
       <small>O chat não compartilha seu telefone. Use uma proposta formal para confirmar o show; o financeiro continua privado.</small>
      </form></>:<div className="hiring-start-prompt">
       <MessageCircle size={30}/>
       <h2>Selecione uma conversa</h2><p>Escolha uma conversa à esquerda para ver as mensagens e responder.</p>
       <Link href="/marketplace/preview" className="sf-ui-button sf-ui-button-ghost">Marketplace de testes</Link>
      </div>}
     </section>
    </div>}
 </div></main>;
}
