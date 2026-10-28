"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import {createClient} from "@/lib/supabase/client";
import {parseProposalFee} from "../model/fee-input";
import {isProposalSnapshot} from "../model/proposal-snapshot";
import {readProposals,readProposalPrefill,checkProposalSchedule,sendProposal,decideProposal,withdrawProposal} from "../services/negotiation-service";
import type {HiringThread,Proposal} from "../proposal-types";
function initialDate(day:string|null){return day?day+"T18:00":"";}
export function useHiringProposals(thread:HiringThread,onUpdate?:()=>void){
 const [items,setItems]=useState<Proposal[]>([]);
 const [readError,setReadError]=useState("");
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
 const [scheduleCheck,setScheduleCheck]=useState<"idle"|"checking"|"free"|"busy"|"possible_conflict"|"error">("idle");

 const aliveRef=useRef(false),locked=useRef(false),dirty=useRef(false);
 const readRequest=useRef<AbortController|null>(null),scheduleRequest=useRef<AbortController|null>(null);
 const load=useCallback(async()=>{
  if(!aliveRef.current)return;
  readRequest.current?.abort();const request=new AbortController();readRequest.current=request;
  setLoading(true);
  try{
  const {data,error:rpcError}=await readProposals(createClient(), {
   p_thread_id:thread.id
  }).abortSignal(request.signal);
  if(!aliveRef.current||request.signal.aborted)return;
  if(rpcError||data?.status!=="ok"||!isProposalSnapshot(data.items))throw Error("Não foi possível carregar as propostas. Tente novamente.");
  setItems(data.items as Proposal[]);setReadError("");
  }catch(e){if(aliveRef.current&&!request.signal.aborted){setItems([]);setReadError("Não foi possível carregar as propostas. Tente novamente.");}}
  finally{if(aliveRef.current&&!request.signal.aborted)setLoading(false);if(readRequest.current===request)readRequest.current=null;}
 },[thread.id]);
 useEffect(()=>{
  let alive=true;aliveRef.current=true;
  const prefill=new AbortController();
  setLoading(true);setItems([]);setError("");setShowForm(false);
  setTitle("");setVenue("");setCity("");setDetails("");setFee("");
  setStarts(initialDate(thread.requested_date));
  setScheduleCheck("idle");
  void load();
  if(thread.event_id&&thread.acting_as==="requester") {
    void Promise.resolve(readProposalPrefill(createClient(), {p_thread_id:thread.id}).abortSignal(prefill.signal))
      .then(({data,error})=>{
        if(!alive||prefill.signal.aborted||dirty.current||error||data?.status!=="ok"||!data.event)return;
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
  const refresh=()=>{if(alive&&document.visibilityState==="visible"&&!locked.current&&!readRequest.current)void load();};
  const timer=setInterval(refresh,16000);document.addEventListener("visibilitychange",refresh);
  return()=>{alive=false;aliveRef.current=false;readRequest.current?.abort();scheduleRequest.current?.abort();prefill.abort();clearInterval(timer);document.removeEventListener("visibilitychange",refresh);};
 },[load,thread.requested_date,thread.event_id,thread.acting_as]);

 async function checkSchedule(){
  if(!starts||locked.current)return;
  scheduleRequest.current?.abort();const request=new AbortController();scheduleRequest.current=request;
  const local=new Date(starts+"-03:00");
  if(Number.isNaN(local.getTime())){setError("Informe a data antes de consultar.");return;}
  setScheduleCheck("checking");setError("");
  try{
    const {data,error:rpcError}=await checkProposalSchedule(createClient(), {
      p_musician_id:thread.other_id,
      p_start:local.toISOString(),p_end:new Date(local.getTime()+4*60*60*1000).toISOString(),
      p_thread_id:thread.id,p_ignore_event:thread.event_id
    }).abortSignal(request.signal);
    if(!aliveRef.current||request.signal.aborted)return;
    if(rpcError)throw rpcError;
    setScheduleCheck(["free","busy","possible_conflict"].includes(data)?data:"error");
  }catch{if(aliveRef.current&&!request.signal.aborted)setScheduleCheck("error");}
 }
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(locked.current||!aliveRef.current)return;
  setError("");setNotice("");
  const amount=parseProposalFee(fee);
  if(amount===undefined){setError("Digite um cachê válido ou deixe vazio para combinar depois.");return;}
  const timestamp=new Date(starts+"-03:00");
  if(!starts||Number.isNaN(timestamp.getTime())){
   setError("Informe a data e a hora corretas.");return;
  }
  locked.current=true;readRequest.current?.abort();scheduleRequest.current?.abort();setScheduleCheck("idle");setLoading(false);setBusy(true);
  try{
   const {data,error:rpcError}=await sendProposal(createClient(), {
    p_thread_id:thread.id,p_title:title.trim(),p_venue:venue.trim()||null,
    p_city:city.trim()||null,p_starts_at:timestamp.toISOString(),
    p_fee:amount,p_details:details.trim()||null
   });
   if(!aliveRef.current)return;
   if(rpcError)throw Error("Não foi possível atualizar a proposta. Tente novamente.");
   if(data?.status!=="ok"){
    const reasons:Record<string,string>={
     pending_exists:"Já existe uma proposta aguardando resposta. Retire-a antes de enviar outra.",
     unavailable:"O músico informou que está indisponível para esta conversa.",
     different_day:"A data da proposta precisa ser a mesma escolhida na consulta.",
     event_mismatch:"O dia e horário precisam coincidir com o evento vinculado.",
     already_confirmed:"Esta conversa já possui uma contratação aceita.",
     daily_limit:"Limite diário de propostas atingido.",
     invalid:"Revise data, hora, título e valores.",
     schedule_conflict:"O músico já tem um compromisso confirmado nesse horário. Escolha outra data ou horário.",
     schedule_unavailable:"Não foi possível verificar a agenda agora. Tente novamente."
    };
    throw Error(reasons[data?.status]||"Não foi possível enviar a proposta.");
   }
   setShowForm(false);setNotice(data?.availability_warning?
    "Proposta enviada, mas há um compromisso ainda não confirmado nesta data. Verifique diretamente com o músico antes do aceite.":
    "Proposta enviada. O show só entrará na agenda após o músico aceitar.");
   await load();if(aliveRef.current)onUpdate?.();
  }catch(e){if(aliveRef.current)setError(e instanceof Error?e.message:"Erro ao enviar proposta.");}
  finally{locked.current=false;if(aliveRef.current)setBusy(false);}
 }

 async function decide(p:Proposal,accept:boolean){
  if(locked.current||!aliveRef.current)return;
  if(!window.confirm(accept?
   "Confirmar esta proposta? O show será criado ou vinculado à agenda e o convite ficará aceito.":
   "Recusar esta proposta? O contratante poderá enviar outra."))return;
  locked.current=true;readRequest.current?.abort();scheduleRequest.current?.abort();setScheduleCheck("idle");setLoading(false);setBusy(true);setError("");setNotice("");
  try{
   const {data,error:rpcError}=await decideProposal(createClient(), {
    p_proposal_id:p.id,p_accept:accept
   });
   if(!aliveRef.current)return;
   if(rpcError)throw Error("Não foi possível atualizar a proposta. Tente novamente.");
   if(data?.status!=="ok"){
    const reasons:Record<string,string>={
      existing_invite:"Já existe um convite deste músico para este evento. Resolva o convite na agenda antes de confirmar.",
      unavailable:"A disponibilidade está marcada como indisponível.",
      expired:"A data e hora do show passaram. Solicite uma nova proposta.",
      closed:"Essa proposta já foi respondida.",
      event_unavailable:"O evento original não está mais disponível.",
      schedule_conflict:"Há outro compromisso confirmado nesse horário. Confira Minha disponibilidade.",
      schedule_unavailable:"Não foi possível verificar a agenda agora; tente novamente."
    };
    throw Error(reasons[data?.status]||"Não foi possível responder à proposta.");
   }
   setNotice(accept?
    "Proposta aceita! O show foi registrado na agenda privada com a participação confirmada.":
    "Proposta recusada. O histórico ficará disponível nesta conversa.");
   await load();if(aliveRef.current)onUpdate?.();
  }catch(e){if(aliveRef.current)setError(e instanceof Error?e.message:"Não foi possível responder.");}
  finally{locked.current=false;if(aliveRef.current)setBusy(false);}
 }

 async function withdraw(p:Proposal){
  if(locked.current||!aliveRef.current)return;
  if(!window.confirm("Retirar esta proposta? Ela ficará no histórico, mas deixará de estar ativa."))return;
  locked.current=true;readRequest.current?.abort();scheduleRequest.current?.abort();setScheduleCheck("idle");setLoading(false);setBusy(true);setError("");setNotice("");
  try{
   const {data,error:rpcError}=await withdrawProposal(createClient(), {
    p_proposal_id:p.id
   });
   if(!aliveRef.current)return;
   if(rpcError||data!=="saved")throw Error("Não foi possível retirar a proposta.");
   setNotice("Proposta retirada. Você pode enviar outra com novos detalhes.");
   await load();if(aliveRef.current)onUpdate?.();
  }catch(e){if(aliveRef.current)setError(e instanceof Error?e.message:"Erro ao retirar.");}
  finally{locked.current=false;if(aliveRef.current)setBusy(false);}
 }

 return {items,loading,busy,error,notice,readError,showForm,setShowForm,title,venue,city,starts,fee,details,scheduleCheck,setScheduleCheck,load,checkSchedule,submit,decide,withdraw,setTitle:(value:string)=>{dirty.current=true;setTitle(value);},setVenue:(value:string)=>{dirty.current=true;setVenue(value);},setCity:(value:string)=>{dirty.current=true;setCity(value);},setStarts:(value:string)=>{dirty.current=true;scheduleRequest.current?.abort();setScheduleCheck("idle");setStarts(value);},setFee:(value:string)=>{dirty.current=true;setFee(value);},setDetails:(value:string)=>{dirty.current=true;setDetails(value);}};
}
