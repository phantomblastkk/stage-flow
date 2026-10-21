"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Clock3,
  LoaderCircle, Music2, RefreshCw, Send, ShieldCheck, Users
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import EventFinancialSummary from "./event-financial-summary";
import "./event-team-invites.css";

type SavedTeam = {
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
type SentInvitation = {
  id: string;
  event_id: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  musician_name: string | null;
};

type Props = {
  eventId: string;
  eventTitle: string;
  eventStatus: "draft" | "published" | "cancelled" | "completed";
};

export default function EventTeamInvites({ eventId, eventTitle, eventStatus }: Props) {
  const [teams, setTeams] = useState<SavedTeam[]>([]);
  const [teamId, setTeamId] = useState("");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<SentInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [message, setMessage] = useState("");
  const [showMembers, setShowMembers] = useState(true);
  const [financialRefresh, setFinancialRefresh] = useState(0);
  const chosen = teams.find(item => item.id === teamId);

  const readData = useCallback(async () => {
    const supabase = createClient();
    const [teamsResult, invitationsResult] = await Promise.all([
      supabase.rpc("stage_my_teams"),
      supabase.rpc("stage_sent_invitations_with_whatsapp")
    ]);
    if (teamsResult.error) {
      setError("Não conseguimos carregar suas equipes. Confira se fixed_teams_migration.sql está executado no Supabase.");
    } else {
      const list = (teamsResult.data ?? []) as SavedTeam[];
      setTeams(list);
      setTeamId(current => list.some(team => team.id === current) ? current : (list[0]?.id || ""));
      setError("");
    }
    if (!invitationsResult.error) {
      setInvitations(((invitationsResult.data ?? []) as SentInvitation[])
        .filter(invitation => invitation.event_id === eventId));
    }
    setLoading(false);
    setRefreshing(false);
    // Revalida também o financeiro ao atualizar a equipe ou gerar convites.
    setFinancialRefresh(value => value + 1);
  }, [eventId]);

  useEffect(() => { void readData(); }, [readData]);

  useEffect(() => {
    let active = true;
    async function readMembers() {
      if (!teamId) { setMembers([]); return; }
      setMembersLoading(true);
      const { data, error: membersError } = await createClient().rpc(
        "stage_team_members_for_owner", { p_team_id: teamId }
      );
      if (!active) return;
      if (membersError) {
        setError("Não foi possível carregar os integrantes desta equipe.");
        setMembers([]);
      } else {
        setMembers((data ?? []) as TeamMember[]);
      }
      setMembersLoading(false);
    }
    void readMembers();
    return () => { active = false; };
  }, [teamId]);

  const pending = invitations.filter(item => item.status === "pending").length;
  const accepted = invitations.filter(item => item.status === "accepted").length;
  const declined = invitations.filter(item => item.status === "declined").length;

  async function sendTeamInvites(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!teamId || !chosen || members.length === 0 || sending) return;
    if (eventStatus === "cancelled" || eventStatus === "completed") {
      setError("Este show foi encerrado ou cancelado. Não é possível convidar a equipe.");
      return;
    }
    const summary = "Convidar os " + members.length + " músico(s) da equipe \"" +
      chosen.name + "\" para \"" + eventTitle + "\"?\n\n" +
      "Cada músico receberá uma proposta individual no Stage Flow. " +
      "A aceitação e o cachê continuam pendentes de negociação. " +
      "Nenhum WhatsApp ou e-mail será enviado automaticamente.";
    if (!window.confirm(summary)) return;
    setSending(true);
    setNotice("");
    setError("");
    const { data, error: inviteError } = await createClient().rpc(
      "stage_invite_team_to_event", {
        p_team_id: teamId,
        p_event_id: eventId,
        p_message: message.trim() || null
      }
    );
    const response = data as {
      status?: string;
      created?: number;
      existing?: number;
      total?: number;
    } | null;
    if (inviteError || response?.status !== "sent") {
      const reasons: Record<string, string> = {
        event_not_found: "Não foi possível localizar este show na sua conta.",
        team_not_found: "A equipe selecionada não pertence à sua conta.",
        empty_team: "Adicione pelo menos um músico à equipe antes de convidar.",
        message_too_long: "A mensagem deve ter até 500 caracteres."
      };
      setError(inviteError?.message || reasons[response?.status || ""] ||
        "Não foi possível registrar os convites agora.");
    } else {
      setNotice(String(response.created ?? 0) + " novo(s) convite(s) registrado(s). " +
        String(response.existing ?? 0) + " músico(s) já tinham convite para este show. " +
        "Acompanhe as respostas e negocie cada cachê individualmente.");
      setMessage("");
      await readData();
    }
    setSending(false);
  }

  return <section className="event-team-panel" aria-label={"Equipe de músicos para " + eventTitle}>
    <div className="event-team-panel-heading">
      <div>
        <span className="event-team-eyebrow"><Music2 size={15}/> ORGANIZAÇÃO DOS MÚSICOS</span>
        <h3>Monte a equipe deste show.</h3>
        <p>Escolha uma formação salva. Os convites e a negociação de cachê continuam individuais.</p>
      </div>
      <button type="button" className="event-team-refresh"
        onClick={() => {setRefreshing(true);void readData();}}
        disabled={loading || refreshing || sending} aria-label="Atualizar convites e equipes">
        <RefreshCw size={16}/>{refreshing ? "Atualizando..." : "Atualizar"}
      </button>
    </div>

    {loading ? <p className="event-team-loading"><LoaderCircle size={16}/> Carregando equipes...</p> : <>
      <div className="event-team-statuses" aria-label="Convites deste show">
        <span><Clock3 size={15}/> {pending} pendente(s)</span>
        <span><CheckCircle2 size={15}/> {accepted} aceito(s)</span>
        <span>{declined} recusado(s)</span>
      </div>

      <EventFinancialSummary eventId={eventId} refreshToken={financialRefresh}/>

      {teams.length === 0 ? <div className="event-team-empty">
        <Users size={20}/>
        <p>Você ainda não tem uma equipe salva. Crie uma formação a partir de músicos com quem já colaborou.</p>
        <Link className="btn btn-primary" href={"/equipes?evento=" + encodeURIComponent(eventId)}>
          Criar minha equipe <ArrowRight size={15}/>
        </Link>
      </div> : <form onSubmit={event => void sendTeamInvites(event)} className="event-team-form">
        <label htmlFor={"event-team-select-" + eventId}>Equipe salva</label>
        <select id={"event-team-select-" + eventId} value={teamId}
          disabled={sending}
          onChange={event => {setTeamId(event.target.value);setNotice("");setError("");}}>
          {teams.map(team => <option key={team.id} value={team.id}>
            {team.name} · {team.member_count} músico(s)
          </option>)}
        </select>

        {chosen && <div className="event-team-members">
          <button type="button" className="event-team-members-toggle"
            aria-expanded={showMembers} onClick={() => setShowMembers(value => !value)}>
            <span><Users size={16}/> {members.length} integrante(s) da equipe</span>
            {showMembers ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          </button>
          {showMembers && (membersLoading
            ? <p className="event-team-loading"><LoaderCircle size={15}/> Carregando integrantes...</p>
            : members.length === 0
              ? <p className="event-team-no-members">Adicione músicos à equipe antes de enviar convites.</p>
              : <div className="event-team-member-list">
                {members.map(member => <div key={member.member_id}>
                  <strong>{member.musician_name}</strong>
                  <span>{member.instrument || "Instrumento não especificado"}</span>
                </div>)}
              </div>)}
        </div>}

        <label htmlFor={"event-team-message-" + eventId}>Mensagem aos convidados (opcional)</label>
        <textarea id={"event-team-message-" + eventId}
          value={message} onChange={event => setMessage(event.target.value)}
          maxLength={500} rows={3}
          placeholder="Ex.: vamos tocar nesse show; confirma sua disponibilidade?"/>

        <div className="event-team-actions">
          <button type="submit" className="btn btn-primary"
            disabled={sending || membersLoading || members.length === 0 ||
              eventStatus === "cancelled" || eventStatus === "completed"}>
            {sending ? <LoaderCircle size={16}/> : <Send size={16}/>}
            {sending ? "Registrando convites..." : "Convidar esta equipe"}
          </button>
          <Link className="btn btn-quiet" href={"/equipes?evento=" + encodeURIComponent(eventId)}>
            Gerenciar formações <ArrowRight size={15}/>
          </Link>
        </div>
      </form>}

      <Link className="event-team-tracking" href={"/convites?evento=" + encodeURIComponent(eventId)}>
        <ShieldCheck size={17}/>
        Ver convites deste show e negociar cachês privados
        <ArrowRight size={16}/>
      </Link>
      <p className="event-team-caution">
        Nenhum convite é enviado sem sua confirmação. Um show em rascunho continua privado
        mesmo depois de convidar músicos. Nada confirma a contratação do evento.
      </p>
    </>}

    {error && <div className="event-team-error" role="alert">{error}</div>}
    {notice && <div className="event-team-notice" role="status">{notice}</div>}
  </section>;
}
