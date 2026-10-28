"use client";
import {useEffect} from "react";

const isField=(element:EventTarget|null):element is HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement =>
 element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement;

/** Keeps the focused artist field in the visible viewport even after the mobile
 * keyboard changes visualViewport.height. No scroll or DOM changes on desktop. */
export function revealMobileEditorField(element:EventTarget|null){
 if(typeof window==="undefined"||window.innerWidth>850||!isField(element))return;
 if(!element.closest(".artist-wizard-mode,.mp-editor-workspace")||!element.isConnected)return;
 requestAnimationFrame(()=>{
  if(!element.isConnected)return;
  const rect=element.getBoundingClientRect();
  const viewport=window.visualViewport;
  const top=viewport?.offsetTop??0;
  const bottom=top+(viewport?.height??window.innerHeight);
  if(rect.top<top+18||rect.bottom>bottom-18)
   element.scrollIntoView({block:"center",behavior:"instant"});
 });
}

export function useMobileEditorKeyboardVisibility(){
 useEffect(()=>{
  const viewport=window.visualViewport;
  if(!viewport)return;
  const onResize=()=>revealMobileEditorField(document.activeElement);
  viewport.addEventListener("resize",onResize);
  return()=>viewport.removeEventListener("resize",onResize);
 },[]);
}
