"use client";

import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {ArrowRight,Check,ChevronRight,Compass,RefreshCw,X} from "lucide-react";
import {createClient} from "@/lib/supabase/client";
import {useAccount} from "../../account/account-context";
import {buildGuide,guideMode,type GuidePlan} from "../model/first-session-guide";
import {useDashboardArtistData} from "./dashboard-artist-data";
import "./first-session-guide.css";

export default function FirstSessionGuide(){
 const {snapshot:{profile}}=useAccount();
 const mode=guideMode(profile);
 const artistData=useDashboardArtistData();
 const artist=mode==="singer"?artistData.singer:artistData.musician;
 const refreshArtist=artistData.refresh;
 const key=profile&&mode?"stageflow:guide:v1:"+profile.id+":"+mode:null;
 const [loadedKey,setLoadedKey]=useState<string|null>(null);
 const [hiddenKey,setHiddenKey]=useState<string|null>(null);
 const [plan,setPlan]=useState<GuidePlan|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [refreshToken,setRefreshToken]=useState(0);
 const checkedAt=useRef(0);

 useEffect(()=>{
  if(!key)return;
  // A dismissed guide is a per-account presentation preference, never an access flag.
  try{setHiddenKey(window.localStorage.getItem(key)==="hidden"?key:null);}
  catch{setHiddenKey(null);}
  setLoadedKey(key);
 },[key]);

 useEffect(()=>{
  if(!profile||!mode)return;
  if(mode!=="organizer"){
   setLoading(artist.loading);setError(artist.error?"Não foi possível conferir seu progresso agora.":"");
   if(artist.data)setPlan(buildGuide(mode,artist.data));
   else setPlan(null);
   if(!artist.loading)checkedAt.current=Date.now();
   return;
  }
  let active=true;
  const request=new AbortController();
  setLoading(true);setError("");setPlan(null);
  async function load(){
   try{
    const db=createClient();
    if(mode==="organizer"){
     const {count,error:dbError}=await db.from("events").select("id",{head:true,count:"exact"})
      .eq("producer_id",profile!.id).abortSignal(request.signal);
     if(dbError||count===null)throw new Error("Falha ao consultar seus eventos");
     if(active&&!request.signal.aborted)setPlan(buildGuide(mode!,null,count));
    }
    checkedAt.current=Date.now();
   }catch{
    if(active&&!request.signal.aborted)setError("Não foi possível conferir seu progresso agora.");
   }finally{
    if(active&&!request.signal.aborted)setLoading(false);
   }
  }
  void load();
  return()=>{active=false;request.abort();};
 },[profile?.id,mode,refreshToken,artist.data,artist.loading,artist.error]);

 useEffect(()=>{if(refreshToken>0&&mode&&mode!=="organizer")void refreshArtist(mode);},[refreshToken,mode,refreshArtist]);

 useEffect(()=>{
  const refresh=()=>{
   if(document.visibilityState==="visible"&&Date.now()-checkedAt.current>10000)
    setRefreshToken(n=>n+1);
  };
  document.addEventListener("visibilitychange",refresh);
  return()=>document.removeEventListener("visibilitychange",refresh);
 },[]);

 if(!profile||!mode||!key||loadedKey!==key)return null;
 const close=()=>{
  try{window.localStorage.setItem(key,"hidden");}catch{}
  setHiddenKey(key);
 };
 const reopen=()=>{
  try{window.localStorage.removeItem(key);}catch{}
  setHiddenKey(null);
  setRefreshToken(n=>n+1);
 };
 if(hiddenKey===key)return <button type="button" className="sf-guide-reopen" onClick={reopen}>
  <Compass size={16} aria-hidden="true"/> Ver meu guia de primeiros passos <ChevronRight size={15} aria-hidden="true"/>
 </button>;
 if(!loading&&!error&&plan?.next===null)return null;

 return <section className="sf-first-guide" aria-labelledby="sf-first-guide-title">
  <header className="sf-guide-header">
   <span className="sf-guide-eyebrow"><Compass size={15} aria-hidden="true"/> SEUS PRIMEIROS PASSOS</span>
   <button type="button" className="sf-guide-hide" onClick={close} aria-label="Ocultar guia inicial">
    <X size={17} aria-hidden="true"/> <span>Agora não</span>
   </button>
  </header>
  {loading&&!plan?<p className="sf-guide-status" role="status">Conferindo seus primeiros passos…</p>:
   error?<div className="sf-guide-recovery" role="alert">{error}
    <button type="button" onClick={()=>setRefreshToken(n=>n+1)}><RefreshCw size={15}/> Tentar novamente</button>
   </div>:plan&&<>
    <h2 id="sf-first-guide-title">{plan.title}</h2>
    <p className="sf-guide-description">{plan.description}</p>
    <div className="sf-guide-progress-label">
     <strong>{plan.done} de {plan.tasks.length} etapas concluídas</strong>
     <span>{plan.percent}%</span>
    </div>
    <div className="sf-guide-progress" role="progressbar" aria-valuemin={0}
      aria-valuemax={100} aria-valuenow={plan.percent}
      aria-label="Progresso dos primeiros passos">
     <span style={{width:plan.percent+"%"}}/>
    </div>
    <ol className="sf-guide-task-list">
     {plan.tasks.map(task=><li key={task.id} className={task.done?"is-done":""}>
      <span className="sf-guide-task-check" aria-hidden="true">
       {task.done?<Check size={16}/>:<span/>}
      </span>
      {task.done?<span>{task.label}</span>:
       <Link href={task.href}>{task.label} <ChevronRight size={15} aria-hidden="true"/></Link>}
     </li>)}
    </ol>
    <div className="sf-guide-actions">
     {plan.next&&<Link className="sf-guide-primary" href={plan.next.href}>
      {plan.next.label} <ArrowRight size={18} aria-hidden="true"/>
     </Link>}
     <Link className="sf-guide-secondary" href={plan.extra.href}>{plan.extra.label}</Link>
    </div>
    <p className="sf-guide-help">Você pode voltar a este guia quando quiser. As etapas são atualizadas com dados salvos da sua conta.</p>
   </>}
 </section>;
}
