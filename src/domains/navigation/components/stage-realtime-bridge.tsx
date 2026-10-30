"use client";

import {useEffect} from "react";
import type {RealtimeChannel,Session} from "@supabase/supabase-js";
import {createClient} from "@/lib/supabase/client";

/**
 * One Realtime subscription per authenticated browser session across all
 * routes (including Marketplace and public artist pages).
 *
 * Only invalidation hints travel over the socket, never private messages.
 * RPCs remain authoritative; polling continues if the socket is unavailable.
 */
export default function StageRealtimeBridge(){
 useEffect(()=>{
  const client=createClient();
  let live=true;
  let generation=0;
  let userId:string|null=null;
  let channel:RealtimeChannel|null=null;

  function signal(connected:boolean){
   document.documentElement.dataset.stageflowRealtime=connected?"connected":"offline";
   window.dispatchEvent(new CustomEvent("stageflow:realtime-status",{
    detail:{connected}
   }));
  }
  function close(){
   const current=channel;
   channel=null;
   userId=null;
   signal(false);
   if(current)void client.removeChannel(current);
  }
  async function connect(session:Session){
   const epoch=++generation;
   if(userId===session.user.id&&channel){
    try{await client.realtime.setAuth(session.access_token);}catch{signal(false);}
    return;
   }
   close();
   userId=session.user.id;
   try{
    await client.realtime.setAuth(session.access_token);
    if(!live||epoch!==generation)return;
    const activeId=session.user.id;
    const room=client.channel("stageflow:account:"+activeId,{config:{private:true}})
     .on("broadcast",{event:"chat_changed"},({payload})=>{
      if(!live||userId!==activeId)return;
      const threadId=payload?.thread_id;
      if(typeof threadId!=="string"||!/^[0-9a-f-]{36}$/i.test(threadId))return;
      window.dispatchEvent(new CustomEvent("stageflow:chat-updated",{
       detail:{threadId}
      }));
     })
     .on("broadcast",{event:"notifications_changed"},()=>{
      if(live&&userId===activeId)
       window.dispatchEvent(new Event("stageflow:notifications-updated"));
     });
    channel=room;
    room.subscribe(status=>{
     if(!live||userId!==activeId)return;
     signal(status==="SUBSCRIBED");
     if(status==="SUBSCRIBED"){
      // Fetch once after joining to close any missed-event gap.
      window.dispatchEvent(new Event("stageflow:notifications-updated"));
      window.dispatchEvent(new CustomEvent("stageflow:chat-updated",{detail:{threadId:null}}));
     }
    });
   }catch{if(live&&epoch===generation){close();}}
  }

  const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{
   // Auth callbacks must not invoke another Supabase method synchronously.
   window.setTimeout(()=>{
    if(!live)return;
    if(!session){generation++;close();return;}
    void connect(session);
   },0);
  });
  async function boot(){
   try{
    const {data:{session}}=await client.auth.getSession();
    if(live){
     if(session)void connect(session);
     else if(!channel)signal(false);
    }
   }catch{if(live)signal(false);}
  }
  void boot();
  return()=>{
   live=false;
   generation++;
   subscription.unsubscribe();
   close();
  };
 },[]);
 return null;
}
