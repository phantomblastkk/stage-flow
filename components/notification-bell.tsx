"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Bell, BellRing, CheckCircle2, LoaderCircle,
  MessageCircle, RefreshCw, XCircle, Crown, Gift, Star, CalendarDays, BadgeCheck, Wallet
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "./notification-bell.module.css";

type NotificationPreview = {
  id: string;
  source_id: string;
  source_type: "invitation" | "proposal" | "conversation" | "operations" | "account" | "booking" | "review" | "verification" | "finance";
  event_code: string;
  event_id: string | null;
  thread_id: string | null;
  title: string;
  summary: string;
  created_at: string;
  read_at: string | null;
};

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit"
});

function destination(item: NotificationPreview) {
  if(item.source_type==="booking")return "/meu-perfil-artistico/solicitacoes?pedido="+encodeURIComponent(item.source_id);
  if(item.source_type==="review")return "/marketplace";
  if(item.source_type==="verification")return "/perfil-artistico";
  if(item.source_type==="finance")return "/financeiro";
  if(item.source_type==="account"){
    return item.event_code==="pro_courtesy_granted"
      ?"/meu-perfil-artistico?aba=pro":"/minha-conta?aba=cantor";
  }
  if (item.source_type === "operations") {
    return item.event_id ? "/eventos/operacao?evento=" + encodeURIComponent(item.event_id) : "/eventos";
  }
  if (item.source_type === "conversation" || item.source_type === "proposal") {
    return item.thread_id
      ? "/conversas?conversa=" + encodeURIComponent(item.thread_id)
      : "/conversas";
  }
  if (item.event_code === "invite_received" || item.event_code === "invite_cancelled") {
    return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(item.source_id)
      ? "/meus-convites?convite=" + encodeURIComponent(item.source_id)
      : "/meus-convites";
  }
  return item.event_id
    ? "/convites?evento=" + encodeURIComponent(item.event_id)
    : "/convites";
}

function NoticeIcon({ code }: { code: string }) {
  if(code==="booking_received")return <CalendarDays size={18}/>;
  if(code==="review_received")return <Star size={18}/>;
  if(code==="profile_verified")return <BadgeCheck size={18}/>;
  if(code==="finance_received")return <Wallet size={18}/>;
  if(code==="pro_courtesy_granted")return <Gift size={18}/>;
  if(code==="pro_courtesy_revoked")return <Crown size={18}/>;
  if (code === "show_briefing_changed") return <BellRing size={18} />;
  if (code === "chat_message") return <MessageCircle size={18} />;
  if (code === "invite_accepted" || code === "proposal_accepted") return <CheckCircle2 size={18} />;
  if (code === "invite_declined" || code === "proposal_declined" || code === "invite_cancelled" || code === "proposal_withdrawn") {
    return <XCircle size={18} />;
  }
  return <BellRing size={18} />;
}

