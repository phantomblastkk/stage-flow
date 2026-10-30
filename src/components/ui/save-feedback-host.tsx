"use client";

import {useEffect,useState} from "react";
import {Toast} from "@/src/components/ui";
import {SAVE_FEEDBACK_EVENT,type SaveFeedbackDetail} from "./save-feedback";
import "./save-feedback-host.css";

/** One notification at a time across all StageFlow routes. */
export default function SaveFeedbackHost(){
 const [current,setCurrent]=useState<SaveFeedbackDetail|null>(null);
 useEffect(()=>{
  const listener=(event:Event)=>{
   const detail=(event as CustomEvent<SaveFeedbackDetail>).detail;
   if(!detail||typeof detail.message!=="string"||
      (detail.tone!=="success"&&detail.tone!=="danger")||
      detail.message.length>300)return;
   setCurrent(detail);
  };
  window.addEventListener(SAVE_FEEDBACK_EVENT,listener);
  return()=>window.removeEventListener(SAVE_FEEDBACK_EVENT,listener);
 },[]);
 useEffect(()=>{
  if(!current)return;
  const id=window.setTimeout(()=>setCurrent(previous=>previous?.id===current.id?null:previous),
   current.tone==="danger"?7500:5500);
  return()=>window.clearTimeout(id);
 },[current]);
 if(!current)return null;
 return <div className="sf-save-feedback-host" aria-label="Resultado do salvamento"
  data-tone={current.tone}>
  <Toast message={current.message} tone={current.tone}
   onClose={()=>setCurrent(null)}/>
 </div>;
}
