"use client";

import {useEffect,useState} from "react";
import {createClient} from "@/lib/supabase/client";

type PublicKind="singer"|"musician"|"venue";

/** Read-only verification. This RPC returns true only for a published public entity. */
export function useStageVerified(kind:PublicKind,slug:string|undefined,enabled:boolean){
 const [verified,setVerified]=useState(false);
 useEffect(()=>{
  let active=true;
  setVerified(false);
  if(!enabled||!slug)return ()=>{active=false;};
  void createClient().rpc("stage_public_verified",{
   p_kind:kind,p_slug:slug
  }).then(({data,error})=>{
   if(active)setVerified(!error&&data===true);
  }).catch(()=>{if(active)setVerified(false);});
  return ()=>{active=false;};
 },[kind,slug,enabled]);
 return verified;
}
