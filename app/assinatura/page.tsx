"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { ArrowLeft,CheckCircle2,LockKeyhole,Crown,ShieldCheck,LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Access={entitled:boolean;published:boolean}|null;
export default function Assinatura(){
 const [checking,setChecking]=useState(true);
 const [access,setAccess]=useState<Access>(null);
 const [message,setMessage]=useState("");
 useEffect(()=>{
  let active=true;
  async function check(){
   try{
    const db=createClient();
    const {data:{user},error:authError}=await db.auth.getUser();
    if(authError||!user){if(active)setMessage("Entre com sua conta de cantor para consultar os benefícios do Pro.");return;}
    const {data,error}=await db.rpc("stage_my_pro_site_publication");
    if(!active)return;
    if(error||!data){setMessage("A assinatura Pro é exclusiva de contas com função de cantor/artista. A ativação comercial ainda não está disponível.");return;}
    setAccess({entitled:data.entitled===true,published:data.published===true});
   }catch{if(active)setMessage("Não foi possível consultar seu acesso agora.");}
   finally{if(active)setChecking(false);}
  }
  void check();
  return()=>{active=false};
 },[]);
 return <main className="container" style={{maxWidth:800,paddingBottom:80}}>
  <nav className="nav"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link><Link className="btn btn-quiet" href="/planos"><ArrowLeft size={16}/> Ver planos</Link></nav>
  <section className="feature" style={{margin:"55px auto",padding:"clamp(22px,5vw,48px)"}}>
   <span className="eyebrow"><Crown size={16}/> ASSINATURA DO CANTOR</span>
   <h1 style={{margin:"18px 0"}}>Seu StageFlow <span className="accent">Pro.</span></h1>
   {checking?<p role="status"><LoaderCircle size={18}/> Consultando seu acesso...</p>:
    access?.entitled?<><p role="status"><CheckCircle2 size={19}/> Sua conta já possui acesso Pro autorizado.</p><Link className="btn btn-primary" href="/meu-perfil-artistico/site-profissional">Acessar meu site Pro</Link></>:
    <><p>Site profissional, portfólio avançado, análises financeiras e subdomínio estarão incluídos na versão Pro do cantor.</p>
     <p role="status" style={{display:"flex",gap:10,alignItems:"center"}}><LockKeyhole size={19}/> Assinatura ainda indisponível. Não estamos recebendo pagamentos nem registrando compras.</p>
     {message&&<p>{message}</p>}
     <Link className="btn btn-quiet" href="/planos">Conferir benefícios do Pro</Link>
     <p style={{marginTop:24,fontSize:13,color:"var(--muted)"}}><ShieldCheck size={16}/> Seu controle financeiro e suas ferramentas gratuitas continuam disponíveis.</p>
    </>}
  </section>
 </main>;
}
