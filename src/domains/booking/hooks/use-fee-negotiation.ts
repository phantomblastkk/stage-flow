"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {readFeeDetails,offerFee,acceptFee} from "../services/negotiation-service";
import {parseFeeInput} from "../model/fee-input";
import {isFeeSnapshot} from "../model/fee-snapshot";
import type {FeeData} from "../negotiation-types";

export function useFeeNegotiation(invitationId:string,onChanged?:()=>void){
 const [data,setData]=useState<FeeData|null>(null);
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false);
 const [feedback,setFeedback]=useState(""),[hasError,setHasError]=useState(false);
 const alive=useRef(false),locked=useRef(false),request=useRef<AbortController|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;request.current?.abort();};},[]);
 const loadFee=useCallback(async(preserveFeedback=false)=>{
  if(!alive.current)return;
  request.current?.abort();const next=new AbortController();request.current=next;
  setLoading(true);
  try{
   const {data:result,error}=await readFeeDetails(createClient(),{p_invitation_id:invitationId}).abortSignal(next.signal);
   if(next.signal.aborted||!alive.current)return;
   if(error||!isFeeSnapshot(result))throw Error("Não foi possível consultar a negociação deste convite. Tente novamente.");
   setData(result as FeeData);setHasError(false);if(!preserveFeedback)setFeedback("");
  }catch(error){if(!next.signal.aborted&&alive.current){setData(null);setHasError(true);setFeedback(error instanceof Error?error.message:"Não foi possível consultar a negociação.");}}
  finally{if(!next.signal.aborted&&alive.current)setLoading(false);}
 },[invitationId]);
 async function mutate(operation:()=>PromiseLike<{data:unknown;error:unknown}>,expected:string,success:string,reasons:Record<string,string>){
  if(locked.current||!alive.current)return false;
  locked.current=true;request.current?.abort();setLoading(false);setBusy(true);setFeedback("");
  try{
   const result=await operation();
   if(!alive.current)return false;
   if(result.error||result.data!==expected)throw Error(reasons[String(result.data)]||"Não foi possível atualizar a negociação. Tente novamente.");
   setHasError(false);setFeedback(success);
   await loadFee(true);
   if(!alive.current)return false;
   onChanged?.();return true;
  }catch(error){if(alive.current){setHasError(true);setFeedback(error instanceof Error?error.message:"Não foi possível atualizar a negociação.");}return false;}
  finally{locked.current=false;if(alive.current)setBusy(false);}
 }
 async function send(amount:string,note:string,other:string){
  const parsed=parseFeeInput(amount);
  if(parsed===undefined||note.trim().length>500){setHasError(true);setFeedback("Informe um valor válido em reais com até duas casas decimais e uma mensagem de até 500 caracteres.");return false;}
  return mutate(()=>offerFee(createClient(),{p_invitation_id:invitationId,p_amount:parsed,p_note:note.trim()||null}),"offered",
   "Proposta enviada! Agora é a vez do "+other+" responder.",{
    waiting_other:"Você já enviou uma proposta. Aguarde o outro lado responder.",closed:"Este convite já foi encerrado.",
    agreed:"O valor deste show já foi acordado.",invalid_amount:"Valor inválido. Informe um número maior que zero.",forbidden:"Esta negociação não pertence à sua conta."
   });
 }
 async function accept(){
  if(!data?.last_amount||data.last_by_me||data.status!=="pending"||data.agreed_amount!==null)return false;
  return mutate(()=>acceptFee(createClient(),{p_invitation_id:invitationId}),"accepted","Cachê acordado! O músico agora pode confirmar a participação.",{
   waiting_other:"A outra pessoa precisa aprovar sua proposta.",unclaimed:"O músico precisa abrir o convite antes de fechar o acordo.",closed:"Este convite já foi encerrado."
  });
 }
 const phase=busy?"mutating":loading?"loading":hasError?"error":data?"ready":"idle";
 return {data,loading,busy,feedback,hasError,phase,loadFee,send,accept};
}
