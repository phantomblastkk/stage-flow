"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users, Send, LoaderCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type EventOption = { id: string; title: string; starts_at: string };
type Musician = { id: string; display_name: string; username: string | null; city: string | null };

export default function ConvitesPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventOption[]>([]);
  const [musicians, setMusicians] = useState<Musician[]>([]);
  const [eventId, setEventId] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (profile?.role !== "producer") {
        router.replace("/painel");
        return;
      }
      const [{ data: eventRows }, { data: musicianRows }] = await Promise.all([
        supabase.from("events").select("id,title,starts_at").eq("producer_id", user.id).order("starts_at", { ascending: true }),
        supabase.from("profiles").select("id,display_name,username,city").eq("role", "musician").order("display_name").limit(200),
      ]);
      if (!active) return;
      setEvents((eventRows ?? []) as EventOption[]);
      setMusicians((musicianRows ?? []) as Musician[]);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [router]);

  const matches = username.trim()
    ? musicians.filter(m => (m.username ?? "").toLowerCase().includes(username.trim().toLowerCase()) || m.display_name.toLowerCase().includes(username.trim().toLowerCase())).slice(0, 6)
    : [];

  async function sendInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true); setStatusMessage(""); setIsError(false);
    const searchValue = username.trim().replace(/^@/, "").toLowerCase();
    const musician = musicians.find(m => m.id === username || (m.username ?? "").toLowerCase() === searchValue || m.display_name.toLowerCase() === username.trim().toLowerCase());
    if (!eventId || !musician) {
      setIsError(true); setStatusMessage("Selecione um músico cadastrado nas sugestões."); setSaving(false); return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("invitations").insert({
      event_id: eventId,
      musician_id: musician.id,
      message: message.trim() || null,
    });
    if (error) {
      setIsError(true);
      setStatusMessage(error.code === "23505" ? "Esse músico já recebeu um convite para este evento." : error.message.includes("row-level security") ? "O banco ainda não liberou os convites. Execute invitations_migration.sql no Supabase." : "Não foi possível enviar o convite: " + error.message);
    } else {
      setStatusMessage("Convite enviado para " + musician.display_name + "!");
      setUsername(""); setMessage("");
    }
    setSaving(false);
  }

  if (loading) return <main><div className="container" style={{ minHeight: "70vh", display: "grid", placeItems: "center" }}><p style={{ color: "var(--muted)" }}><LoaderCircle size={17} style={{ display: "inline", verticalAlign: "middle" }}/> Carregando convites...</p></div></main>;

  return <main><div className="container">
    <nav className="nav"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link><Link className="btn btn-quiet" href="/painel"><ArrowLeft size={15}/> Voltar ao painel</Link></nav>
    <section style={{ padding: "42px 0 24px" }}><div className="eyebrow"><span className="dot"/> EQUIPE DO EVENTO</div><h1 style={{ fontSize: "clamp(34px,5vw,46px)" }}>Convidar <span className="accent">músicos.</span></h1><p className="lead">Escolha um evento e convide um músico cadastrado para organizar a participação dele no Stage Flow.</p></section>
    <section className="feature" style={{ maxWidth: 760 }}>
      {events.length === 0 ? <><h2>Crie um evento primeiro</h2><p>Você precisa cadastrar um evento antes de convidar músicos para participar.</p><Link className="btn btn-primary" href="/eventos">Ir para a agenda</Link></> :
      <form onSubmit={sendInvite}>
        <div className="field"><label htmlFor="invite-event">Evento *</label><select id="invite-event" value={eventId} onChange={e => setEventId(e.target.value)} required style={{ width: "100%", padding: 13, border: "1px solid var(--line)", background: "var(--panel)", borderRadius: 11, color: "var(--text)" }}><option value="">Selecione um evento</option>{events.map(ev => <option key={ev.id} value={ev.id}>{ev.title} · {new Date(ev.starts_at).toLocaleDateString("pt-BR")}</option>)}</select></div>
        <div className="field"><label htmlFor="invite-musician">Músico (nome ou @usuário) *</label><input id="invite-musician" value={username} onChange={e => setUsername(e.target.value)} placeholder="Pesquise o músico cadastrado" required autoComplete="off"/>{matches.length > 0 && <div style={{ border: "1px solid var(--line)", borderRadius: 10, marginTop: 6, overflow: "hidden" }}>{matches.map(m => <button type="button" key={m.id} onClick={() => setUsername(m.username ? "@" + m.username : m.display_name)} style={{ display: "block", width: "100%", textAlign: "left", padding: 12, background: "var(--panel)", color: "var(--text)", border: 0, borderBottom: "1px solid var(--line)", cursor: "pointer" }}><strong>{m.display_name}</strong><span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{m.username ? "@" + m.username : "Sem nome de usuário"}{m.city ? " · " + m.city : ""}</span></button>)}</div>}<p style={{ fontSize: 12, color: "var(--muted)" }}>Por enquanto, esta primeira versão envia convites a músicos que já têm conta no Stage Flow.</p></div>
        <div className="field"><label htmlFor="invite-message">Mensagem (opcional)</label><textarea id="invite-message" value={message} onChange={e => setMessage(e.target.value)} rows={3} maxLength={500} placeholder="Ex.: preciso de você no tantã para esse show." style={{ width: "100%", padding: 13, border: "1px solid var(--line)", background: "var(--panel)", borderRadius: 11, color: "var(--text)", resize: "vertical" }}/></div>
        {statusMessage && <div className="coming" role="status" style={isError ? { borderColor: "#754343", background: "#281919", color: "#ffb5b5" } : {}}>{!isError && <CheckCircle2 size={15} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }}/>} {statusMessage}</div>}
        <button className="btn btn-primary" type="submit" disabled={saving || !eventId || !username.trim()}><Send size={16}/>{saving ? "Enviando..." : "Enviar convite"}</button>
      </form>}
    </section>
    <div className="coming" style={{ maxWidth: 760, marginTop: 20 }}><Users size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 7 }}/> O músico convidado usa a conta dele para acompanhar e organizar a participação. Marketplace e subdomínio personalizado não fazem parte do acesso básico de convidado.</div>
  </div></main>;
}
