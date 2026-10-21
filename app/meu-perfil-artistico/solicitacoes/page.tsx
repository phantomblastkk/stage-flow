"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive, ArrowLeft, ArrowUpRight, CalendarDays, CheckCircle2, Clock3,
  Inbox, LoaderCircle, Mail, MapPin, MessageCircle, RotateCcw, ShieldCheck, Trash2,
  Plus, Pencil, Save, ExternalLink, Users
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./booking-inbox.css";

type BookingStatus = "new" | "contacted" | "archived";
type Booking = {
  id: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  event_city: string;
  event_date: string | null;
  message: string;
  status: BookingStatus;
  created_at: string;
  event_id?: string | null;
  event_status?: "draft" | "published" | "cancelled" | "completed" | null;
  event_title?: string | null;
  event_starts_at?: string | null;
  event_venue?: string | null;
  event_description?: string | null;
};

type EventDraftForm = {
  requestId: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  description: string;
};

function localDateKey(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")].join("-");
}
function localTimeKey(date: Date) {
  return String(date.getHours()).padStart(2, "0") + ":" +
    String(date.getMinutes()).padStart(2, "0");
}

function formatDate(input: string, withTime = false) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return new Intl.DateTimeFormat("pt-BR", withTime
    ? { dateStyle: "long", timeStyle: "short" }
    : { dateStyle: "long", timeZone: "UTC" }).format(date);
}

function waLink(phone: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  const number = digits.length === 10 || digits.length === 11
    ? "55" + digits : digits;
  if (!/^55[1-9][0-9]{9,10}$/.test(number)) return null;
  return "https://wa.me/" + number;
}

