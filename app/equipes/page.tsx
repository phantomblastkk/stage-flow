"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CheckCircle2, Clock3, LoaderCircle, Music2,
  Pencil, Plus, RefreshCw, Send, Trash2, UserPlus, Users, ArrowRight, CalendarDays
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Team = {
  id: string;
  name: string;
  notes: string;
  member_count: number;
  created_at: string;
};
type TeamMember = {
  member_id: string;
  musician_id: string;
  musician_name: string;
  instrument: string;
  created_at: string;
};
type Candidate = { musician_id: string; musician_name: string };
type EventOption = { id: string; title: string; starts_at: string };

const fieldStyle = {
  width: "100%",
  padding: 12,
  border: "1px solid var(--line)",
  borderRadius: 11,
  background: "var(--panel)",
  color: "var(--text)",
};

export default function EquipesPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [newName, setNewName] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editing, setEditing] = useState(false);
  const [newMusicianId, setNewMusicianId] = useState("");
  const [newInstrument, setNewInstrument] = useState("");
  const [eventId, setEventId] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);

  const selectedTeam = useMemo(
    () => teams.find(team => team.id === selectedTeamId) ?? null,
    [selectedTeamId, teams]
  );

  const availableCandidates = useMemo(() => {
    const memberIds = new Set(members.map(m => m.musician_id));
    return candidates.filter(c => !memberIds.has(c.musician_id));
  }, [candidates, members]);

  const setNotice = (text: string, error = false) => {
    setStatusMessage(text);
    setIsError(error);
  };

  const loadTeams = useCallback(async () => {
    const { data, error } = await createClient().rpc("stage_my_teams");
    if (error) {
      setNotice("Não foi possível consultar as equipes. Execute fixed_teams_migration.sql no Supabase. Detalhes: " + error.message, true);
      return;
    }
    const rows = (data ?? []) as Team[];
    setTeams(rows);
    setSelectedTeamId(current =>
      current && rows.some(t => t.id === current) ? current : (rows[0]?.id ?? "")
    );
  }, []);

  const loadMembers = useCallback(async (teamId: string) => {
    if (!teamId) { setMembers([]); return; }
    setMembersLoading(true);
    const { data, error } = await createClient().rpc(
      "stage_team_members_for_owner", { p_team_id: teamId }
    );
    if (error) {
      setNotice("Não foi possível carregar os integrantes: " + error.message, true);
    } else {
      setMembers((data ?? []) as TeamMember[]);
    }
    setMembersLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    async function initialLoad() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) { router.replace("/login"); return; }

      const { data: profile } = await supabase.from("profiles")
        .select("is_artist,is_producer").eq("id", user.id).maybeSingle();
      if (!active) return;
      if (!profile?.is_artist && !profile?.is_producer) {
        router.replace("/painel");
        return;
      }

      const [teamsResult, candidatesResult, eventsResult] = await Promise.all([
        supabase.rpc("stage_my_teams"),
        supabase.rpc("stage_team_candidates"),
        supabase.from("events").select("id,title,starts_at")
          .eq("producer_id", user.id).order("starts_at", { ascending: true })
      ]);
      if (!active) return;

      if (teamsResult.error || candidatesResult.error) {
        setNotice("O banco ainda não liberou as equipes. Execute fixed_teams_migration.sql no Supabase. Detalhes: "
          + (teamsResult.error?.message || candidatesResult.error?.message), true);
      } else {
        const rows = (teamsResult.data ?? []) as Team[];
        setTeams(rows);
        setSelectedTeamId(rows[0]?.id ?? "");
        setCandidates((candidatesResult.data ?? []) as Candidate[]);
      }

      if (eventsResult.error) {
        setNotice("Não foi possível carregar os seus eventos: " + eventsResult.error.message, true);
      } else {
        const ownedEvents = (eventsResult.data ?? []) as EventOption[];
        setEvents(ownedEvents);
        // Retorna da agenda com o show correto selecionado, sem confiar em IDs
        // externos: somente a lista de eventos do dono é aceita.
        const linkedEventId = new URLSearchParams(window.location.search).get("evento");
        if (linkedEventId && ownedEvents.some(event => event.id === linkedEventId)) {
          setEventId(linkedEventId);
        }
      }
      setLoading(false);
    }
    void initialLoad();
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    let active = true;
    async function loadSelected() {
      if (!selectedTeamId) {
        setMembers([]);
        setMembersLoading(false);
        return;
      }
      setMembersLoading(true);
      setMembers([]);
      const { data, error } = await createClient().rpc(
        "stage_team_members_for_owner", { p_team_id: selectedTeamId }
      );
      if (!active) return;
      if (error) setNotice("Não foi possível carregar a formação: " + error.message, true);
      else setMembers((data ?? []) as TeamMember[]);
      setMembersLoading(false);
    }
    void loadSelected();
    return () => { active = false; };
  }, [selectedTeamId]);

  useEffect(() => {
    setEditName(selectedTeam?.name ?? "");
    setEditNotes(selectedTeam?.notes ?? "");
    setEditing(false);
    setNewMusicianId("");
    setNewInstrument("");
  }, [selectedTeam?.id, selectedTeam?.name, selectedTeam?.notes]);

  async function refresh() {
    setReloading(true);
    const supabase = createClient();
    const [teamsResult, candidatesResult] = await Promise.all([
      supabase.rpc("stage_my_teams"),
      supabase.rpc("stage_team_candidates")
    ]);
    if (teamsResult.error || candidatesResult.error) {
      setNotice("Não foi possível atualizar as equipes. " +
        (teamsResult.error?.message || candidatesResult.error?.message), true);
    } else {
      const rows = (teamsResult.data ?? []) as Team[];
      setTeams(rows);
      setCandidates((candidatesResult.data ?? []) as Candidate[]);
      setSelectedTeamId(current =>
        current && rows.some(t => t.id === current) ? current : (rows[0]?.id ?? "")
      );
      if (selectedTeamId && rows.some(t => t.id === selectedTeamId)) {
        await loadMembers(selectedTeamId);
      }
    }
    setReloading(false);
  }

  async function createTeam(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setNotice("");
    const { data, error } = await createClient().rpc("stage_create_team", {
      p_name: newName.trim(),
      p_notes: newNotes.trim()
    });
    const response = data as { status: string; id?: string } | null;
    if (error || response?.status !== "created") {
      setNotice(error?.message || (response?.status === "duplicate"
        ? "Você já possui uma equipe com esse nome."
        : "Não foi possível criar a equipe. Verifique o nome e tente novamente."), true);
    } else {
      setNewName("");
      setNewNotes("");
      await loadTeams();
      if (response.id) setSelectedTeamId(response.id);
      setNotice("Equipe criada! Agora escolha os músicos que vão fazer parte dessa formação.");
    }
    setSaving(false);
  }

  async function updateTeam(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedTeamId || saving) return;
    setSaving(true);
    const { data, error } = await createClient().rpc("stage_update_team", {
      p_team_id: selectedTeamId,
      p_name: editName.trim(),
      p_notes: editNotes.trim()
    });
    if (error || data !== "updated") {
      setNotice(error?.message || (data === "duplicate"
        ? "Já existe outra equipe com esse nome."
        : "Não foi possível alterar a formação."), true);
    } else {
      await loadTeams();
      setEditing(false);
      setNotice("Nome e descrição da equipe atualizados.");
    }
    setSaving(false);
  }

  async function deleteTeam() {
    if (!selectedTeamId || saving || !selectedTeam) return;
    if (!window.confirm('Excluir a equipe "' + selectedTeam.name +
      '"? Isso não cancela convites já enviados nem apaga shows.')) return;
    setSaving(true);
    const { data, error } = await createClient().rpc("stage_delete_team", {
      p_team_id: selectedTeamId
    });
    if (error || data !== "deleted") {
      setNotice(error?.message || "Não foi possível excluir a equipe.", true);
    } else {
      await loadTeams();
      setNotice("Equipe excluída. Os convites anteriores foram preservados.");
    }
    setSaving(false);
  }

  async function addMusician(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedTeamId || !newMusicianId || saving) return;
    setSaving(true);
    const { data, error } = await createClient().rpc("stage_add_team_member", {
      p_team_id: selectedTeamId,
      p_musician_id: newMusicianId,
      p_instrument: newInstrument.trim()
    });
    if (error || (data !== "added" && data !== "updated")) {
      const reasons: Record<string, string> = {
        not_previous_invitee: "O músico precisa ter sido convidado anteriormente por esta conta.",
        team_full: "Cada equipe pode ter até 25 integrantes.",
        not_found: "Essa equipe não está mais disponível."
      };
      setNotice(error?.message || reasons[String(data)] || "Não foi possível adicionar o músico.", true);
    } else {
      setNewMusicianId("");
      setNewInstrument("");
      await loadMembers(selectedTeamId);
      await loadTeams();
      setNotice("Músico adicionado à formação. Ele receberá um convite individual quando você selecionar um show.");
    }
    setSaving(false);
  }

  async function removeMember(member: TeamMember) {
    if (!selectedTeamId || saving) return;
    if (!window.confirm("Remover " + member.musician_name + " desta formação?")) return;
    setSaving(true);
    const { data, error } = await createClient().rpc("stage_remove_team_member", {
      p_member_id: member.member_id
    });
    if (error || data !== "removed") {
      setNotice(error?.message || "Não foi possível remover o integrante.", true);
    } else {
      await loadMembers(selectedTeamId);
      await loadTeams();
      setNotice("Integrante removido da equipe, sem alterar os convites anteriores.");
    }
    setSaving(false);
  }

  async function inviteTeam(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedTeamId || !eventId || saving) return;
    if (!window.confirm("Enviar convites individuais para os músicos desta equipe?")) return;
    setSaving(true);
    const { data, error } = await createClient().rpc("stage_invite_team_to_event", {
      p_team_id: selectedTeamId,
      p_event_id: eventId,
      p_message: inviteMessage.trim() || null
    });
    const response = data as {
      status: string; created?: number; existing?: number; total?: number
    } | null;
    if (error || response?.status !== "sent") {
      const reasons: Record<string, string> = {
        empty_team: "Adicione pelo menos um integrante antes de enviar convites.",
        event_not_found: "Este evento não pertence à sua conta.",
        team_not_found: "Esta equipe não pertence à sua conta."
      };
      setNotice(error?.message || reasons[String(response?.status)] ||
        "Não foi possível enviar os convites.", true);
    } else {
      setNotice("Convites registrados para " + String(response.created ?? 0) +
        " músico(s). " + String(response.existing ?? 0) +
        " integrante(s) já tinham convite para este show. Os cachês serão negociados individualmente.");
      setInviteMessage("");
    }
    setSaving(false);
  }

  if (loading) return <main><div className="container"
    style={{ minHeight: "80vh", display: "grid", placeItems: "center" }}>
    <p style={{ color: "var(--muted)" }}>
      <LoaderCircle size={18} style={{ display: "inline", verticalAlign: "middle" }}/> Carregando suas equipes...
    </p>
  </div></main>;

  return <main><div className="container" style={{ paddingBottom: 60 }}>
    <nav className="nav">
      <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
      <Link className="btn btn-quiet" href="/painel"><ArrowLeft size={15}/> Meu painel</Link>
    </nav>

    <section style={{ padding: "42px 0 24px" }}>
      <div className="eyebrow"><span className="dot"/> ORGANIZAÇÃO MUSICAL</div>
      <h1 style={{ fontSize: "clamp(34px,5vw,46px)", marginBottom: 12 }}>
        Minhas <span className="accent">equipes.</span>
      </h1>
      <p className="lead">Salve a formação da banda uma vez e reutilize nos próximos shows. Cada músico recebe seu próprio convite e negocia o cachê em particular.</p><Link className="btn btn-quiet" href="/shows-recorrentes" style={{marginTop:14}}><CalendarDays size={15}/> Usar equipe em shows recorrentes</Link>
      {events.find(event => event.id === eventId) && <div className="coming" style={{ maxWidth: 840, marginTop: 16 }}>
        <strong>Show selecionado:</strong> {events.find(event => event.id === eventId)?.title}. Escolha uma equipe abaixo e confirme o envio dos convites somente quando estiver pronto.
        <Link href={"/convites?evento=" + encodeURIComponent(eventId)} className="btn btn-quiet" style={{ marginTop: 12 }}>
          Ver convites deste show <ArrowRight size={15}/>
        </Link>
      </div>}
    </section>

    {statusMessage && <div className="coming" role={isError ? "alert" : "status"}
      style={isError
        ? { borderColor: "#754343", background: "#281919", color: "#ffb5b5", maxWidth: 860 }
        : { maxWidth: 860 }}>
      {!isError && <CheckCircle2 size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }}/>}
      {statusMessage}
    </div>}

    <section className="feature" style={{ maxWidth: 860, marginBottom: 22 }}>
      <h2 style={{ fontSize: 23, marginTop: 0 }}>
        <Plus size={20} style={{ display: "inline", verticalAlign: "middle" }}/> Nova formação
      </h2>
      <form onSubmit={createTeam} style={{ display: "grid", gap: 12 }}>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="new-team-name">Nome da equipe *</label>
          <input id="new-team-name" value={newName} onChange={e=>setNewName(e.target.value)}
            minLength={2} maxLength={80} required placeholder="Ex.: Banda principal / Formação acústica"/>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="new-team-notes">Observações (opcional)</label>
          <input id="new-team-notes" value={newNotes} onChange={e=>setNewNotes(e.target.value)}
            maxLength={250} placeholder="Ex.: formação usada em eventos de pagode"/>
        </div>
        <button className="btn btn-primary" type="submit" disabled={saving}
          style={{ justifyContent: "center", maxWidth: 250 }}>
          <Plus size={16}/>{saving ? "Salvando..." : "Criar equipe"}
        </button>
      </form>
    </section>

    <section className="feature" style={{ maxWidth: 860 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 23, margin: 0 }}><Users size={21} style={{ display: "inline", verticalAlign: "middle" }}/> Minhas formações</h2>
        <button type="button" className="btn btn-quiet" onClick={() => void refresh()}
          disabled={reloading || saving}>
          <RefreshCw size={16}/>{reloading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>
      {teams.length === 0 ? <div className="coming" style={{ marginTop: 18 }}>
        <p style={{ margin: 0 }}>Você ainda não cadastrou uma equipe. Crie a primeira formação acima.</p>
      </div> : <>
        <div className="field" style={{ marginTop: 20 }}>
          <label htmlFor="team-select">Equipe que deseja gerenciar</label>
          <select id="team-select" style={fieldStyle} value={selectedTeamId}
            onChange={e=>setSelectedTeamId(e.target.value)}>
            {teams.map(team=><option key={team.id} value={team.id}>
              {team.name} · {team.member_count} integrante(s)
            </option>)}
          </select>
        </div>
        {selectedTeam && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
            <div>
              <h3 style={{ fontSize: 20, margin: "0 0 5px" }}>{selectedTeam.name}</h3>
              <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
                {selectedTeam.notes || "Formação privada do organizador"} · {selectedTeam.member_count} integrante(s)
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-quiet" onClick={()=>setEditing(x=>!x)}>
                <Pencil size={15}/> Editar
              </button>
              <button type="button" className="btn btn-quiet"
                onClick={()=>void deleteTeam()} disabled={saving}>
                <Trash2 size={15}/> Excluir
              </button>
            </div>
          </div>
          {editing && <form onSubmit={updateTeam}
            style={{ display: "grid", gap: 10, marginTop: 16, border: "1px solid var(--line)", borderRadius: 12, padding: 15 }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="edit-team-name">Nome</label>
              <input id="edit-team-name" value={editName} onChange={e=>setEditName(e.target.value)}
                minLength={2} maxLength={80} required/>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="edit-team-notes">Observações</label>
              <input id="edit-team-notes" value={editNotes} onChange={e=>setEditNotes(e.target.value)} maxLength={250}/>
            </div>
            <button className="btn btn-primary" type="submit" disabled={saving}>Salvar alteração</button>
          </form>}

          <div style={{ marginTop: 25 }}>
            <h3 style={{ fontSize: 18, marginBottom: 12 }}>Integrantes</h3>
            {membersLoading ? <p style={{ fontSize: 13, color: "var(--muted)" }}>
              <Clock3 size={16} style={{ verticalAlign: "middle" }}/> Carregando...
            </p> : members.length === 0 ? <div className="coming">
              <p style={{ margin: 0 }}>Equipe vazia. Adicione músicos já convidados por sua conta.</p>
            </div> : <div style={{ display: "grid", gap: 8 }}>
              {members.map(member=><article key={member.member_id}
                style={{ background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 12, padding: 12, display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <strong style={{ display: "block" }}>{member.musician_name}</strong>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {member.instrument || "Instrumento ainda não informado"}
                  </span>
                </div>
                <button type="button" className="btn btn-quiet" disabled={saving}
                  onClick={()=>void removeMember(member)} aria-label={"Remover " + member.musician_name}>
                  <Trash2 size={15}/> Remover
                </button>
              </article>)}
            </div>}
          </div>

          <form onSubmit={addMusician} style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 18, marginBottom: 12 }}>
              <UserPlus size={19} style={{ display: "inline", verticalAlign: "middle" }}/> Adicionar músico
            </h3>
            {availableCandidates.length === 0 ? <p style={{ color: "var(--muted)", fontSize: 13 }}>
              {candidates.length === 0
                ? "Nenhum músico elegível encontrado ainda. Primeiro convide alguém para um show e aguarde o vínculo da conta."
                : "Todos os músicos com convites anteriores já foram incluídos nesta formação."}
              {" "}<Link href="/convites" style={{ color: "var(--lime)" }}>Ir para convites</Link>
            </p> : <>
              <div className="cards" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
                <div className="field" style={{ margin: 0 }}>
                  <label htmlFor="team-musician">Músico já convidado *</label>
                  <select id="team-musician" style={fieldStyle} value={newMusicianId}
                    onChange={e=>setNewMusicianId(e.target.value)} required>
                    <option value="">Selecione um músico</option>
                    {availableCandidates.map(candidate=><option key={candidate.musician_id} value={candidate.musician_id}>{candidate.musician_name}</option>)}
                  </select>
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label htmlFor="team-instrument">Instrumento na formação (opcional)</label>
                  <input id="team-instrument" value={newInstrument}
                    onChange={e=>setNewInstrument(e.target.value)}
                    maxLength={60} placeholder="Ex.: Cavaquinho"/>
                </div>
              </div>
              <button type="submit" className="btn btn-quiet" style={{ marginTop: 12 }}
                disabled={saving || !newMusicianId}>
                <Plus size={16}/> Adicionar integrante
              </button>
            </>}
          </form>

          <div style={{ borderTop: "1px solid var(--line)", marginTop: 27, paddingTop: 24 }}>
            <h3 style={{ fontSize: 21, margin: "0 0 8px" }}>
              <Send size={19} style={{ display: "inline", verticalAlign: "middle" }}/> Convidar a equipe para um show
            </h3>
            <p style={{ color: "var(--muted)", fontSize: 13 }}>
              Um convite separado para cada músico. Duplicados não serão enviados de novo.
              O cachê de cada participação será negociado individualmente, sem acesso dos colegas.
            </p>
            <form onSubmit={inviteTeam} style={{ display: "grid", gap: 12 }}>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="team-event">Escolha um show seu *</label>
                <select id="team-event" style={fieldStyle} value={eventId}
                  onChange={e=>setEventId(e.target.value)} required>
                  <option value="">Selecione um evento</option>
                  {events.map(event=><option key={event.id} value={event.id}>
                    {event.title} · {new Date(event.starts_at).toLocaleDateString("pt-BR")}
                  </option>)}
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="team-invite-message">Mensagem para os convidados (opcional)</label>
                <textarea id="team-invite-message" style={{ ...fieldStyle, resize: "vertical" }}
                  rows={3} maxLength={500} value={inviteMessage}
                  onChange={e=>setInviteMessage(e.target.value)}
                  placeholder="Ex.: apresentação com a banda completa, passagem de som às 18h"/>
              </div>
              {events.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>
                Você precisa <Link href="/eventos" style={{ color: "var(--lime)" }}>criar um evento</Link> antes.
              </p>}
              <button type="submit" className="btn btn-primary"
                style={{ justifyContent: "center" }}
                disabled={saving || membersLoading || members.length === 0 || !eventId}>
                <Send size={16}/>{saving ? "Registrando convites..." : "Convidar equipe para este show"}
              </button>
            </form>
            <Link href="/convites" className="btn btn-quiet" style={{ marginTop: 14 }}>
              <Music2 size={16}/> Acompanhar respostas e negociar cachês
            </Link>
          </div>
        </>}
      </>}
    </section>

    <p className="fine" style={{ maxWidth: 860, marginTop: 22 }}>
      Sua formação é um catálogo privado. Salvar alguém numa equipe não confirma uma apresentação
      nem cria compromisso permanente. A pessoa decide sobre cada convite no próprio Stage Flow.
      O envio não dispara e-mail ou WhatsApp automaticamente.
    </p>
  </div></main>;
}
