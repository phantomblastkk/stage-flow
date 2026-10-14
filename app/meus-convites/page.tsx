"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Check, CheckCircle2, Clock3, LoaderCircle, MapPin, MessageCircle, Music2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Invite = {
  id: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  message: string | null;
  created_at: string;
  responded_at: string | null;
  event_id: string;
  event_title: string;
  event_starts_at: string;
  event_venue: string | null;
  event_city: string | null;
  organizer_name: string;
};
type Filter = "all" | "pending" | "accepted" | "declined";

const dateTime = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short" }).format(new Date(value));

const statusNames: Record<Invite["status"], string> = {
  pending: "Aguardando resposta",
  accepted: "Confirmado",
  declined: "Recusado",
  cancelled: "Cancelado",
};

export default function MeusConvitesPage() {
  const router = useRouter();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [feedback, setFeedback] = useState("");
  const [isError, setIsError] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [whatsappLoading, setWhatsappLoading] = useState(true);
  const [whatsappSaving, setWhatsappSaving] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [whatsappError, setWhatsappError] = useState(false);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      router.replace("/login");
      return;
    }
    const { data, error } = await supabase.rpc("stage_my_invitations");
    if (error) {
      setIsError(true);
      setFeedback("Não foi possível carregar os convites. Execute received_invitations_migration.sql no Supabase. Detalhes: " + error.message);
    } else {
      setInvites((data ?? []) as Invite[]);
      setIsError(false);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    let active = true;
    async function loadWhatsAppPreferences() {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!active || !authData.user) return;
      const { data, error } = await supabase.rpc("stage_my_whatsapp_preference");
      if (!active) return;
      if (error) {
        setWhatsappError(true);
        setWhatsappMessage("Preferências de WhatsApp ainda indisponíveis. Execute whatsapp_reminders_migration.sql no Supabase.");
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
      p_opt_in: whatsappConsent,
    });
    if (error) {
      setWhatsappError(true);
      setWhatsappMessage("Não foi possível salvar: " + error.message);
    } else if (data === "enabled") {
      setWhatsappMessage("Autorização salva! Os organizadores dos seus convites pendentes ou confirmados poderão abrir uma conversa pelo WhatsApp.");
    } else if (data === "disabled") {
      setWhatsappPhone("");
      setWhatsappConsent(false);
      setWhatsappMessage("Autorização desativada. Seu número de lembretes não ficará mais disponível aos organizadores.");
    } else {
      setWhatsappError(true);
      setWhatsappMessage(data === "invalid_phone" ? "Informe um número válido com DDD (por exemplo: 11 99999-9999)." : "Não foi possível atualizar a autorização: " + String(data));
    }
    setWhatsappSaving(false);
  }

  const pendingCount = invites.filter((invite) => invite.status === "pending").length;
  const acceptedCount = invites.filter((invite) => invite.status === "accepted").length;
  const filtered = useMemo(() => filter === "all" ? invites : invites.filter((invite) => invite.status === filter), [invites, filter]);

  async function respond(invite: Invite, accept: boolean) {
    if (invite.status !== "pending" || processingId) return;
    setProcessingId(invite.id);
    setFeedback("");
    setIsError(false);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("stage_respond_invite", {
      p_invitation_id: invite.id,
      p_accept: accept,
    });
    if (error) {
      setFeedback("Não conseguimos registrar sua resposta: " + error.message);
      setIsError(true);
    } else if (data === "accepted" || data === "declined") {
      setInvites((prev) => prev.map((item) =>
        item.id === invite.id ? { ...item, status: data, responded_at: new Date().toISOString() } : item
      ));
      setFeedback(data === "accepted" ? "Presença confirmada! O organizador poderá acompanhar sua resposta." : "Convite recusado. Sua resposta foi registrada.");
    } else {
      setIsError(true);
      setFeedback(data === "already_responded"
        ? "Esse convite já foi respondido. Atualize a página para conferir."
        : "Não foi possível responder a esse convite. Atualize a página e tente novamente.");
    }
    setProcessingId(null);
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

    {filtered.length === 0 && <section className="feature" style={{ maxWidth: 680 }}>
      <Music2 size={27} style={{ color: "var(--lime)", marginBottom: 14 }}/>
      <h2 style={{ fontSize: 21 }}>{invites.length === 0 ? "Nenhum convite por enquanto" : "Nada nesta categoria"}</h2>
      <p>{invites.length === 0 ? "Quando um cantor ou produtor convidar você para um show, ele aparecerá aqui após você vincular o convite à sua conta." : "Escolha outro filtro para ver seus convites."}</p>
    </section>}

    <div style={{ display: "grid", gap: 16, maxWidth: 800 }}>
      {filtered.map((invite) => (
        <article key={invite.id} className="feature" style={{ padding: "22px 20px" }}>
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

          {invite.status === "pending" && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginTop: 22 }}>
            <button type="button" className="btn btn-primary" disabled={Boolean(processingId)} onClick={() => void respond(invite, true)}>
              {processingId === invite.id ? <LoaderCircle size={16}/> : <Check size={16}/>} {processingId === invite.id ? "Registrando..." : "Aceitar convite"}
            </button>
            <button type="button" className="btn btn-quiet" disabled={Boolean(processingId)} onClick={() => void respond(invite, false)}>
              <X size={16}/> Recusar
            </button>
          </div>}

          {invite.status === "accepted" && <div style={{ marginTop: 18, display: "grid", gap: 10 }}><p style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, fontSize: 13, color: "var(--lime)" }}><CheckCircle2 size={17}/> Sua participação está confirmada.</p><Link className="btn btn-quiet" href="/eventos" style={{ justifyContent: "center" }}><CalendarDays size={16}/> Ver show na minha agenda</Link></div>}
          {invite.status === "declined" && <p style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 0", fontSize: 13, color: "var(--muted)" }}><Clock3 size={16}/> Você recusou este convite.</p>}
        </article>
      ))}
    </div>

    <section className="feature" style={{ maxWidth: 800, marginTop: 30 }}>
      <div className="eyebrow"><span className="dot"/> CONTATO OPCIONAL</div>
      <h2 style={{ fontSize: 23, margin: "16px 0 10px" }}><MessageCircle size={21} style={{ display: "inline", verticalAlign: "middle", marginRight: 8 }}/> Lembretes no WhatsApp</h2>
      <p style={{ marginBottom: 18 }}>Você decide se quer disponibilizar seu número aos cantores e produtores dos shows para os quais recebeu convites. O organizador abre o WhatsApp e envia a mensagem manualmente; não são notificações automáticas.</p>
      {whatsappLoading ? <p style={{ color: "var(--muted)" }}>Carregando preferências...</p> :
        <form onSubmit={saveWhatsappPreferences}>
          <div className="field" style={{ maxWidth: 430 }}>
            <label htmlFor="my-whatsapp-number">Seu WhatsApp com DDD</label>
            <input id="my-whatsapp-number" type="tel" autoComplete="tel" value={whatsappPhone} onChange={e=>setWhatsappPhone(e.target.value)} placeholder="(11) 99999-9999" required={whatsappConsent}/>
          </div>
          <label style={{ display: "flex", gap: 11, alignItems: "flex-start", fontSize: 13, lineHeight: 1.6, color: "var(--muted)", marginBottom: 18 }}>
            <input type="checkbox" checked={whatsappConsent} onChange={e=>setWhatsappConsent(e.target.checked)} style={{ marginTop: 4, accentColor: "var(--lime)", flexShrink: 0 }}/>
            <span>Autorizo o Stage Flow a compartilhar este número apenas com os organizadores dos shows para os quais tenho convites pendentes ou aceitos, para que possam falar comigo e enviar lembretes pelo WhatsApp. Posso retirar essa autorização quando quiser.</span>
          </label>
          <button type="submit" className="btn btn-primary" disabled={whatsappSaving}>{whatsappSaving ? "Salvando..." : whatsappConsent ? "Salvar autorização" : "Desativar contato por WhatsApp"}</button>
          {whatsappMessage && <div role={whatsappError ? "alert" : "status"} className="coming" style={whatsappError ? { borderColor: "#754343", background: "#281919", color: "#ffb5b5" } : {}}>{whatsappMessage}</div>}
        </form>}
    </section>
    <p className="fine" style={{ marginTop: 26 }}>Os convites são gratuitos. Aceitar um show não libera marketplace ou endereço personalizado.</p>
  </div></main>;
}
