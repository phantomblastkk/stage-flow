"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {usePathname} from "next/navigation";
import {House,CalendarDays,MessagesSquare,Store,UserRound} from "lucide-react";
import "./workspace-shell.css";

/** Navegacao de polegar compartilhada por todas as telas privadas e Marketplace logado. */
const items=[
 {href:"/painel",label:"Início",Icon:House},
 {href:"/eventos",label:"Agenda",Icon:CalendarDays},
 {href:"/conversas",label:"Chats",Icon:MessagesSquare},
 {href:"/marketplace",label:"Explorar",Icon:Store},
 {href:"/minha-conta",label:"Conta",Icon:UserRound}
] as const;

export default function WorkspaceMobileNav(){
 const pathname=usePathname();
 const [chatUnread,setChatUnread]=useState<number|null>(null);
 useEffect(()=>{
  const client=createClient();
  let active=true,requestId=0;
  async function refresh(){
   if(!active||document.visibilityState==="hidden")return;
   const id=++requestId;
   try{
    const {data:{user}}=await client.auth.getUser();
    if(!active||id!==requestId)return;
    if(!user){setChatUnread(null);return;}
    const {data,error}=await client.rpc("stage_hiring_list");
    if(!active||id!==requestId||error||!Array.isArray(data))return;
    setChatUnread(data.reduce((sum:number,item:{unread?:number})=>
     sum+Math.max(0,Number(item.unread)||0),0));
   }catch{/* A chat badge must never block the navigation. */}
  }
  void refresh();
  const interval=setInterval(()=>void refresh(),45000);
  const onMessage=()=>void refresh();
  const onVisible=()=>{if(document.visibilityState==="visible")void refresh();};
  const {data:{subscription}}=client.auth.onAuthStateChange(()=>{
   requestId++;
   setChatUnread(null);
   void refresh();
  });
  window.addEventListener("stageflow:chat-updated",onMessage);
  document.addEventListener("visibilitychange",onVisible);
  return()=>{active=false;requestId++;clearInterval(interval);subscription.unsubscribe();
   window.removeEventListener("stageflow:chat-updated",onMessage);
   document.removeEventListener("visibilitychange",onVisible);};
 },[]);
 return <nav className="sf-workspace-bottom-nav" aria-label="Navegação principal no celular">
  {items.map(({href,label,Icon})=>{
   const active=pathname===href||(href!=="/painel"&&pathname.startsWith(href+"/"));
   return <Link key={href} href={href} className={"sf-workspace-link"+(active?" is-active":"")}
    aria-current={active?"page":undefined}
    aria-label={href==="/conversas"&&chatUnread?label+" — "+chatUnread+" mensagens não lidas":label}>
    <span className="sf-mobile-nav-icon"><Icon size={21} aria-hidden="true"/>
     {href==="/conversas"&&chatUnread!==null&&chatUnread>0&&
      <span className="sf-mobile-nav-count" aria-hidden="true">{chatUnread>99?"99+":chatUnread}</span>}
    </span><span>{label}</span>
   </Link>;
  })}
 </nav>;
}
