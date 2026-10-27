"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
 ArrowLeft, CalendarDays, CheckCheck, CheckCircle2, ClipboardCheck,
 Clock3, CircleAlert, CircleCheck, FileText, LoaderCircle,
 MapPin, MessageCircle, Bell, Plus, RefreshCw, Save, ShieldCheck, Trash2, Truck, Users,
 Wallet, Wrench, X, RotateCcw
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import EventBudgetPanel from "@/components/event-budget-panel";
import "./operacao.css";

type Category = "preparation"|"logistics"|"soundcheck"|"show"|"closing";
type Task={
 id:string;category:Category;title:string;notes:string|null;
 responsible:string|null;due_at:string|null;
 done:boolean;completed_at:string|null;template_code:string|null;
};
type Briefing={
 arrival_at:string|null;soundcheck_at:string|null;doors_at:string|null;
 meeting_point:string|null;contact_name:string|null;
 transport_plan:string|null;equipment_plan:string|null;
};
type Overview={
 status:"ok"|"forbidden"|"login_required";
 can_edit:boolean;
 event:{id:string;title:string;starts_at:string;venue:string|null;city:string|null;status:string};
 briefing:Briefing;
 private_details:{backstage_notes:string|null;closing_notes:string|null;closed_at:string|null;updated_at:string|null}|null;
 tasks:Task[];
 progress:{count:number;done:number;pending:number;overdue:number}|null;
};
const categories:Record<Category,string>={
 preparation:"Preparação",logistics:"Transporte e logística",
 soundcheck:"Passagem de som",show:"Dia do show",closing:"Pós-show"
};
const emptyTask=()=>({
 id:"",category:"preparation" as Category,title:"",notes:"",responsible:"",due_at:""
});
const humanDate=(value:string)=>new Intl.DateTimeFormat("pt-BR",{
 timeZone:"America/Sao_Paulo",dateStyle:"medium",timeStyle:"short"
}).format(new Date(value));
const localInput=(value:string|null)=>{
 if(!value)return "";
 return new Intl.DateTimeFormat("sv-SE",{timeZone:"America/Sao_Paulo",
 year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",
 hour12:false}).format(new Date(value)).replace(" ","T");
};
function asISO(raw:string){
 if(!raw.trim())return null;
 const dt=new Date(raw+"-03:00");
 return Number.isNaN(dt.getTime())?undefined:dt.toISOString();
}
const dayStatus:Record<string,string>={
 draft:"Rascunho",published:"Publicado",completed:"Concluído",cancelled:"Cancelado"
};
const issues:Record<string,string>={
 forbidden:"Somente o organizador pode fazer essa alteração.",
 cancelled:"Este show foi cancelado. As informações estão preservadas para consulta.",
 invalid:"Revise os campos e os horários informados.",
 not_found:"Registro não encontrado neste show.",
 limit_reached:"Limite de 100 atividades por show atingido.",
 not_yet:"O fechamento final só pode ser feito após o horário do show.",
 closing_pending:"Conclua as tarefas de pós-show antes de encerrar a operação."
};
function friendly(status:unknown){
 return issues[String(status)]||"Não foi possível salvar a alteração. Atualize a página e tente novamente.";
}

