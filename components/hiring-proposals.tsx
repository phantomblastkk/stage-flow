"use client";

import {useHiringProposals} from "@/src/domains/booking/hooks/use-hiring-proposals";
import Link from "next/link";
import { CalendarClock, CheckCircle2, ClipboardList, FileCheck2, Handshake, LoaderCircle, RotateCcw, Send, XCircle } from "lucide-react";
import { invitationAgendaHref } from "@/src/domains/booking/model/booking-links";
import "./hiring-proposals.css";

import type {HiringThread,ProposalStatus} from "@/src/domains/booking/proposal-types";
type Props={thread:HiringThread; onUpdate?:()=>void};
const brl=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
const formatFee=(fee:number|null)=>fee==null?"Cachê a combinar":brl.format(fee);
const when=(date:string)=>new Date(date).toLocaleString("pt-BR",{
  dateStyle:"medium",timeStyle:"short",timeZone:"America/Sao_Paulo"
});
const statusNames:Record<ProposalStatus,string>={
  pending:"Aguardando resposta",accepted:"Aceita",declined:"Recusada",withdrawn:"Retirada"
};
function HiringProposalsPanel({thread,onUpdate}:Props){
 const {items,loading,busy,error,notice,readError,showForm,setShowForm,title,setTitle,venue,setVenue,city,setCity,starts,setStarts,fee,setFee,details,setDetails,scheduleCheck,setScheduleCheck,load,checkSchedule,submit,decide,withdraw}=useHiringProposals(thread,onUpdate);

 const pending=items.find(x=>x.status==="pending");
 const accepted=items.find(x=>x.status==="accepted");
 return <section className="hiring-proposals" aria-label="Propostas da conversa">
  <div className="hiring-proposals-header">
   <div><span><Handshake size={16}/> NEGOCIAÇÃO FORMAL</span>
    <h3>Propostas de show</h3></div>
   {thread.acting_as==="requester"&&!readError&&!loading&&!pending&&!accepted&&
    <button type="button" className="btn btn-quiet" disabled={busy}
     onClick={()=>setShowForm(v=>!v)}><ClipboardList size={15}/>
      {showForm?"Fechar formulário":"Montar proposta"}
    </button>}
  </div>
  <p className="hiring-proposals-hint">Converse antes de formalizar. Uma resposta de disponibilidade não significa contratação; o aceite da proposta registra o show e o cachê combinado.</p>
  {readError&&<div className="hiring-proposals-error" role="alert">{readError}</div>}
  <button type="button" className="btn btn-quiet" disabled={busy||loading} onClick={()=>void load()}>Atualizar propostas</button>
  {error&&<p className="hiring-proposals-error" role="alert">{error}</p>}
  {notice&&<p className="hiring-proposals-notice" role="status">{notice}</p>}
  {showForm&&thread.acting_as==="requester"&&!readError&&!loading&&!pending&&!accepted&&
   <form className="hiring-proposals-form" onSubmit={e=>void submit(e)}>
    <fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0,display:"contents"}}>
    <label>Nome da apresentação *
      <input required minLength={3} maxLength={140} value={title} onChange={e=>setTitle(e.target.value)}
       placeholder="Ex.: Pagode de sábado"/>
    </label>
    <div className="hiring-proposals-fields">
     <label>Data e horário *
      <input required type="datetime-local" value={starts} onChange={e=>{setStarts(e.target.value);setScheduleCheck("idle");}}/>
     </label>
     <label>Cachê combinado (R$, opcional)
      <input value={fee} inputMode="decimal" placeholder="Ex.: 250,00" onChange={e=>setFee(e.target.value)}/>
     </label>
     <label>Local
      <input value={venue} maxLength={140} onChange={e=>setVenue(e.target.value)} placeholder="Nome da casa"/>
     </label>
     <label>Cidade
      <input value={city} maxLength={80} onChange={e=>setCity(e.target.value)} placeholder="Cidade"/>
     </label>
    </div>
    <div className="hiring-schedule-availability">
     <button type="button" className="btn btn-quiet" onClick={()=>void checkSchedule()}
      disabled={busy||scheduleCheck==="checking"||!starts}>
      <CalendarClock size={15}/> {scheduleCheck==="checking"?"Consultando agenda...":"Verificar conflito antes de enviar"}
     </button>
     {scheduleCheck!=="idle"&&scheduleCheck!=="checking"&&
      <span className={"hiring-schedule-status "+scheduleCheck}>
       {scheduleCheck==="busy"?"Ocupado: existe um compromisso confirmado":
        scheduleCheck==="possible_conflict"?"Possível conflito: compromisso ainda não confirmado":
        scheduleCheck==="free"?"Sem conflito registrado — confirme com o músico":
        "Não foi possível consultar a agenda"}
      </span>}
    </div>
    <label>Observações (opcional)
     <textarea rows={2} maxLength={800} value={details}
      onChange={e=>setDetails(e.target.value)} placeholder="Horário de chegada, formação, repertório, transporte..."/>
    </label>
    <div className="hiring-proposals-submit">
     <p>Se existir um show vinculado à conversa, a proposta usará esse evento. Caso contrário, o sistema criará um rascunho privado somente após o aceite.</p>
     <button type="submit" className="btn btn-primary" disabled={busy}>
      {busy?<LoaderCircle size={15}/>:<Send size={15}/>} Enviar proposta
     </button>
    </div>
    </fieldset>
   </form>}
  {loading?<p className="hiring-proposals-hint">Carregando propostas...</p>:
   readError?null:items.length?<div className="hiring-proposals-list">
    {items.map(p=><article key={p.id} className="hiring-proposal-card">
     <div className="hiring-proposal-top">
      <strong>{p.title}</strong>
      <span className={"hiring-proposal-status is-"+p.status}>{statusNames[p.status]}</span>
     </div>
     <p><CalendarClock size={14}/> {when(p.starts_at)}</p>
     {(p.venue||p.city)&&<p>{[p.venue,p.city].filter(Boolean).join(" · ")}</p>}
     <p><strong>{formatFee(p.fee_amount)}</strong></p>
     {p.details&&<p className="hiring-proposal-details">{p.details}</p>}
     {p.status==="pending"&&thread.acting_as==="musician"&&
      <div className="hiring-proposal-actions">
       <button type="button" className="btn btn-primary" disabled={busy}
        onClick={()=>void decide(p,true)}><CheckCircle2 size={15}/> Aceitar proposta</button>
       <button type="button" className="btn btn-quiet" disabled={busy}
        onClick={()=>void decide(p,false)}><XCircle size={15}/> Recusar</button>
      </div>}
     {p.status==="pending"&&thread.acting_as==="requester"&&
      <div className="hiring-proposal-actions">
       <button type="button" className="btn btn-quiet" disabled={busy}
        onClick={()=>void withdraw(p)}><RotateCcw size={14}/> Retirar proposta</button>
      </div>}
     {p.status==="accepted"&&<div className="hiring-proposal-actions">
       <span className="hiring-proposal-confirmed"><FileCheck2 size={15}/> Participação confirmada</span>
       {p.linked_event_id&&thread.acting_as==="requester"&&
        <Link className="btn btn-quiet" href={"/eventos?evento="+encodeURIComponent(p.linked_event_id)+"&equipe=1"}>
          Ver show e financeiro
        </Link>}
       {thread.acting_as==="musician"&&<Link className="btn btn-quiet"
        href={p.linked_event_id?invitationAgendaHref(p.linked_event_id):"/meus-shows"}>
         {p.linked_event_id?"Ver show na agenda":"Meus shows"}</Link>}
      </div>}
    </article>)}
   </div>:<p className="hiring-proposals-empty">Ainda não há proposta formal nesta conversa.</p>}
 </section>;
}

export default function HiringProposals(props:Props){return <HiringProposalsPanel key={props.thread.id} {...props}/>;}
