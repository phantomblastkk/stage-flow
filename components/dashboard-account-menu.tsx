"use client";

import {useEffect,useId,useRef,useState} from "react";
import Link from "next/link";
import {
  ChevronDown,ArrowUpRight,Guitar,LogOut,Mic2,
  Settings2,ShieldCheck,Shield,UserRound,KeyRound
} from "lucide-react";
import "./dashboard-account-menu.css";

type Props={
  displayName:string;
  avatarUrl?:string|null;
  isSinger:boolean;
  isMusician:boolean;
  isOwnerAdmin:boolean;
  signingOut:boolean;
  onSignOut:()=>void;
};

export default function DashboardAccountMenu({
  displayName,avatarUrl,isSinger,isMusician,isOwnerAdmin,signingOut,onSignOut
}:Props){
  const [open,setOpen]=useState(false);
  const [imageBroken,setImageBroken]=useState(false);
  useEffect(()=>{setImageBroken(false);},[avatarUrl]);
  const wrapper=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const menuId=useId();
  useEffect(()=>{
    if(!open)return;
    function onPointer(event:PointerEvent){
      if(!wrapper.current?.contains(event.target as Node))setOpen(false);
    }
    function onEscape(event:KeyboardEvent){
      if(event.key==="Escape"){
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown",onPointer);
    document.addEventListener("keydown",onEscape);
    return ()=>{
      document.removeEventListener("pointerdown",onPointer);
      document.removeEventListener("keydown",onEscape);
    };
  },[open]);
  const initials=displayName.trim().split(/\\s+/).slice(0,2).map(part=>part[0]||"").join("").toLocaleUpperCase("pt-BR")||"SF";
  const portrait=avatarUrl&&!imageBroken
    ?<img src={avatarUrl} alt="" loading="eager" onError={()=>setImageBroken(true)}/>
    :initials;
  return <div className="dashboard-profile-menu" ref={wrapper}>
    <button type="button" ref={trigger} className="dashboard-profile-trigger"
      aria-haspopup="true" aria-expanded={open} aria-controls={menuId}
      aria-label="Abrir menu do meu perfil"
      onClick={()=>setOpen(value=>!value)}>
      <span className="dashboard-profile-avatar" aria-hidden="true">{portrait}</span>
      <span className="dashboard-profile-trigger-name">
        <strong>Meu perfil</strong>
        <small>{displayName||"Minha conta"}</small>
      </span>
      <ChevronDown className={open?"is-rotated":""} size={17}/>
    </button>
    {open&&<div id={menuId} className="dashboard-profile-dropdown" aria-label="Menu da conta">
      <div className="dashboard-profile-summary">
        <span className="dashboard-profile-summary-avatar" aria-hidden="true">{portrait}</span>
        <div><strong>{displayName||"Minha conta"}</strong><small>Central da sua conta StageFlow</small></div>
      </div>
      <div className="dashboard-profile-group">
        <span className="dashboard-profile-group-title">PERFIS</span>
        <Link onClick={()=>setOpen(false)} href="/minha-conta"><UserRound size={17}/> Meu perfil e conta</Link>
        {isSinger&&<Link onClick={()=>setOpen(false)} href="/minha-conta?aba=cantor"><Mic2 size={17}/> Perfil de cantor <ArrowUpRight size={14}/></Link>}
        {isMusician&&<Link onClick={()=>setOpen(false)} href="/minha-conta?aba=musico"><Guitar size={17}/> Perfil de músico <ArrowUpRight size={14}/></Link>}
        {isOwnerAdmin&&<Link onClick={()=>setOpen(false)} href="/admin/central"><ShieldCheck size={17}/> Administração geral</Link>}
      </div>
      <div className="dashboard-profile-group">
        <span className="dashboard-profile-group-title">CONFIGURAÇÕES</span>
        <Link onClick={()=>setOpen(false)} href="/minha-conta?aba=seguranca"><KeyRound size={17}/> E-mail e segurança</Link>
        <Link onClick={()=>setOpen(false)} href="/minha-conta?aba=privacidade"><Shield size={17}/> Privacidade</Link>
        <Link onClick={()=>setOpen(false)} href="/"><Settings2 size={17}/> Voltar ao site</Link>
      </div>
      <button type="button" className="dashboard-profile-logout" disabled={signingOut}
        onClick={()=>{setOpen(false);onSignOut();}}>
        <LogOut size={17}/>{signingOut?"Saindo...":"Sair da conta"}
      </button>
    </div>}
  </div>;
}
