"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Music2, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function CadastroPage() {
  const [role, setRole] = useState<"musician" | "producer">("musician");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage(""); setError(false);
    try {
      const supabase = createClient();
      const cleanUsername = username.trim().toLowerCase();
      const { error: signUpError } = await supabase.auth.signUp({
        email, password,
        options: { data: { role, display_name: displayName.trim(), username: role === "musician" ? cleanUsername : null } }
      });
      if (signUpError) throw signUpError;
      setMessage("Cadastro enviado. Se a confirmação por e-mail estiver ativada no Supabase, abra sua caixa de entrada para confirmar a conta. O perfil no banco precisa da configuração SQL indicada no README antes de usar em produção.");
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : "Não foi possível criar a conta. Confira os dados e tente novamente.");
    } finally { setBusy(false); }
  }

  return <main className="auth-wrap">
    <aside className="auth-aside"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link><div><div className="eyebrow">SEU PRÓXIMO CAPÍTULO</div><h1>Mais organização. <span className="accent">Mais palco.</span></h1><p className="tagline">Crie seu espaço para organizar shows, receber convites e aproximar músicos e produtores.</p></div><Link href="/" className="fine"><ArrowLeft size={14} style={{display:"inline",verticalAlign:"middle"}}/> Voltar ao início</Link></aside>
    <section className="auth-main"><div className="auth-card"><Link href="/" className="fine">← Voltar para o site</Link><h2 style={{marginTop:24}}>Crie sua conta</h2><p>Primeiro, conte como você usa o Stage Flow.</p>
      <div className="role-options">
        <button type="button" className="role-option" onClick={()=>setRole("musician")} style={role==="musician"?{borderColor:"#c6f36b",background:"#1b2416"}:{}}><Music2 size={18} color={role==="musician"?"#c6f36b":"#98a3b6"}/><strong>Músico / artista</strong><span>Minha agenda e portfólio</span></button>
        <button type="button" className="role-option" onClick={()=>setRole("producer")} style={role==="producer"?{borderColor:"#c6f36b",background:"#1b2416"}:{}}><Building2 size={18} color={role==="producer"?"#c6f36b":"#98a3b6"}/><strong>Produtor</strong><span>Organizar eventos e equipes</span></button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="field"><label htmlFor="name">Nome {role==="producer"?"do produtor ou empresa":"artístico"}</label><input id="name" autoComplete="name" value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder={role==="producer"?"Nome da produtora":"Ex.: Cantor Sousa"} required /></div>
        {role==="musician"&&<div className="field"><label htmlFor="slug">Nome de usuário para seu portfólio</label><input id="slug" value={username} onChange={e=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,""))} placeholder="cantorsousa" pattern="[a-z0-9-]{3,30}" minLength={3} maxLength={30} required /><span className="field-help">Seu endereço futuro: usuario.stageflow.com. Use de 3 a 30 letras, números ou hífens. A disponibilidade será validada no banco.</span></div>}
        <div className="field"><label htmlFor="email">E-mail</label><input id="email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@exemplo.com" required /></div>
        <div className="field"><label htmlFor="password">Criar senha</label><input id="password" type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} placeholder="Pelo menos 8 caracteres" required /></div>
        <button className="btn btn-primary full" type="submit" disabled={busy}>{busy ? "Criando conta..." : "Criar conta grátis"}</button>
      </form>
      {message && <div role="status" className="coming" style={error?{borderColor:"#754343",background:"#281919",color:"#ffb5b5"}:{}}>{message}</div>}
      <div className="auth-bottom">Já tem uma conta? <Link href="/login">Entrar</Link></div>
    </div></section>
  </main>;
}
