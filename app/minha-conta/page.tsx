"use client";

import Link from "next/link";
import {FormEvent,useCallback,useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {
  ArrowLeft,ArrowRight,CalendarDays,CheckCircle2,ChevronRight,Copy,
  ExternalLink,Eye,EyeOff,Guitar,KeyRound,LoaderCircle,LockKeyhole,
  Mail,Mic2,Save,Shield,ShieldCheck,Sparkles,UserRound,X
} from "lucide-react";
import {createClient} from "@/lib/supabase/client";
import {useAccount} from "@/src/domains/account/account-context";
import "./minha-conta.css";

type AccountIdentity={
  display_name:string;username:string|null;
  is_singer:boolean;is_musician:boolean;is_producer:boolean;
  artist_kind:"lead"|"support"|null;is_public:boolean;
  name_changed_at:string|null;username_changed_at:string|null;
  musician_slug:string|null;musician_published:boolean;
};
type AccountTab="inicio"|"cantor"|"musico"|"dados"|"seguranca"|"privacidade";
type ArtistRole="singer"|"musician";
const tabs: {id:AccountTab;label:string;sub:string;Icon:typeof UserRound}[]=[
  {id:"inicio",label:"Visão geral",sub:"Minha conta",Icon:UserRound},
  {id:"cantor",label:"Perfil de cantor",sub:"Página artística",Icon:Mic2},
  {id:"musico",label:"Perfil de músico",sub:"Portfólio",Icon:Guitar},
  {id:"dados",label:"Dados pessoais",sub:"Nome e @",Icon:Save},
  {id:"seguranca",label:"E-mail e segurança",sub:"Acesso à conta",Icon:KeyRound},
  {id:"privacidade",label:"Privacidade",sub:"Publicações e dados",Icon:Shield}
];
const periodMs=60*24*60*60*1000;
function nextChange(timestamp:string|null){
  if(!timestamp)return null;
  const end=new Date(timestamp).getTime()+periodMs;
  return Number.isFinite(end)&&end>Date.now()?new Date(end):null;
}
function dateString(date:Date){
  return date.toLocaleDateString("pt-BR",{
    timeZone:"America/Sao_Paulo",day:"2-digit",month:"long",year:"numeric"
  });
}
function tabFromUrl():AccountTab {
  if(typeof window==="undefined")return "inicio";
  const value=new URLSearchParams(window.location.search).get("aba");
  return tabs.some(tab=>tab.id===value)?value as AccountTab:"inicio";
}

export default function MinhaConta(){
 const router=useRouter();
 const {refresh:refreshAccount}=useAccount();
 const [account,setAccount]=useState<AccountIdentity|null>(null);
 const [activeTab,setActiveTab]=useState<AccountTab>("inicio");
 const [name,setName]=useState("");
 const [username,setUsername]=useState("");
 const [email,setEmail]=useState("");
 const [newEmail,setNewEmail]=useState("");
 const [password,setPassword]=useState("");
 const [passwordAgain,setPasswordAgain]=useState("");
 const [showPassword,setShowPassword]=useState(false);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [securityBusy,setSecurityBusy]=useState(false);
 const [enabling,setEnabling]=useState<ArtistRole|null>(null);
 const [pendingRole,setPendingRole]=useState<ArtistRole|null>(null);
 const [confirmationText,setConfirmationText]=useState("");
 const [confirmationChecked,setConfirmationChecked]=useState(false);
 const [copied,setCopied]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState(false);
 const roleDialogInput=useRef<HTMLInputElement>(null);
 const roleOrigin=useRef<HTMLButtonElement|null>(null);

 const flash=(text:string,isError=false)=>{setMessage(text);setError(isError);};
 const switchTab=useCallback((next:AccountTab)=>{
   setActiveTab(next);setMessage("");setError(false);
   const url=new URL(window.location.href);
   if(next==="inicio")url.searchParams.delete("aba");
   else url.searchParams.set("aba",next);
   window.history.pushState(null,"",url.pathname+url.search+url.hash);
   window.scrollTo({top:0,behavior:"smooth"});
 },[]);
 useEffect(()=>{
   setActiveTab(tabFromUrl());
   function onPopState(){setActiveTab(tabFromUrl());}
   window.addEventListener("popstate",onPopState);
   return()=>window.removeEventListener("popstate",onPopState);
 },[]);

 const load=useCallback(async()=>{
   const db=createClient();
   const {data:{user},error:authError}=await db.auth.getUser();
   if(authError){
     flash("Não foi possível validar sua sessão agora. Tente novamente.",true);
     setLoading(false);return;
   }
   if(!user){router.replace("/login");return;}
   setEmail(user.email||"");
   const {data,error:rpcError}=await db.rpc("stage_my_account_identity");
   if(rpcError||!data){
     flash("Não foi possível carregar suas funções e seu perfil.",true);
     setLoading(false);return;
   }
   const next=data as AccountIdentity;
   setAccount(next);setName(next.display_name);setUsername(next.username||"");
   setLoading(false);
 },[router]);
 useEffect(()=>{void load();},[load]);

 const nameReady=nextChange(account?.name_changed_at||null);
 const usernameReady=nextChange(account?.username_changed_at||null);
 const nameChanged=name.trim()!==account?.display_name;
 const usernameChanged=account?.is_singer&&username.trim().toLowerCase()!==(account?.username||"");
 const saveBlocked=saving||(!nameChanged&&!usernameChanged)||
   (Boolean(nameReady)&&nameChanged)||(Boolean(usernameReady)&&Boolean(usernameChanged));

 async function save(event:FormEvent<HTMLFormElement>){
   event.preventDefault();
   if(saveBlocked||!account)return;
   setSaving(true);setMessage("");setError(false);
   const db=createClient();
   const {data,error:rpcError}=await db.rpc("stage_update_account_identity",{
     p_display_name:name.trim(),
     p_username:account.is_singer?username.trim().toLowerCase():null
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
     flash(rpcError?.message||errors[String(data)]||"Não foi possível salvar.",true);
   }else{
     await load();
     await refreshAccount();
     flash(data==="saved"
       ?"Alterações salvas! O prazo de 60 dias é independente para o nome e para o @."
       :"Nenhuma alteração necessária.");
   }
   setSaving(false);
 }

 function openRoleConfirmation(role:ArtistRole,event:React.MouseEvent<HTMLButtonElement>){
   if(saving||enabling||!account)return;
   if((role==="singer"&&account.is_singer)||(role==="musician"&&account.is_musician))return;
   roleOrigin.current=event.currentTarget;
   setPendingRole(role);setConfirmationText("");setConfirmationChecked(false);setMessage("");
 }
 function closeRoleConfirmation(){
   if(enabling)return;
   setPendingRole(null);setConfirmationText("");setConfirmationChecked(false);
   window.requestAnimationFrame(()=>roleOrigin.current?.focus());
 }
 useEffect(()=>{
   if(!pendingRole)return;
   roleDialogInput.current?.focus();
   const previous=document.body.style.overflow;
   document.body.style.overflow="hidden";
   function onKey(event:KeyboardEvent){
     if(event.key==="Escape"&&!enabling){event.preventDefault();closeRoleConfirmation();}
     if(event.key!=="Tab")return;
     const dialog=document.getElementById("account-role-dialog");
     if(!dialog)return;
     const controls=Array.from(dialog.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled])"));
     if(!controls.length)return;
     const first=controls[0],last=controls[controls.length-1];
     if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
     else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
   }
   document.addEventListener("keydown",onKey);
   return()=>{document.body.style.overflow=previous;document.removeEventListener("keydown",onKey);};
 },[pendingRole,enabling]);

 async function activate(){
   const role=pendingRole;
   if(!role||enabling||saving||confirmationText.trim().toLocaleUpperCase("pt-BR")!=="ATIVAR"||!confirmationChecked)return;
   setEnabling(role);setError(false);setMessage("");
   const {data,error:rpcError}=await createClient().rpc("stage_account_enable_role",{p_role:role});
   if(rpcError||data!=="enabled"){
     flash(rpcError?.message||"Não foi possível ativar esta função.",true);
   }else{
     setPendingRole(null);setConfirmationText("");setConfirmationChecked(false);
     await load();
     await refreshAccount();
     flash(role==="musician"
       ?"Função de músico ativada. Agora você pode editar e publicar seu portfólio."
       :"Função de cantor ativada. Escolha seu @ e prepare sua página artística.");
     setActiveTab(role==="singer"?"cantor":"musico");
     const url=new URL(window.location.href);
     url.searchParams.set("aba",role==="singer"?"cantor":"musico");
     window.history.replaceState(null,"",url.pathname+url.search+url.hash);
   }
   setEnabling(null);
 }

 async function updateEmail(event:FormEvent<HTMLFormElement>){
   event.preventDefault();
   const proposed=newEmail.trim().toLowerCase();
   if(!proposed||proposed===email.trim().toLowerCase())return;
   setSecurityBusy(true);flash("");
   try{
     const {data:{user},error:authError}=await createClient().auth.getUser();
     if(authError||!user)throw new Error("Entre novamente na sua conta antes de alterar o e-mail.");
     const {error:updateError}=await createClient().auth.updateUser({email:proposed});
     if(updateError)throw updateError;
     setNewEmail("");
     flash("Solicitação enviada. Confira as mensagens de confirmação nos endereços envolvidos. O e-mail atual só será substituído depois da verificação exigida pelo Supabase.");
   }catch(e){flash(e instanceof Error?e.message:"Não foi possível solicitar a troca de e-mail.",true);}
   finally{setSecurityBusy(false);}
 }
 async function updatePassword(event:FormEvent<HTMLFormElement>){
   event.preventDefault();
   if(password.length<12){flash("Use uma senha com pelo menos 12 caracteres.",true);return;}
   if(password!==passwordAgain){flash("As duas senhas não coincidem.",true);return;}
   setSecurityBusy(true);flash("");
   try{
     const {data:{user},error:authError}=await createClient().auth.getUser();
     if(authError||!user)throw new Error("Entre novamente na sua conta antes de alterar a senha.");
     const {error:updateError}=await createClient().auth.updateUser({password});
     if(updateError)throw updateError;
     setPassword("");setPasswordAgain("");
     flash("Senha atualizada. Proteja seu acesso e não compartilhe seus dados de entrada.");
   }catch(e){flash(e instanceof Error?e.message:"Não foi possível atualizar a senha.",true);}
   finally{setSecurityBusy(false);}
 }

 async function copySingerLink(){
   if(!account?.username)return;
   try{
     await navigator.clipboard.writeText(window.location.origin+"/"+account.username);
     setCopied(true);
     window.setTimeout(()=>setCopied(false),3000);
   }catch{flash("Não foi possível copiar o link. Abra o perfil público e copie o endereço.",true);}
 }

 if(loading)return <main className="container account-loading"><LoaderCircle size={20}/> Carregando seu perfil...</main>;
 return <main className="container account-page">
   <nav className="nav"><Link href="/painel" className="brand"><span className="brand-mark">S</span> stage flow</Link>
     <Link href="/painel" className="btn btn-quiet"><ArrowLeft size={15}/> Meu painel</Link>
   </nav>
   <header className="account-header">
     <div className="eyebrow"><UserRound size={15}/> CENTRAL DA MINHA CONTA</div>
     <h1>Seu perfil, <span className="accent">do seu jeito.</span></h1>
     <p>Dados pessoais, páginas artísticas, privacidade e segurança. Tudo organizado em uma conta só.</p>
     {account&&<div className="account-hero-status">
       <span><ShieldCheck size={14}/> Conta protegida</span>
       {account.is_singer&&<span><Mic2 size={14}/> Cantor ativo</span>}
       {account.is_musician&&<span><Guitar size={14}/> Músico ativo</span>}
       {account.is_producer&&<span><CheckCircle2 size={14}/> Produtor ativo</span>}
     </div>}
   </header>
   {message&&<p className="coming account-flash" role={error?"alert":"status"}>{message}</p>}
   {account&&<div className="account-shell">
     <nav className="account-side" aria-label="Áreas do meu perfil">
       <div className="account-side-heading"><span>CONFIGURAÇÕES</span><strong>Minha conta</strong></div>
       {tabs.map(({id,label,sub,Icon})=><button type="button" key={id}
         className={"account-tab"+(activeTab===id?" is-active":"")}
         aria-current={activeTab===id?"page":undefined} onClick={()=>switchTab(id)}>
         <span className="account-tab-icon"><Icon size={18}/></span>
         <span className="account-tab-label"><strong>{label}</strong><small>{sub}</small></span>
         <ChevronRight size={16} className="account-tab-chevron"/>
       </button>)}
       <div className="account-side-support">
         <LockKeyhole size={16}/> Suas informações sensíveis não aparecem nos perfis públicos.
       </div>
     </nav>

     <div className="account-content">
       {activeTab==="inicio"&&<section className="account-section" aria-label="Visão geral da minha conta">
         <div className="account-section-heading"><span className="account-kicker">PAINEL PESSOAL</span>
           <h2>Meus perfis e funções</h2>
           <p>Você pode ter presença como cantor e músico na mesma conta, com páginas independentes.</p>
         </div>
         <div className="account-role-grid">
           <article className="account-role-card">
             <div className="account-role-heading"><span><Mic2 size={22}/></span>
               <div><h3>Cantor / artista principal</h3>
                 <small>{account.is_singer?"Função ativa":"Função não ativada"}</small></div>
             </div>
             <p>{account.is_singer?"Sua página artística, agenda e contato com contratantes.":"Crie sua página de cantor e anuncie apresentações gratuitamente."}</p>
             <button type="button" className="account-card-cta" onClick={()=>switchTab("cantor")}>
               {account.is_singer?"Gerenciar perfil de cantor":"Conhecer perfil de cantor"} <ArrowRight size={16}/>
             </button>
           </article>
           <article className="account-role-card">
             <div className="account-role-heading"><span><Guitar size={22}/></span>
               <div><h3>Músico / instrumentista</h3>
                 <small>{account.is_musician?"Função ativa":"Função não ativada"}</small></div>
             </div>
             <p>{account.is_musician?"Instrumentos, trabalhos, disponibilidade e portfólio de músico.":"Ative um portfólio separado para mostrar seus instrumentos e trabalhos."}</p>
             <button type="button" className="account-card-cta" onClick={()=>switchTab("musico")}>
               {account.is_musician?"Gerenciar perfil de músico":"Conhecer perfil de músico"} <ArrowRight size={16}/>
             </button>
           </article>
         </div>
         <div className="account-quick-grid">
           <button type="button" onClick={()=>switchTab("dados")}><UserRound size={18}/>
             <strong>Dados pessoais</strong><span>Nome e identidade pública</span><ArrowRight size={15}/></button>
           <button type="button" onClick={()=>switchTab("seguranca")}><KeyRound size={18}/>
             <strong>Segurança</strong><span>E-mail e senha</span><ArrowRight size={15}/></button>
           <button type="button" onClick={()=>switchTab("privacidade")}><Shield size={18}/>
             <strong>Privacidade</strong><span>Controle da exposição pública</span><ArrowRight size={15}/></button>
         </div>
       </section>}

       {activeTab==="cantor"&&<section className="account-section" aria-label="Meu perfil de cantor">
         <div className="account-section-heading"><span className="account-kicker"><Mic2 size={15}/> IDENTIDADE ARTÍSTICA</span>
           <h2>Meu perfil de cantor</h2>
           <p>Uma página profissional para divulgar sua música, receber contatos e publicar shows.</p>
         </div>
         {account.is_singer?<>
           <div className="account-profile-banner account-singer-banner">
             <div><small>PERFIL DE CANTOR</small><h3>{account.display_name}</h3>
               <p>{account.username?"@"+account.username:"Escolha seu @ artístico no editor"}</p></div>
             <span className="account-public-status">{account.is_public?"Publicado":"Não publicado"}</span>
           </div>
           <div className="account-role-actions">
             <Link className="btn btn-primary" href="/meu-perfil-artistico"><Mic2 size={16}/> Editar perfil de cantor</Link>
             {account.username&&account.is_public&&<>
               <Link className="btn btn-quiet" href={"/"+encodeURIComponent(account.username)} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> Ver perfil público</Link>
               <button type="button" className="btn btn-quiet" onClick={()=>void copySingerLink()}>
                 <Copy size={15}/>{copied?"Copiado!":"Copiar link"}</button>
             </>}
             <Link className="btn btn-quiet" href="/meu-perfil-artistico/solicitacoes">Pedidos de contratação</Link>
           </div>
           <p className="account-note"><Sparkles size={17}/> Sua frase de destaque é uma assinatura visual abaixo do nome. Biografia, fotos e agenda são editadas separadamente no perfil de cantor.</p>
           {!account.is_public&&<p className="account-tip">Sua página ainda não está publicada. Abra o editor, complete suas informações e escolha quando tornar o perfil público.</p>}
         </>:<div className="account-activation">
           <Mic2 size={28}/>
           <h3>Seu palco começa aqui.</h3>
           <p>Crie uma identidade pública como cantor sem perder seu perfil de músico. A ativação é permanente para você e só poderá ser revertida pela administração.</p>
           <button type="button" className="btn btn-primary" disabled={Boolean(enabling)}
             onClick={event=>openRoleConfirmation("singer",event)}>Ativar função de cantor <ArrowRight size={16}/></button>
         </div>}
       </section>}

       {activeTab==="musico"&&<section className="account-section" aria-label="Meu perfil de músico">
         <div className="account-section-heading"><span className="account-kicker"><Guitar size={15}/> PORTFÓLIO PROFISSIONAL</span>
           <h2>Meu perfil de músico</h2>
           <p>Instrumentos, repertório, trabalhos e disponibilidade em um portfólio próprio.</p>
         </div>
         {account.is_musician?<>
           <div className="account-profile-banner account-musician-banner">
             <div><small>PORTFÓLIO DE MÚSICO</small><h3>{account.display_name}</h3>
               <p>{account.musician_slug?"/musico/"+account.musician_slug:"Prepare seu portfólio profissional"}</p></div>
             <span className="account-public-status">{account.musician_published?"Publicado":"Não publicado"}</span>
           </div>
           <div className="account-role-actions">
             <Link className="btn btn-primary" href="/meu-portfolio"><Guitar size={16}/> Editar portfólio de músico</Link>
             {account.musician_slug&&account.musician_published&&
               <Link className="btn btn-quiet" href={"/musico/"+encodeURIComponent(account.musician_slug)} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> Ver portfólio público</Link>}
             <Link className="btn btn-quiet" href="/meus-convites"><CalendarDays size={15}/> Convites para tocar</Link>
             <Link className="btn btn-quiet" href="/minha-disponibilidade">Disponibilidade</Link>
           </div>
           <p className="account-note"><ShieldCheck size={17}/> Seu perfil de músico é independente do perfil de cantor. Publicar ou ocultar um não altera o outro.</p>
         </>:<div className="account-activation">
           <Guitar size={28}/>
           <h3>Um portfólio só seu.</h3>
           <p>Mostre instrumentos e trabalhos como músico, mesmo que você também cante. A ativação é permanente para você e só poderá ser revertida pela administração.</p>
           <button type="button" className="btn btn-primary" disabled={Boolean(enabling)}
             onClick={event=>openRoleConfirmation("musician",event)}>Ativar função de músico <ArrowRight size={16}/></button>
         </div>}
       </section>}

       {activeTab==="dados"&&<section className="account-section" aria-label="Editar informações da conta">
         <div className="account-section-heading"><span className="account-kicker"><UserRound size={15}/> IDENTIDADE DA CONTA</span>
           <h2>Dados pessoais</h2>
           <p>O nome identifica sua conta. O @ identifica o endereço público do cantor, quando essa função estiver ativa.</p>
         </div>
         <p className="account-note"><CalendarDays size={16}/> Nome e @ podem ser alterados <strong>uma vez a cada 60 dias</strong>, com prazos independentes e proteção no servidor.</p>
         <form onSubmit={save} className="account-form">
           <label htmlFor="account-name">Nome público</label>
           <input id="account-name" value={name} maxLength={80} minLength={2} required
             disabled={Boolean(nameReady)||saving} onChange={e=>setName(e.target.value)}/>
           <small>{nameReady?"Próxima alteração do nome: "+dateString(nameReady):"Seu nome pode ser alterado agora."}</small>
           {account.is_singer&&<>
             <label htmlFor="account-username">@ do cantor</label>
             <input id="account-username" value={username} maxLength={30} minLength={3}
               pattern="[a-z0-9-]{3,30}" required={Boolean(usernameChanged)}
               placeholder="seuarroba" disabled={Boolean(usernameReady)||saving}
               onChange={e=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,""))}/>
             <small>{usernameReady?"Próxima alteração do @: "+dateString(usernameReady):"Seu @ define o link da página de cantor. Atualizá-lo pode afetar links anteriores."}</small>
           </>}
           <button type="submit" className="btn btn-primary" disabled={saveBlocked}>
             {saving?<LoaderCircle size={16}/>:<Save size={16}/>} {saving?"Salvando...":"Salvar alterações"}
           </button>
         </form>
         <p className="account-tip">Para mudar fotos, biografia, instrumentos, redes sociais ou agenda, use as abas específicas de cantor e músico.</p>
       </section>}

       {activeTab==="seguranca"&&<section className="account-section" aria-label="E-mail e segurança">
         <div className="account-section-heading"><span className="account-kicker"><KeyRound size={15}/> ACESSO E PROTEÇÃO</span>
           <h2>E-mail e segurança</h2>
           <p>Atualize seu endereço de acesso e sua senha com as verificações do Supabase Auth.</p>
         </div>
         <div className="account-security-stack">
           <form className="account-form account-security-card" onSubmit={event=>void updateEmail(event)}>
             <div className="account-security-title"><Mail size={20}/><div><h3>Alterar e-mail</h3><p>E-mail atual: <strong>{email||"não informado"}</strong></p></div></div>
             <label htmlFor="account-new-email">Novo e-mail de acesso</label>
             <input id="account-new-email" type="email" autoComplete="email" required value={newEmail}
               placeholder="novoemail@exemplo.com" onChange={event=>setNewEmail(event.target.value)}
               disabled={securityBusy}/>
             <small>Você receberá instruções para confirmar a troca. Dependendo da configuração de segurança, os dois endereços precisam confirmar.</small>
             <button type="submit" className="btn btn-primary"
               disabled={securityBusy||!newEmail.trim()||newEmail.trim().toLowerCase()===email.trim().toLowerCase()}>
               {securityBusy?<LoaderCircle size={16}/>:<Mail size={16}/>} Solicitar mudança de e-mail
             </button>
           </form>
           <form className="account-form account-security-card" onSubmit={event=>void updatePassword(event)}>
             <div className="account-security-title"><LockKeyhole size={20}/><div><h3>Alterar senha</h3><p>Recomendamos uma senha longa e exclusiva.</p></div></div>
             <label htmlFor="account-new-password">Nova senha</label>
             <div className="account-password-wrapper">
               <input id="account-new-password" type={showPassword?"text":"password"} autoComplete="new-password"
                 minLength={12} required value={password} onChange={event=>setPassword(event.target.value)}
                 disabled={securityBusy}/>
               <button type="button" onClick={()=>setShowPassword(v=>!v)}
                 aria-label={showPassword?"Ocultar senha":"Mostrar senha"} aria-pressed={showPassword}>
                 {showPassword?<EyeOff size={18}/>:<Eye size={18}/>}
               </button>
             </div>
             <label htmlFor="account-confirm-password">Confirmar nova senha</label>
             <input id="account-confirm-password" type={showPassword?"text":"password"}
               autoComplete="new-password" minLength={12} required value={passwordAgain}
               onChange={event=>setPasswordAgain(event.target.value)} disabled={securityBusy}/>
             <small>No mínimo 12 caracteres. Por segurança, a plataforma pode pedir que você confirme a sessão novamente.</small>
             <button type="submit" className="btn btn-primary"
               disabled={securityBusy||password.length<12||password!==passwordAgain}>
               {securityBusy?<LoaderCircle size={16}/>:<KeyRound size={16}/>} Atualizar senha
             </button>
           </form>
         </div>
       </section>}

       {activeTab==="privacidade"&&<section className="account-section" aria-label="Privacidade das minhas páginas">
         <div className="account-section-heading"><span className="account-kicker"><Shield size={15}/> SUA VISIBILIDADE</span>
           <h2>Privacidade e publicação</h2>
           <p>Você controla separadamente o que é publicado como cantor e como músico.</p>
         </div>
         <div className="account-privacy-list">
           <article><div><Mic2 size={19}/><div><h3>Página de cantor</h3>
             <p>{account.is_singer
               ?account.is_public?"Seu perfil de cantor está público.":"Seu perfil de cantor está oculto do público."
               :"Você ainda não ativou uma página de cantor."}</p></div></div>
             <button type="button" onClick={()=>switchTab("cantor")}>Gerenciar <ArrowRight size={15}/></button>
           </article>
           <article><div><Guitar size={19}/><div><h3>Portfólio de músico</h3>
             <p>{account.is_musician
               ?account.musician_published?"Seu portfólio de músico está público.":"Seu portfólio de músico está oculto do público."
               :"Você ainda não ativou um portfólio de músico."}</p></div></div>
             <button type="button" onClick={()=>switchTab("musico")}>Gerenciar <ArrowRight size={15}/></button>
           </article>
         </div>
         <div className="account-privacy-explain">
           <ShieldCheck size={21}/>
           <div><strong>O que fica privado?</strong>
             <p>Seu e-mail de acesso, sua senha e dados internos da conta não aparecem nas páginas públicas. Informações de contratação e recursos privados só podem ser lidos pelas pessoas autorizadas.</p>
             <p>Para ocultar fotos, biografia ou o perfil inteiro, altere a publicação no editor de cantor ou músico e salve. A página pública só mostra conteúdo publicado.</p>
             <button type="button" className="account-inline-action" onClick={()=>switchTab("seguranca")}>Revisar segurança da minha conta <ArrowRight size={15}/></button>
           </div>
         </div>
       </section>}
     </div>
   </div>}

   {pendingRole&&<div className="account-dialog-backdrop" onPointerDown={e=>{
     if(e.target===e.currentTarget)closeRoleConfirmation();
   }}>
     <div id="account-role-dialog" role="dialog" aria-modal="true"
       aria-labelledby="account-role-title" aria-describedby="account-role-description"
       className="account-role-dialog">
       <button type="button" className="account-dialog-close" onClick={closeRoleConfirmation}
         aria-label="Cancelar ativação" disabled={Boolean(enabling)}><X size={20}/></button>
       <span className="account-dialog-icon"><ShieldCheck size={26}/></span>
       <span className="account-kicker">CONFIRMAÇÃO ADICIONAL</span>
       <h2 id="account-role-title">Ativar função de {pendingRole==="singer"?"cantor":"músico"}?</h2>
       <p id="account-role-description">Você terá dois perfis independentes quando ambas as funções estiverem ativas. Essa ativação não pode ser desfeita por você: somente a administração do StageFlow poderá reverter.</p>
       <div className="account-dialog-notice">A ativação é gratuita. Não altera seu plano, assinatura ou recursos Pro.</div>
       <label className="account-dialog-check">
         <input type="checkbox" checked={confirmationChecked}
           onChange={event=>setConfirmationChecked(event.target.checked)} disabled={Boolean(enabling)}/>
         <span>Entendo que a ativação é permanente para minha conta, salvo reversão pela administração.</span>
       </label>
       <label htmlFor="account-confirm-role">Digite <strong>ATIVAR</strong> para confirmar</label>
       <input id="account-confirm-role" ref={roleDialogInput} value={confirmationText}
         autoComplete="off" maxLength={12} disabled={Boolean(enabling)}
         onChange={event=>setConfirmationText(event.target.value)} placeholder="ATIVAR"/>
       <div className="account-dialog-actions">
         <button type="button" className="btn btn-quiet" disabled={Boolean(enabling)}
           onClick={closeRoleConfirmation}>Cancelar</button>
         <button type="button" className="btn btn-primary" disabled={Boolean(enabling)||
           !confirmationChecked||confirmationText.trim().toLocaleUpperCase("pt-BR")!=="ATIVAR"}
           onClick={()=>void activate()}>
           {enabling?<LoaderCircle size={16}/>:<CheckCircle2 size={16}/>} Confirmar ativação
         </button>
       </div>
     </div>
   </div>}
 </main>;
}
