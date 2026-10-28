"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CheckCircle2, Clock3, LoaderCircle, Music2,
  Pencil, Plus, RefreshCw, Send, Trash2, UserPlus, Users, ArrowRight, CalendarDays
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, InlineNotice, Input, LoadingState, Select, Textarea } from "@/src/components/ui";
import "./equipes.css";

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

  if (loading) return <main className="teams-page"><LoadingState label="Carregando suas equipes..."/></main>;

  return <main className="teams-page"><div className="container teams-spacing" >
    <nav className="nav">
      <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
      <Link className="sf-ui-button sf-ui-button-ghost" href="/painel"><ArrowLeft size={15}/> Meu painel</Link>
    </nav>

    <section className="teams-hero">
      <div className="eyebrow"><span className="dot"/> ORGANIZAÇÃO MUSICAL</div>
      <h1 className="teams-title">
        Minhas <span className="accent">equipes.</span>
      </h1>
      <p className="lead">Salve a formação da banda uma vez e reutilize nos próximos shows. Cada músico recebe seu próprio convite e negocia o cachê em particular.</p><Link className="sf-ui-button sf-ui-button-ghost teams-recurring-link" href="/shows-recorrentes" ><CalendarDays size={15}/> Usar equipe em shows recorrentes</Link>
      {events.find(event => event.id === eventId) && <div className="sf-ui-notice teams-context" >
        <strong>Show selecionado:</strong> {events.find(event => event.id === eventId)?.title}. Escolha uma equipe abaixo e confirme o envio dos convites somente quando estiver pronto.
        <Link href={"/convites?evento=" + encodeURIComponent(eventId)} className="sf-ui-button sf-ui-button-ghost teams-top-gap" >
          Ver convites deste show <ArrowRight size={15}/>
        </Link>
      </div>}
    </section>

    {statusMessage && <div className="teams-feedback"><InlineNotice tone={isError?"danger":"success"}>{statusMessage}</InlineNotice></div>}

    <section className="sf-ui-card teams-create-panel" >
      <h2 className="teams-section-title">
        <Plus size={20} className="teams-inline-icon"/> Nova formação
      </h2>
      <form onSubmit={createTeam} className="teams-form">
        <Input label="Nome da equipe *" id="new-team-name" value={newName} onChange={e=>setNewName(e.target.value)}
            minLength={2} maxLength={80} required placeholder="Ex.: Banda principal / Formação acústica"/>
        <Input label="Observações (opcional)" id="new-team-notes" value={newNotes} onChange={e=>setNewNotes(e.target.value)}
            maxLength={250} placeholder="Ex.: formação usada em eventos de pagode"/>
        <Button type="submit" disabled={saving}
          className="teams-create-action">
          <Plus size={16}/>{saving ? "Salvando..." : "Criar equipe"}
        </Button>
      </form>
    </section>

    <section className="sf-ui-card teams-panel" >
      <div className="teams-heading">
        <h2 className="teams-heading-title"><Users size={21} className="teams-inline-icon"/> Minhas formações</h2>
        <Button variant="ghost" type="button" onClick={() => void refresh()}
          disabled={reloading || saving}>
          <RefreshCw size={16}/>{reloading ? "Atualizando..." : "Atualizar"}
        </Button>
      </div>
      {teams.length === 0 ? <div className="sf-ui-notice teams-empty" >
        <p className="teams-zero">Você ainda não cadastrou uma equipe. Crie a primeira formação acima.</p>
      </div> : <>
        <Select label="Equipe que deseja gerenciar" id="team-select"  value={selectedTeamId}
            onChange={e=>setSelectedTeamId(e.target.value)}>
            {teams.map(team=><option key={team.id} value={team.id}>
              {team.name} · {team.member_count} integrante(s)
            </option>)}
          </Select>
        {selectedTeam && <>
          <div className="teams-selected-heading">
            <div>
              <h3 className="teams-team-title">{selectedTeam.name}</h3>
              <p className="teams-team-meta">
                {selectedTeam.notes || "Formação privada do organizador"} · {selectedTeam.member_count} integrante(s)
              </p>
            </div>
            <div className="teams-actions">
              <Button variant="ghost" type="button" aria-expanded={editing} aria-controls="team-edit-form" onClick={()=>setEditing(x=>!x)}>
                <Pencil size={15}/> Editar
              </Button>
              <Button variant="ghost" type="button"
                onClick={()=>void deleteTeam()} disabled={saving}>
                <Trash2 size={15}/> Excluir
              </Button>
            </div>
          </div>
          {editing && <form id="team-edit-form" onSubmit={updateTeam}
            className="teams-edit-form">
            <Input label="Nome" id="edit-team-name" value={editName} onChange={e=>setEditName(e.target.value)}
                minLength={2} maxLength={80} required/>
            <Input label="Observações" id="edit-team-notes" value={editNotes} onChange={e=>setEditNotes(e.target.value)} maxLength={250}/>
            <Button type="submit" disabled={saving}>Salvar alteração</Button>
          </form>}

          <div className="teams-members-section">
            <h3 className="teams-subheading">Integrantes</h3>
            {membersLoading ? <LoadingState label="Carregando integrantes..."/> : members.length === 0 ? <div className="sf-ui-notice">
              <p className="teams-zero">Equipe vazia. Adicione músicos já convidados por sua conta.</p>
            </div> : <div className="teams-members">
              {members.map(member=><article key={member.member_id}
                className="teams-member-card">
                <div className="teams-member-person">
                  <strong className="teams-member-name">{member.musician_name}</strong>
                  <span className="teams-member-meta">
                    {member.instrument || "Instrumento ainda não informado"}
                  </span>
                </div>
                <Button variant="ghost" type="button" disabled={saving}
                  onClick={()=>void removeMember(member)} aria-label={"Remover " + member.musician_name}>
                  <Trash2 size={15}/> Remover
                </Button>
              </article>)}
            </div>}
          </div>

          <form onSubmit={addMusician} className="teams-add-section">
            <h3 className="teams-subheading">
              <UserPlus size={19} className="teams-inline-icon"/> Adicionar músico
            </h3>
            {availableCandidates.length === 0 ? <p className="teams-hint">
              {candidates.length === 0
                ? "Nenhum músico elegível encontrado ainda. Primeiro convide alguém para um show e aguarde o vínculo da conta."
                : "Todos os músicos com convites anteriores já foram incluídos nesta formação."}
              {" "}<Link href="/convites" className="teams-text-link">Ir para convites</Link>
            </p> : <>
              <div className="teams-field-grid" >
                <Select label="Músico já convidado *" id="team-musician"  value={newMusicianId}
                    onChange={e=>setNewMusicianId(e.target.value)} required>
                    <option value="">Selecione um músico</option>
                    {availableCandidates.map(candidate=><option key={candidate.musician_id} value={candidate.musician_id}>{candidate.musician_name}</option>)}
                  </Select>
                <Input label="Instrumento na formação (opcional)" id="team-instrument" value={newInstrument}
                    onChange={e=>setNewInstrument(e.target.value)}
                    maxLength={60} placeholder="Ex.: Cavaquinho"/>
              </div>
              <Button variant="ghost" type="submit" className="teams-top-gap"
                disabled={saving || !newMusicianId}>
                <Plus size={16}/> Adicionar integrante
              </Button>
            </>}
          </form>

          <div className="teams-invite-section">
            <h3 className="teams-invite-title">
              <Send size={19} className="teams-inline-icon"/> Convidar a equipe para um show
            </h3>
            <p className="teams-hint">
              Um convite separado para cada músico. Duplicados não serão enviados de novo.
              O cachê de cada participação será negociado individualmente, sem acesso dos colegas.
            </p>
            <form onSubmit={inviteTeam} className="teams-form">
              <Select label="Escolha um show seu *" id="team-event"  value={eventId}
                  onChange={e=>setEventId(e.target.value)} required>
                  <option value="">Selecione um evento</option>
                  {events.map(event=><option key={event.id} value={event.id}>
                    {event.title} · {new Date(event.starts_at).toLocaleDateString("pt-BR")}
                  </option>)}
                </Select>
              <Textarea label="Mensagem para os convidados (opcional)" id="team-invite-message"
                  rows={3} maxLength={500} value={inviteMessage}
                  onChange={e=>setInviteMessage(e.target.value)}
                  placeholder="Ex.: apresentação com a banda completa, passagem de som às 18h"/>
              {events.length === 0 && <p className="teams-hint">
                Você precisa <Link href="/eventos" className="teams-text-link">criar um evento</Link> antes.
              </p>}
              <Button type="submit"

                disabled={saving || membersLoading || members.length === 0 || !eventId}>
                <Send size={16}/>{saving ? "Registrando convites..." : "Convidar equipe para este show"}
              </Button>
            </form>
            <Link href="/convites" className="sf-ui-button sf-ui-button-ghost teams-recurring-link" >
              <Music2 size={16}/> Acompanhar respostas e negociar cachês
            </Link>
          </div>
        </>}
      </>}
    </section>

    <p className="teams-footnote" >
      Sua formação é um catálogo privado. Salvar alguém numa equipe não confirma uma apresentação
      nem cria compromisso permanente. A pessoa decide sobre cada convite no próprio Stage Flow.
      O envio não dispara e-mail ou WhatsApp automaticamente.
    </p>
  </div></main>;
}