export default function NotificationBell() {
  const router = useRouter();
  const panelId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState<number | null>(null);
  const [items, setItems] = useState<NotificationPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [refreshRequest,setRefreshRequest]=useState(0);
  const [realtimeConnected,setRealtimeConnected]=useState(false);

  // Count without downloading the feed while the dropdown is closed.
  // Fetch five most recent notices only when the user opens it.
  useEffect(() => {
    let alive = true;
    async function refresh() {
      if (document.visibilityState !== "visible") return;
      try {
        const db = createClient();
        if (open) {
          setLoading(true);
          const { data, error: rpcError } = await db.rpc("stage_notifications_list", {
            p_filter: "unread", p_limit: 5
          });
          if (rpcError || data?.status !== "ok" || !Array.isArray(data.items)) {
            throw new Error("Não foi possível carregar seus avisos.");
          }
          if (alive) {
            setItems(data.items as NotificationPreview[]);
            setUnread(Math.max(0, Number(data.unread) || 0));
            setError("");
          }
        } else {
          const { data, error: rpcError } = await db.rpc("stage_notifications_unread_count");
          if (alive && !rpcError && typeof data === "number") {
            setUnread(Math.max(0, data));
          }
        }
      } catch {
        if (alive && open) setError("Não foi possível buscar os avisos. Tente atualizar.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void refresh();
    const interval = setInterval(() => { void refresh(); }, realtimeConnected?60000:25000);
    // Keep the count fresh when the owner returns from the administration
    // or a musician reopens the tab after receiving a new Pro courtesy.
    const onReturn=()=>{if(document.visibilityState==="visible")void refresh();};
    document.addEventListener("visibilitychange",onReturn);
    window.addEventListener("focus",onReturn);
    window.addEventListener("stageflow:notifications-updated",onReturn);
    return () => {
      alive=false;clearInterval(interval);
      document.removeEventListener("visibilitychange",onReturn);
      window.removeEventListener("focus",onReturn);
      window.removeEventListener("stageflow:notifications-updated",onReturn);
    };
  }, [open,refreshRequest,realtimeConnected]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(()=>{
    const update=(event:Event)=>{
      setRealtimeConnected(Boolean((event as CustomEvent<{connected:boolean}>).detail?.connected));
    };
    window.addEventListener("stageflow:realtime-status",update);
    return()=>window.removeEventListener("stageflow:realtime-status",update);
  },[]);

  async function openNotification(item: NotificationPreview) {
    if (openingId !== null) return;
    setOpeningId(item.id);
    if (!item.read_at) {
      try {
        const { data, error: rpcError } = await createClient().rpc("stage_notifications_mark", {
          p_ids: [item.id], p_all: false
        });
        if (!rpcError && data?.status === "ok") {
          // So os nao lidos aparecem na campainha; o historico fica em Todas.
          setItems(previous=>previous.filter(notice=>notice.id!==item.id));
          setUnread(count => count === null ? null : Math.max(0, count - 1));
          window.dispatchEvent(new Event("stageflow:notifications-updated"));
        }
      } catch {
        // Mark-as-read failures must not block access to the original subject.
      }
    }
    setOpen(false);
    router.push(destination(item));
  }

  return <div className={styles.wrapper} ref={wrapper}>
    <button type="button" ref={trigger} className="btn btn-quiet"
      aria-label={"Notificações" + (unread ? " — " + unread + " não lidas" : "")}
      aria-expanded={open} aria-controls={panelId}
      onClick={() => setOpen(value => !value)}
      title="Últimas notificações">
      <Bell size={16} />
      <span className={styles.triggerText}>Avisos</span>
      {unread !== null && unread > 0 &&
        <span className={styles.counter} aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
    </button>
    {open && <div id={panelId} className={styles.dropdown}
      role="region" aria-label="Notificações não lidas">
      <div className={styles.header}>
        <div>
          <strong>Notificações</strong>
          <small>{unread === null ? "Seus avisos recentes" :
            unread === 0 ? "Tudo em dia" : unread + " não lida" + (unread === 1 ? "" : "s")}</small>
        </div>
        <Link className={styles.headerLink} href="/notificacoes"
          onClick={() => setOpen(false)}>Ver todas <ArrowRight size={14} /></Link>
      </div>
      <div className={styles.feed}>
        {loading && items.length === 0
          ? <p className={styles.feedback}><LoaderCircle size={17} /> Carregando avisos...</p>
          : error
          ? <div className={styles.feedback} role="alert"><RefreshCw size={17} /> {error} <button type="button" className={styles.retry} onClick={()=>setRefreshRequest(n=>n+1)}>Tentar novamente</button></div>
          : items.length === 0
          ? <div className={styles.empty}>
              <Bell size={22} />
              <strong>Tudo em dia!</strong>
              <span>Você não tem notificações pendentes. Os avisos lidos ficam no histórico em “Ver todas”.</span>
            </div>
          : items.map(item =>
            <button key={item.id} type="button"
              className={styles.item + (item.read_at ? "" : " " + styles.unread)}
              disabled={openingId !== null}
              onClick={() => void openNotification(item)}>
              <span className={styles.itemIcon}><NoticeIcon code={item.event_code} /></span>
              <span className={styles.itemContent}>
                <span className={styles.itemTitle}>
                  <strong>{item.title}</strong>
                  {!item.read_at && <span className={styles.unreadDot} aria-label="Não lida" />}
                </span>
                <span className={styles.summary}>{item.summary}</span>
                <span className={styles.time}>{timeFormatter.format(new Date(item.created_at))}</span>
              </span>
            </button>
          )}
      </div>
      <Link href="/notificacoes" className={styles.footer}
        onClick={() => setOpen(false)}>
        Ver todas as notificações <ArrowRight size={16} />
      </Link>
    </div>}
  </div>;
}
