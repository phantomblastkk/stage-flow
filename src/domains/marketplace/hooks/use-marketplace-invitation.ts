"use client";

import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { createClient } from "@/lib/supabase/client";

type EventOption = { id: string; title: string; starts_at: string; city: string | null };
type InvitationTarget = { musician_id: string; name: string; availability_mode: "ask" | "accepting" | "unavailable" };
type InvitationContext = {
  gate: "loading" | "allowed" | "denied";
  authUser: boolean;
  selected: InvitationTarget | null;
  panelVersion: RefObject<number>;
  mounted: RefObject<boolean>;
  reviewWriting: RefObject<boolean>;
  savingReview: boolean;
};

// The catalog owns dialog focus and coordinates review/invitation writes.
// This domain hook owns the invitation draft, reads, and exact-payload recovery.
export function useMarketplaceInvitation({gate, authUser, selected, panelVersion,
  mounted, reviewWriting, savingReview}: InvitationContext) {
  const [events,setEvents] = useState<EventOption[]>([]);
  const [loadingEvents,setLoadingEvents] = useState(true);
  const [eventsError,setEventsError] = useState("");
  const [eventsReady,setEventsReady] = useState(false);
  const [eventsRetry,setEventsRetry] = useState(0);
  const eventsReading=useRef(false);
  const [inviteUncertain,setInviteUncertain] = useState(false);
  const [inviteError,setInviteError] = useState("");
  const [inviteNotice,setInviteNotice] = useState("");
  const [confirmedInvites,setConfirmedInvites] = useState<string[]>([]);
  const confirmedInviteKeys=useRef(new Set<string>());
  const inviteWriting=useRef(false);
  const lastInviteAttempt=useRef<{p_event_id:string;p_musician_id:string;p_message:string|null}|null>(null);
  const [inviting,setInviting] = useState(false);
  const [selectedEvent,setSelectedEvent] = useState("");
  const [inviteMessage,setInviteMessage] = useState("");
  useEffect(()=>{
    if(gate!=="allowed"||!authUser)return;
    let active=true;
    async function getEvents(){
      eventsReading.current=true;setLoadingEvents(true);setEventsReady(false);setEventsError("");
      try{
        const {data,error:rpcError}=await createClient().rpc("stage_marketplace_my_events");
        if(!active)return;
        if(rpcError||!Array.isArray(data)||!data.every(row=>row&&typeof row.id==="string"&&typeof row.title==="string"&&Number.isFinite(Date.parse(row.starts_at))))throw new Error("events_unavailable");
        setEvents(data);setEventsReady(true);
      }catch{if(active)setEventsError("Não foi possível carregar seus shows. Tente novamente antes de convidar.");}
      finally{if(active){eventsReading.current=false;setLoadingEvents(false);}}
    }
    void getEvents();return()=>{active=false;};
  },[gate,authUser,eventsRetry]);

  function retryEvents(){
    if(eventsReading.current||inviteWriting.current||inviteUncertain)return;
    eventsReading.current=true;setLoadingEvents(true);setEventsRetry(v=>v+1);
  }
  function resetInvitation() {
    lastInviteAttempt.current=null;
    setInviteUncertain(false);
    confirmedInviteKeys.current.clear();
    setConfirmedInvites([]);
    setSelectedEvent("");
    setInviteMessage("");
    setInviteError("");
    setInviteNotice("");
  }
  async function sendInvite(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if(!selected||!authUser||inviteWriting.current||reviewWriting.current||savingReview)return;
    const payload=inviteUncertain?lastInviteAttempt.current:{p_event_id:selectedEvent,p_musician_id:selected.musician_id,p_message:inviteMessage.trim()||null};
    if(!payload||!payload.p_event_id||!eventsReady||loadingEvents||!events.some(ev=>ev.id===payload.p_event_id)||selected.availability_mode==="unavailable")return;
    const key=payload.p_event_id+":"+payload.p_musician_id;
    if(confirmedInviteKeys.current.has(key))return;
    inviteWriting.current=true;
    if(!window.confirm("Registrar convite individual para "+selected.name+
      "? O músico poderá aceitar ou recusar no Stage Flow. Nenhuma mensagem externa será enviada automaticamente.")){inviteWriting.current=false;return;}
    const version=panelVersion.current;
    const current=()=>mounted.current&&version===panelVersion.current;
    lastInviteAttempt.current=payload;setInviting(true);setInviteError("");setInviteNotice("");
    const uncertain=()=>{setInviteUncertain(true);setInviteError("Não foi possível confirmar o convite. Ele pode ter sido registrado. Confirme novamente o mesmo convite antes de criar outro.");};
    try{
      const {data,error:rpcError}=await createClient().rpc("stage_marketplace_invite_musician",payload);
      if(!current())return;
      const res=data as {status?:string}|null;
      const reasons:Record<string,string>={
        login_required:"Entre novamente na sua conta para convidar.",
        event_not_found:"O show não está disponível na sua conta ou já terminou.",
        not_listed:"O músico não está recebendo propostas no marketplace.",
        date_unavailable:"O músico marcou a data do show como indisponível no marketplace.",
        invalid_message:"A mensagem deve ter até 500 caracteres.",
        invalid:"Não foi possível identificar o show ou músico escolhido.",
        not_released:"Marketplace não liberado para a sua conta."
      };
      if(rpcError){uncertain();return;}
      if(res?.status==="sent"||res?.status==="already_exists"){
        setInviteUncertain(false);confirmedInviteKeys.current.add(key);setConfirmedInvites(current=>current.includes(key)?current:[...current,key]);
        setInviteNotice(res.status==="already_exists"?"Esse convite já existe. Acompanhe a resposta em Meus convites; nenhuma nova mensagem foi enviada.":"Convite registrado! O músico verá a proposta em Meus convites. A contratação ainda depende da resposta dele.");
        if(res.status==="sent")setInviteMessage("");
      }else if(reasons[res?.status||""]){setInviteUncertain(false);setInviteError(reasons[res?.status||""]);}
      else uncertain();
    }catch{if(current())uncertain();}
    finally{inviteWriting.current=false;if(current())setInviting(false);}
  }
  return {events, loadingEvents, eventsError, eventsReady, inviteUncertain,
    inviteError, setInviteError, inviteNotice, setInviteNotice, confirmedInvites,
    inviteWriting, inviting, selectedEvent, setSelectedEvent, inviteMessage,
    setInviteMessage, retryEvents, sendInvite, resetInvitation};
}
