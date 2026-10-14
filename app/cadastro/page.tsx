"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, UserRound, Music2, Building2 } from "lucide-react";

export default function CadastroPage() {
  const [role, setRole] = useState<"musician" | "producer">("musician");
  return <main className="auth-wrap">
    <aside className="auth-aside"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link><div><div className="eyebrow">SEU PRÓXIMO CAPÍTULO</div><h1>Mais organização. <span className="accent">Mais palco.</span></h1><p className="tagline">Crie seu espaço para organizar shows, receber convites e aproximar músicos e produtores.</p></div><Link href="/" className="fine"><ArrowLeft size={14} style={{display:"inline",verticalAlign:"middle"}}/> Voltar ao início</Link></aside>
    <section className="auth-main"><div className="auth-card"><Link href="/" className="fine">← Voltar para o site</Link><h2 style={{marginTop:24}}>Crie sua conta</h2><p>Primeiro, conte como você usa o Stage Flow.</p>
      <div className="role-options">
        <button type="button" className="role-option" onClick={()=>setRole("musician")} style={role==="musician"?{borderColor:"#c6f36b",background:"#1b2416"}:{}}><Music2 size={18} color={role==="musician"?"#c6f36b":"#98a3b6"}/><strong>Músico / artista</strong><span>Minha agenda e portfólio</span></button>
        <button type="button" className="role-option" onClick={()=>setRole("producer")} style={role==="producer"?{borderColor:"#c6f36b",background:"#1b2416"}:{}}><Building2 size={18} color={role==="producer"?"#c6f36b":"#98a3b6"}/><strong>Produtor</strong><span>Organizar eventos e equipes</span></button>
      </div>
      <form onSubmit={(e)=>{e.preventDefault(); alert("Cadastro visual pronto. A criação real de conta e a reserva de usuário serão ativadas quando conectarmos o Supabase.");}}>
        <div className="field"><label htmlFor="name">Nome {role==="producer"?"do produtor ou empresa":"artístico"}</label><input id="name" placeholder={role==="producer"?"Nome da produtora":"Ex.: Cantor Sousa"} required /></div>
        {role==="musician"&&<div className="field"><label htmlFor="slug">Nome de usuário para seu portfólio</label><input id="slug" placeholder="cantorsousa" pattern="[A-Za-z0-9-]{3,30}" /><span className="field-help">Seu endereço futuro: usuario.stageflow.com. Use de 3 a 30 letras, números ou hífens.</span></div>}
        <div className="field"><label htmlFor="email">E-mail</label><input id="email" type="email" placeholder="voce@exemplo.com" required /></div>
        <div className="field"><label htmlFor="password">Criar senha</label><input id="password" type="password" minLength={8} placeholder="Pelo menos 8 caracteres" required /></div>
        <button className="btn btn-primary full" type="submit">Criar conta grátis</button>
      </form>
      <div className="coming">Demonstração de interface: nenhum dado é enviado ou salvo ainda. O cadastro real será ligado ao banco com regras de segurança.</div><div className="auth-bottom">Já tem uma conta? <Link href="/login">Entrar</Link></div>
    </div></section>
  </main>;
}
