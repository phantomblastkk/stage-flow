"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { ArrowLeft,CheckCircle2,LockKeyhole,Crown,ShieldCheck,LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, InlineNotice, LoadingState } from "@/src/components/ui";
import "@/src/domains/billing/components/subscription-ui.css";

type Access={entitled:boolean;published:boolean}|null;
export default function Assinatura(){
 const [checking,setChecking]=useState(true);
 const [access,setAccess]=useState<Access>(null);
 const [message,setMessage]=useState("");
 const [readFailed,setReadFailed]=useState(false);
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  let active=true;
  setChecking(true);setAccess(null);setMessage("");setReadFailed(false);
  async function check(){
   try{
    const db=createClient();
    const {data:{user},error:authError}=await db.auth.getUser();
    if(authError){if(active){setReadFailed(true);setMessage("Não foi possível validar sua sessão agora.");}return;}
    if(!user){if(active)setMessage("Entre com sua conta de cantor para consultar os benefícios do Pro.");return;}
    const {data,error}=await db.rpc("stage_my_pro_site_publication");
    if(!active)return;
    if(error){setReadFailed(true);setMessage("Não foi possível consultar seu acesso Pro agora. Tente novamente.");return;}
    if(!data){setMessage("A assinatura Pro é exclusiva de contas com função de cantor/artista. A ativação comercial ainda não está disponível.");return;}
    setAccess({entitled:data.entitled===true,published:data.published===true});
   }catch{if(active){setReadFailed(true);setMessage("Não foi possível consultar seu acesso agora.");}}
   finally{if(active)setChecking(false);}
  }
  void check();
  return()=>{active=false};
 },[retry]);
 return <main className="container subscription-page">
  <nav className="nav"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link><Link className="sf-ui-button sf-ui-button-ghost" href="/planos"><ArrowLeft size={16}/> Ver planos</Link></nav>
  <section className="sf-ui-card subscription-card">
   <span className="eyebrow"><Crown size={16}/> ASSINATURA DO CANTOR</span>
   <h1 className="subscription-title">Seu StageFlow <span className="accent">Pro.</span></h1>
   {checking?<LoadingState label="Consultando seu acesso..."/>:
    readFailed?<div className="subscription-stack"><InlineNotice tone="danger">{message}</InlineNotice><Button onClick={()=>setRetry(v=>v+1)}>Tentar novamente</Button></div>:
    access?.entitled?<div className="subscription-stack"><InlineNotice tone="success">Sua conta já possui acesso Pro autorizado.</InlineNotice><Link className="sf-ui-button sf-ui-button-primary" href="/perfil-artistico?aba=midia">Acessar meu Perfil Artístico</Link></div>:
    <div className="subscription-stack"><p>Perfil Artístico, portfólio avançado, análises financeiras e subdomínio estarão incluídos na versão Pro do cantor.</p>
     <InlineNotice tone="warning">Assinatura ainda indisponível. Não estamos recebendo pagamentos nem registrando compras.</InlineNotice>
     {message&&<p>{message}</p>}
     <Link className="sf-ui-button sf-ui-button-ghost" href="/planos">Conferir benefícios do Pro</Link>
     <p className="subscription-footnote"><ShieldCheck size={16}/> Seu controle financeiro e suas ferramentas gratuitas continuam disponíveis.</p>
    </div>}
  </section>
 </main>;
}
