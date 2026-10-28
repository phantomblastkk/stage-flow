"use client";

import Link from "next/link";
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
 return <nav className="sf-workspace-bottom-nav" aria-label="Navegação principal no celular">
  {items.map(({href,label,Icon})=>{
   const active=pathname===href||(href!=="/painel"&&pathname.startsWith(href+"/"));
   return <Link key={href} href={href} className={"sf-workspace-link"+(active?" is-active":"")}
    aria-current={active?"page":undefined}>
    <Icon size={21} aria-hidden="true"/><span>{label}</span>
   </Link>;
  })}
 </nav>;
}
