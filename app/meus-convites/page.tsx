"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Check, CheckCircle2, Clock3, LoaderCircle, MapPin, Music2, X } from "lucide-react";
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

          {invite.status === "accepted" && <p style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 0", fontSize: 13, color: "var(--lime)" }}><CheckCircle2 size={17}/> Sua participação está confirmada.</p>}
          {invite.status === "declined" && <p style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 0", fontSize: 13, color: "var(--muted)" }}><Clock3 size={16}/> Você recusou este convite.</p>}
        </article>
      ))}
    </div>

    <p className="fine" style={{ marginTop: 26 }}>Os convites são gratuitos. Aceitar um show não libera marketplace ou endereço personalizado.</p>
  </div></main>;
}
