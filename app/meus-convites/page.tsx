"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Check, CheckCircle2, Clock3, LoaderCircle, MapPin, MessageCircle, Music2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import FeeNegotiation from "@/components/fee-negotiation";
import { useAccount } from "@/src/domains/account/account-context";
import { Button,Input,StatCard,StatusChip,InlineNotice,EmptyState,LoadingState,Card } from "@/src/components/ui";
import type { Invite } from "@/src/domains/booking/types";
import { invitationAgendaHref } from "@/src/domains/booking/model/booking-links";
import { BookingSessionRequired, loadInvitations, respondToInvitation } from "@/src/domains/booking/services/booking-service";

import "@/src/domains/booking/components/booking-ui.css";

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

  if (loading) return <main className="sf-booking-page"><div className="container sf-booking-loading"><LoadingState label="Carregando seus convites..."/></div></main>;

  return <main className="sf-booking-page"><div className="container">
    <nav className="nav">
      <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
      <Link className="sf-ui-button sf-ui-button-ghost" href="/painel"><ArrowLeft size={15}/> Meu painel</Link>
    </nav>
    <header className="sf-booking-hero">
      <div className="eyebrow"><span className="dot"/> PARTICIPAÇÕES MUSICAIS</div>
      <h1>Meus <span className="accent">convites.</span></h1>
      <p className="lead">Veja quem convidou você, confira os detalhes do show e confirme sua participação. Tudo funciona pelo celular.</p>
      <Link href="/conversas" className="sf-ui-button sf-ui-button-ghost"><MessageCircle size={16}/> Conversas de contratação</Link>
    </header>
    <div className="sf-booking-stats">
      <StatCard label="Recebidos" value={invites.length}/><StatCard label="Para responder" value={pendingCount}/><StatCard label="Confirmados" value={acceptedCount}/>
    </div>
    {feedback && <InlineNotice tone={isError ? "danger" : "success"}>{feedback}</InlineNotice>}
    <div className="sf-booking-filters" role="group" aria-label="Filtrar convites">
      {([ ["all", "Todos"], ["pending", "Pendentes"], ["accepted", "Confirmados"], ["declined", "Recusados"] ] as const).map(([value, label]) => (
        <Button key={value} variant={filter === value ? "primary" : "ghost"} onClick={() => setFilter(value)} aria-pressed={filter === value}>{label}</Button>
      ))}
    </div>
    {listError && <InlineNotice tone="danger">{listError}{" "}<Button variant="ghost" onClick={() => void reload()}>Tentar carregar convites novamente</Button></InlineNotice>}
    {!listError && filtered.length === 0 && <EmptyState icon={<Music2 size={27}/>} title={invites.length === 0 ? "Nenhum convite por enquanto" : "Nada nesta categoria"}
      description={invites.length === 0 ? "Quando um cantor ou produtor convidar você para um show, ele aparecerá aqui após você vincular o convite à sua conta." : "Escolha outro filtro para ver seus convites."}/>}
    <div className="sf-booking-invites">
      {filtered.map((invite) => (
        <article key={invite.id} id={"convite-" + invite.id} tabIndex={-1} className={"sf-ui-card sf-booking-invite"+(highlightedInvite === invite.id ? " is-highlighted" : "")}>
          <div className="sf-booking-invite-head">
            <span className="sf-booking-muted">Convite de <strong>{invite.organizer_name}</strong></span>
            <StatusChip status={invite.status === "accepted" ? "success" : invite.status === "pending" ? "warning" : "neutral"} label={statusNames[invite.status] || invite.status}/>
          </div>
          <h2>{invite.event_title}</h2>
          <div className="sf-booking-event-details">
            <div><CalendarDays size={17}/>{dateTime(invite.event_starts_at)}</div>
            {(invite.event_venue || invite.event_city) && <div><MapPin size={17}/>{[invite.event_venue, invite.event_city].filter(Boolean).join(" · ")}</div>}
            {invite.message && <p><strong>Recado:</strong> {invite.message}</p>}
          </div>
          <FeeNegotiation invitationId={invite.id} perspective="musician" onChanged={() => { setFeedback("");setIsError(false);void reload(); }}
            openRequest={feeFocus.invitationId === invite.id ? feeFocus.request : 0}
            invitationStatus={invite.status}
            onConfirmParticipation={invite.status === "pending" ? () => void respond(invite, true) : undefined}
            confirmingParticipation={processingId === invite.id}/>
          {invite.status === "pending" && <div className="sf-booking-action-grid sf-booking-invite-actions">
            <Button disabled={Boolean(processingId)} onClick={() => void respond(invite, true)}>
              {processingId === invite.id ? <LoaderCircle size={16}/> : <Check size={16}/>} {processingId === invite.id ? "Registrando..." : "Aceitar convite"}
            </Button>
            <Button variant="ghost" disabled={Boolean(processingId)} onClick={() => void respond(invite, false)}><X size={16}/> Recusar</Button>
          </div>}
          {invite.status === "accepted" && <div className="sf-booking-confirmed">
            <p className="sf-booking-inline"><CheckCircle2 size={17}/> Sua participação está confirmada.</p>
            <Link className="sf-ui-button sf-ui-button-ghost" href={invitationAgendaHref(invite.event_id)}><CalendarDays size={16}/> Ver show na minha agenda</Link>
            <Link className="sf-ui-button sf-ui-button-ghost" href={"/eventos/operacao?evento="+encodeURIComponent(invite.event_id)}><Music2 size={16}/> Ver briefing e logística do show</Link>
          </div>}
          {invite.status === "declined" && <p className="sf-booking-declined sf-booking-inline"><Clock3 size={16}/> Você recusou este convite.</p>}
        </article>
      ))}
    </div>
    <Card className="sf-booking-preferences">
      <div className="eyebrow"><span className="dot"/> WHATSAPP E PRIVACIDADE</div>
      <h2 className="sf-booking-inline"><MessageCircle size={21}/> Lembretes no WhatsApp</h2>
      <p>A autorização para contato é registrada no cadastro. Aqui você pode corrigir seu número ou desativar os contatos a qualquer momento. Os lembretes são enviados manualmente pelo organizador.</p>
      {whatsappLoading ? <LoadingState label="Carregando preferências..."/> : <form onSubmit={saveWhatsappPreferences} className="sf-booking-form">
        <Input label="Seu WhatsApp com DDD" id="my-whatsapp-number" type="tel" autoComplete="tel" value={whatsappPhone} onChange={e=>setWhatsappPhone(e.target.value)} placeholder="(11) 99999-9999" required={whatsappConsent}/>
        <p className="sf-booking-muted">{whatsappConsent
          ? "Contato pelo WhatsApp ativado no cadastro. Seu número só fica disponível aos organizadores de convites pendentes ou aceitos."
          : "Contato pelo WhatsApp desativado. Se quiser voltar a receber lembretes, ative novamente abaixo."}</p>
        <div className="sf-booking-actions">
          <Button type="submit" disabled={whatsappSaving}>{whatsappSaving ? "Salvando..." : whatsappConsent ? "Atualizar meu número" : "Ativar contato pelo WhatsApp"}</Button>
          {whatsappConsent && <Button variant="ghost" disabled={whatsappSaving} onClick={() => void disableWhatsapp()}>Desativar contatos</Button>}
        </div>
        {whatsappMessage && <InlineNotice tone={whatsappError ? "danger" : "success"}>{whatsappMessage}</InlineNotice>}
      </form>}
    </Card>
    <p className="sf-booking-footnote">Os convites são gratuitos. Aceitar um show não libera marketplace ou endereço personalizado.</p>
  </div></main>;
}
