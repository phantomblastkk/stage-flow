"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {Bell} from "lucide-react";
import {createClient} from "@/lib/supabase/client";

export default function NotificationBell(){
 const [unread,setUnread]=useState<number|null>(null);
 useEffect(()=>{
  let alive=true;
  async function update(){
   try{
    const {data,error}=await createClient().rpc("stage_notifications_unread_count");
    if(alive&&!error&&typeof data==="number")setUnread(Math.max(0,data));
   }catch{/* Do not interrupt the dashboard if notification RPC is unavailable. */}
  }
  void update();
  const clock=setInterval(()=>{
   if(document.visibilityState==="visible")void update();
  },25000);
  return()=>{alive=false;clearInterval(clock)};
 },[]);
 return <Link href="/notificacoes" className="btn btn-quiet"
  aria-label={"Notificações"+(unread?" — "+unread+" não lidas":"")}
  title="Minhas notificações"
  style={{position:"relative",display:"inline-flex",gap:7,alignItems:"center",justifyContent:"center"}}>
  <Bell size={16}/>
  <span className="notification-bell-word">Avisos</span>
  {unread!==null&&unread>0&&
   <span aria-hidden="true" style={{minWidth:19,height:19,borderRadius:100,
    background:"#8250da",color:"#fff",fontWeight:850,fontSize:10,
    display:"inline-grid",placeItems:"center",padding:"0 5px"}}>
    {unread>99?"99+":unread}
   </span>}
 </Link>;
}
