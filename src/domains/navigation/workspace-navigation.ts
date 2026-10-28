import type {LucideIcon} from "lucide-react";
import {
 House,CalendarDays,MessagesSquare,UserRound,Settings2,
 Clock3,History,Mail,MessageCircle,Wallet,Store,Users,
 ShieldCheck,Bell,Building2,Inbox,Repeat2
} from "lucide-react";

export type WorkspaceRole={
 isSinger:boolean;isMusician:boolean;isProducer:boolean;isOwnerAdmin:boolean;
 partnerHouseCount?:number;
};
export type WorkspaceNavItem={label:string;href:string;icon:LucideIcon;description?:string};
export type WorkspaceNavGroup={
 title:string;icon:LucideIcon;items:WorkspaceNavItem[];href?:string;
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
  {label:"Contratar artista ou grupo",href:"/contratar",icon:Users},
  {label:"Convites recebidos",href:"/meus-convites",icon:Mail},
  {label:"Conversas",href:"/conversas",icon:MessagesSquare},
  ...(role.isSinger?[{label:"Pedidos recebidos",href:"/meu-perfil-artistico/solicitacoes",icon:Inbox}]:[]),
  {label:"Convidar músicos",href:"/convites",icon:Users}
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
  {title:"Marketplace",icon:Store,href:"/marketplace",items:[]},
  {title:"Financeiro",icon:Wallet,href:"/financeiro",items:[]},
  {title:"Perfil Artístico",icon:UserRound,href:"/perfil-artistico",items:[]},
  {title:"Configurações",icon:Settings2,items:[...config,
   {label:"Perfis e grupos",href:"/perfis",icon:Users},
   {label:"Equipes",href:"/equipes",icon:Users},
   ...(role.isProducer||role.partnerHouseCount?[{label:"Casas de show",href:"/parceiros",icon:Building2}]:[])
  ]}
 ];
}
