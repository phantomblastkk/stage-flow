"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, LoaderCircle, Music2, UserRoundPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Preview = { title: string; starts_at: string; organizer: string; message: string | null };
type InviteState = "loading" | "open" | "ready" | "claiming" | "claimed" | "invalid" | "used" | "closed" | "artist_required" | "own_event" | "different_email" | "already_invited" | "error";

export default function AbrirConvitePage() {
  const [token, setToken] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [status, setStatus] = useState<InviteState>("loading");
  const [signedIn, setSignedIn] = useState(false);
  const [errorDetails, setErrorDetails] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const code = new URLSearchParams(window.location.search).get("codigo") || "";
      if (!active) return;
      setToken(code);
      if (!/^[0-9a-f-]{36}$/i.test(code)) {
        setStatus("invalid"); return;
      }

      const supabase = createClient();
      const [previewResult, userResult] = await Promise.all([
        supabase.rpc("stage_invite_preview", { p_invite_code: code }),
        supabase.auth.getUser(),
      ]);
      if (!active) return;
      if (!previewResult.error && previewResult.data) {
        setPreview(previewResult.data as Preview);
      }
      const user = userResult.data.user;
      setSignedIn(Boolean(user));
      if (!user) {
        if (previewResult.error) {
          setStatus("error");
          setErrorDetails("A prévia do convite está indisponível. Verifique se a migração SQL foi executada.");
        } else {
          setStatus(previewResult.data ? "open" : "invalid");
        }
        return;
      }

      if (previewResult.data) {
        setStatus("ready");
        return;
      }
      // Convites já utilizados não são consumidos de novo; a função apenas
      // permite reconhecer se este próprio usuário já vinculou o convite.
      const { data, error } = await supabase.rpc("claim_stage_invite", { p_invite_code: code });
      if (!active) return;
      if (error) {
        setStatus("error");
        setErrorDetails("Não conseguimos verificar seu convite: " + error.message);
      } else {
        const result = String(data ?? "invalid");
        setStatus(result === "already_claimed" ? "claimed" : result === "used" ? "used" : "invalid");
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function claimInvite() {
    if (!token || status !== "ready") return;
    setStatus("claiming");
    const { data, error } = await createClient().rpc("claim_stage_invite", { p_invite_code: token });
    if (error) {
      setErrorDetails("Não foi possível vincular o convite: " + error.message);
      setStatus("error");
      return;
    }
    const result = String(data ?? "error");
    if (result === "claimed" || result === "already_claimed") setStatus("claimed");
    else if (["invalid", "used", "closed", "artist_required", "own_event", "different_email", "already_invited"].includes(result)) setStatus(result as InviteState);
    else {
      setErrorDetails("Não foi possível validar o convite. Tente novamente.");
      setStatus("error");
    }
  }

  const inviteParams = encodeURIComponent(token);
  const isSuccess = status === "claimed";
  const isAvailable = status === "open";
  const stateMessages: Record<string, string> = {
    invalid: "Este link não existe, já foi usado ou não está mais disponível.",
    used: "Este convite já foi utilizado por outra conta. Peça um novo link ao organizador.",
    closed: "Este convite foi encerrado. Peça um novo link ao organizador.",
    artist_required: "Sua conta ainda não possui a função de músico/artista. O convite não pode ser vinculado a este perfil.",
    own_event: "Você não pode usar o convite do seu próprio evento.",
    different_email: "Este é um convite antigo vinculado a um e-mail específico. Entre com esse e-mail ou solicite um novo link sem essa restrição.",
    already_invited: "Você já possui um convite para esse show. Confira suas participações no Stage Flow.",
  };

  return <main><div className="container" style={{ minHeight: "100vh" }}>
    <nav className="nav"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link><Link className="btn btn-quiet" href="/"><ArrowLeft size={15}/> Início</Link></nav>
    <section className="feature" style={{ maxWidth: 540, margin: "44px auto", padding: 28 }}>
      <div className="eyebrow"><span className="dot"/> CONVITE DE EQUIPE</div>
      <h1 style={{ fontSize: "clamp(30px,5vw,42px)", marginTop: 14 }}>Seu próximo <span className="accent">show.</span></h1>
      {(status === "loading" || status === "claiming") && <p style={{ color: "var(--muted)" }}><LoaderCircle size={17} style={{ display: "inline", verticalAlign: "middle" }}/> Verificando seu convite...</p>}
      {preview && <div className="coming" style={{ marginTop: 18 }}>
        <h2 style={{ margin: "0 0 8px" }}>{preview.title}</h2>
        <p style={{ margin: "0 0 6px" }}>Convite de {preview.organizer}</p>
        <p style={{ margin: 0, display: "flex", gap: 8, alignItems: "center" }}><CalendarDays size={15}/> {new Date(preview.starts_at).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })}</p>
        {preview.message && <p style={{ margin: "12px 0 0" }}><strong>Mensagem:</strong> {preview.message}</p>}
      </div>}
      {status === "ready" && <><p>Você está conectado ao Stage Flow. Confirme para vincular este convite à sua conta de músico. Cada link só pode ser utilizado uma vez.</p><button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => void claimInvite()}><CheckCircle2 size={17}/> Vincular convite à minha conta</button></>}
      {isSuccess && <>
        <p role="status" style={{ marginTop: 22 }}><CheckCircle2 color="#c6f36b" size={20} style={{ verticalAlign: "middle", marginRight: 7 }}/> <strong>Convite vinculado à sua conta!</strong></p>
        <p>Você já está associado a este convite. A confirmação da participação será feita na área de convites do Stage Flow.</p>
        <Link href="/painel" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>Ir para meu painel</Link>
      </>}
      {isAvailable && <>
        <p style={{ marginTop: 22 }}>Você foi convidado a participar de um show. Entre com sua conta ou cadastre-se gratuitamente para vincular seu convite.</p>
        <div style={{ display: "grid", gap: 12 }}>
          <Link className="btn btn-primary" href={`/cadastro?convite=${inviteParams}`} style={{ justifyContent: "center" }}><UserRoundPlus size={17}/> Criar conta grátis</Link>
          <Link className="btn btn-quiet" href={`/login?convite=${inviteParams}`} style={{ justifyContent: "center" }}><Music2 size={17}/> Já tenho conta</Link>
        </div>
      </>}
      {!isSuccess && !isAvailable && status !== "loading" && status !== "claiming" && status !== "ready" && <>
        <p role="alert" className="coming" style={{ borderColor: "#754343", background: "#281919", color: "#ffb5b5", marginTop: 20 }}>{stateMessages[status] || errorDetails || "Não foi possível abrir este convite."}</p>
        {signedIn && <Link className="btn btn-quiet" href="/painel">Voltar para meu painel</Link>}
      </>}
      <p className="fine" style={{ marginTop: 24 }}>O convite organiza sua participação. Ele não ativa planos pagos, marketplace nem subdomínio próprio.</p>
    </section>
  </div></main>;
}
