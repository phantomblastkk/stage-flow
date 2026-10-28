"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Music2, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Only allow the private owner dashboard as an explicit post-login return target.
// Other values are ignored to avoid open redirects.
function postLoginDestination(): string {
  return new URLSearchParams(window.location.search).get("next") === "/admin/central"
    ? "/admin/central" : "/painel";
}

export default function LoginPage() {
  const [inviteCode, setInviteCode] = useState("");
  const [checkingSession,setCheckingSession] = useState(true);
  useEffect(() => {
    const code=new URLSearchParams(window.location.search).get("convite") || "";
    setInviteCode(code);
    // During auth verification, never render a password form to someone
    // already logged in. The login page is not a logout action.
    let active=true;
    async function check(){
      try{
        const {data,error}=await createClient().auth.getUser();
        if(active&&!error&&data.user){
          window.location.replace(code?"/convite?codigo="+encodeURIComponent(code):postLoginDestination());
          return;
        }
      }catch{/* On network failure show the form without signing anyone out. */}
      if(active)setCheckingSession(false);
    }
    void check();
    return()=>{active=false};
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setMessage(""); setError(false);
    try {
      const supabase = createClient();
      const input=email.trim();
      const raw=input.replace(/[^0-9]/g,"");
      const phone=raw.length===10||raw.length===11?"55"+raw:raw;
      const isPhone=!input.includes("@") && /^55[1-9][0-9]{9,10}$/.test(phone);
      if(!isPhone && !/^\S+@\S+\\.\S+$/.test(input))
        throw new Error("Informe seu e-mail ou WhatsApp com DDD.");
      const { error: signInError } = await supabase.auth.signInWithPassword(
        isPhone?{phone:"+"+phone,password}:{email:input,password}
      );
      if (signInError) throw signInError;
      window.location.href = inviteCode ? "/convite?codigo=" + encodeURIComponent(inviteCode) : postLoginDestination();
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : "Não foi possível entrar. Confira os dados e tente novamente.");
    } finally { setBusy(false); }
  }

  if(checkingSession)return <main className="auth-wrap">
    <div className="container" style={{minHeight:"60vh",display:"grid",placeItems:"center",textAlign:"center"}}>
      <p style={{color:"var(--muted)"}}>Verificando sua sessão do Stage Flow...</p>
    </div>
  </main>;

  return <main className="auth-wrap">
    <aside className="auth-aside"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link><div><div className="eyebrow">BEM-VINDO DE VOLTA</div><h1>Sua próxima apresentação começa <span className="accent">aqui.</span></h1><p className="tagline">Entre para acompanhar sua agenda musical, seus convites e as novidades da plataforma.</p></div><Link href="/" className="fine"><ArrowLeft size={14} style={{display:"inline",verticalAlign:"middle"}}/> Voltar ao início</Link></aside>
    <section className="auth-main"><div className="auth-card"><Link href="/" className="fine">← Voltar para o site</Link><h2 style={{marginTop:24}}>Entrar na conta</h2><p>{inviteCode ? "Entre com sua conta para vincular o convite ao seu perfil de músico." : "Use seu e-mail ou número de WhatsApp verificado e senha."}</p>
      <form onSubmit={handleSubmit}>
        <div className="field"><label htmlFor="email">E-mail ou WhatsApp com DDD</label><input id="email" type="text" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@exemplo.com ou (11) 99999-9999" required /></div>
        <div className="field"><label htmlFor="password">Senha</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Sua senha" required /></div>
        <button className="btn btn-primary full" type="submit" disabled={busy}>{busy ? "Entrando..." : "Entrar"} <Music2 size={16}/></button>
      </form>
      {message && <div role="alert" className={error?"coming":"coming"} style={error?{borderColor:"#754343",background:"#281919",color:"#ffb5b5"}:{}}>{message}</div>}
      <div className="auth-bottom">Ainda não tem conta? <Link href={inviteCode ? "/cadastro?convite=" + encodeURIComponent(inviteCode) : "/cadastro"}>Cadastre-se</Link></div>
    </div></section>
  </main>;
}
