"use client";

import Link from "next/link";
import { Music2, ArrowLeft } from "lucide-react";

export default function LoginPage() {
  return <main className="auth-wrap">
    <aside className="auth-aside"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link><div><div className="eyebrow">BEM-VINDO DE VOLTA</div><h1>Sua próxima apresentação começa <span className="accent">aqui.</span></h1><p className="tagline">Entre para acompanhar sua agenda musical, seus convites e as novidades da plataforma.</p></div><Link href="/" className="fine"><ArrowLeft size={14} style={{display:"inline",verticalAlign:"middle"}}/> Voltar ao início</Link></aside>
    <section className="auth-main"><div className="auth-card"><Link href="/" className="fine">← Voltar para o site</Link><h2 style={{marginTop:24}}>Entrar na conta</h2><p>Use seu e-mail e senha para continuar.</p><form onSubmit={(e)=>{e.preventDefault(); alert("A tela visual está pronta, mas o login ainda precisa ser conectado ao Supabase.");}}><div className="field"><label htmlFor="email">E-mail</label><input id="email" type="email" placeholder="voce@exemplo.com" required /></div><div className="field"><label htmlFor="password">Senha</label><input id="password" type="password" placeholder="Sua senha" required /></div><button className="btn btn-primary full" type="submit">Entrar <Music2 size={16}/></button></form><div className="coming">Esta é a primeira interface. Estamos preparando a conexão segura de login e recuperação de senha.</div><div className="auth-bottom">Ainda não tem conta? <Link href="/cadastro">Cadastre-se</Link></div></div></section>
  </main>;
}
