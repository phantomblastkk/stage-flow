"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, CheckCircle2, ClipboardList, FileCheck2, Handshake, LoaderCircle, RotateCcw, Send, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./hiring-proposals.css";

type HiringThread = {
  id:string;requested_date:string|null;event_id:string|null;
  availability:"awaiting"|"available"|"unavailable"|"ask_later";
  acting_as:"requester"|"musician";
};
type ProposalStatus="pending"|"accepted"|"declined"|"withdrawn";
type Proposal={
  id:string; title:string;venue:string|null;city:string|null;
  starts_at:string;fee_amount:number|null;details:string|null;
  status:ProposalStatus;created_at:string;responded_at:string|null;
  linked_event_id:string|null;linked_invitation_id:string|null
};
type Props={thread:HiringThread; onUpdate?:()=>void};
const brl=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
const formatFee=(fee:number|null)=>fee==null?"Cachê a combinar":brl.format(fee);
const when=(date:string)=>new Date(date).toLocaleString("pt-BR",{
  dateStyle:"medium",timeStyle:"short",timeZone:"America/Sao_Paulo"
});
const statusNames:Record<ProposalStatus,string>={
  pending:"Aguardando resposta",accepted:"Aceita",declined:"Recusada",withdrawn:"Retirada"
};
function initialDate(day:string|null){
  if(!day)return "";
  return day+"T18:00";
}
function parseFee(raw:string){
  const cleaned=raw.trim();
  if(!cleaned)return null;
  if(!/^\d+(?:[.,]\d{1,2})?$/.test(cleaned))return undefined;
  const amount=Number(cleaned.replace(",","."));
  return amount>0&&amount<=999999.99?amount:undefined;
}

