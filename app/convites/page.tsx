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
  const [inviteMode, setInviteMode] = useState<"registered" | "email">("registered");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");
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
      const { data: profile } = await supabase.from("profiles").select("role,is_artist,is_producer").eq("id", user.id).maybeSingle();
      if (!profile?.is_artist && !profile?.is_producer && profile?.role !== "producer") {
        router.replace("/painel");
        return;
      }
      const [{ data: eventRows }, { data: musicianRows }] = await Promise.all([
        supabase.from("events").select("id,title,starts_at").eq("producer_id", user.id).order("starts_at", { ascending: true }),
        supabase.from("profiles").select("id,display_name,username,city").eq("is_artist", true).order("display_name").limit(200),
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
    if (!eventId || (inviteMode === "registered" && !musician) || (inviteMode === "email" && !inviteEmail.trim())) {
      setIsError(true); setStatusMessage("Selecione um músico cadastrado nas sugestões."); setSaving(false); return;
    }
    const supabase = createClient();
    const code = inviteMode === "email" ? crypto.randomUUID() : null;
    const { error } = await supabase.from("invitations").insert({
      event_id: eventId,
      musician_id: inviteMode === "registered" ? musician!.id : null,
      invited_email: inviteMode === "email" ? inviteEmail.trim().toLowerCase() : null,
      invite_code: code,
      message: message.trim() || null,
    });
    if (error) {
      setIsError(true);
      setStatusMessage(error.code === "23505" ? "Esse músico já recebeu um convite para este evento." : error.message.includes("row-level security") ? "O Supabase bloqueou este convite pela política de segurança. Execute a versão atualizada de invitations_migration.sql. Se persistir, confira se o evento pertence a esta conta. Detalhes: " + error.message + " (código " + error.code + ")" : "Não foi possível enviar o convite: " + error.message + " (código " + error.code + ")");
    } else {
      if (code) {
        setInviteLink(window.location.origin + "/cadastro?convite=" + encodeURIComponent(code));
        setStatusMessage("Convite criado. Copie o link e envie ao músico. Ele deve usar o e-mail informado.");
      } else {
        setInviteLink("");
        setStatusMessage("Convite registrado para " + musician!.display_name + "!");
      }
      setUsername(""); setInviteEmail(""); setMessage("");
    }
    setSaving(false);
  }

  if (loading) return <main><div className="container" style={{ minHeight: "70vh", display: "grid", placeItems: "center" }}><p style={{ color: "var(--muted)" }}><LoaderCircle size={17} style={{ display: "inline", verticalAlign: "middle" }}/> Carregando convites...</p></div></main>;

  return <main><div className="container">
    <nav className="nav"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link><Link className="btn btn-quiet" href="/painel"><ArrowLeft size={15}/> Voltar ao painel</Link></nav>
    <section style={{ padding: "42px 0 24px" }}><div className="eyebrow"><span className="dot"/> EQUIPE DO EVENTO</div><h1 style={{ fontSize: "clamp(34px,5vw,46px)" }}>Convidar <span className="accent">músicos.</span></h1><p className="lead">Como artista ou produtor, escolha um evento e convide músicos para organizar a participação deles no Stage Flow.</p></section>
    <section className="feature" style={{ maxWidth: 760 }}>
      {events.length === 0 ? <><h2>Crie um evento primeiro</h2><p>Você precisa cadastrar um evento antes de convidar músicos para participar.</p><Link className="btn btn-primary" href="/eventos">Ir para a agenda</Link></> :
      <form onSubmit={sendInvite}>
        <div className="field"><label htmlFor="invite-event">Evento *</label><select id="invite-event" value={eventId} onChange={e => setEventId(e.target.value)} required style={{ width: "100%", padding: 13, border: "1px solid var(--line)", background: "var(--panel)", borderRadius: 11, color: "var(--text)" }}><option value="">Selecione um evento</option>{events.map(ev => <option key={ev.id} value={ev.id}>{ev.title} · {new Date(ev.starts_at).toLocaleDateString("pt-BR")}</option>)}</select></div>
        <div className="role-options"><button type="button" className="role-option" onClick={()=>{setInviteMode("registered");setInviteLink("");}} aria-pressed={inviteMode==="registered"}>Músico cadastrado</button><button type="button" className="role-option" onClick={()=>{setInviteMode("email");setInviteLink("");}} aria-pressed={inviteMode==="email"}>Convidar por link</button></div>
        {inviteMode === "registered" ? <div className="field"><label htmlFor="invite-musician">Músico (nome ou @usuário) *</label><input id="invite-musician" value={username} onChange={e => setUsername(e.target.value)} placeholder="Pesquise o músico cadastrado" required autoComplete="off"/>{matches.length > 0 && <div style={{ border: "1px solid var(--line)", borderRadius: 10, marginTop: 6, overflow: "hidden" }}>{matches.map(m => <button type="button" key={m.id} onClick={() => setUsername(m.username ? "@" + m.username : m.display_name)} style={{ display: "block", width: "100%", textAlign: "left", padding: 12, background: "var(--panel)", color: "var(--text)", border: 0, borderBottom: "1px solid var(--line)", cursor: "pointer" }}><strong>{m.display_name}</strong><span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{m.username ? "@" + m.username : "Sem nome de usuário"}{m.city ? " · " + m.city : ""}</span></button>)}</div>}<p style={{ fontSize: 12, color: "var(--muted)" }}>Selecione um músico cadastrado.</p></div> : <div className="field"><label htmlFor="invite-email">E-mail do músico *</label><input id="invite-email" type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="musico@exemplo.com" required/><p style={{fontSize:12,color:"var(--muted)"}}>O convite será vinculado a este e-mail.</p></div>}
        <div className="field"><label htmlFor="invite-message">Mensagem (opcional)</label><textarea id="invite-message" value={message} onChange={e => setMessage(e.target.value)} rows={3} maxLength={500} placeholder="Ex.: preciso de você no tantã para esse show." style={{ width: "100%", padding: 13, border: "1px solid var(--line)", background: "var(--panel)", borderRadius: 11, color: "var(--text)", resize: "vertical" }}/></div>
        {statusMessage && <div className="coming" role="status" style={isError ? { borderColor: "#754343", background: "#281919", color: "#ffb5b5" } : {}}>{!isError && <CheckCircle2 size={15} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }}/>} {statusMessage}</div>}
        {inviteLink && <div className="field"><label>Link para enviar ao músico</label><input readOnly value={inviteLink} onFocus={e=>e.currentTarget.select()}/><button className="btn btn-quiet" type="button" onClick={()=>void navigator.clipboard.writeText(inviteLink)}>Copiar link</button></div>}
        <button className="btn btn-primary" type="submit" disabled={saving || !eventId || (inviteMode === "registered" ? !username.trim() : !inviteEmail.trim())}><Send size={16}/>{saving ? "Enviando..." : "Enviar convite"}</button>
      </form>}
    </section>
    <div className="coming" style={{ maxWidth: 760, marginTop: 20 }}><Users size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 7 }}/> O músico convidado usa a conta dele para acompanhar e organizar a participação. Marketplace e subdomínio personalizado não fazem parte do acesso básico de convidado.</div>
  </div></main>;
}
