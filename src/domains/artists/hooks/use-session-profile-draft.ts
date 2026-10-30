"use client";

import {useEffect,useRef,useState} from "react";

const HOURS_24=24*60*60*1000;
type Envelope<T>={version:1;expiresAt:number;value:T};
type SaveState="idle"|"saved"|"unavailable";

/**
 * An opt-in-to-restore, per-account/per-tab recovery copy of editor text.
 * It never changes server publication state or sends updates to Supabase.
 * The owner must explicitly press Salvar for database persistence.
 */
export function useSessionProfileDraft<T extends Record<string,unknown>>(
 key:string|null,ready:boolean,value:T,onRestore:(snapshot:T)=>void
){
 const [pending,setPending]=useState<{key:string;value:T}|null>(null);
 const [active,setActive]=useState(false);
 const [saveState,setSaveState]=useState<SaveState>("idle");
 const baseline=useRef("");
 const version=useRef(0);
 const serialized=JSON.stringify(value);

 useEffect(()=>{
  version.current++;
  setPending(null);
  setActive(false);
  setSaveState("idle");
  if(!key||!ready)return;
  baseline.current=serialized;
  try{
   const raw=window.sessionStorage.getItem(key);
   if(raw){
    const entry=JSON.parse(raw) as Partial<Envelope<T>>;
    const valid=entry.version===1&&typeof entry.expiresAt==="number"&&
      entry.expiresAt>Date.now()&&entry.value!==null&&
      typeof entry.value==="object"&&!Array.isArray(entry.value);
    if(valid&&JSON.stringify(entry.value)!==serialized){
     setPending({key,value:entry.value as T});
     return;
    }
    window.sessionStorage.removeItem(key);
   }
   setActive(true);
  }catch{
   setActive(true);
   setSaveState("unavailable");
  }
  // Only initialize when a verified server snapshot is loaded for this account.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[key,ready]);

 useEffect(()=>{
  if(!ready||!key||!active||pending?.key===key||saveState==="unavailable")return;
  const generation=version.current;
  const id=window.setTimeout(()=>{
   if(generation!==version.current)return;
   try{
    if(serialized===baseline.current){
     window.sessionStorage.removeItem(key);
     setSaveState("idle");
     return;
    }
    if(serialized.length>16000){setSaveState("unavailable");return;}
    const envelope:Envelope<T>={version:1,expiresAt:Date.now()+HOURS_24,value};
    window.sessionStorage.setItem(key,JSON.stringify(envelope));
    setSaveState("saved");
   }catch{setSaveState("unavailable");}
  },650);
  return()=>window.clearTimeout(id);
 },[ready,key,active,serialized,saveState,pending?.key]); // value changes with serialized

 function restore(){
  if(!key||pending?.key!==key)return;
  onRestore(pending.value);
  setPending(null);setActive(true);
  setSaveState("idle");
 }
 function discard(){
  if(!key)return;
  version.current++;
  try{window.sessionStorage.removeItem(key);}catch{}
  baseline.current=serialized;
  setPending(null);setActive(true);setSaveState("idle");
 }
 function savedToAccount(){
  version.current++;
  baseline.current=serialized;
  try{if(key)window.sessionStorage.removeItem(key);}catch{}
  setPending(null);setActive(true);setSaveState("idle");
 }
 return {pending:pending?.key===key,restore,discard,saveState,savedToAccount};
}