export default function HiringProposals({thread,onUpdate}:Props){
 const [items,setItems]=useState<Proposal[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [showForm,setShowForm]=useState(false);
 const [title,setTitle]=useState("");
 const [venue,setVenue]=useState("");
 const [city,setCity]=useState("");
 const [starts,setStarts]=useState(()=>initialDate(thread.requested_date));
 const [fee,setFee]=useState("");
 const [details,setDetails]=useState("");

 const load=useCallback(async()=>{
  const {data,error:rpcError}=await createClient().rpc("stage_hiring_proposals",{
   p_thread_id:thread.id
  });
  if(rpcError)throw rpcError;
  if(data?.status!=="ok"||!Array.isArray(data.items))throw Error("Não foi possível carregar as propostas.");
  setItems(data.items as Proposal[]);
 },[thread.id]);
 useEffect(()=>{
  let alive=true;
  setLoading(true);setItems([]);setError("");setShowForm(false);
  setTitle("");setVenue("");setCity("");setDetails("");setFee("");
  setStarts(initialDate(thread.requested_date));
  void load().catch(e=>{if(alive)setError(e instanceof Error?e.message:"Não foi possível carregar as propostas.");})
   .finally(()=>{if(alive)setLoading(false);});
  if(thread.event_id&&thread.acting_as==="requester") {
    void createClient().rpc("stage_hiring_proposal_prefill",{p_thread_id:thread.id})
      .then(({data,error})=>{
        if(!alive||error||data?.status!=="ok"||!data.event)return;
        const saved=data.event as {title:string;venue:string|null;city:string|null;starts_at:string};
        setTitle(saved.title||"");
        setVenue(saved.venue||"");
        setCity(saved.city||"");
        const local=new Intl.DateTimeFormat("sv-SE",{
          timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",
          day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false
        }).format(new Date(saved.starts_at)).replace(" ","T");
        setStarts(local);
      }).catch(()=>{});
  }
  const timer=setInterval(()=>{if(alive)void load().catch(()=>{});},16000);
  return()=>{alive=false;clearInterval(timer);};
 },[load,thread.requested_date,thread.event_id,thread.acting_as]);

 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;
  setError("");setNotice("");
  const amount=parseFee(fee);
  if(amount===undefined){setError("Digite um cachê válido ou deixe vazio para combinar depois.");return;}
  const timestamp=new Date(starts);
  if(!starts||Number.isNaN(timestamp.getTime())){
   setError("Informe a data e a hora corretas.");return;
  }
  setBusy(true);
  try{
   const {data,error:rpcError}=await createClient().rpc("stage_hiring_proposal_send",{
    p_thread_id:thread.id,p_title:title.trim(),p_venue:venue.trim()||null,
    p_city:city.trim()||null,p_starts_at:timestamp.toISOString(),
    p_fee:amount,p_details:details.trim()||null
   });
   if(rpcError)throw rpcError;
   if(data?.status!=="ok"){
    const reasons:Record<string,string>={
     pending_exists:"Já existe uma proposta aguardando resposta. Retire-a antes de enviar outra.",
     unavailable:"O músico informou que está indisponível para esta conversa.",
     different_day:"A data da proposta precisa ser a mesma escolhida na consulta.",
     event_mismatch:"O dia e horário precisam coincidir com o evento vinculado.",
     already_confirmed:"Esta conversa já possui uma contratação aceita.",
     daily_limit:"Limite diário de propostas atingido.",
     invalid:"Revise data, hora, título e valores."
    };
    throw Error(reasons[data?.status]||"Não foi possível enviar a proposta.");
   }
   setShowForm(false);setNotice("Proposta enviada. O show só entrará na agenda após o músico aceitar.");
   await load();onUpdate?.();
  }catch(e){setError(e instanceof Error?e.message:"Erro ao enviar proposta.");}
  finally{setBusy(false);}
 }

 async function decide(p:Proposal,accept:boolean){
  if(busy)return;
  if(!window.confirm(accept?
   "Confirmar esta proposta? O show será criado ou vinculado à agenda e o convite ficará aceito.":
   "Recusar esta proposta? O contratante poderá enviar outra."))return;
  setBusy(true);setError("");setNotice("");
  try{
   const {data,error:rpcError}=await createClient().rpc("stage_hiring_proposal_decide",{
    p_proposal_id:p.id,p_accept:accept
   });
   if(rpcError)throw rpcError;
   if(data?.status!=="ok"){
    const reasons:Record<string,string>={
      existing_invite:"Já existe um convite deste músico para este evento. Resolva o convite na agenda antes de confirmar.",
      unavailable:"A disponibilidade está marcada como indisponível.",
      expired:"A data e hora do show passaram. Solicite uma nova proposta.",
      closed:"Essa proposta já foi respondida.",
      event_unavailable:"O evento original não está mais disponível."
    };
    throw Error(reasons[data?.status]||"Não foi possível responder à proposta.");
   }
   setNotice(accept?
    "Proposta aceita! O show foi registrado na agenda privada com a participação confirmada.":
    "Proposta recusada. O histórico ficará disponível nesta conversa.");
   await load();onUpdate?.();
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível responder.");}
  finally{setBusy(false);}
 }

 async function withdraw(p:Proposal){
  if(busy)return;
  if(!window.confirm("Retirar esta proposta? Ela ficará no histórico, mas deixará de estar ativa."))return;
  setBusy(true);setError("");setNotice("");
  try{
   const {data,error:rpcError}=await createClient().rpc("stage_hiring_proposal_withdraw",{
    p_proposal_id:p.id
   });
   if(rpcError||data!=="saved")throw Error("Não foi possível retirar a proposta.");
   setNotice("Proposta retirada. Você pode enviar outra com novos detalhes.");
   await load();onUpdate?.();
  }catch(e){setError(e instanceof Error?e.message:"Erro ao retirar.");}
  finally{setBusy(false);}
 }

 const pending=items.find(x=>x.status==="pending");
 const accepted=items.find(x=>x.status==="accepted");
 return <section className="hiring-proposals" aria-label="Propostas da conversa">
  <div className="hiring-proposals-header">
   <div><span><Handshake size={16}/> NEGOCIAÇÃO FORMAL</span>
    <h3>Propostas de show</h3></div>
   {thread.acting_as==="requester"&&!pending&&!accepted&&
    <button type="button" className="btn btn-quiet" disabled={busy}
     onClick={()=>setShowForm(v=>!v)}><ClipboardList size={15}/>
      {showForm?"Fechar formulário":"Montar proposta"}
    </button>}
  </div>
  <p className="hiring-proposals-hint">Converse antes de formalizar. Uma resposta de disponibilidade não significa contratação; o aceite da proposta registra o show e o cachê combinado.</p>
  {error&&<p className="hiring-proposals-error" role="alert">{error}</p>}
  {notice&&<p className="hiring-proposals-notice" role="status">{notice}</p>}
  {showForm&&thread.acting_as==="requester"&&!pending&&!accepted&&
   <form className="hiring-proposals-form" onSubmit={e=>void submit(e)}>
    <label>Nome da apresentação *
      <input required minLength={3} maxLength={140} value={title} onChange={e=>setTitle(e.target.value)}
       placeholder="Ex.: Pagode de sábado"/>
    </label>
    <div className="hiring-proposals-fields">
     <label>Data e horário *
      <input required type="datetime-local" value={starts} onChange={e=>setStarts(e.target.value)}/>
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
   </form>}
  {loading?<p className="hiring-proposals-hint">Carregando propostas...</p>:
   items.length?<div className="hiring-proposals-list">
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
       {thread.acting_as==="musician"&&<Link className="btn btn-quiet" href="/meus-shows">Meus shows</Link>}
      </div>}
    </article>)}
   </div>:<p className="hiring-proposals-empty">Ainda não há proposta formal nesta conversa.</p>}
 </section>;
}
