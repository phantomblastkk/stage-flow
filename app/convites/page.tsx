"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Copy, LoaderCircle, MessageCircle, RefreshCw, Send, Share2, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import FeeNegotiation from "@/components/fee-negotiation";

type EventOption = { id: string; title: string; starts_at: string };
type SentInvite = {
  id: string;
  event_id: string;
  event_title: string;
  event_starts_at: string;
  event_venue: string | null;
  event_city: string | null;
  status: "pending" | "accepted" | "declined" | "cancelled";
  musician_name: string | null;
  musician_phone: string | null;
  invite_code: string | null;
  created_at: string;
  responded_at: string | null;
};
type TrackingFilter = "all" | "pending" | "accepted" | "declined" | "unclaimed";

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
  const [sentInvites, setSentInvites] = useState<SentInvite[]>([]);
  const [sentError, setSentError] = useState("");
  const [trackingEventId, setTrackingEventId] = useState("");
  const [trackingFilter, setTrackingFilter] = useState<TrackingFilter>("all");
  const [reloading, setReloading] = useState(false);

  const chosenEvent = events.find((event) => event.id === eventId);
  const shareText = chosenEvent
    ? `Você foi convidado para participar de "${chosenEvent.title}" no Stage Flow! Acesse seu convite:`
    : "Você foi convidado para participar de um show no Stage Flow!";
  const whatsappUrl = inviteLink
    ? "https://wa.me/?text=" + encodeURIComponent(shareText + "\n" + inviteLink)
    : "";

  async function reloadSent() {
    setReloading(true);
    const { data, error } = await createClient().rpc("stage_sent_invitations_with_whatsapp");
    if (error) {
      setSentError("Não foi possível consultar os convites e os contatos autorizados. Execute whatsapp_reminders_migration.sql no Supabase. Detalhes: " + error.message);
    } else {
      setSentInvites((data ?? []) as SentInvite[]);
      setSentError("");
    }
    setReloading(false);
  }

  const scopedInvites = trackingEventId
    ? sentInvites.filter(invite => invite.event_id === trackingEventId)
    : sentInvites;
  const acceptedCount = scopedInvites.filter(invite => invite.status === "accepted").length;
  const declinedCount = scopedInvites.filter(invite => invite.status === "declined").length;
  const pendingCount = scopedInvites.filter(invite => invite.status === "pending" && invite.musician_name).length;
  const unclaimedCount = scopedInvites.filter(invite => invite.status === "pending" && !invite.musician_name).length;
  const filteredInvites = scopedInvites.filter(invite => {
    if (trackingFilter === "all") return true;
    if (trackingFilter === "unclaimed") return invite.status === "pending" && !invite.musician_name;
    if (trackingFilter === "pending") return invite.status === "pending" && Boolean(invite.musician_name);
    return invite.status === trackingFilter;
  });
  const groupedInvites = events
    .map(event => ({
      event,
      rows: filteredInvites.filter(invite => invite.event_id === event.id),
    }))
    .filter(group => group.rows.length > 0);

  function reminderFor(invite: SentInvite) {
    const name = invite.musician_name || "tudo bem";
    const date = new Date(invite.event_starts_at).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" });
    const venue = [invite.event_venue, invite.event_city].filter(Boolean).join(" - ");
    const details = venue ? "\nLocal: " + venue : "";
    if (invite.status === "accepted") {
      return "Olá, " + name + "! Passando para lembrar do nosso show \"" + invite.event_title + "\". 🎶\nData: " + date + details + "\nSua participação já está confirmada no Stage Flow. Até lá!";
    }
    return "Olá, " + name + "! Tudo bem? 🎶 Passando para lembrar do convite para o show \"" + invite.event_title + "\".\nData: " + date + details + "\nConsegue confirmar ou recusar sua participação aqui? " + window.location.origin + "/meus-convites";
  }

  function reminderLink(invite: SentInvite) {
    if (!invite.musician_name || !invite.musician_phone ||
        !/^[1-9][0-9]{9,14}$/.test(invite.musician_phone) ||
        (invite.status !== "pending" && invite.status !== "accepted")) return null;
    return "https://wa.me/" + invite.musician_phone +
      "?text=" + encodeURIComponent(reminderFor(invite));
  }

  async function shareExisting(invite: SentInvite) {
    if (!invite.invite_code) return;
    const url = window.location.origin + "/convite?codigo=" + encodeURIComponent(invite.invite_code);
    const text = "Convite para participar de " + invite.event_title + " no Stage Flow!";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Convite Stage Flow", text, url });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    window.open("https://wa.me/?text=" + encodeURIComponent(text + "\n" + url), "_blank", "noopener,noreferrer");
  }

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
      void reloadSent();
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
      void reloadSent();
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
    <section style={{ maxWidth: 820, marginTop: 34 }} aria-label="Convites enviados">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow"><span className="dot"/> ORGANIZAÇÃO DA EQUIPE</div>
          <h2 style={{ fontSize: 25, margin: "12px 0 0" }}>Respostas dos músicos</h2>
        </div>
        <button type="button" className="btn btn-quiet" onClick={() => void reloadSent()} disabled={reloading}>
          <RefreshCw size={16}/>{reloading ? "Atualizando..." : "Atualizar respostas"}
        </button>
      </div>
      <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
        Veja quem aceitou, recusou ou ainda não respondeu. Os lembretes abrem o WhatsApp com uma mensagem pronta; você confirma o envio no aplicativo.
      </p>
      {sentError && <div className="coming" role="alert" style={{ borderColor: "#754343", background: "#281919", color: "#ffb5b5" }}>{sentError}</div>}
      {!sentError && <>
        <div className="field" style={{ maxWidth: 520 }}>
          <label htmlFor="tracking-event">Acompanhar qual show?</label>
          <select id="tracking-event" value={trackingEventId} onChange={e=>setTrackingEventId(e.target.value)}>
            <option value="">Todos os shows</option>
            {events.map(event=><option key={event.id} value={event.id}>{event.title} · {new Date(event.starts_at).toLocaleDateString("pt-BR")}</option>)}
          </select>
        </div>
        <div className="stat-row" style={{ marginBottom: 18 }}>
          <div className="stat"><strong>{acceptedCount}</strong><span>Aceitaram</span></div>
          <div className="stat"><strong>{declinedCount}</strong><span>Recusaram</span></div>
          <div className="stat"><strong>{pendingCount}</strong><span>Sem resposta</span></div>
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px" }}>{unclaimedCount} link(s) ainda sem músico cadastrado.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {([
            ["all", "Todos"],
            ["accepted", "Aceitaram"],
            ["declined", "Recusaram"],
            ["pending", "Sem resposta"],
            ["unclaimed", "Links não utilizados"],
          ] as const).map(([value,label])=><button key={value} type="button" className={trackingFilter===value?"btn btn-primary":"btn btn-quiet"} onClick={()=>setTrackingFilter(value)} aria-pressed={trackingFilter===value} style={{ padding: "10px 12px" }}>{label}</button>)}
        </div>
        {filteredInvites.length===0 && <div className="feature"><p style={{ margin: 0 }}>Nenhum convite nesta categoria.</p></div>}
        <div style={{ display: "grid", gap: 18 }}>
          {groupedInvites.map(group=><div key={group.event.id} className="feature" style={{ padding: "20px 16px" }}>
            <h3 style={{ margin: "0 0 5px" }}>{group.event.title}</h3>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>{new Date(group.event.starts_at).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" })} · {group.rows.length} convite(s)</p>
            <div style={{ display: "grid", gap: 10 }}>
              {group.rows.map(invite=>{
                const assigned=Boolean(invite.musician_name);
                const statusLabel=invite.status==="accepted"?"Aceitou":invite.status==="declined"?"Recusou":invite.status==="cancelled"?"Cancelado":assigned?"Aguardando resposta":"Link não utilizado";
                const canRemind=assigned && (invite.status==="pending"||invite.status==="accepted");
                const directWhatsApp=reminderLink(invite);
                return <article key={invite.id} style={{ border: "1px solid var(--line)", borderRadius: 14, background: "var(--panel2)", padding: 14 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <strong style={{ display: "block", fontSize: 15 }}>{invite.musician_name || "Convite por link"}</strong>
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>{assigned ? (invite.musician_phone ? "WhatsApp autorizado" : "WhatsApp não autorizado") : "Aguardando o músico abrir o link"}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 99, color: invite.status==="accepted"?"var(--lime)":invite.status==="declined"?"#ffb5b5":"var(--text)" }}>{statusLabel}</span>
                      {canRemind && (directWhatsApp
                        ? <a className="btn btn-primary" href={directWhatsApp} target="_blank" rel="noopener noreferrer" style={{ padding: "10px 12px", whiteSpace: "nowrap" }}><MessageCircle size={16}/> Enviar lembrete</a>
                        : <button className="btn btn-quiet" type="button" disabled title="O músico precisa autorizar lembretes pelo WhatsApp em Meus convites" style={{ padding: "10px 12px", opacity: 0.55, cursor: "not-allowed", whiteSpace: "nowrap" }}><MessageCircle size={16}/> Enviar lembrete</button>
                      )}
                    </div>
                  </div>
                  <FeeNegotiation invitationId={invite.id} perspective="organizer" onChanged={() => void reloadSent()}/>
                  {canRemind && !directWhatsApp && <p style={{ fontSize: 12, color: "var(--muted)", margin: "10px 0 0" }}>O músico ainda precisa autorizar lembretes pelo WhatsApp na área Meus convites.</p>}
                  {invite.invite_code && <button type="button" className="btn btn-quiet" style={{ width: "100%", marginTop: 13 }} onClick={()=>void shareExisting(invite)}><Share2 size={16}/> Reenviar link de convite</button>}
                </article>;
              })}
            </div>
          </div>)}
        </div>
      </>}
    </section>

    <div className="coming" style={{ maxWidth: 760, marginTop: 20 }}>
      <Users size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 7 }}/>
      Um link é válido para apenas uma conta. O músico pode entrar com uma conta existente ou se cadastrar gratuitamente. O convite não libera marketplace ou subdomínio próprio.
    </div>
  </div></main>;
}
