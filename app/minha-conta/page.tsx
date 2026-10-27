"use client";

import Link from "next/link";
import {FormEvent, useCallback, useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowLeft, CalendarDays, CheckCircle2, ExternalLink, Guitar, LoaderCircle, Mic2, Save, ShieldCheck, UserRound} from "lucide-react";
import {createClient} from "@/lib/supabase/client";
import "./minha-conta.css";

type AccountIdentity={
  display_name:string;username:string|null;
  is_singer:boolean;is_musician:boolean;is_producer:boolean;
  artist_kind:"lead"|"support"|null;is_public:boolean;
  name_changed_at:string|null;username_changed_at:string|null;
  musician_slug:string|null;musician_published:boolean;
};
const periodMs=60*24*60*60*1000;
function nextChange(timestamp:string|null){
  if(!timestamp)return null;
  const end=new Date(timestamp).getTime()+periodMs;
  return Number.isFinite(end)&&end>Date.now()?new Date(end):null;
}
function dateString(date:Date){return date.toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"long",year:"numeric"});}

export default function MinhaConta(){
 const router=useRouter();
 const [account,setAccount]=useState<AccountIdentity|null>(null);
 const [name,setName]=useState("");
 const [username,setUsername]=useState("");
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [enabling,setEnabling]=useState<"singer"|"musician"|null>(null);
 const [message,setMessage]=useState("");
 const [error,setError]=useState(false);

 const load=useCallback(async()=>{
  const db=createClient();
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError){setMessage("Não foi possível validar sua sessão agora. Tente novamente.");setError(true);setLoading(false);return;}
  if(!user){router.replace("/login");return;}
  const {data,error:rpcError}=await db.rpc("stage_my_account_identity");
  if(rpcError||!data){setMessage("Não foi possível carregar suas funções e seu perfil.");setError(true);setLoading(false);return;}
  const next=data as AccountIdentity;
  setAccount(next);setName(next.display_name);setUsername(next.username||"");
  setLoading(false);
 },[router]);
 useEffect(()=>{void load();},[load]);

 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(saving||!account)return;
  setSaving(true);setMessage("");setError(false);
  const db=createClient();
  const {data,error:rpcError}=await db.rpc("stage_update_account_identity",{
   p_display_name:name.trim(),p_username:account.is_singer?username.trim().toLowerCase():null
  });
  const errors:Record<string,string>={
   invalid_name:"Informe um nome de 2 a 80 caracteres.",
   invalid_username:"O @ precisa ter entre 3 e 30 caracteres, usando letras, números ou hífen.",
   name_cooldown:"Seu nome só poderá ser alterado novamente após 60 dias.",
   username_cooldown:"Seu @ só poderá ser alterado novamente após 60 dias.",
   username_taken:"Este @ já está em uso. Escolha outro.",
   reserved_username:"Este @ é reservado para o StageFlow.",
   singer_required:"Ative primeiro a função de cantor para editar o @.",
   not_found:"Não encontramos seu cadastro."
  };
  if(rpcError||!["saved","unchanged"].includes(String(data))){
   setError(true);setMessage(rpcError?.message||errors[String(data)]||"Não foi possível salvar.");
  }else{
   await load();
   setMessage(data==="saved"?"Alterações salvas! A próxima troca de cada campo será possível após 60 dias.":"Nenhuma alteração necessária.");
  }
  setSaving(false);
 }

 async function activate(role:"singer"|"musician"){
  if(enabling||saving)return;
  setEnabling(role);setError(false);setMessage("");
  const {data,error:rpcError}=await createClient().rpc("stage_account_enable_role",{p_role:role});
  if(rpcError||data!=="enabled"){setError(true);setMessage(rpcError?.message||"Não foi possível ativar esta função.");}
  else {await load();setMessage(role==="musician"?"Função de músico ativada. Agora você pode editar e publicar seu portfólio.":"Função de cantor ativada. Escolha seu @ e prepare a página artística.");}
  setEnabling(null);
 }
 if(loading)return <main className="container account-loading"><LoaderCircle size={20}/> Carregando seu perfil...</main>;
 const nameReady=nextChange(account?.name_changed_at||null);
 const usernameReady=nextChange(account?.username_changed_at||null);
 return <main className="container account-page">
  <nav className="nav"><Link href="/painel" className="brand"><span className="brand-mark">S</span> stage flow</Link>
   <Link href="/painel" className="btn btn-quiet"><ArrowLeft size={15}/> Voltar ao painel</Link></nav>
  <header className="account-header"><div className="eyebrow"><UserRound size={15}/> MINHA CONTA</div>
   <h1>Meu <span className="accent">perfil</span></h1>
   <p>Uma conta, funções independentes. Veja como seus perfis aparecem ao público e edite suas informações.</p></header>
  {message&&<p className="coming" role={error?"alert":"status"}>{message}</p>}
  {account&&<div className="account-layout">
   <section className="account-section" aria-label="Meus perfis públicos">
    <h2>Meus perfis e funções</h2>
    <div className="account-role-grid">
     <article className="account-role-card">
      <div className="account-role-heading"><Mic2 size={23}/><div><h3>Cantor / artista principal</h3><small>{account.is_singer?"Função ativa":"Ainda não ativada"}</small></div></div>
      {account.is_singer?<>
       <p>Seu @ artístico é {account.username?"@"+account.username:"definido aqui na sua conta"}. A página pública usa a identidade de cantor.</p>
       <div className="account-role-actions">
        {account.username&&account.is_public?<Link className="btn btn-primary" href={"/"+encodeURIComponent(account.username)} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> Ver perfil de cantor</Link>:
         <span className="account-role-unpublished">Página ainda não publicada. Configure-a no editor.</span>}
        <Link className="btn btn-quiet" href="/meu-perfil-artistico">Editar perfil de cantor</Link>
       </div></>:<>
       <p>Crie sua página de cantor, organize shows e gerencie a equipe. Gratuito.</p>
       <button type="button" className="btn btn-primary" disabled={!!enabling} onClick={()=>void activate("singer")}>Ativar função de cantor</button>
      </>}
     </article>
     <article className="account-role-card">
      <div className="account-role-heading"><Guitar size={23}/><div><h3>Músico / instrumentista</h3><small>{account.is_musician?"Função ativa":"Ainda não ativada"}</small></div></div>
      {account.is_musician?<>
       <p>Portfólio próprio, independente da página de cantor, para divulgar seus instrumentos e receber propostas.</p>
       <div className="account-role-actions">
        {account.musician_slug&&account.musician_published?<Link className="btn btn-primary" href={"/musico/"+encodeURIComponent(account.musician_slug)} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> Ver portfólio de músico</Link>:
         <span className="account-role-unpublished">Portfólio ainda não publicado.</span>}
        <Link className="btn btn-quiet" href="/meu-portfolio">Editar portfólio de músico</Link>
        <Link className="btn btn-quiet" href="/meus-convites">Convites para tocar</Link>
       </div></>:<>
       <p>Ative a função gratuita de músico nesta mesma conta, sem criar outro login.</p>
       <button type="button" className="btn btn-primary" disabled={!!enabling} onClick={()=>void activate("musician")}>Ativar função de músico</button>
      </>}
     </article>
    </div>
    {account.is_producer&&<p className="account-producer"><CheckCircle2 size={16}/> Função de produtor/contratante também ativa nesta conta.</p>}
    <p className="account-note"><ShieldCheck size={16}/> Alternar a experiência do painel não altera seu plano, assinatura nem libera recursos Pro.</p>
   </section>
   <section className="account-section" aria-label="Editar nome e endereço artístico">
    <h2>Editar informações da conta</h2>
    <p className="account-note">Nome e @ podem ser alterados <strong>uma vez a cada 60 dias</strong>, com prazos independentes. Essa regra também é validada pelo servidor.</p>
    <form onSubmit={save} className="account-form">
     <label htmlFor="account-name">Nome público</label>
     <input id="account-name" value={name} maxLength={80} minLength={2} required disabled={!!nameReady||saving} onChange={e=>setName(e.target.value)}/>
     <small>{nameReady?"Próxima alteração do nome: "+dateString(nameReady):"Seu nome pode ser alterado agora."}</small>
     {account.is_singer&&<>
      <label htmlFor="account-username">@ de cantor</label>
      <input id="account-username" value={username} maxLength={30} minLength={3} required pattern="[a-z0-9-]{3,30}" placeholder="seuarroba"
       disabled={!!usernameReady||saving} onChange={e=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,""))}/>
      <small>{usernameReady?"Próxima alteração do @: "+dateString(usernameReady):"Este @ identifica sua página pública de cantor. Mudanças podem afetar links antigos."}</small>
     </>}
     <button type="submit" className="btn btn-primary" disabled={saving||(!account.is_singer&&!!nameReady)||(!!nameReady&&(!account.is_singer||!!usernameReady))}>
      {saving?<LoaderCircle size={15}/>:<Save size={15}/>} {saving?"Salvando...":"Salvar alterações"}
     </button>
    </form>
    <p className="account-note"><CalendarDays size={15}/> Alterações de foto, biografia, instrumentos, redes sociais e agenda ficam nos editores específicos de cada perfil.</p>
   </section>
  </div>}
 </main>;
}
