"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Building2, Mic2, Guitar, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const reservedArtistUsernames = new Set([
  "admin", "api", "auth", "artista", "artistas", "cadastro", "configuracoes",
  "convite", "convites", "dashboard", "entrar", "equipes", "eventos",
  "login", "logout", "marketplace", "meu-perfil", "meu-perfil-artistico",
  "meu-portfolio", "meus-convites", "musico", "musicos", "painel", "planos",
  "assinatura", "conversas", "financeiro", "homologacao", "locais",
  "meu-desempenho", "meus-shows", "minha-disponibilidade",
  "notificacoes", "parceiros", "pro", "shows-recorrentes",
  "privacidade", "publico", "sobre", "suporte", "termos", "www"
]);

export default function CadastroPage() {
  const [artistKind, setArtistKind] = useState<"lead" | "support" | "none">("support");
  const [inviteCode, setInviteCode] = useState("");
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("convite");
    if (code) {
      setInviteCode(code);
      setArtistKind("support");
      setIsProducer(false);
    } else if (new URLSearchParams(window.location.search).get("parceiro") === "1") {
      // Facilitador visual apenas: jamais concede papel de gerente ou administrador.
      setArtistKind("none");
      setIsProducer(true);
      setPartnerOnboarding(true);
    }
  }, []);
  const [checkingSession, setCheckingSession] = useState(true);
  useEffect(() => {
    // An existing musician account can open a singer's invitation directly.
    // The invitation is a shortcut, never a prerequisite for free signup.
    let active = true;
    async function checkSession() {
      try {
        const { data, error } = await createClient().auth.getUser();
        if (active && !error && data.user) {
          const code = new URLSearchParams(window.location.search).get("convite");
          window.location.replace(code
            ? "/convite?codigo=" + encodeURIComponent(code)
            : "/painel");
          return;
        }
      } catch {
        // Keep the signup form available when verification is temporarily offline.
      }
      if (active) setCheckingSession(false);
    }
    void checkSession();
    return () => { active = false; };
  }, []);
  const [isProducer, setIsProducer] = useState(false);
  const [alsoMusician,setAlsoMusician] = useState(false);
  const [partnerOnboarding, setPartnerOnboarding] = useState(false);
  const isArtist = artistKind !== "none";
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
      if (!inviteCode && !isArtist && !isProducer) throw new Error("Selecione sua atividade principal.");
      const supabase = createClient();
      const cleanUsername = username.trim().toLowerCase();
      if (artistKind === "lead" && !inviteCode && reservedArtistUsernames.has(cleanUsername)) {
        throw new Error("Este @ é reservado para o Stage Flow. Escolha outro nome artístico.");
      }
      const needsMusicianPhone = (Boolean(inviteCode) || isArtist) && whatsappConsent;
      const rawPhone = whatsappPhone.replace(/\D/g, "");
      const internationalPhone = rawPhone.length === 10 || rawPhone.length === 11 ? "55" + rawPhone : rawPhone;
      if (needsMusicianPhone && !/^55[1-9][0-9]{9,10}$/.test(internationalPhone)) {
        throw new Error("Informe um WhatsApp brasileiro válido, com DDD. Exemplo: (11) 99999-9999.");
      }
      const { data: signupData, error: signUpError } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: inviteCode ? window.location.origin + "/convite?codigo=" + encodeURIComponent(inviteCode) : undefined,
          data: {
            role: inviteCode ? "musician" : isProducer && !isArtist ? "producer" : "musician",
            is_artist: inviteCode ? true : isArtist,
            is_producer: inviteCode ? false : isProducer,
            artist_kind: inviteCode ? "support" : isArtist ? artistKind : null,
            is_musician: Boolean(inviteCode) || (artistKind==="support") || (artistKind==="lead"&&alsoMusician),
            display_name: displayName.trim(),
            whatsapp_phone: needsMusicianPhone ? internationalPhone : null,
            whatsapp_opt_in: needsMusicianPhone && whatsappConsent,
            username: inviteCode ? null : artistKind === "lead" ? cleanUsername : null
          }
        }
      });
      if (signUpError) throw signUpError;
      if (signupData.session) {
        window.location.href = inviteCode
          ? "/convite?codigo=" + encodeURIComponent(inviteCode)
          : "/painel";
        return;
      }
      setMessage(inviteCode
        ? "Cadastro enviado! Confira seu e-mail para confirmar sua conta. Depois da confirmação, abra novamente o link do convite para vinculá-lo. Caso a confirmação já esteja desativada, entre com sua conta pelo link recebido."
        : partnerOnboarding
          ? "Cadastro enviado! Confirme seu e-mail e avise a administração da casa para conceder seu acesso. O cadastro por si só não libera a programação."
          : "Cadastro gratuito enviado! Se a confirmação por e-mail estiver ativada, confirme sua conta pelo e-mail recebido. Gestão, convites, portfólio e marketplace são gratuitos; apenas recursos profissionais opcionais de cantores pertencem aos futuros planos pagos.");
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : "Não foi possível criar a conta. Confira os dados e tente novamente.");
    } finally { setBusy(false); }
  }

  if (checkingSession) return <main className="auth-wrap">
    <div className="container" style={{ minHeight: "60vh", display: "grid", placeItems: "center", textAlign: "center" }}>
      <p style={{ color: "var(--muted)" }}>Verificando sua sessão do Stage Flow...</p>
    </div>
  </main>;

  return <main className="auth-wrap">
    <aside className="auth-aside"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link><div><div className="eyebrow">SEU PRÓXIMO CAPÍTULO</div><h1>Mais organização. <span className="accent">Mais palco.</span></h1><p className="tagline">Uma conta para organizar shows, receber convites e aproximar músicos e produtores.</p></div><Link href="/" className="fine"><ArrowLeft size={14} style={{display:"inline",verticalAlign:"middle"}}/> Voltar ao início</Link></aside>
    <section className="auth-main"><div className="auth-card"><Link href="/" className="fine">← Voltar para o site</Link><h2 style={{marginTop:24}}>Crie sua conta</h2>{inviteCode && <p className="coming">Você chegou por um convite para tocar. Vamos criar uma conta gratuita de músico de apoio para receber e negociar suas participações. Não precisa de @ nem de assinatura.</p>}
      {partnerOnboarding && <p className="coming"><strong>Cadastro de responsável por uma casa parceira.</strong> A opção Produtor/contratante já foi selecionada para facilitar. Depois de confirmar o e-mail, avise a administração da casa: somente ela pode liberar sua programação. Este link não dá acesso automático.</p>}<p>{inviteCode ? "Informe seus dados para acessar o convite. Você também pode se cadastrar gratuitamente sem convite." : "Crie sua conta gratuitamente. Músicos não precisam de convite; cantores e produtores também usam gratuitamente as ferramentas de shows e contratação."}</p>
      {!inviteCode && <div className="signup-role-picker">
        <div className="signup-role-grid" role="group" aria-label="Sua atividade principal">
          <button type="button" className="signup-role-card" aria-pressed={artistKind === "lead"}
            onClick={() => setArtistKind("lead")}>
            <Mic2 size={21}/><strong>Cantor / artista principal</strong>
            <span>Divulgo meus shows, gerencio minha equipe e quero uma página com meu @.</span>
            <small>{artistKind === "lead" ? "✓ Selecionado" : "Selecionar"}</small>
          </button>
          <button type="button" className="signup-role-card" aria-pressed={artistKind === "support"}
            onClick={() => setArtistKind("support")}>
            <Guitar size={21}/><strong>Músico de apoio</strong>
            <span>Crio minha conta grátis sem convite, publico portfólio, apareço no marketplace e recebo propostas.</span>
            <small>{artistKind === "support" ? "✓ Selecionado" : "Selecionar"}</small>
          </button>
          <button type="button" className="signup-role-card" aria-pressed={artistKind === "none"}
            onClick={() => { setArtistKind("none"); setIsProducer(true); }}>
            <Building2 size={21}/><strong>Produtor / contratante</strong>
            <span>Organizo apresentações, convido músicos e monto equipes.</span>
            <small>{artistKind === "none" ? "✓ Selecionado" : "Selecionar"}</small>
          </button>
        </div>
        {artistKind==="lead"&&<label className="signup-producer-add">
          <input type="checkbox" checked={alsoMusician} onChange={e=>setAlsoMusician(e.target.checked)}/>
          <span><strong>Também sou músico</strong><small>Libera meu portfólio de músico, convites para tocar e as funções de instrumentista nesta conta. Meu perfil de cantor continua separado.</small></span>
          <CheckCircle2 size={18} color={alsoMusician ? "#C0A7FF" : "#657083"}/>
        </label>}
        {isArtist && <label className="signup-producer-add">
          <input type="checkbox" checked={isProducer} onChange={e => setIsProducer(e.target.checked)}/>
          <span><strong>Também organizo ou contrato shows</strong><small>Ativa as ferramentas de produtor nesta mesma conta.</small></span>
          <CheckCircle2 size={18} color={isProducer ? "#C0A7FF" : "#657083"}/>
        </label>}
      </div>}
      <form onSubmit={handleSubmit}>
        <div className="field"><label htmlFor="name">Nome {inviteCode ? "profissional" : artistKind === "none" ? "do produtor ou empresa" : artistKind === "lead" ? "artístico" : "completo ou profissional"}</label><input id="name" autoComplete="name" value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder={artistKind === "none" ? "Ex.: Produções Vitória" : artistKind === "support" || inviteCode ? "Ex.: João Oliveira" : "Ex.: Cantor Sousa"} required /></div>
        {artistKind === "lead"&&!inviteCode&&<div className="field"><label htmlFor="slug">Seu @ artístico (grátis)</label><input id="slug" value={username} onChange={e=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,""))} placeholder="cantorsousa" pattern="[a-z0-9-]{3,30}" minLength={3} maxLength={30} required /><span className="field-help">Você poderá publicar sua página /{username || "seuusuario"}. Nome e @ podem ser alterados uma vez a cada 60 dias. O site completo com subdomínio é um adicional pago, separado do perfil gratuito.</span></div>}
        {(isArtist || Boolean(inviteCode)) && <>
          <div className="field">
            <label htmlFor="whatsapp">Seu WhatsApp com DDD (opcional)</label>
            <input id="whatsapp" type="tel" autoComplete="tel" inputMode="tel" value={whatsappPhone} onChange={e=>setWhatsappPhone(e.target.value)} placeholder="(11) 99999-9999" required={whatsappConsent} maxLength={24}/>
            <span className="field-help">Opcional. Você pode receber e negociar convites dentro do Stage Flow sem informar WhatsApp.</span>
          </div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 12, lineHeight: 1.6, color: "var(--muted)", marginBottom: 20 }}>
            <input type="checkbox" checked={whatsappConsent} onChange={e=>setWhatsappConsent(e.target.checked)} style={{ marginTop: 4, flexShrink: 0, accentColor: "var(--lime)" }}/>
            <span>Opcional: autorizo que organizadores dos meus convites pendentes ou aceitos visualizem meu número e entrem em contato manualmente pelo WhatsApp. Posso revogar essa autorização em Meus convites.</span>
          </label>
        </>}
        <div className="field"><label htmlFor="email">E-mail</label><input id="email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@exemplo.com" required /></div>
        <div className="field"><label htmlFor="password">Criar senha</label><input id="password" type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} placeholder="Pelo menos 8 caracteres" required /></div>
        <button className="btn btn-primary full" type="submit" disabled={busy}>{busy ? "Criando conta..." : inviteCode ? "Criar conta e abrir convite" : "Criar minha conta gratuita"}</button>
      </form>
      {message && <div role="status" className="coming" style={error?{borderColor:"#754343",background:"#281919",color:"#ffb5b5"}:{}}>{message}</div>}
      <div className="auth-bottom">Já tem uma conta? <Link href={inviteCode ? "/login?convite=" + encodeURIComponent(inviteCode) : "/login"}>Entrar</Link></div>
    </div></section>
  </main>;
}
