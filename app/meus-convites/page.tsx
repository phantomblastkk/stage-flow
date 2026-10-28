"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Check, CheckCircle2, Clock3, LoaderCircle, MapPin, MessageCircle, Music2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import FeeNegotiation from "@/components/fee-negotiation";
import { useAccount } from "@/src/domains/account/account-context";
import { Button } from "@/src/components/ui";
import type { Invite } from "@/src/domains/booking/types";
import { invitationAgendaHref } from "@/src/domains/booking/model/booking-links";
import { BookingSessionRequired, loadInvitations, respondToInvitation } from "@/src/domains/booking/services/booking-service";

type Filter = "all" | "pending" | "accepted" | "declined";

const dateTime = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));

const statusNames: Record<Invite["status"], string> = {
  pending: "Aguardando resposta",
  accepted: "Confirmado",
  declined: "Recusado",
  cancelled: "Cancelado",
};

export default function MeusConvitesPage() {
  const router = useRouter();
  const { snapshot: account } = useAccount();
  const alive = useRef(false);
  const invitationRequest = useRef<AbortController | null>(null);
  const [listError, setListError] = useState("");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feeFocus, setFeeFocus] = useState({ invitationId: "", request: 0 });
  const [filter, setFilter] = useState<Filter>("all");
  const [highlightedInvite, setHighlightedInvite] = useState("");
  const focusedFromNotification = useRef(false);
  const [feedback, setFeedback] = useState("");
  const [isError, setIsError] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [whatsappLoading, setWhatsappLoading] = useState(true);
  const [whatsappSaving, setWhatsappSaving] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [whatsappError, setWhatsappError] = useState(false);

  const reload = useCallback(async () => {
    invitationRequest.current?.abort();
    const request = new AbortController();invitationRequest.current = request;
    try {
      const data = await loadInvitations(createClient(), request.signal);
      if (!alive.current || request.signal.aborted) return;
      setInvites(data);setListError("");
    } catch (error) {
      if (!alive.current || request.signal.aborted) return;
      setListError(error instanceof Error ? error.message : "Não foi possível carregar os convites.");
    } finally { if (alive.current && !request.signal.aborted) setLoading(false); }
  }, []);

  useEffect(() => {
    alive.current = true;void reload();
    return () => { alive.current = false;invitationRequest.current?.abort(); };
  }, [reload]);

  useEffect(() => {
    let active = true;
    async function loadWhatsAppPreferences() {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) {
        setWhatsappLoading(false);
        if (authError) {
          setWhatsappError(true);
          setWhatsappMessage("Não foi possível consultar suas preferências de WhatsApp agora. Tente novamente mais tarde.");
        }
        return;
      }
      const { data, error } = await supabase.rpc("stage_my_whatsapp_preference");
      if (!active) return;
      if (error) {
        setWhatsappError(true);
        setWhatsappMessage("Não foi possível consultar as preferências de WhatsApp. Tente novamente mais tarde.");
      } else if (data?.[0]) {
        setWhatsappPhone(data[0].phone || "");
        setWhatsappConsent(Boolean(data[0].opted_in));
      }
      setWhatsappLoading(false);
    }
    void loadWhatsAppPreferences();
    return () => { active = false; };
  }, []);

  async function saveWhatsappPreferences(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (whatsappSaving) return;
    setWhatsappSaving(true);
    setWhatsappError(false);
    setWhatsappMessage("");
    const { data, error } = await createClient().rpc("stage_save_whatsapp_preference", {
      p_phone: whatsappPhone,
      p_opt_in: true,
    });
    if (error) {
      setWhatsappError(true);
      setWhatsappMessage("Não foi possível salvar: " + error.message);
    } else if (data === "enabled") {
      setWhatsappConsent(true);
      setWhatsappMessage("Número salvo! Os organizadores dos seus convites pendentes ou confirmados poderão abrir uma conversa pelo WhatsApp.");
    } else if (data === "disabled") {
      setWhatsappConsent(false);
      setWhatsappMessage("Autorização desativada. Seu número continuará guardado de forma privada, mas não ficará disponível aos organizadores.");
    } else {
      setWhatsappError(true);
      setWhatsappMessage(data === "invalid_phone" ? "Informe um número válido com DDD (por exemplo: 11 99999-9999)." : "Não foi possível atualizar a autorização: " + String(data));
    }
    setWhatsappSaving(false);
  }

  async function disableWhatsapp() {
    if (whatsappSaving) return;
    setWhatsappSaving(true);
    setWhatsappMessage("");
    setWhatsappError(false);
    const { data, error } = await createClient().rpc("stage_save_whatsapp_preference", {
      p_phone: whatsappPhone,
      p_opt_in: false,
    });
    if (error || data !== "disabled") {
      setWhatsappError(true);
      setWhatsappMessage("Não foi possível desativar os contatos: " + (error?.message || String(data)));
    } else {
      setWhatsappConsent(false);
      setWhatsappMessage("Contatos desativados. O número continua privado e não será mostrado aos organizadores.");
    }
    setWhatsappSaving(false);
  }

  useEffect(() => {
    if (loading || focusedFromNotification.current) return;
    const id = new URLSearchParams(window.location.search).get("convite") || "";
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return;
    if (!invites.some(invite => invite.id === id)) return;
    focusedFromNotification.current = true;
    setFilter("all");
    setHighlightedInvite(id);
    window.requestAnimationFrame(() => {
      const target = document.getElementById("convite-" + id);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    });
  }, [invites, loading]);

  const pendingCount = invites.filter((invite) => invite.status === "pending").length;
  const acceptedCount = invites.filter((invite) => invite.status === "accepted").length;
  const filtered = useMemo(() => filter === "all" ? invites : invites.filter((invite) => invite.status === filter), [invites, filter]);

  async function respond(invite: Invite, accept: boolean) {
    if (invite.status !== "pending" || processingId) return;
    setProcessingId(invite.id);
    setFeedback("");
    setIsError(false);
    invitationRequest.current?.abort();
    try {
    const data = await respondToInvitation(createClient(), account.user?.id ?? "", invite.id, accept);
    if (!alive.current) return;
    invitationRequest.current?.abort();
    if (data === "accepted" || data === "declined") {
      setInvites((prev) => prev.map((item) =>
        item.id === invite.id ? { ...item, status: data, responded_at: new Date().toISOString() } : item
      ));
      setFeedback(data === "accepted" ? "Presença confirmada! O organizador poderá acompanhar sua resposta." : "Convite recusado. Sua resposta foi registrada.");
    } else {
      setIsError(true);
      if (data === "fee_pending") {
        // Open only the private negotiation associated with this invitation.
        setFeeFocus((prev) => ({ invitationId: invite.id, request: prev.request + 1 }));
      }
      setFeedback(data === "fee_pending"
        ? "Antes de confirmar sua presença, resolva a proposta de cachê. Abrimos a negociação deste show logo abaixo."
        : data === "already_responded" ? "Esse convite já foi respondido. Atualize a página para conferir."
        : "Não foi possível responder a esse convite. Atualize a página e tente novamente.");
    }
    } catch (error) {
      if (!alive.current) return;
      if (error instanceof BookingSessionRequired) router.replace("/login");
      else { setIsError(true);setFeedback(error instanceof Error ? error.message : "Não foi possível responder ao convite."); }
    } finally { if (alive.current) setProcessingId(null); }
  }

  if (loading) return <main><div className="container" style={{ minHeight: "85vh", display: "grid", placeItems: "center" }}>
    <p style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: 10 }}><LoaderCircle size={20}/> Carregando seus convites...</p>
  </div></main>;

  return <main><div className="container" style={{ paddingBottom: 60 }}>
    <nav className="nav">
      <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
      <Link className="btn btn-quiet" href="/painel"><ArrowLeft size={15}/> Meu painel</Link>
    </nav>

    <section style={{ padding: "40px 0 26px" }}>
      <div className="eyebrow"><span className="dot"/> PARTICIPAÇÕES MUSICAIS</div>
      <h1 style={{ fontSize: "clamp(32px,5vw,46px)", marginBottom: 14 }}>Meus <span className="accent">convites.</span></h1>
      <p className="lead">Veja quem convidou você, confira os detalhes do show e confirme sua participação. Tudo funciona pelo celular.</p>
      <Link href="/conversas" className="btn btn-quiet"><MessageCircle size={16}/> Conversas de contratação</Link>
    </section>

    <div className="stat-row" style={{ marginBottom: 26 }}>
      <div className="stat"><strong>{invites.length}</strong><span>Recebidos</span></div>
      <div className="stat"><strong>{pendingCount}</strong><span>Para responder</span></div>
      <div className="stat"><strong>{acceptedCount}</strong><span>Confirmados</span></div>
    </div>

    {feedback && <div className="coming" role={isError ? "alert" : "status"} style={isError ? { borderColor: "#754343", background: "#281919", color: "#ffb5b5" } : {}}>{feedback}</div>}

    <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginBottom: 20 }}>
      {([
        ["all", "Todos"],
        ["pending", "Pendentes"],
        ["accepted", "Confirmados"],
        ["declined", "Recusados"],
      ] as const).map(([value, label]) => (
        <button type="button" key={value} className={filter === value ? "btn btn-primary" : "btn btn-quiet"}
          onClick={() => setFilter(value)} aria-pressed={filter === value} style={{ padding: "10px 13px" }}>{label}</button>
      ))}
    </div>

    {listError && <div className="coming" role="alert">{listError}{" "}
      <Button variant="ghost" onClick={() => void reload()}>Tentar carregar convites novamente</Button></div>}
    {!listError && filtered.length === 0 && <section className="feature" style={{ maxWidth: 680 }}>
      <Music2 size={27} style={{ color: "var(--lime)", marginBottom: 14 }}/>
      <h2 style={{ fontSize: 21 }}>{invites.length === 0 ? "Nenhum convite por enquanto" : "Nada nesta categoria"}</h2>
      <p>{invites.length === 0 ? "Quando um cantor ou produtor convidar você para um show, ele aparecerá aqui após você vincular o convite à sua conta." : "Escolha outro filtro para ver seus convites."}</p>
    </section>}

    <div style={{ display: "grid", gap: 16, maxWidth: 800 }}>
      {filtered.map((invite) => (
        <article key={invite.id} id={"convite-" + invite.id} tabIndex={-1} className="feature"
          style={{ padding: "22px 20px", scrollMarginTop: 24,
            outline: highlightedInvite === invite.id ? "2px solid var(--accent-solid)" : undefined,
            outlineOffset: highlightedInvite === invite.id ? 4 : undefined }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Convite de <strong style={{ color: "var(--text)" }}>{invite.organizer_name}</strong></span>
            <span style={{
              fontSize: 12, fontWeight: 700, padding: "6px 10px", borderRadius: 99,
              border: "1px solid var(--line)",
              background: invite.status === "accepted" ? "#263620" : "var(--panel2)",
              color: invite.status === "accepted" ? "var(--lime)" : "var(--text)",
            }}>{statusNames[invite.status] || invite.status}</span>
          </div>

          <h2 style={{ fontSize: "clamp(20px,4vw,25px)", letterSpacing: "-.5px", margin: "0 0 15px" }}>{invite.event_title}</h2>
          <div style={{ display: "grid", gap: 9, fontSize: 14, color: "var(--muted)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}><CalendarDays size={17} style={{ flexShrink: 0 }}/>{dateTime(invite.event_starts_at)}</div>
            {(invite.event_venue || invite.event_city) && <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}><MapPin size={17} style={{ flexShrink: 0 }}/>{[invite.event_venue, invite.event_city].filter(Boolean).join(" · ")}</div>}
            {invite.message && <p style={{ margin: "8px 0", overflowWrap: "anywhere", color: "var(--text)" }}><strong>Recado:</strong> {invite.message}</p>}
          </div>

          <FeeNegotiation invitationId={invite.id} perspective="musician" onChanged={() => void reload()}
            openRequest={feeFocus.invitationId === invite.id ? feeFocus.request : 0}
            invitationStatus={invite.status}
            onConfirmParticipation={invite.status === "pending" ? () => void respond(invite, true) : undefined}
            confirmingParticipation={processingId === invite.id}/>

          {invite.status === "pending" && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginTop: 22 }}>
            <button type="button" className="btn btn-primary" disabled={Boolean(processingId)} onClick={() => void respond(invite, true)}>
              {processingId === invite.id ? <LoaderCircle size={16}/> : <Check size={16}/>} {processingId === invite.id ? "Registrando..." : "Aceitar convite"}
            </button>
            <button type="button" className="btn btn-quiet" disabled={Boolean(processingId)} onClick={() => void respond(invite, false)}>
              <X size={16}/> Recusar
            </button>
          </div>}

          {invite.status === "accepted" && <div style={{ marginTop: 18, display: "grid", gap: 10 }}><p style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, fontSize: 13, color: "var(--lime)" }}><CheckCircle2 size={17}/> Sua participação está confirmada.</p><Link className="btn btn-quiet" href={invitationAgendaHref(invite.event_id)} style={{ justifyContent: "center" }}><CalendarDays size={16}/> Ver show na minha agenda</Link><Link className="btn btn-quiet" href={"/eventos/operacao?evento="+encodeURIComponent(invite.event_id)} style={{ justifyContent: "center" }}><Music2 size={16}/> Ver briefing e logística do show</Link></div>}
          {invite.status === "declined" && <p style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 0", fontSize: 13, color: "var(--muted)" }}><Clock3 size={16}/> Você recusou este convite.</p>}
        </article>
      ))}
    </div>

    <section className="feature" style={{ maxWidth: 800, marginTop: 30 }}>
      <div className="eyebrow"><span className="dot"/> WHATSAPP E PRIVACIDADE</div>
      <h2 style={{ fontSize: 23, margin: "16px 0 10px" }}><MessageCircle size={21} style={{ display: "inline", verticalAlign: "middle", marginRight: 8 }}/> Lembretes no WhatsApp</h2>
      <p style={{ marginBottom: 18 }}>A autorização para contato é registrada no cadastro. Aqui você pode corrigir seu número ou desativar os contatos a qualquer momento. Os lembretes são enviados manualmente pelo organizador.</p>
      {whatsappLoading ? <p style={{ color: "var(--muted)" }}>Carregando preferências...</p> :
        <form onSubmit={saveWhatsappPreferences}>
          <div className="field" style={{ maxWidth: 430 }}>
            <label htmlFor="my-whatsapp-number">Seu WhatsApp com DDD</label>
            <input id="my-whatsapp-number" type="tel" autoComplete="tel" value={whatsappPhone} onChange={e=>setWhatsappPhone(e.target.value)} placeholder="(11) 99999-9999" required={whatsappConsent}/>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "8px 0 18px" }}>
            {whatsappConsent
              ? "Contato pelo WhatsApp ativado no cadastro. Seu número só fica disponível aos organizadores de convites pendentes ou aceitos."
              : "Contato pelo WhatsApp desativado. Se quiser voltar a receber lembretes, ative novamente abaixo."}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="submit" className="btn btn-primary" disabled={whatsappSaving}>
              {whatsappSaving ? "Salvando..." : whatsappConsent ? "Atualizar meu número" : "Ativar contato pelo WhatsApp"}
            </button>
            {whatsappConsent && <button type="button" className="btn btn-quiet" disabled={whatsappSaving} onClick={() => void disableWhatsapp()}>Desativar contatos</button>}
          </div>
          {whatsappMessage && <div role={whatsappError ? "alert" : "status"} className="coming" style={whatsappError ? { borderColor: "#754343", background: "#281919", color: "#ffb5b5" } : {}}>{whatsappMessage}</div>}
        </form>}
    </section>
    <p className="fine" style={{ marginTop: 26 }}>Os convites são gratuitos. Aceitar um show não libera marketplace ou endereço personalizado.</p>
  </div></main>;
}
