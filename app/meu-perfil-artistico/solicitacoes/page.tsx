"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive, ArrowLeft, ArrowUpRight, CalendarDays, CheckCircle2, Clock3,
  Inbox, LoaderCircle, Mail, MapPin, MessageCircle, RotateCcw, ShieldCheck
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
};

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
                <span className={"booking-inbox-status is-" + item.status}>
                  {item.status === "new" ? "Novo pedido" : item.status === "contacted" ? "Em contato" : "Arquivado"}
                </span>
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
              </div>
            </article>;
          })}
        </div>}
      <footer className="booking-inbox-footer">
        Os pedidos são privados. Abrir e-mail ou WhatsApp não envia mensagens automaticamente.
        Os status servem apenas para sua organização; não representam contratação confirmada.
      </footer>
    </div>
  </main>;
}
