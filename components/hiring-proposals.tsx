"use client";

import {Button,Input,Textarea,InlineNotice,StatusChip} from "@/src/components/ui";
import "@/src/domains/booking/components/booking-ui.css";
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
    <Button type="button" variant="ghost" disabled={busy}
     onClick={()=>setShowForm(v=>!v)}><ClipboardList size={15}/>
      {showForm?"Fechar formulário":"Montar proposta"}
    </Button>}
  </div>
  <p className="hiring-proposals-hint">Converse antes de formalizar. Uma resposta de disponibilidade não significa contratação; o aceite da proposta registra o show e o cachê combinado.</p>
  {readError&&<InlineNotice tone="danger">{readError}</InlineNotice>}
  <Button type="button" variant="ghost" disabled={busy||loading} onClick={()=>void load()}>Atualizar propostas</Button>
  {error&&<InlineNotice tone="danger">{error}</InlineNotice>}
  {notice&&<InlineNotice tone="success">{notice}</InlineNotice>}
  {showForm&&thread.acting_as==="requester"&&!readError&&!loading&&!pending&&!accepted&&
   <form className="hiring-proposals-form" onSubmit={e=>void submit(e)}>
    <fieldset disabled={busy} className="sf-booking-fieldset">
    <Input label="Nome da apresentação *" required minLength={3} maxLength={140} value={title} onChange={e=>setTitle(e.target.value)}
       placeholder="Ex.: Pagode de sábado"/>
    <div className="hiring-proposals-fields">
     <Input label="Data e horário *" required type="datetime-local" value={starts} onChange={e=>{setStarts(e.target.value);setScheduleCheck("idle");}}/>
     <Input label="Cachê combinado (R$, opcional)" value={fee} inputMode="decimal" placeholder="Ex.: 250,00" onChange={e=>setFee(e.target.value)}/>
     <Input label="Local" value={venue} maxLength={140} onChange={e=>setVenue(e.target.value)} placeholder="Nome da casa"/>
     <Input label="Cidade" value={city} maxLength={80} onChange={e=>setCity(e.target.value)} placeholder="Cidade"/>
    </div>
    <div className="hiring-schedule-availability">
     <Button type="button" variant="ghost" onClick={()=>void checkSchedule()}
      disabled={busy||scheduleCheck==="checking"||!starts}>
      <CalendarClock size={15}/> {scheduleCheck==="checking"?"Consultando agenda...":"Verificar conflito antes de enviar"}
     </Button>
     {scheduleCheck!=="idle"&&scheduleCheck!=="checking"&&
      <span className={"hiring-schedule-status "+scheduleCheck}>
       {scheduleCheck==="busy"?"Ocupado: existe um compromisso confirmado":
        scheduleCheck==="possible_conflict"?"Possível conflito: compromisso ainda não confirmado":
        scheduleCheck==="free"?"Sem conflito registrado — confirme com o músico":
        "Não foi possível consultar a agenda"}
      </span>}
    </div>
    <Textarea label="Observações (opcional)" rows={2} maxLength={800} value={details}
      onChange={e=>setDetails(e.target.value)} placeholder="Horário de chegada, formação, repertório, transporte..."/>
    <div className="hiring-proposals-submit">
     <p>Se existir um show vinculado à conversa, a proposta usará esse evento. Caso contrário, o sistema criará um rascunho privado somente após o aceite.</p>
     <Button type="submit"  disabled={busy}>
      {busy?<LoaderCircle size={15}/>:<Send size={15}/>} Enviar proposta
     </Button>
    </div>
    </fieldset>
   </form>}
  {loading?<p className="hiring-proposals-hint">Carregando propostas...</p>:
   readError?null:items.length?<div className="hiring-proposals-list">
    {items.map(p=><article key={p.id} className="hiring-proposal-card">
     <div className="hiring-proposal-top">
      <strong>{p.title}</strong>
      <StatusChip label={statusNames[p.status]} status={p.status==="accepted"?"success":p.status==="pending"?"warning":"neutral"}/>
     </div>
     <p><CalendarClock size={14}/> {when(p.starts_at)}</p>
     {(p.venue||p.city)&&<p>{[p.venue,p.city].filter(Boolean).join(" · ")}</p>}
     <p><strong>{formatFee(p.fee_amount)}</strong></p>
     {p.details&&<p className="hiring-proposal-details">{p.details}</p>}
     {p.status==="pending"&&thread.acting_as==="musician"&&
      <div className="hiring-proposal-actions">
       <Button type="button"  disabled={busy}
        onClick={()=>void decide(p,true)}><CheckCircle2 size={15}/> Aceitar proposta</Button>
       <Button type="button" variant="ghost" disabled={busy}
        onClick={()=>void decide(p,false)}><XCircle size={15}/> Recusar</Button>
      </div>}
     {p.status==="pending"&&thread.acting_as==="requester"&&
      <div className="hiring-proposal-actions">
       <Button type="button" variant="ghost" disabled={busy}
        onClick={()=>void withdraw(p)}><RotateCcw size={14}/> Retirar proposta</Button>
      </div>}
     {p.status==="accepted"&&<div className="hiring-proposal-actions">
       <span className="hiring-proposal-confirmed"><FileCheck2 size={15}/> Participação confirmada</span>
       {p.linked_event_id&&thread.acting_as==="requester"&&
        <Link className="sf-ui-button sf-ui-button-ghost" href={"/eventos?evento="+encodeURIComponent(p.linked_event_id)+"&equipe=1"}>
          Ver show e financeiro
        </Link>}
       {thread.acting_as==="musician"&&<Link className="sf-ui-button sf-ui-button-ghost"
        href={p.linked_event_id?invitationAgendaHref(p.linked_event_id):"/meus-shows"}>
         {p.linked_event_id?"Ver show na agenda":"Meus shows"}</Link>}
      </div>}
    </article>)}
   </div>:<p className="hiring-proposals-empty">Ainda não há proposta formal nesta conversa.</p>}
 </section>;
}

export default function HiringProposals(props:Props){return <HiringProposalsPanel key={props.thread.id} {...props}/>;}
