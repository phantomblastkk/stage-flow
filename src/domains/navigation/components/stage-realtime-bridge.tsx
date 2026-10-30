"use client";

import {useEffect} from "react";
import {createClient} from "@/lib/supabase/client";
import {useAccount} from "@/src/domains/account/account-context";

/**
 * One private WebSocket channel per signed-in workspace, not one per thread.
 * Broadcast payloads are invalidation hints. Message content stays behind RPCs.
 * Existing polling and visibility refresh remain a fallback on offline/auth failure.
 */
export default function StageRealtimeBridge(){
 const {snapshot}=useAccount();
 const accountId=snapshot.status==="ready"?snapshot.user?.id:null;

 useEffect(()=>{
  if(!accountId)return;
  let live=true;
  const client=createClient();
  const channel=client.channel("stageflow:account:"+accountId,{config:{private:true}});
  const signal=(connected:boolean)=>{
   if(live)window.dispatchEvent(new CustomEvent("stageflow:realtime-status",{
    detail:{connected,accountId}
   }));
  };
  channel
   .on("broadcast",{event:"chat_changed"},({payload})=>{
    if(!live)return;
    const threadId=payload?.thread_id;
    if(typeof threadId!=="string"||!/^[0-9a-f-]{36}$/i.test(threadId))return;
    window.dispatchEvent(new CustomEvent("stageflow:chat-updated",{
     detail:{threadId}
    }));
   })
   .on("broadcast",{event:"notifications_changed"},()=>{
    if(live)window.dispatchEvent(new Event("stageflow:notifications-updated"));
   });

  async function connect(){
   try{
    const {data:{session}}=await client.auth.getSession();
    if(!live||!session||session.user.id!==accountId)return;
    await client.realtime.setAuth(session.access_token);
    if(!live)return;
    channel.subscribe(status=>{
     if(!live)return;
     signal(status==="SUBSCRIBED");
     if(status==="SUBSCRIBED"){
      // Close the subscribe gap: catch events delivered while connecting.
      window.dispatchEvent(new Event("stageflow:notifications-updated"));
      window.dispatchEvent(new CustomEvent("stageflow:chat-updated",{detail:{threadId:null}}));
     }
    });
   }catch{signal(false);}
  }
  void connect();
  return()=>{
   live=false;
   // Auth/session changes remount this boundary and close the old account channel.
   void client.removeChannel(channel);
   window.dispatchEvent(new CustomEvent("stageflow:realtime-status",{
    detail:{connected:false,accountId}
   }));
  };
 },[accountId]);
 return null;
}
