import type {AccountProfile} from "../../account/account-types";

export type GuideMode="singer"|"musician"|"organizer";
export type ArtistGuideData={
 name?:string|null;username?:string|null;bio?:string|null;city?:string|null;
 avatar_path?:string|null;avatar_url?:string|null;instruments?:string[]|null;
 is_public?:boolean|null;is_published?:boolean|null;
};
export type GuideTask={id:string;label:string;href:string;done:boolean};
export type GuidePlan={
 mode:GuideMode;title:string;description:string;
 tasks:GuideTask[];done:number;percent:number;next:GuideTask|null;
 extra:{href:string;label:string};
};

export function guideMode(profile:AccountProfile|null):GuideMode|null {
 if(!profile)return null;
 if(profile.is_singer&&(!profile.is_musician||profile.artist_kind!=="support"))return "singer";
 if(profile.is_musician)return "musician";
 if(profile.is_producer)return "organizer";
 return null;
}

/** Only verifiable account/RPC fields count as completion. No clicks or assumed publications. */
export function buildGuide(mode:GuideMode,data:ArtistGuideData|null,eventCount:number|null=null):GuidePlan {
 const task=(id:string,label:string,href:string,done:boolean):GuideTask=>({id,label,href,done});
 let tasks:GuideTask[],title:string,description:string,extra:{href:string;label:string};
 if(mode==="singer"){
  title="Seu palco começa com seu Perfil Artístico";
  description="Prepare o essencial para divulgar seus shows e receber propostas.";
  tasks=[
   task("account","Conta criada","/minha-conta",true),
   task("username","Escolher o @ do perfil","/perfil-artistico",Boolean(data?.username?.trim())),
   task("identity","Adicionar foto, cidade e apresentação","/perfil-artistico",
     Boolean(data?.avatar_path&&data.city?.trim()&&data.bio?.trim())),
   task("publish","Publicar o Perfil Artístico","/perfil-artistico",data?.is_public===true)
  ];
  extra={href:"/eventos",label:"Organizar meus shows"};
 }else if(mode==="musician"){
  title="Deixe seu talento pronto para ser encontrado";
  description="Complete seu portfólio e publique-o para aparecer no Marketplace.";
  tasks=[
   task("account","Conta criada","/minha-conta",true),
   task("instruments","Informar instrumentos e estilos","/perfil-artistico?aba=instrumentista",
     Array.isArray(data?.instruments)&&data.instruments.length>0),
   task("identity","Adicionar foto e cidade","/perfil-artistico?aba=instrumentista",
     Boolean(data?.avatar_url&&data.city?.trim())),
   task("publish","Publicar o portfólio de músico","/perfil-artistico?aba=instrumentista",
     data?.is_published===true)
  ];
  extra={href:"/minha-disponibilidade",label:"Minha disponibilidade"};
 }else{
  title="Organize seu primeiro show no StageFlow";
  description="Crie uma oportunidade e encontre profissionais para o seu evento.";
  tasks=[
   task("account","Conta criada","/minha-conta",true),
   task("event","Criar o primeiro evento","/eventos?novo=1",eventCount!==null&&eventCount>0)
  ];
  extra={href:"/marketplace",label:"Encontrar músicos no Marketplace"};
 }
 const done=tasks.filter(item=>item.done).length;
 return {mode,title,description,tasks,done,percent:Math.round(100*done/tasks.length),
  next:tasks.find(item=>!item.done)||null,extra};
}
