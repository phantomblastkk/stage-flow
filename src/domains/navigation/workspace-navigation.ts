import type {LucideIcon} from "lucide-react";
import {
 House,CalendarDays,MessagesSquare,BriefcaseBusiness,UserRound,Settings2,
 Clock3,History,Mail,MessageCircle,Wallet,Store,Users,Mic2,Guitar,
 Globe2,ChartNoAxesCombined,ShieldCheck,Bell,Building2,Inbox,Repeat2
} from "lucide-react";

export type WorkspaceRole={
 isSinger:boolean;isMusician:boolean;isProducer:boolean;isOwnerAdmin:boolean;
 partnerHouseCount?:number;
};
export type WorkspaceNavItem={label:string;href:string;icon:LucideIcon;description?:string};
export type WorkspaceNavGroup={
 title:string;icon:LucideIcon;items:WorkspaceNavItem[];
};
export const homeItem:WorkspaceNavItem={label:"Início",href:"/painel",icon:House};

/** All legacy URLs stay alive: navigation groups them, not redirects them. */
export function workspaceNavigation(role:WorkspaceRole):WorkspaceNavGroup[]{
 const agenda:WorkspaceNavItem[]=[
  {label:"Shows e agenda",href:"/eventos",icon:CalendarDays},
  {label:"Histórico de shows",href:"/meus-shows",icon:History},
  {label:"Shows recorrentes",href:"/shows-recorrentes",icon:Repeat2}
 ];
 if(role.isSinger||role.isMusician)agenda.splice(1,0,{label:"Disponibilidade",href:"/minha-disponibilidade",icon:Clock3});
 const booking:WorkspaceNavItem[]=[
  ...(role.isMusician?[{label:"Meus convites",href:"/meus-convites",icon:Mail}]:[]),
  {label:"Conversas",href:"/conversas",icon:MessagesSquare},
  ...(role.isSinger?[{label:"Pedidos recebidos",href:"/meu-perfil-artistico/solicitacoes",icon:Inbox}]:[]),
  {label:"Convidar músicos",href:"/convites",icon:Users}
 ];
 const business:WorkspaceNavItem[]=[
  {label:"Marketplace",href:"/marketplace",icon:Store},
  {label:"Financeiro",href:"/financeiro",icon:Wallet},
  {label:"Equipes",href:"/equipes",icon:Users}
 ];
 if(role.partnerHouseCount)business.push({label:"Casas parceiras",href:"/parceiros",icon:Building2});
 const profile:WorkspaceNavItem[]=[
  ...(role.isMusician?[{label:"Portfólio de músico",href:"/meu-portfolio",icon:Guitar},
   {label:"Estatísticas",href:"/meu-desempenho",icon:ChartNoAxesCombined}]:[]),
  ...(role.isSinger?[{label:"Perfil de cantor",href:"/meu-perfil-artistico",icon:Mic2},
   {label:"Site Pro",href:"/meu-perfil-artistico/site-profissional",icon:Globe2}]:[])
 ];
 const config:WorkspaceNavItem[]=[
  {label:"Minha conta",href:"/minha-conta",icon:UserRound},
  {label:"Notificações",href:"/notificacoes",icon:Bell},
  {label:"Privacidade e segurança",href:"/minha-conta?aba=privacidade",icon:Settings2}
 ];
 if(role.isOwnerAdmin)config.push({label:"Administração geral",href:"/admin/central",icon:ShieldCheck});
 return [
  {title:"Agenda",icon:CalendarDays,items:agenda},
  {title:"Contratações",icon:MessageCircle,items:booking},
  {title:"Negócios",icon:BriefcaseBusiness,items:business},
  ...(profile.length?[{title:"Perfil",icon:UserRound,items:profile}]:[]),
  {title:"Configurações",icon:Settings2,items:config}
 ];
}