export default function ArtistBookingInboxPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "archived" | "all">("active");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState<EventDraftForm | null>(null);
  const [eventError, setEventError] = useState("");
  const [eventSaving, setEventSaving] = useState(false);

  const loadBookings = useCallback(async () => {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      router.replace("/login");
      return;
    }
    const { data, error: rpcError } = await supabase.rpc("stage_my_artist_bookings");
    if (rpcError) {
      setError("Não foi possível carregar suas solicitações. Execute artist_booking_requests_migration.sql no Supabase. " + rpcError.message);
    } else if (data === null) {
      setError("Esta área é destinada a contas com função de cantor ou artista.");
    } else {
      setBookings(Array.isArray(data) ? data as Booking[] : []);
      setError("");
    }
    setLoading(false);
  }, [router]);

  useEffect(() => { void loadBookings(); }, [loadBookings]);

  const counts = useMemo(() => ({
    all: bookings.length,
    active: bookings.filter(b => b.status !== "archived").length,
    new: bookings.filter(b => b.status === "new").length,
    archived: bookings.filter(b => b.status === "archived").length
  }), [bookings]);

  const visible = useMemo(() => bookings.filter(b =>
    filter === "all" ? true : filter === "archived"
      ? b.status === "archived" : b.status !== "archived"
  ), [bookings, filter]);

  function editBookingEvent(item: Booking) {
    if (updating || eventSaving) return;
    const existingDate = item.event_starts_at ? new Date(item.event_starts_at) : null;
    setEventError("");
    setEventForm({
      requestId: item.id,
      title: item.event_title || ("Show em " + item.event_city).slice(0, 120),
      date: existingDate && !Number.isNaN(existingDate.getTime())
        ? localDateKey(existingDate)
        : (item.event_date || ""),
      time: existingDate && !Number.isNaN(existingDate.getTime())
        ? localTimeKey(existingDate) : "",
      venue: item.event_venue || "",
      // Dados do contratante não são copiados: descrição pode ficar pública
      // futuramente se o dono publicar voluntariamente este show.
      description: item.event_description || ""
    });
    setSuccess("");
  }

  async function saveBookingEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!eventForm || eventSaving || updating) return;
    setEventError("");
    setSuccess("");
    const { requestId, title, date, time, venue, description } = eventForm;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      setEventError("Informe uma data e um horário de início.");
      return;
    }
    const timestamp = new Date(date + "T" + time + ":00");
    if (Number.isNaN(timestamp.getTime())
      || localDateKey(timestamp) !== date
      || localTimeKey(timestamp) !== time
      || timestamp.getTime() < Date.now()) {
      setEventError("Escolha uma data e um horário futuros válidos para o show.");
      return;
    }
    if (!title.trim() || title.trim().length < 3 || title.trim().length > 120) {
      setEventError("O nome do show precisa ter entre 3 e 120 caracteres.");
      return;
    }
    setEventSaving(true);
    const { data, error: saveError } = await createClient().rpc(
      "stage_save_event_from_booking", {
        p_booking_id: requestId,
        p_title: title.trim(),
        p_starts_at: timestamp.toISOString(),
        p_venue: venue.trim() || null,
        p_description: description.trim() || null
      }
    );
    const result = data as { status?: string; event_id?: string } | null;
    if (saveError || !["created", "updated"].includes(result?.status || "")) {
      const explanations: Record<string, string> = {
        booking_not_found: "Este pedido não está mais disponível na sua conta.",
        not_editable: "Este show já deixou de ser rascunho. Ele não pode ser alterado por aqui.",
        invalid_date: "A data precisa ser futura e estar dentro dos próximos três anos.",
        invalid_title: "Informe um nome com 3 a 120 caracteres.",
        invalid_venue: "O nome do local é muito longo.",
        invalid_description: "A descrição excede 1.500 caracteres.",
        artist_required: "Sua conta precisa ter a função de artista."
      };
      setEventError(saveError?.code === "PGRST202" || saveError?.code === "42883"
        ? "Execute booking_to_event_draft_migration.sql no Supabase antes de usar esta integração."
        : saveError?.message || explanations[result?.status || ""] || "Não foi possível salvar o show.");
    } else {
      await loadBookings();
      setEventForm(null);
      setSuccess(result?.status === "updated"
        ? "Rascunho atualizado na agenda. Nenhum convite foi enviado."
        : "Show criado como rascunho privado na agenda. A contratação não foi confirmada e nenhum convite foi enviado.");
    }
    setEventSaving(false);
  }

  async function changeStatus(item: Booking, status: BookingStatus) {
    if (updating) return;
    setUpdating(item.id);
    setError("");
    setSuccess("");
    const { data, error: requestError } = await createClient().rpc(
      "stage_update_artist_booking_status", { p_id: item.id, p_status: status }
    );
    if (requestError || data !== "saved") {
      setError("Não foi possível atualizar esta solicitação. Recarregue a página e tente novamente.");
    } else {
      setBookings(previous => previous.map(b =>
        b.id === item.id ? { ...b, status } : b
      ));
      setSuccess("Andamento atualizado. Nenhuma mensagem foi enviada automaticamente ao solicitante.");
    }
    setUpdating(null);
  }

  async function permanentlyDelete(item: Booking) {
    if (updating) return;
    setUpdating(item.id);
    setError("");
    setSuccess("");
    const { data, error: deleteError } = await createClient().rpc(
      "stage_delete_artist_booking", { p_id: item.id }
    );
    if (deleteError || data !== "deleted") {
      setError("Não foi possível excluir. Tente novamente ou verifique a migração de solicitações.");
    } else {
      setBookings(previous => previous.filter(b => b.id !== item.id));
      setSuccess("Solicitação excluída definitivamente. Os dados do contato foram removidos. Se havia um show vinculado, ele permanece na agenda.");
    }
    setDeletingId(null);
    setUpdating(null);
  }

  return <main className="booking-inbox-page">
    <div className="container">
      <nav className="nav">
        <Link href="/painel" className="brand"><span className="brand-mark">S</span> stage flow</Link>
        <Link href="/painel" className="btn btn-quiet"><ArrowLeft size={15}/> Meu painel</Link>
      </nav>

      <header className="booking-inbox-header">
        <span className="eyebrow"><span className="dot"/> ÁREA DO ARTISTA · PRIVADA</span>
        <h1>Pedidos de <span className="accent">contratação.</span></h1>
        <p>Veja quem demonstrou interesse no seu show, responda pelos canais informados e acompanhe cada contato.</p>
      </header>

      <div className="booking-inbox-stats">
        <div><Inbox size={20}/><strong>{counts.new}</strong><span>Novos pedidos</span></div>
        <div><MessageCircle size={20}/><strong>{counts.active}</strong><span>Em acompanhamento</span></div>
        <div><Archive size={20}/><strong>{counts.archived}</strong><span>Arquivados</span></div>
      </div>

      <div className="booking-inbox-bar">
        <div className="booking-inbox-filters" role="group" aria-label="Filtrar solicitações">
          {([
            ["active", "Em aberto"],
            ["archived", "Arquivados"],
            ["all", "Todos"]
          ] as const).map(([value, label]) =>
            <button type="button" key={value} aria-pressed={filter === value}
              onClick={() => setFilter(value)}>
              {label} <span>{counts[value]}</span>
            </button>
          )}
        </div>
        <button className="btn btn-quiet" type="button" disabled={loading || Boolean(updating)}
          onClick={() => {setLoading(true);setSuccess("");void loadBookings();}}>
          <RotateCcw size={15}/> Atualizar
        </button>
      </div>

      {error && <div className="booking-inbox-feedback is-error" role="alert">{error}</div>}
      {success && <div className="booking-inbox-feedback" role="status">{success}</div>}

      {loading ? <div className="booking-inbox-empty"><LoaderCircle size={24}/> Carregando suas solicitações...</div>
        : visible.length === 0 ? <div className="booking-inbox-empty">
          <Inbox size={32}/>
          <h2>{filter === "archived" ? "Nenhuma solicitação arquivada." : "Nenhuma solicitação por enquanto."}</h2>
          <p>Quando alguém preencher o formulário da sua página gratuita de cantor, o pedido aparecerá aqui.</p>
          <Link className="btn btn-primary" href="/meu-perfil-artistico">Minha página artística <ArrowUpRight size={15}/></Link>
        </div> : <div className="booking-inbox-list">
          {visible.map(item => {
            const whatsapp = waLink(item.contact_phone);
            return <article className="booking-inbox-item" key={item.id}>
              <div className="booking-inbox-item-top">
                <div>
                  <span className="booking-inbox-created"><Clock3 size={13}/> Recebido em {formatDate(item.created_at, true)}</span>
                  <h2>{item.contact_name}</h2>
                  <p><MapPin size={14}/> {item.event_city}
                    {item.event_date && <> · <CalendarDays size={14}/> {formatDate(item.event_date)}</>}</p>
                </div>
                <div className="booking-inbox-status-stack">
                  <span className={"booking-inbox-status is-" + item.status}>
                    {item.status === "new" ? "Novo pedido" : item.status === "contacted" ? "Em contato" : "Arquivado"}
                  </span>
                  {item.event_id && <span className="booking-inbox-linked-tag">
                    <CalendarDays size={12}/> {item.event_status === "draft" ? "Rascunho na agenda" : "Show na agenda"}
                  </span>}
                </div>
              </div>

              <p className="booking-inbox-description">{item.message}</p>
              <div className="booking-inbox-private">
                <span><ShieldCheck size={14}/> Contato privado do solicitante</span>
                <div>
                  <a href={"mailto:" + encodeURIComponent(item.contact_email) + "?subject=" +
                    encodeURIComponent("Sua solicitação de show pelo Stage Flow")} className="booking-inbox-contact">
                    <Mail size={16}/> Responder e-mail <ArrowUpRight size={13}/>
                  </a>
                  {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer"
                    className="booking-inbox-contact">
                    <MessageCircle size={16}/> Abrir WhatsApp <ArrowUpRight size={13}/>
                  </a>}
                  <span className="booking-inbox-email">{item.contact_email}</span>
                  {item.contact_phone && <span className="booking-inbox-email">{item.contact_phone}</span>}
                </div>
              </div>

              <div className="booking-inbox-event-panel">
                <div>
                  <strong><CalendarDays size={17}/> Show na agenda</strong>
                  <p>{item.event_id
                    ? "Este pedido já está ligado a um show. Os detalhes do contratante permanecem somente nesta caixa privada."
                    : "Aproveite a cidade e a data do pedido para preparar um show. Você confirma o horário antes de criar o rascunho privado."}</p>
                </div>
                <div className="booking-inbox-event-controls">
                  {(!item.event_id || item.event_status === "draft") &&
                    <button type="button" className="btn btn-primary" disabled={eventSaving || Boolean(updating)}
                      onClick={() => {
                        if (eventForm?.requestId === item.id) { setEventForm(null); setEventError(""); }
                        else editBookingEvent(item);
                      }}>
                      {item.event_id ? <Pencil size={15}/> : <Plus size={15}/>}
                      {eventForm?.requestId === item.id ? "Fechar formulário" :
                        item.event_id ? "Editar rascunho" : "Criar show a partir do pedido"}
                    </button>}
                  {item.event_id && <>
                    <Link className="btn btn-quiet" href={"/eventos?evento=" + encodeURIComponent(item.event_id)}>
                      <ExternalLink size={15}/> Ver na agenda
                    </Link>
                    {item.event_status !== "cancelled" && item.event_status !== "completed" &&
                      <Link className="btn btn-quiet" href={"/eventos?evento=" + encodeURIComponent(item.event_id) + "&equipe=1"}>
                        <Users size={15}/> Organizar músicos
                      </Link>}
                  </>}
                </div>
              </div>
              {eventForm?.requestId === item.id && <form
                className="booking-inbox-event-form" onSubmit={e => void saveBookingEvent(e)}>
                <h3>{item.event_id ? "Editar show privado" : "Preparar rascunho do show"}</h3>
                <p className="booking-inbox-event-explain">
                  O pedido não confirma a contratação. Revise a data, informe o horário e salve.
                  O evento fica privado e nenhum convite é enviado automaticamente.
                </p>
                <div className="booking-inbox-event-fields">
                  <label className="booking-inbox-event-field booking-inbox-event-wide">
                    Nome do evento *
                    <input type="text" required minLength={3} maxLength={120}
                      value={eventForm.title}
                      onChange={e => setEventForm(prev => prev ? {...prev,title:e.target.value} : null)}
                      placeholder="Ex.: Show de pagode"/>
                  </label>
                  <label className="booking-inbox-event-field">
                    Data do show *
                    <input type="date" required value={eventForm.date}
                      onChange={e => setEventForm(prev => prev ? {...prev,date:e.target.value} : null)}/>
                  </label>
                  <label className="booking-inbox-event-field">
                    Horário de início *
                    <input type="time" required value={eventForm.time}
                      onChange={e => setEventForm(prev => prev ? {...prev,time:e.target.value} : null)}/>
                  </label>
                  <label className="booking-inbox-event-field">
                    Cidade do evento
                    <input type="text" readOnly value={item.event_city}
                      title="Cidade informada no pedido original" />
                  </label>
                  <label className="booking-inbox-event-field">
                    Local / estabelecimento (opcional)
                    <input type="text" maxLength={180} value={eventForm.venue}
                      onChange={e => setEventForm(prev => prev ? {...prev,venue:e.target.value} : null)}
                      placeholder="A definir"/>
                  </label>
                  <label className="booking-inbox-event-field booking-inbox-event-wide">
                    Observações do show (opcional)
                    <textarea rows={3} maxLength={1500} value={eventForm.description}
                      onChange={e => setEventForm(prev => prev ? {...prev,description:e.target.value} : null)}
                      placeholder="Anotações para o evento, sem dados pessoais do contratante"/>
                  </label>
                </div>
                <p className="booking-inbox-event-privacy">
                  <ShieldCheck size={16}/> Nome, e-mail, WhatsApp e mensagem do contratante
                  continuam somente neste pedido e não são copiados para o evento.
                </p>
                {eventError && <div className="booking-inbox-event-error" role="alert">{eventError}</div>}
                <div className="booking-inbox-event-form-actions">
                  <button className="btn btn-primary" type="submit" disabled={eventSaving}>
                    {eventSaving ? <LoaderCircle size={16}/> : <Save size={16}/>}
                    {eventSaving ? "Salvando rascunho..." : item.event_id ? "Salvar alterações" : "Criar rascunho privado"}
                  </button>
                  <button className="btn btn-quiet" type="button" disabled={eventSaving}
                    onClick={() => {setEventForm(null);setEventError("");}}>
                    Cancelar
                  </button>
                </div>
              </form>}
              <div className="booking-inbox-actions">
                {item.status !== "contacted" && <button type="button" disabled={Boolean(updating)}
                  onClick={() => void changeStatus(item, "contacted")}>
                  <CheckCircle2 size={15}/> Marcar como em contato
                </button>}
                {item.status !== "archived" && <button type="button" disabled={Boolean(updating)}
                  onClick={() => void changeStatus(item, "archived")}>
                  <Archive size={15}/> Arquivar
                </button>}
                {item.status !== "new" && <button type="button" disabled={Boolean(updating)}
                  onClick={() => void changeStatus(item, "new")}>
                  <RotateCcw size={15}/> Marcar como novo
                </button>}
                {item.status === "archived" && (deletingId === item.id ?
                  <>
                    <button type="button" className="booking-inbox-delete"
                      disabled={Boolean(updating)}
                      onClick={() => void permanentlyDelete(item)}>
                      <Trash2 size={15}/> Confirmar exclusão definitiva
                    </button>
                    <button type="button" disabled={Boolean(updating)}
                      onClick={() => setDeletingId(null)}>Cancelar</button>
                  </> :
                  <button type="button" className="booking-inbox-delete"
                    disabled={Boolean(updating)}
                    onClick={() => setDeletingId(item.id)}>
                    <Trash2 size={15}/> Excluir dados
                  </button>
                )}
              </div>
            </article>;
          })}
        </div>}
      <footer className="booking-inbox-footer">
        Os pedidos são privados. Abrir e-mail ou WhatsApp não envia mensagens automaticamente.
        Os status servem apenas para sua organização; não representam contratação confirmada. Você pode arquivar e excluir definitivamente solicitações antigas, inclusive quando o solicitante pedir a remoção de seus dados.
      </footer>
    </div>
  </main>;
}
