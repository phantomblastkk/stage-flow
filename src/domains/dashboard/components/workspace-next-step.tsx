import Link from "next/link";
import {ArrowUpRight,CheckCircle2,Compass,Inbox,MessageCircle,CalendarDays,Mic2,Guitar,Store} from "lucide-react";

type Metrics={pending_invites:number;unread_conversations:number;pending_contacts:number;shows_week:number};
type JourneyStep={label:string;href:string};
type Priority={title:string;description:string;href:string;action:string;icon:typeof Compass};

/**
 * Intent is computed from the same private dashboard snapshot. No extra RPC,
 * no fabricated completion flags and no new sensitive fields in the browser.
 */
export function nextWorkspaceAction(metrics:Metrics,role:{
 isMusician:boolean;isSinger:boolean;isProducer:boolean
}):Priority{
 if(role.isMusician&&metrics.pending_invites>0)return {
  title:"Você tem convites aguardando resposta",
  description:"Confira datas e valores antes de aceitar ou recusar.",
  href:"/meus-convites",action:"Responder convites",icon:Inbox
 };
 if(role.isSinger&&metrics.pending_contacts>0)return {
  title:"Um contratante quer conversar",
  description:"Responda a solicitações recebidas no seu perfil de cantor.",
  href:"/meu-perfil-artistico/solicitacoes",action:"Ver solicitações",icon:MessageCircle
 };
 if(metrics.unread_conversations>0)return {
  title:"Continue suas negociações",
  description:"Há conversas com mensagens ainda não lidas.",
  href:"/conversas",action:"Abrir conversas",icon:MessageCircle
 };
 if(metrics.shows_week>0)return {
  title:"Prepare seus próximos shows",
  description:"Revise horários, compromissos e equipe antes da apresentação.",
  href:"/eventos",action:"Abrir agenda",icon:CalendarDays
 };
 if(role.isMusician)return {
  title:"Deixe seu trabalho pronto para ser encontrado",
  description:"Mostre instrumentos, vídeos e contato profissional no portfólio.",
  href:"/meu-portfolio",action:"Editar portfólio",icon:Guitar
 };
 if(role.isSinger)return {
  title:"Seu perfil é seu melhor cartão de visitas",
  description:"Atualize fotos, próximos shows e a forma de contratação.",
  href:"/meu-perfil-artistico",action:"Cuidar do perfil",icon:Mic2
 };
 return {
  title:"Encontre seu próximo talento",
  description:"Descubra músicos e organize um convite pela plataforma.",
  href:"/marketplace",action:"Explorar marketplace",icon:Store
 };
}

export default function WorkspaceNextStep({metrics,isMusician,isSinger,isProducer}:{
 metrics:Metrics;isMusician:boolean;isSinger:boolean;isProducer:boolean
}){
 const role={isMusician,isSinger,isProducer};
 const priority=nextWorkspaceAction(metrics,role);
 const Icon=priority.icon;
 const journey:JourneyStep[]=isMusician?[
  {label:"Portfólio",href:"/meu-portfolio"},
  {label:"Disponibilidade",href:"/minha-disponibilidade"},
  {label:"Convites",href:"/meus-convites"}
 ]:isSinger?[
  {label:"Perfil de cantor",href:"/meu-perfil-artistico"},
  {label:"Agenda",href:"/eventos"},
  {label:"Contratações",href:"/meu-perfil-artistico/solicitacoes"}
 ]:[
  {label:"Marketplace",href:"/marketplace"},
  {label:"Convidar",href:"/convites"},
  {label:"Organizar show",href:"/eventos"}
 ];
 return <section className="sf-workspace-next-step" aria-labelledby="sf-workspace-next-title">
  <div className="sf-workspace-next-highlight">
   <span className="sf-workspace-next-icon"><Icon size={21} aria-hidden="true"/></span>
   <div className="sf-workspace-next-copy">
    <span className="sf-workspace-next-eyebrow"><CheckCircle2 size={14}/> PRÓXIMA AÇÃO RECOMENDADA</span>
    <h2 id="sf-workspace-next-title">{priority.title}</h2>
    <p>{priority.description}</p>
   </div>
   <Link href={priority.href} className="sf-ui-button sf-ui-button-primary sf-workspace-next-action">
    {priority.action} <ArrowUpRight size={16} aria-hidden="true"/>
   </Link>
  </div>
  <nav className="sf-workspace-journey" aria-label="Etapas úteis para sua função">
   <span><Compass size={15} aria-hidden="true"/> SUA JORNADA</span>
   {journey.map((step,index)=><Link href={step.href} key={step.href}>
    <small>{String(index+1).padStart(2,"0")}</small>{step.label}
   </Link>)}
  </nav>
 </section>;
}
