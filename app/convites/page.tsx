"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Copy, LoaderCircle, Send, Share2, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type EventOption = { id: string; title: string; starts_at: string };

export default function ConvitesPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventId, setEventId] = useState("");
  const [message, setMessage] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const chosenEvent = events.find((event) => event.id === eventId);
  const shareText = chosenEvent
    ? `Você foi convidado para participar de "${chosenEvent.title}" no Stage Flow! Acesse seu convite:`
    : "Você foi convidado para participar de um show no Stage Flow!";
  const whatsappUrl = inviteLink
    ? "https://wa.me/?text=" + encodeURIComponent(shareText + "\n" + inviteLink)
    : "";

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) { router.replace("/login"); return; }
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_artist,is_producer")
        .eq("id", user.id).maybeSingle();
      if (!active) return;
      if (profileError || (!profile?.is_artist && !profile?.is_producer)) {
        router.replace("/painel");
        return;
      }
      const { data, error } = await supabase.from("events")
        .select("id,title,starts_at")
        .eq("producer_id", user.id)
        .order("starts_at", { ascending: true });
      if (!active) return;
      if (error) {
        setIsError(true);
        setStatusMessage("Não conseguimos carregar seus eventos: " + error.message);
      } else {
        setEvents((data ?? []) as EventOption[]);
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [router]);

  async function openShareSheet(url: string, title: string) {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: "Convite Stage Flow",
        text: `Você foi convidado para participar de "${title}" no Stage Flow!`,
        url,
      });
    } catch {
      // Navegadores podem bloquear a abertura após uma operação assíncrona.
      // O botão "Compartilhar" abaixo permite abrir a janela num toque próprio.
    }
  }

  async function generateInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!eventId || saving) return;
    setSaving(true);
    setStatusMessage("");
    setIsError(false);
    setCopied(false);
    setInviteLink("");
    const inviteCode = crypto.randomUUID();
    const supabase = createClient();
    const { error } = await supabase.from("invitations").insert({
      event_id: eventId,
      musician_id: null,
      invited_email: null,
      invite_code: inviteCode,
      message: message.trim() || null,
    });
    if (error) {
      setIsError(true);
      setStatusMessage(
        error.message.toLowerCase().includes("row-level security")
          ? "O banco bloqueou o convite. Confirme se o evento pertence à sua conta e se a migração de convites foi executada."
          : "Não foi possível gerar o convite: " + error.message
      );
    } else {
      const url = window.location.origin + "/convite?codigo=" + encodeURIComponent(inviteCode);
      setInviteLink(url);
      setStatusMessage("Link exclusivo gerado! Ele poderá ser usado por uma única conta. Envie pelo WhatsApp ou compartilhe com outro aplicativo.");
      // Tentativa imediata: funciona em alguns navegadores; caso contrário,
      // o botão Compartilhar permite uma nova interação do usuário.
      void openShareSheet(url, chosenEvent?.title ?? "um show");
    }
    setSaving(false);
  }

  async function shareInvite() {
    if (!inviteLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Convite Stage Flow",
          text: `Você foi convidado para participar de "${chosenEvent?.title ?? "um show"}" no Stage Flow!`,
          url: inviteLink,
        });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
    } catch {
      setStatusMessage("Não foi possível copiar automaticamente. Toque no campo do link e copie o endereço.");
    }
  }

  if (loading) return <main><div className="container" style={{ minHeight: "70vh", display: "grid", placeItems: "center" }}><p style={{ color: "var(--muted)" }}><LoaderCircle size={17} style={{ display: "inline", verticalAlign: "middle" }}/> Carregando convites...</p></div></main>;

  return <main><div className="container">
    <nav className="nav"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link><Link className="btn btn-quiet" href="/painel"><ArrowLeft size={15}/> Voltar ao painel</Link></nav>
    <section style={{ padding: "42px 0 24px" }}>
      <div className="eyebrow"><span className="dot"/> EQUIPE DO EVENTO</div>
      <h1 style={{ fontSize: "clamp(34px,5vw,46px)" }}>Convidar <span className="accent">músicos.</span></h1>
      <p className="lead">Sem precisar saber o e-mail: gere um link único e compartilhe pelo WhatsApp ou pelo aplicativo que preferir.</p>
    </section>
    <section className="feature" style={{ maxWidth: 760 }}>
      {events.length === 0 && !isError ? <>
        <h2>Crie um evento primeiro</h2>
        <p>Cadastre o show na sua agenda para poder enviar um convite à equipe.</p>
        <Link className="btn btn-primary" href="/eventos">Ir para a agenda</Link>
      </> : <form onSubmit={generateInvite}>
        <div className="field">
          <label htmlFor="invite-event">Qual show? *</label>
          <select id="invite-event" value={eventId} onChange={(e) => {
            setEventId(e.target.value); setInviteLink(""); setCopied(false); setStatusMessage(""); setIsError(false);
          }} required style={{ width: "100%", padding: 13, border: "1px solid var(--line)", background: "var(--panel)", borderRadius: 11, color: "var(--text)" }}>
            <option value="">Selecione um evento</option>
            {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title} · {new Date(ev.starts_at).toLocaleDateString("pt-BR")}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="invite-message">Mensagem para o músico (opcional)</label>
          <textarea id="invite-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={500} placeholder="Ex.: quero você no tantã nesse show!" style={{ width: "100%", padding: 13, border: "1px solid var(--line)", background: "var(--panel)", borderRadius: 11, color: "var(--text)", resize: "vertical" }}/>
        </div>
        {statusMessage && <div className="coming" role="status" style={isError ? { borderColor: "#754343", background: "#281919", color: "#ffb5b5" } : {}}>{!isError && <CheckCircle2 size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }}/>} {statusMessage}</div>}
        {!inviteLink && <button className="btn btn-primary" type="submit" disabled={saving || !eventId} style={{ width: "100%", justifyContent: "center" }}>
          <Send size={17}/>{saving ? "Gerando convite..." : "Gerar link e compartilhar"}
        </button>}
        {inviteLink && <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <button className="btn btn-primary" type="button" onClick={() => void shareInvite()} style={{ width: "100%", justifyContent: "center" }}><Share2 size={17}/> Compartilhar convite</button>
          <a className="btn btn-quiet" href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ justifyContent: "center" }}>Enviar pelo WhatsApp</a>
          <div className="field"><label htmlFor="generated-link">Seu link exclusivo</label><input id="generated-link" readOnly value={inviteLink} onFocus={(e) => e.currentTarget.select()}/></div>
          <button className="btn btn-quiet" type="button" onClick={() => void copyInvite()} style={{ justifyContent: "center" }}><Copy size={16}/>{copied ? "Link copiado!" : "Copiar link"}</button>
          <button className="btn btn-quiet" type="button" onClick={() => {setInviteLink("");setStatusMessage("");setCopied(false);setMessage("");}}>Gerar convite para outro músico</button>
        </div>}
      </form>}
    </section>
    <div className="coming" style={{ maxWidth: 760, marginTop: 20 }}>
      <Users size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 7 }}/>
      Um link é válido para apenas uma conta. O músico pode entrar com uma conta existente ou se cadastrar gratuitamente. O convite não libera marketplace ou subdomínio próprio.
    </div>
  </div></main>;
}
