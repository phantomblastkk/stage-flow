"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Music2, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const reservedArtistUsernames = new Set([
  "admin", "api", "auth", "artista", "artistas", "cadastro", "configuracoes",
  "convite", "convites", "dashboard", "entrar", "equipes", "eventos",
  "login", "logout", "marketplace", "meu-perfil", "meu-perfil-artistico",
  "meu-portfolio", "meus-convites", "musico", "musicos", "painel", "planos",
  "privacidade", "publico", "sobre", "suporte", "termos", "www"
]);

export default function CadastroPage() {
  const [isArtist, setIsArtist] = useState(true);
  const [inviteCode, setInviteCode] = useState("");
  useEffect(() => { const code = new URLSearchParams(window.location.search).get("convite"); if (code) { setInviteCode(code); setIsArtist(true); } }, []);
  const [isProducer, setIsProducer] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage(""); setError(false);
    try {
      if (!inviteCode && !isArtist && !isProducer) throw new Error("Selecione pelo menos uma função para sua conta.");
      const supabase = createClient();
      const cleanUsername = username.trim().toLowerCase();
      if (isArtist && !inviteCode && reservedArtistUsernames.has(cleanUsername)) {
        throw new Error("Este @ é reservado para o Stage Flow. Escolha outro nome artístico.");
      }
      const needsMusicianPhone = Boolean(inviteCode) || isArtist;
      const rawPhone = whatsappPhone.replace(/\D/g, "");
      const internationalPhone = rawPhone.length === 10 || rawPhone.length === 11 ? "55" + rawPhone : rawPhone;
      if (needsMusicianPhone && !/^55[1-9][0-9]{9,10}$/.test(internationalPhone)) {
        throw new Error("Informe um WhatsApp brasileiro válido, com DDD. Exemplo: (11) 99999-9999.");
      }
      if (needsMusicianPhone && !whatsappConsent) {
        throw new Error("Para concluir o cadastro de músico, confirme a autorização de contato pelo WhatsApp.");
      }
      const { data: signupData, error: signUpError } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: inviteCode ? window.location.origin + "/convite?codigo=" + encodeURIComponent(inviteCode) : undefined,
          data: {
            role: inviteCode ? "musician" : isProducer && !isArtist ? "producer" : "musician",
            is_artist: inviteCode ? true : isArtist,
            is_producer: inviteCode ? false : isProducer,
            display_name: displayName.trim(),
            whatsapp_phone: needsMusicianPhone ? internationalPhone : null,
            whatsapp_opt_in: needsMusicianPhone && whatsappConsent,
            username: inviteCode ? null : isArtist ? cleanUsername : null
          }
        }
      });
      if (signUpError) throw signUpError;
      if (inviteCode && signupData.session) {
        window.location.href = "/convite?codigo=" + encodeURIComponent(inviteCode);
        return;
      }
      setMessage(inviteCode
        ? "Cadastro enviado! Confira seu e-mail para confirmar sua conta. Depois da confirmação, abra novamente o link do convite para vinculá-lo. Caso a confirmação já esteja desativada, entre com sua conta pelo link recebido."
        : "Cadastro enviado! Se a confirmação por e-mail estiver ativada, confirme sua conta pelo e-mail recebido. Recursos premium continuam bloqueados até um upgrade.");
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : "Não foi possível criar a conta. Confira os dados e tente novamente.");
    } finally { setBusy(false); }
  }

  return <main className="auth-wrap">
    <aside className="auth-aside"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link><div><div className="eyebrow">SEU PRÓXIMO CAPÍTULO</div><h1>Mais organização. <span className="accent">Mais palco.</span></h1><p className="tagline">Uma conta para organizar shows, receber convites e aproximar músicos e produtores.</p></div><Link href="/" className="fine"><ArrowLeft size={14} style={{display:"inline",verticalAlign:"middle"}}/> Voltar ao início</Link></aside>
    <section className="auth-main"><div className="auth-card"><Link href="/" className="fine">← Voltar para o site</Link><h2 style={{marginTop:24}}>Crie sua conta</h2>{inviteCode && <p className="coming">Você chegou por um convite. Crie sua conta grátis de músico para participar do show. Não é necessário escolher nome de usuário nem contratar um plano.</p>}<p>{inviteCode ? "Basta informar seu nome, e-mail e senha." : "Escolha uma ou mais funções. Você não precisa criar contas separadas."}</p>
      {!inviteCode && <div className="role-options">
        <button type="button" className="role-option" onClick={()=>setIsArtist(v=>!v)} aria-pressed={isArtist} style={isArtist?{borderColor:"#c6f36b",background:"#1b2416"}:{}}><Music2 size={18} color={isArtist?"#c6f36b":"#98a3b6"}/><strong>Sou cantor / músico</strong><span>Perfil artístico, agenda e convites</span><span>{isArtist?"✓ Selecionado":"Toque para selecionar"}</span></button>
        <button type="button" className="role-option" onClick={()=>setIsProducer(v=>!v)} aria-pressed={isProducer} style={isProducer?{borderColor:"#c6f36b",background:"#1b2416"}:{}}><Building2 size={18} color={isProducer?"#c6f36b":"#98a3b6"}/><strong>Também sou produtor</strong><span>Organizar eventos e equipes</span><span>{isProducer?"✓ Selecionado":"Toque para selecionar"}</span></button>
      </div>}
      <form onSubmit={handleSubmit}>
        <div className="field"><label htmlFor="name">Nome {inviteCode ? "completo" : isProducer && !isArtist ? "do produtor ou empresa" : "artístico / profissional"}</label><input id="name" autoComplete="name" value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder={isProducer && !isArtist ? "Nome da produtora" : "Ex.: Cantor Sousa"} required /></div>
        {isArtist&&!inviteCode&&<div className="field"><label htmlFor="slug">Nome de usuário do perfil artístico</label><input id="slug" value={username} onChange={e=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,""))} placeholder="cantorsousa" pattern="[a-z0-9-]{3,30}" minLength={3} maxLength={30} required /><span className="field-help">Seu @ gratuito criará o endereço stageflow.com/{username || "seuusuario"} quando publicá-lo, após o domínio oficial ficar disponível. O subdomínio personalizado é um adicional pago separado.</span></div>}
        {(isArtist || Boolean(inviteCode)) && <>
          <div className="field">
            <label htmlFor="whatsapp">Seu WhatsApp com DDD *</label>
            <input id="whatsapp" type="tel" autoComplete="tel" inputMode="tel" value={whatsappPhone} onChange={e=>setWhatsappPhone(e.target.value)} placeholder="(11) 99999-9999" required maxLength={24}/>
            <span className="field-help">Número obrigatório para contas de músicos. Ele fica armazenado de forma privada e não aparece no seu perfil público.</span>
          </div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 12, lineHeight: 1.6, color: "var(--muted)", marginBottom: 20 }}>
            <input type="checkbox" checked={whatsappConsent} onChange={e=>setWhatsappConsent(e.target.checked)} required aria-required="true" style={{ marginTop: 4, flexShrink: 0, accentColor: "var(--lime)" }}/>
            <span>Li e autorizo que os organizadores dos shows para os quais tenho convites pendentes ou aceitos visualizem meu número para entrar em contato e enviar lembretes manuais pelo WhatsApp. Esta confirmação é obrigatória para o cadastro de músico e posso desativar os contatos depois em Meus convites. *</span>
          </label>
        </>}
        <div className="field"><label htmlFor="email">E-mail</label><input id="email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@exemplo.com" required /></div>
        <div className="field"><label htmlFor="password">Criar senha</label><input id="password" type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} placeholder="Pelo menos 8 caracteres" required /></div>
        <button className="btn btn-primary full" type="submit" disabled={busy}>{busy ? "Criando conta..." : "Criar conta grátis"}</button>
      </form>
      {message && <div role="status" className="coming" style={error?{borderColor:"#754343",background:"#281919",color:"#ffb5b5"}:{}}>{message}</div>}
      <div className="auth-bottom">Já tem uma conta? <Link href={inviteCode ? "/login?convite=" + encodeURIComponent(inviteCode) : "/login"}>Entrar</Link></div>
    </div></section>
  </main>;
}
