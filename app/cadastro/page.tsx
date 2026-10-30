"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft, ArrowRight, Building2, Check, ChevronLeft, Guitar,
  LockKeyhole, Mic2, ShieldCheck, UserRound, UsersRound
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./signup-wizard.css";

type Purpose = "artist" | "organizer" | null;
type Activity = "singer" | "musician" | "both" | null;
type WizardStep = 1 | 2 | 3;

const termsVersion = "2026-10-29-v1";
const labels = ["O que você faz", "Seus dados", "Confirmar"];
const phonePattern = /^55[1-9][0-9]{9,10}$/;
const digits = (value: string) => value.replace(/\D/g, "");
function normalizePhone(value: string) {
  const numbers = digits(value);
  return numbers.length === 10 || numbers.length === 11 ? "55" + numbers : numbers;
}
function formatPhone(value: string) {
  const raw = digits(value);
  const national = raw.startsWith("55") && raw.length > 11 ? raw.slice(2, 13) : raw.slice(0, 11);
  if (national.length < 3) return national;
  return "(" + national.slice(0, 2) + ") " + national.slice(2, 7) +
    (national.length > 7 ? "-" + national.slice(7, 11) : "");
}

export default function CadastroPage() {
  const [step, setStep] = useState<WizardStep>(1);
  const [purpose, setPurpose] = useState<Purpose>(null);
  const [activity, setActivity] = useState<Activity>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [partnerOnboarding, setPartnerOnboarding] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [whatsappNotifications, setWhatsappNotifications] = useState(false);
  const [whatsappShare, setWhatsappShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const invite = query.get("convite");
    if (invite) {
      setInviteCode(invite);
      setPurpose("artist");
      setActivity("musician");
    } else if (query.get("parceiro") === "1") {
      // This only selects a use case. Venue roles still need administrator approval.
      setPurpose("organizer");
      setPartnerOnboarding(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function checkSession() {
      try {
        const { data, error: authError } = await createClient().auth.getUser();
        if (active && !authError && data.user) {
          const code = new URLSearchParams(window.location.search).get("convite");
          window.location.replace(code
            ? "/convite?codigo=" + encodeURIComponent(code)
            : "/painel");
          return;
        }
      } catch { /* Keep the form available while auth is temporarily offline. */ }
      if (active) setCheckingSession(false);
    }
    void checkSession();
    return () => { active = false; };
  }, []);

  const isArtist = purpose === "artist";
  const artistKind = !isArtist ? "none" : activity === "musician" ? "support" : "lead";
  const alsoMusician = activity === "both";
  const isProducer = purpose === "organizer";
  const roleText = isProducer ? "Organizar e contratar shows" :
    activity === "both" ? "Cantar e tocar instrumentos" :
    activity === "singer" ? "Cantar e divulgar shows" : "Tocar instrumentos";

  function fail(text: string) {
    setError(true);
    setMessage(text);
  }
  function validateRole() {
    if (!purpose || (isArtist && !activity)) {
      fail("Escolha o que você deseja fazer no StageFlow para continuar.");
      return false;
    }
    return true;
  }
  function validateIdentity() {
    if (displayName.trim().length < 2) {
      fail("Informe seu nome ou nome profissional (pelo menos 2 caracteres).");
      return false;
    }
    if (!phonePattern.test(normalizePhone(whatsappPhone))) {
      fail("Informe um WhatsApp brasileiro válido com DDD, como (11) 99999-9999.");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      fail("Informe um e-mail válido para acessar sua conta.");
      return false;
    }
    if (password.length < 8) {
      fail("Crie uma senha com pelo menos 8 caracteres.");
      return false;
    }
    return true;
  }
  function next() {
    setError(false);
    setMessage("");
    if (step === 1 && validateRole()) setStep(2);
    else if (step === 2 && validateIdentity()) setStep(3);
  }
  function back() {
    if (busy) return;
    setError(false);
    setMessage("");
    setStep(current => current === 3 ? 2 : 1);
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError(false);
    if (!validateRole() || !validateIdentity()) return;
    if (!termsAccepted) {
      fail("Para criar a conta, leia e aceite os Termos de Uso e a Política de Privacidade.");
      return;
    }
    setBusy(true);
    try {
      const client = createClient();
      const { data, error: signUpError } = await client.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: inviteCode
            ? window.location.origin + "/convite?codigo=" + encodeURIComponent(inviteCode)
            : undefined,
          data: {
            signup_flow: "wizard_v2",
            terms_version: termsVersion,
            terms_accepted: true,
            privacy_acknowledged: true,
            whatsapp_notifications_opt_in: whatsappNotifications,
            whatsapp_contact_share_opt_in: isArtist && whatsappShare,
            whatsapp_opt_in: isArtist && whatsappShare,
            whatsapp_phone: normalizePhone(whatsappPhone),
            role: isProducer ? "producer" : "musician",
            is_artist: isArtist,
            is_producer: isProducer,
            artist_kind: isArtist ? artistKind : null,
            is_musician: isArtist && (artistKind === "support" || alsoMusician),
            display_name: displayName.trim(),
            // The public @ is chosen later inside the artistic profile, not at registration.
            username: null
          }
        }
      });
      if (signUpError) {
        const duplicate = signUpError.code === "user_already_exists" ||
          /user already (?:registered|exists)/i.test(signUpError.message);
        if (duplicate) throw new Error("Este usuário já existe. Use Entrar para acessar sua conta ou recuperar a senha.");
        const databaseSignupFailure = signUpError.status === 500 &&
          (signUpError.code === "unexpected_failure" || /database error saving new user/i.test(signUpError.message));
        if (databaseSignupFailure) throw new Error(
          "O cadastro não pôde ser salvo no momento. Confira os dados e tente novamente. Se continuar, contate o suporte."
        );
        throw signUpError;
      }
      if (data.session) {
        window.location.href = inviteCode
          ? "/convite?codigo=" + encodeURIComponent(inviteCode) : "/painel";
        return;
      }
      setMessage(partnerOnboarding
        ? "Conta criada! Confirme o e-mail recebido. O acesso à gestão de uma casa parceira depende de aprovação da administração."
        : inviteCode
          ? "Conta criada! Confirme seu e-mail e volte ao link do convite para aceitar a participação."
          : "Conta criada! Confira seu e-mail para confirmar o acesso. Você poderá completar seu Perfil Artístico depois, sem precisar preencher tudo agora.");
    } catch (err) {
      fail(err instanceof Error ? err.message : "Não foi possível criar a conta. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (checkingSession) return <main className="auth-wrap">
    <div className="container" style={{minHeight:"60vh",display:"grid",placeItems:"center"}}>
      <p>Verificando sua sessão do Stage Flow...</p>
    </div>
  </main>;

  return <main className="auth-wrap signup-v2">
    <aside className="auth-aside">
      <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
      <div>
        <div className="eyebrow">COMECE PELO ESSENCIAL</div>
        <h1>Seu espaço na <span className="accent">música.</span></h1>
        <p className="tagline">Uma conta gratuita para divulgar seu talento ou organizar oportunidades. Você completa os detalhes depois.</p>
      </div>
      <Link href="/" className="fine"><ArrowLeft size={15} aria-hidden="true"/> Voltar ao início</Link>
    </aside>
    <section className="auth-main">
      <div className="auth-card signup-wizard">
        <Link href="/" className="signup-back-home"><ChevronLeft size={16}/> Voltar ao site</Link>
        <div className="signup-heading">
          <span className="signup-kicker">CADASTRO GRATUITO</span>
          <h2>Crie sua conta</h2>
          <p>São só três etapas. Nenhum portfólio ou assinatura é obrigatório agora.</p>
        </div>
        <ol className="signup-steps" aria-label="Etapas do cadastro">
          {labels.map((label,index) => <li key={label}
            className={step === index+1 ? "is-current" : step > index+1 ? "is-complete" : ""}
            aria-current={step === index+1 ? "step" : undefined}>
            <span>{step > index+1 ? <Check size={15}/> : index+1}</span>
            <small>{label}</small>
          </li>)}
        </ol>
        {inviteCode && <p className="signup-note">Você chegou por um convite. A opção de músico já foi selecionada. Depois do cadastro, você poderá aceitar o convite.</p>}
        {partnerOnboarding && <p className="signup-note">Você está se cadastrando para organizar shows de uma casa. O acesso à administração da casa precisa ser aprovado.</p>}
        <form onSubmit={handleSubmit} noValidate>
          {step === 1 && <section className="signup-stage" aria-labelledby="signup-stage-title">
            <h3 id="signup-stage-title">O que você quer fazer?</h3>
            <p>Escolha a opção que combina com você. Depois do cadastro, você poderá completar seu perfil com calma.</p>
            <div className="signup-purpose" role="group" aria-label="Objetivo principal">
              <button type="button" aria-pressed={purpose === "artist"}
                className="signup-choice" onClick={() => {
                  setPurpose("artist"); setWhatsappShare(false);
                }}>
                <span className="signup-choice-icon"><Mic2 size={23}/></span>
                <span><strong>Divulgar meu trabalho</strong><small>Sou cantor, músico ou faço os dois. Quero apresentar meu trabalho e receber oportunidades.</small></span>
                <span className="signup-choice-check">{purpose === "artist" ? <Check size={18}/> : null}</span>
              </button>
              {!inviteCode && <button type="button" aria-pressed={purpose === "organizer"}
                className="signup-choice" onClick={() => {setPurpose("organizer");setWhatsappShare(false);}}>
                <span className="signup-choice-icon"><Building2 size={23}/></span>
                <span><strong>Contratar ou organizar shows</strong><small>Sou produtor, responsável por um evento ou casa de shows. Quero montar agendas e equipes.</small></span>
                <span className="signup-choice-check">{purpose === "organizer" ? <Check size={18}/> : null}</span>
              </button>}
            </div>
            {isArtist && <fieldset className="signup-activity">
              <legend>E na música, você…</legend>
              <p>É só para personalizar sua área de trabalho.</p>
              <div className="signup-activity-grid">
                {([
                  ["singer","Canta",Mic2],
                  ["musician","Toca instrumentos",Guitar],
                  ["both","Canta e toca",UsersRound]
                ] as const).map(([value,label,Icon]) => <label key={value}
                  className={"signup-activity-option"+(activity===value?" is-selected":"")}>
                  <input type="radio" name="activity" checked={activity===value}
                    disabled={Boolean(inviteCode) && value !== "musician"}
                    onChange={() => setActivity(value)}/>
                  <Icon size={18}/><span>{label}</span>
                </label>)}
              </div>
              {activity === "both" && <p className="signup-tip">
                Você terá um único perfil público com as funções de cantor e instrumentista.
              </p>}
            </fieldset>}
          </section>}
          {step === 2 && <section className="signup-stage" aria-labelledby="signup-stage-title">
            <h3 id="signup-stage-title">Só os dados essenciais</h3>
            <p>Seu objetivo: <strong>{roleText}</strong>. Instrumentos, portfólio, fotos e @ ficam para depois.</p>
            <div className="field"><label htmlFor="name">Seu nome ou nome profissional</label>
              <input id="name" autoComplete="name" value={displayName} onChange={e=>setDisplayName(e.target.value)}
                placeholder="Como você quer ser chamado" maxLength={90} required/></div>
            <div className="field"><label htmlFor="whatsapp">Seu WhatsApp com DDD <span className="signup-required">Obrigatório</span></label>
              <input id="whatsapp" type="tel" inputMode="tel" autoComplete="tel" value={whatsappPhone}
                onChange={e=>setWhatsappPhone(formatPhone(e.target.value))}
                placeholder="(11) 99999-9999" maxLength={16} required/>
              <span className="field-help">Usaremos este número como seu contato de cadastro. Ele não será publicado no perfil sem sua autorização. Ainda não há verificação por código de WhatsApp.</span></div>
            <div className="field"><label htmlFor="email">E-mail para entrar</label>
              <input id="email" type="email" autoComplete="email" value={email}
                onChange={e=>setEmail(e.target.value)} placeholder="voce@exemplo.com" maxLength={254} required/></div>
            <div className="field"><label htmlFor="password">Crie uma senha</label>
              <input id="password" type="password" autoComplete="new-password" value={password}
                onChange={e=>setPassword(e.target.value)} minLength={8} placeholder="No mínimo 8 caracteres" required/>
              <span className="field-help"><LockKeyhole size={13} aria-hidden="true"/> Sua senha é privada. Não compartilhamos com outros usuários.</span></div>
          </section>}
          {step === 3 && <section className="signup-stage" aria-labelledby="signup-stage-title">
            <h3 id="signup-stage-title">Tudo certo! Falta confirmar.</h3>
            <div className="signup-review">
              <UserRound size={19}/><span><strong>{displayName.trim()}</strong><small>{roleText} · {whatsappPhone}</small></span>
            </div>
            <div className="signup-consents">
              <label className="signup-consent required">
                <input type="checkbox" checked={termsAccepted} onChange={e=>setTermsAccepted(e.target.checked)} required/>
                <span>Li e aceito os <Link href="/termos" target="_blank" rel="noopener noreferrer">Termos de Uso</Link> e a <Link href="/privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</Link> do StageFlow. <strong>(Obrigatório)</strong></span>
              </label>
              <label className="signup-consent">
                <input type="checkbox" checked={whatsappNotifications} onChange={e=>setWhatsappNotifications(e.target.checked)}/>
                <span><strong>Quero receber notificações do StageFlow pelo WhatsApp.</strong><small>Convites, propostas e atualizações importantes, quando o serviço estiver disponível. Posso desativar depois. Não inclui publicidade.</small></span>
              </label>
              {isArtist && <label className="signup-consent">
                <input type="checkbox" checked={whatsappShare} onChange={e=>setWhatsappShare(e.target.checked)}/>
                <span><strong>Permito compartilhar meu WhatsApp com organizadores de convites.</strong><small>Somente no contexto de convites e contratações, para contato direto. Posso revogar em Privacidade. Não publica o número no meu perfil automaticamente.</small></span>
              </label>}
            </div>
            <p className="signup-tip"><ShieldCheck size={16}/> Seu telefone é obrigatório no cadastro, mas receber mensagens e compartilhá-lo são escolhas separadas.</p>
          </section>}
          {message && <p className={"signup-feedback"+(error?" is-error":"")} role={error?"alert":"status"}>{message}</p>}
          <div className="signup-actions">
            {step > 1 && <button type="button" className="signup-back" onClick={back} disabled={busy}>
              <ChevronLeft size={18}/> Voltar</button>}
            {step < 3 ? <button key={step} type="button" className="btn btn-primary signup-next"
              onClick={next}>Continuar <ArrowRight size={18}/></button> :
              <button type="submit" className="btn btn-primary signup-next"
                disabled={busy || !termsAccepted}>{busy?"Criando conta…":"Criar minha conta grátis"} <Check size={17}/></button>}
          </div>
        </form>
        <p className="auth-bottom">Já tem uma conta? <Link href={inviteCode ?
          "/login?convite="+encodeURIComponent(inviteCode) : "/login"}>Entrar</Link></p>
      </div>
    </section>
  </main>;
}
