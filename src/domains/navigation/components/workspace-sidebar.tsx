"use client";

import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {Menu,PanelLeftClose,X,ChevronDown} from "lucide-react";
import {
  homeItem,workspaceNavigation,
  type WorkspaceRole,type WorkspaceNavItem
} from "../workspace-navigation";
import "./workspace-shell.css";

function WorkspaceLink({item,path,onNavigate}:{item:WorkspaceNavItem;path:string;onNavigate?:()=>void}){
 const active=path===item.href.split("?")[0]||
  (item.href!=="/painel"&&path.startsWith(item.href.split("?")[0]+"/"));
 const Icon=item.icon;
 return <Link href={item.href} onClick={onNavigate} className={"sf-workspace-link"+(active?" is-active":"")}
  aria-current={active?"page":undefined}>
  <Icon size={18} aria-hidden="true"/><span>{item.label}</span>
 </Link>;
}

export default function WorkspaceSidebar({role}:{role:WorkspaceRole}){
 const path=usePathname();
 const [mobileOpen,setMobileOpen]=useState(false);
 const [expanded,setExpanded]=useState<Record<string,boolean>>({});
 const toggle=useRef<HTMLButtonElement>(null);
 const drawerRef=useRef<HTMLElement>(null);
 const closeRef=useRef<HTMLButtonElement>(null);
 const groups=workspaceNavigation(role);
 useEffect(()=>{
  if(!mobileOpen)return;
  const old=document.body.style.overflow;
  const previous=document.activeElement as HTMLElement|null;
  document.body.style.overflow="hidden";
  closeRef.current?.focus();
  const onKey=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){
    event.preventDefault();setMobileOpen(false);return;
   }
   if(event.key!=="Tab")return;
   const controls=Array.from(drawerRef.current?.querySelectorAll<HTMLElement>(
    'a[href],button:not([disabled]),summary,[tabindex="0"]'
   )||[]).filter(element=>element.getClientRects().length>0);
   if(!controls.length)return;
   const first=controls[0],last=controls[controls.length-1];
   if(event.shiftKey&&document.activeElement===first){
    event.preventDefault();last.focus();
   }else if(!event.shiftKey&&document.activeElement===last){
    event.preventDefault();first.focus();
   }
  };
  document.addEventListener("keydown",onKey);
  return()=>{
   document.removeEventListener("keydown",onKey);
   document.body.style.overflow=old;
   (toggle.current||previous)?.focus();
  };
 },[mobileOpen]);
 const nav=<>
  <div className="sf-workspace-brand"><Link href="/painel" onClick={()=>setMobileOpen(false)}>
   <span className="sf-workspace-brand-mark">S</span>
   <span>stage <b>flow</b><small>SEU ESPAÇO DE TRABALHO</small></span>
  </Link>
  <button ref={closeRef} className="sf-workspace-drawer-close" type="button" aria-label="Fechar menu"
   onClick={()=>setMobileOpen(false)}><PanelLeftClose size={20}/></button>
  </div>
  <nav className="sf-workspace-group-list" aria-label="Navegação do StageFlow">
   <WorkspaceLink item={homeItem} path={path} onNavigate={()=>setMobileOpen(false)}/>
   {groups.map(group=><details className="sf-workspace-group" key={group.title}
     open={expanded[group.title]??(group.items.some(x=>path===x.href.split("?")[0]||
      path.startsWith(x.href.split("?")[0]+"/"))||group.title==="Agenda")}
     onToggle={event=>{
      const opened=event.currentTarget.open;
      setExpanded(previous=>previous[group.title]===opened?previous:{
       ...previous,[group.title]:opened
      });
     }}>
    <summary><group.icon size={17} aria-hidden="true"/>
     <span>{group.title}</span><ChevronDown size={15} className="sf-workspace-chevron"/></summary>
    <div className="sf-workspace-group-items">
     {group.items.map(item=><WorkspaceLink item={item} key={item.href}
       path={path} onNavigate={()=>setMobileOpen(false)}/>)}
    </div>
   </details>)}
  </nav>
  <p className="sf-workspace-nav-foot">Tudo o que você precisa, em um só palco.</p>
 </>;
 const bottom=[
  homeItem,
  {label:"Agenda",href:"/eventos",icon:groups[0].icon},
  {label:"Contratações",href:role.isMusician?"/meus-convites":"/conversas",icon:groups[1].icon},
  {label:"Negócios",href:"/financeiro",icon:groups[2].icon},
  {label:"Conta",href:"/minha-conta",icon:groups[groups.length-1].icon}
 ];
 return <>
  <aside className="sf-workspace-sidebar">{nav}</aside>
  <button ref={toggle} className="sf-workspace-mobile-trigger" type="button"
   aria-expanded={mobileOpen} aria-controls="sf-workspace-mobile-drawer"
   onClick={()=>setMobileOpen(true)}>
   <Menu size={20}/><span>Menu</span>
  </button>
  {mobileOpen&&<div className="sf-workspace-mobile-overlay">
   <button type="button" aria-label="Fechar navegação" onClick={()=>setMobileOpen(false)}
    className="sf-workspace-overlay-backdrop"/>
   <aside ref={drawerRef} id="sf-workspace-mobile-drawer" className="sf-workspace-drawer"
    role="dialog" aria-modal="true" aria-label="Navegação do StageFlow">{nav}</aside>
  </div>}
  <nav className="sf-workspace-bottom-nav" aria-label="Acesso rápido no celular">
   {bottom.map(item=><WorkspaceLink item={item} key={item.href} path={path}/>)}
  </nav>
 </>;
}