export default function OperationPage(){
 const router=useRouter();
 const [eventId,setEventId]=useState("");
 const [data,setData]=useState<Overview|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [arrival,setArrival]=useState("");
 const [soundcheck,setSoundcheck]=useState("");
 const [doors,setDoors]=useState("");
 const [meetingPoint,setMeetingPoint]=useState("");
 const [contact,setContact]=useState("");
 const [transport,setTransport]=useState("");
 const [equipment,setEquipment]=useState("");
 const [backstage,setBackstage]=useState("");
 const [closing,setClosing]=useState("");
 const [task,setTask]=useState(emptyTask);
 const [taskForm,setTaskForm]=useState(false);
 const [financeOpen,setFinanceOpen]=useState(false);
 const [quickRefreshing,setQuickRefreshing]=useState(false);
 const [copying,setCopying]=useState(false);

 const refresh=useCallback(async(id:string)=>{
  const {data:next,error:rpcError}=await createClient().rpc(
   "stage_show_ops_overview",{p_event_id:id}
  );
  if(rpcError)throw rpcError;
  if(!next||next.status!=="ok")throw Error(friendly(next?.status));
  const info=next as Overview;
  setData(info);
  setArrival(localInput(info.briefing.arrival_at));
  setSoundcheck(localInput(info.briefing.soundcheck_at));
  setDoors(localInput(info.briefing.doors_at));
  setMeetingPoint(info.briefing.meeting_point||"");
  setContact(info.briefing.contact_name||"");
  setTransport(info.briefing.transport_plan||"");
  setEquipment(info.briefing.equipment_plan||"");
  setBackstage(info.private_details?.backstage_notes||"");
  setClosing(info.private_details?.closing_notes||"");
  return info;
 },[]);
 useEffect(()=>{
  let active=true;
  const id=new URLSearchParams(window.location.search).get("evento")||"";
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)){
   setError("Abra este painel a partir de uma apresentação da agenda.");
   setLoading(false);return;
  }
  setEventId(id);
  void (async()=>{
   try{
    const {data:{user},error:authError}=await createClient().auth.getUser();
    if(!active)return;
    if(!user&&!authError){router.replace("/login");return;}
    if(authError){throw Error("Não foi possível validar sua sessão. Sua conta não foi desconectada; tente novamente.");}
    await refresh(id);
   }catch(e){if(active)setError(e instanceof Error?e.message:"Erro ao carregar a operação.");}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[router,refresh]);
 async function execute(
  key:string,
  rpc:()=>PromiseLike<{data:unknown;error:{message:string}|null}>,
  success:string,
  afterSuccess?:()=>void
 ){
  if(busy||!eventId)return;
  setBusy(key);setError("");setNotice("");
  try{
   const {data:result,error:rpcError}=await rpc();
   if(rpcError)throw Error(rpcError.message);
   const status=typeof result==="string"?result:
    (result&&typeof result==="object"&&"status" in result)?String(result.status):"invalid";
   if(status!=="ok"&&status!=="saved"&&status!=="removed")throw Error(friendly(status));
   await refresh(eventId);
   setNotice(success);
   afterSuccess?.();
  }catch(e){setError(e instanceof Error?e.message:"Erro ao salvar.");}
  finally{setBusy("");}
 }
 const cancelled=data?.event.status==="cancelled";
 const owner=!!data?.can_edit;
 const canEdit=owner&&!cancelled;

 function saveBrief(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  const parsed=[arrival,soundcheck,doors].map(asISO);
  if(parsed.some(v=>v===undefined)){setError("Revise os horários de chegada e passagem de som.");return;}
  void execute("brief",()=>createClient().rpc("stage_show_ops_save",{
   p_event_id:eventId,p_arrival_at:parsed[0],p_soundcheck_at:parsed[1],
   p_doors_at:parsed[2],p_meeting_point:meetingPoint.trim()||null,
   p_contact_name:contact.trim()||null,p_transport_plan:transport.trim()||null,
   p_equipment_plan:equipment.trim()||null,p_backstage_notes:backstage.trim()||null
  }),"Informações do show atualizadas. Músicos com convite aceito verão apenas o briefing logístico.");
 }
 function saveTask(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  const due=asISO(task.due_at);
  if(due===undefined){setError("A data de vencimento é inválida.");return;}
  void execute("task",()=>createClient().rpc("stage_show_ops_task_save",{
   p_event_id:eventId,p_task_id:task.id||null,p_category:task.category,
   p_title:task.title.trim(),p_notes:task.notes.trim()||null,
   p_responsible:task.responsible.trim()||null,p_due_at:due
  }),task.id?"Atividade atualizada.":"Atividade adicionada.",()=>{
    setTask(emptyTask());
    setTaskForm(false);
  });
 }
 function toggleTask(item:Task){
  void execute(item.id,()=>createClient().rpc("stage_show_ops_task_toggle",{
    p_event_id:eventId,p_task_id:item.id,p_done:!item.done
  }),item.done?"Atividade reaberta.":"Atividade concluída.");
 }
 function removeTask(item:Task){
  if(!window.confirm("Excluir esta atividade do checklist?"))return;
  void execute(item.id,()=>createClient().rpc("stage_show_ops_task_remove",{
   p_event_id:eventId,p_task_id:item.id
  }),"Atividade removida.");
 }
 function closeOps(reopen:boolean){
  if(!reopen&&!window.confirm("Encerrar a operação deste show? O evento e o financeiro não serão alterados."))return;
  void execute("close",()=>createClient().rpc("stage_show_ops_close",{
   p_event_id:eventId,p_notes:closing.trim()||null,p_reopen:reopen
  }),reopen?"Fechamento reaberto para revisão.":"Pós-show encerrado. O histórico e o financeiro continuam disponíveis.");
 }
 async function updateDayBriefing(){
  if(!eventId||quickRefreshing)return;
  setQuickRefreshing(true);setError("");setNotice("");
  try{
   await refresh(eventId);
   setNotice("Informações atualizadas. Consulte os horários e a logística abaixo.");
  }catch(e){
   setError(e instanceof Error?e.message:"Não foi possível atualizar o briefing.");
  }finally{setQuickRefreshing(false);}
 }
 async function copyDayBriefing(){
  if(!data||copying)return;
  const event=data.event,info=data.briefing;
  // Only the approved participant's logistical RPC fields are included.
  // Never copy production tasks, private notes or financial information.
  const lines=[
   "StageFlow — Resumo do dia do show",
   "Show: "+event.title,
   "Início: "+humanDate(event.starts_at),
   "Chegada: "+(info.arrival_at?humanDate(info.arrival_at):"A combinar"),
   "Passagem de som: "+(info.soundcheck_at?humanDate(info.soundcheck_at):"A combinar"),
   "Abertura das portas: "+(info.doors_at?humanDate(info.doors_at):"A combinar"),
   "Local: "+([event.venue,event.city].filter(Boolean).join(" · ")||"A confirmar"),
   "Ponto de encontro: "+(info.meeting_point||"A combinar"),
   "Contato no local: "+(info.contact_name||"A combinar"),
   "Transporte: "+(info.transport_plan||"A combinar"),
   "Equipamentos: "+(info.equipment_plan||"A combinar")
  ];
  setCopying(true);setError("");setNotice("");
  try{
   if(!navigator.clipboard?.writeText)throw Error("Cópia não disponível neste navegador.");
   await navigator.clipboard.writeText(lines.join("\\n"));
   setNotice("Resumo do show copiado. Confira as notificações para eventuais alterações.");
  }catch(e){
   setError(e instanceof Error?e.message:"Não foi possível copiar o resumo.");
  }finally{setCopying(false);}
 }
 const tasks=data?.tasks||[];
 const total=data?.progress?.count||0;
 const done=data?.progress?.done||0;
 const percent=total?Math.round(done*100/total):0;
 const grouped=(Object.keys(categories) as Category[]).map(key=>({
   key,title:categories[key],items:tasks.filter(t=>t.category===key)
 })).filter(group=>group.items.length);
 return <main className="operations-page"><div className="container">
  <nav className="nav">
   <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
   <Link className="btn btn-quiet" href="/eventos"><ArrowLeft size={15}/> Agenda</Link>
  </nav>
  <header className="operations-hero">
   <span className="eyebrow"><ClipboardCheck size={15}/> ORGANIZAÇÃO DE CADA APRESENTAÇÃO</span>
   <h1>Operação do <span className="accent">show.</span></h1>
   <p>Do planejamento ao pós-show: horários, equipamento, transporte, tarefas, responsáveis e fechamento, sem duplicar o financeiro.</p>
  </header>
  {error&&<p className="ops-feedback error" role="alert">{error}</p>}
  {notice&&<p className="ops-feedback" role="status">{notice}</p>}
  {loading?<p className="ops-loading"><LoaderCircle size={17}/> Carregando informações do show...</p>:
   data&&<div className="ops-sections">
    <section className="ops-heading-card">
     <div><h2>{data.event.title}</h2>
      <p><CalendarDays size={15}/> {humanDate(data.event.starts_at)} · {dayStatus[data.event.status]||data.event.status}</p>
      {(data.event.venue||data.event.city)&&<p><MapPin size={15}/> {[data.event.venue,data.event.city].filter(Boolean).join(" · ")}</p>}
     </div>
     <Link href={owner?"/eventos/equipe?evento="+encodeURIComponent(eventId):"/meus-shows"} className="btn btn-quiet">
       <Users size={15}/>{owner?"Equipe do show":"Meus shows"}
     </Link>
    </section>
    {owner&&<section className="ops-summary">
     <div><strong>{percent}%</strong><span>Checklist concluído</span></div>
     <div><strong>{done}/{total}</strong><span>Tarefas realizadas</span></div>
     <div><strong>{data.progress?.overdue||0}</strong><span>Com prazo vencido</span></div>
     <div><strong>{data.private_details?.closed_at?"Encerrado":"Em andamento"}</strong><span>Fechamento operacional</span></div>
    </section>}
    {!owner&&<section className="ops-day-quick" id="dia-do-show" aria-labelledby="ops-day-title">
     <header className="ops-day-top">
      <div>
       <span className="eyebrow"><ShieldCheck size={15}/> SEU BRIEFING CONFIRMADO</span>
       <h2 id="ops-day-title">Dia do show, sem correria.</h2>
       <p>O essencial para chegar preparado. Horários exibidos no fuso de Brasília.</p>
      </div>
      <div className="ops-day-actions">
       <button type="button" className="btn btn-quiet" disabled={quickRefreshing||copying}
        onClick={()=>void updateDayBriefing()}>
        {quickRefreshing?<LoaderCircle size={15}/>:<RefreshCw size={15}/>}
        {quickRefreshing?"Atualizando...":"Atualizar informações"}
       </button>
       <button type="button" className="btn btn-primary" disabled={quickRefreshing||copying}
        onClick={()=>void copyDayBriefing()}>
        {copying?<LoaderCircle size={15}/>:<ClipboardCheck size={15}/>}
        {copying?"Copiando...":"Copiar resumo"}
       </button>
      </div>
     </header>
     <div className="ops-day-times" aria-label="Horários da apresentação">
      <div><span>Chegada da equipe</span><strong>{data.briefing.arrival_at?humanDate(data.briefing.arrival_at):"A combinar"}</strong></div>
      <div><span>Passagem de som</span><strong>{data.briefing.soundcheck_at?humanDate(data.briefing.soundcheck_at):"A combinar"}</strong></div>
      <div><span>Abertura das portas</span><strong>{data.briefing.doors_at?humanDate(data.briefing.doors_at):"A combinar"}</strong></div>
      <div><span>Início da apresentação</span><strong>{humanDate(data.event.starts_at)}</strong></div>
     </div>
     <div className="ops-day-details">
      <div><strong><MapPin size={16}/> Local informado</strong>
       <p>{[data.event.venue,data.event.city].filter(Boolean).join(" · ")||"Local a confirmar"}</p>
       <small>O endereço completo não está disponível neste briefing. Confirme o acesso exato com a organização.</small>
      </div>
      <div><strong><Users size={16}/> Ponto de encontro</strong><p>{data.briefing.meeting_point||"A combinar"}</p></div>
      <div><strong><MessageCircle size={16}/> Contato no local</strong><p>{data.briefing.contact_name||"A combinar"}</p></div>
      <div><strong><Truck size={16}/> Transporte</strong><p>{data.briefing.transport_plan||"A combinar"}</p></div>
      <div><strong><Wrench size={16}/> Equipamentos</strong><p>{data.briefing.equipment_plan||"A combinar"}</p></div>
     </div>
     <div className="ops-day-footer">
      <p><ShieldCheck size={16}/> Apenas informações logísticas do seu convite aceito. Sem custos, cachês ou anotações privadas.</p>
      <Link className="btn btn-quiet" href="/notificacoes"><Bell size={15}/> Ver notificações</Link>
     </div>
    </section>}
    {!owner&&<p className="ops-privacy"><ShieldCheck size={17}/> Briefing da sua apresentação confirmada. As tarefas internas, custos e pagamentos do organizador são privados. Se os horários ou a logística mudarem, você receberá um aviso na Central de Notificações.</p>}
    {cancelled&&<p className="ops-privacy"><CircleAlert size={17}/> Show cancelado: informações preservadas apenas para consulta.</p>}
    <section className="ops-panel">
     <h2><Clock3 size={19}/> Horários e informações para a equipe</h2>
     {owner?<form onSubmit={saveBrief} className="ops-form">
      <div className="ops-grid-three">
       <label>Chegada da equipe
        <input type="datetime-local" value={arrival} disabled={!canEdit||!!busy}
         onChange={e=>setArrival(e.target.value)}/>
       </label>
       <label>Passagem de som
        <input type="datetime-local" value={soundcheck} disabled={!canEdit||!!busy}
         onChange={e=>setSoundcheck(e.target.value)}/>
       </label>
       <label>Abertura das portas
        <input type="datetime-local" value={doors} disabled={!canEdit||!!busy}
         onChange={e=>setDoors(e.target.value)}/>
       </label>
      </div>
      <div className="ops-grid-two">
       <label>Ponto de encontro
        <input value={meetingPoint} disabled={!canEdit||!!busy} maxLength={180}
         onChange={e=>setMeetingPoint(e.target.value)} placeholder="Ex.: entrada lateral do palco"/>
       </label>
       <label>Responsável pelo contato no local
        <input value={contact} disabled={!canEdit||!!busy} maxLength={100}
         onChange={e=>setContact(e.target.value)} placeholder="Ex.: produção do evento"/>
       </label>
      </div>
      <div className="ops-grid-two">
       <label><Truck size={14}/> Instruções de transporte
        <textarea rows={3} maxLength={600} disabled={!canEdit||!!busy}
          value={transport} onChange={e=>setTransport(e.target.value)}
          placeholder="Ponto de saída, estacionamento, carregamento..."/>
       </label>
       <label><Wrench size={14}/> Equipamentos e rider
        <textarea rows={3} maxLength={600} disabled={!canEdit||!!busy}
          value={equipment} onChange={e=>setEquipment(e.target.value)}
          placeholder="PA, microfones, cabos, instrumentos, retornos..."/>
       </label>
      </div>
      <label>Anotações privadas da produção
       <textarea rows={2} maxLength={600} disabled={!canEdit||!!busy}
        value={backstage} onChange={e=>setBackstage(e.target.value)}
        placeholder="Somente o organizador vê estas informações."/>
      </label>
      {canEdit&&<button className="btn btn-primary" type="submit" disabled={!!busy}>
       {busy==="brief"?<LoaderCircle size={15}/>:<Save size={15}/>} Salvar briefing
      </button>}
      <small className="ops-help">Somente horários e informações logísticas são compartilhados com músicos que aceitaram o convite. Mudanças nesses dados geram avisos na Central de Notificações dos músicos confirmados. Anotações privadas não geram avisos; nenhum WhatsApp ou push é enviado.</small>
     </form>:<div className="ops-brief">
      <div><span>Chegada</span><strong>{data.briefing.arrival_at?humanDate(data.briefing.arrival_at):"A combinar"}</strong></div>
      <div><span>Passagem de som</span><strong>{data.briefing.soundcheck_at?humanDate(data.briefing.soundcheck_at):"A combinar"}</strong></div>
      <div><span>Abertura das portas</span><strong>{data.briefing.doors_at?humanDate(data.briefing.doors_at):"A combinar"}</strong></div>
      <div><span>Encontro</span><strong>{data.briefing.meeting_point||"A combinar"}</strong></div>
      <div><span>Contato no local</span><strong>{data.briefing.contact_name||"A combinar"}</strong></div>
      <div><span>Transporte</span><strong>{data.briefing.transport_plan||"A combinar"}</strong></div>
      <div><span>Equipamentos</span><strong>{data.briefing.equipment_plan||"A combinar"}</strong></div>
     </div>}
    </section>
    {owner&&<>
     <section className="ops-panel">
      <div className="ops-panel-heading">
       <div><h2><CheckCheck size={19}/> Checklist de produção</h2>
        <p>Responsáveis, prazos e atividades por etapa do show. Só o organizador pode editar.</p></div>
       {canEdit&&<div className="ops-actions">
        <button type="button" className="btn btn-quiet" disabled={!!busy}
         onClick={()=>void execute("seed",()=>createClient().rpc("stage_show_ops_seed",{p_event_id:eventId}),
          "Modelo de checklist adicionado. Atividades existentes foram preservadas.")}>
         <ClipboardCheck size={15}/> Criar checklist inicial</button>
        <button type="button" className="btn btn-quiet" disabled={!!busy}
         onClick={()=>{setTask(emptyTask());setTaskForm(v=>!v);}}>
         {taskForm?<X size={15}/>:<Plus size={15}/>} {taskForm?"Fechar":"Nova tarefa"}</button>
       </div>}
      </div>
      {taskForm&&canEdit&&<form onSubmit={saveTask} className="ops-task-editor">
       <h3>{task.id?"Editar atividade":"Adicionar atividade"}</h3>
       <div className="ops-grid-two">
        <label>Etapa
         <select value={task.category} onChange={e=>setTask(t=>({...t,category:e.target.value as Category}))}
          disabled={!!busy}>{(Object.keys(categories) as Category[]).map(key=>
          <option key={key} value={key}>{categories[key]}</option>)}</select>
        </label>
        <label>Prazo (opcional)
         <input type="datetime-local" value={task.due_at} disabled={!!busy}
          onChange={e=>setTask(t=>({...t,due_at:e.target.value}))}/>
        </label>
       </div>
       <label>Atividade
        <input value={task.title} required minLength={3} maxLength={140} disabled={!!busy}
         onChange={e=>setTask(t=>({...t,title:e.target.value}))}
         placeholder="Ex.: confirmar lista de equipamentos"/>
       </label>
       <div className="ops-grid-two">
        <label>Responsável (opcional)
         <input value={task.responsible} maxLength={100} disabled={!!busy}
          onChange={e=>setTask(t=>({...t,responsible:e.target.value}))}
          placeholder="Ex.: produtor / técnico de som"/>
        </label>
        <label>Observações (opcional)
         <input value={task.notes} maxLength={500} disabled={!!busy}
          onChange={e=>setTask(t=>({...t,notes:e.target.value}))}/>
        </label>
       </div>
       <div className="ops-actions">
        <button type="submit" className="btn btn-primary" disabled={!!busy||task.title.trim().length<3}>
         <Save size={15}/> Salvar atividade</button>
        <button type="button" className="btn btn-quiet" onClick={()=>{setTask(emptyTask());setTaskForm(false);}}>
         Cancelar</button>
       </div>
      </form>}
      {tasks.length===0?<div className="ops-empty">
       <ClipboardCheck size={26}/>
       <p>Nenhuma atividade cadastrada ainda. Use o modelo inicial ou adicione uma tarefa personalizada.</p>
      </div>:<div className="ops-task-groups">
       {grouped.map(group=><div key={group.key} className="ops-task-group">
        <h3>{group.title}</h3>
        {group.items.map(item=><article key={item.id} className={"ops-task"+(item.done?" done":"")}>
         <button type="button" className="ops-task-check" disabled={!canEdit||!!busy}
          aria-label={(item.done?"Reabrir ":"Concluir ")+item.title}
          aria-pressed={item.done} onClick={()=>toggleTask(item)}>
          {item.done?<CheckCircle2 size={20}/>:<span className="ops-check-empty"/>}</button>
         <div className="ops-task-main">
          <strong>{item.title}</strong>
          {item.notes&&<p>{item.notes}</p>}
          <small>
           {item.responsible&&<span><Users size={12}/>{item.responsible}</span>}
           {item.due_at&&<span className={!item.done&&new Date(item.due_at).getTime()<Date.now()?"ops-overdue":""}>
            <Clock3 size={12}/>{humanDate(item.due_at)}</span>}
           {item.done&&<span><CircleCheck size={12}/> Concluída</span>}
          </small>
         </div>
         {canEdit&&<div className="ops-task-controls">
          <button type="button" className="btn btn-quiet" disabled={!!busy}
           onClick={()=>{setTask({id:item.id,category:item.category,title:item.title,
            notes:item.notes||"",responsible:item.responsible||"",due_at:localInput(item.due_at)});
            setTaskForm(true);window.scrollTo({top:440,behavior:"smooth"});}}>Editar</button>
          <button type="button" className="btn btn-quiet" disabled={!!busy}
           aria-label={"Excluir "+item.title} onClick={()=>removeTask(item)}><Trash2 size={15}/></button>
         </div>}
        </article>)}
       </div>)}
      </div>}
     </section>
     <section className="ops-panel">
      <div className="ops-panel-heading">
       <div><h2><Wallet size={19}/> Despesas e recebimentos</h2>
        <p>Transporte, alimentação, equipamentos e cachês são gerenciados pelo financeiro original deste show, sem lançamentos duplicados.</p></div>
       <button type="button" className="btn btn-quiet" aria-expanded={financeOpen}
        onClick={()=>setFinanceOpen(v=>!v)}>
        <Wallet size={15}/>{financeOpen?"Fechar financeiro":"Abrir financeiro"}
       </button>
      </div>
      {financeOpen&&<EventBudgetPanel eventId={eventId}/>}
      <Link className="ops-link" href="/financeiro">Ver painel financeiro geral</Link>
     </section>
     <section className="ops-panel">
      <h2><FileText size={19}/> Encerramento pós-show</h2>
      <p className="ops-helper">Registre aprendizados e ocorrências. O fechamento operacional é independente do status do evento e não confirma pagamentos.</p>
      <label>Resumo do pós-show (privado)
       <textarea rows={4} maxLength={1200} value={closing} disabled={!canEdit||!!busy}
        onChange={e=>setClosing(e.target.value)}
        placeholder="O que funcionou, imprevistos, melhorias para a próxima apresentação..."/>
      </label>
      <div className="ops-close-actions">
       {data.private_details?.closed_at&&<span><CheckCircle2 size={16}/> Encerrado em {humanDate(data.private_details.closed_at)}</span>}
       {canEdit&&(data.private_details?.closed_at?
        <button type="button" className="btn btn-quiet" disabled={!!busy}
         onClick={()=>closeOps(true)}><RotateCcw size={15}/> Reabrir fechamento</button>:
        <button type="button" className="btn btn-primary" disabled={!!busy}
         onClick={()=>closeOps(false)}><CheckCheck size={15}/> Encerrar operação</button>)}
      </div>
      <small className="ops-help">Para encerrar, o show precisa ter começado e as tarefas de pós-show devem estar concluídas. Nenhuma transferência financeira é realizada.</small>
     </section>
    </>}
   </div>}
 </div></main>;
}
