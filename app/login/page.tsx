"use client";

import Link from "next/link";
import { useState } from "react";
import { Music2, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
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
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      window.location.href = "/painel";
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : "Não foi possível entrar. Confira os dados e tente novamente.");
    } finally { setBusy(false); }
  }

  return <main className="auth-wrap">
    <aside className="auth-aside"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link><div><div className="eyebrow">BEM-VINDO DE VOLTA</div><h1>Sua próxima apresentação começa <span className="accent">aqui.</span></h1><p className="tagline">Entre para acompanhar sua agenda musical, seus convites e as novidades da plataforma.</p></div><Link href="/" className="fine"><ArrowLeft size={14} style={{display:"inline",verticalAlign:"middle"}}/> Voltar ao início</Link></aside>
    <section className="auth-main"><div className="auth-card"><Link href="/" className="fine">← Voltar para o site</Link><h2 style={{marginTop:24}}>Entrar na conta</h2><p>Use seu e-mail e senha para continuar.</p>
      <form onSubmit={handleSubmit}>
        <div className="field"><label htmlFor="email">E-mail</label><input id="email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@exemplo.com" required /></div>
        <div className="field"><label htmlFor="password">Senha</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Sua senha" required /></div>
        <button className="btn btn-primary full" type="submit" disabled={busy}>{busy ? "Entrando..." : "Entrar"} <Music2 size={16}/></button>
      </form>
      {message && <div role="alert" className={error?"coming":"coming"} style={error?{borderColor:"#754343",background:"#281919",color:"#ffb5b5"}:{}}>{message}</div>}
      <div className="auth-bottom">Ainda não tem conta? <Link href="/cadastro">Cadastre-se</Link></div>
    </div></section>
  </main>;
}
