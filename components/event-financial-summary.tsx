"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, CheckCircle2, ChevronDown, ChevronUp, CircleHelp,
  Clock3, FileWarning, LoaderCircle, LockKeyhole, RefreshCw,
  Wallet
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, InlineNotice, LoadingState, StatusChip } from "@/src/components/ui";
import "./event-financial-summary.css";

type InvitationStatus = "pending" | "accepted" | "declined" | "cancelled";

type FinancialItem = {
  invitation_id: string;
  musician_name: string;
  has_musician: boolean;
  invitation_status: InvitationStatus;
  agreed_amount: number | null;
  last_offer_amount: number | null;
};

type FinancialSummary = {
  event_id: string;
  invitation_count: number;
  active_count: number;
  accepted_count: number;
  confirmed_fee_count: number;
  agreed_waiting_count: number;
  pending_fee_count: number;
  open_offer_count: number;
  unquoted_count: number;
  inactive_count: number;
  confirmed_total: number;
  agreed_waiting_total: number;
  agreed_total: number;
  open_offer_total: number;
  items: FinancialItem[];
};

type Props = { eventId: string; refreshToken?: number };

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL"
});

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "Não informado";
  return currency.format(value);
}

function badgeFor(item: FinancialItem) {
  if (item.invitation_status === "declined") {
    return { text: "Recusou o convite", type: "inactive" };
  }
  if (item.invitation_status === "cancelled") {
    return { text: "Convite cancelado", type: "inactive" };
  }
  if (item.invitation_status === "accepted" && item.agreed_amount != null) {
    return { text: "Participação e cachê acordados", type: "confirmed" };
  }
  if (item.invitation_status === "pending" && item.agreed_amount != null) {
    return { text: "Cachê acordado · aceite pendente", type: "agreed" };
  }
  if (item.last_offer_amount != null) {
    return { text: "Proposta em negociação", type: "proposed" };
  }
  if (item.invitation_status === "accepted") {
    return { text: "Participação aceita · cachê a definir", type: "missing" };
  }
  return { text: "Aguardando negociação", type: "missing" };
}

export default function EventFinancialSummary({ eventId, refreshToken = 0 }: Props) {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  const reload = useCallback(() => {
    setReloadNonce(value => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      const { data, error: rpcError } = await createClient().rpc(
        "stage_event_financial_summary",
        { p_event_id: eventId }
      );
      if (!active) return;
      if (rpcError) {
        setSummary(null);
        setError(
          rpcError.code === "PGRST202" || rpcError.code === "42883"
            ? "Para ativar o resumo, execute event_financial_summary_migration.sql no Supabase."
            : "Não foi possível consultar os cachês deste show. Verifique suas permissões e a migração financeira. " +
              rpcError.message
        );
      } else if (!data || !Array.isArray(data.items)) {
        setSummary(null);
        setError("Não foi possível carregar o resumo privado deste evento.");
      } else {
        setSummary(data as FinancialSummary);
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [eventId, refreshToken, reloadNonce]);

  return <section className="event-financial-panel" aria-label="Resumo financeiro privado deste show">
    <div className="event-financial-heading">
      <div>
        <span className="event-financial-eyebrow">
          <LockKeyhole size={13}/> FINANCEIRO PRIVADO · ORGANIZADOR
        </span>
        <h4><Wallet size={19}/> Cachês da banda</h4>
        <p>Valores reais das negociações do Stage Flow, sem estimar cachês que ainda não foram acordados.</p>
      </div>
      <Button variant="ghost" className="event-financial-refresh" type="button" onClick={reload} disabled={loading}>
        <RefreshCw size={15}/>{loading ? "Consultando..." : "Atualizar valores"}
      </Button>
    </div>

    {loading && <LoadingState label="Consultando cachês privados..."/>}

    {!loading && error && <InlineNotice tone="danger">{error}</InlineNotice>}

    {!loading && summary && <>
      <div className="event-financial-total">
        <div>
          <span>Total de cachês acordados</span>
          <strong>{money(summary.agreed_total)}</strong>
          <small>{summary.confirmed_fee_count + summary.agreed_waiting_count} cachê(s) fechado(s) em convites ativos</small>
        </div>
        <p><CircleHelp size={16}/> Subtotal parcial da banda, não orçamento final nem valor já pago.</p>
      </div>

      <div className="event-financial-stats">
        <div>
          <span><CheckCircle2 size={15}/> Cachês com participação aceita</span>
          <strong>{money(summary.confirmed_total)}</strong>
          <small>{summary.confirmed_fee_count} músico(s) com convite aceito e cachê acordado</small>
        </div>
        <div>
          <span><Clock3 size={15}/> Cachês fechados, aceite pendente</span>
          <strong>{money(summary.agreed_waiting_total)}</strong>
          <small>{summary.agreed_waiting_count} músico(s) ainda precisam confirmar presença</small>
        </div>
        <div>
          <span><Clock3 size={15}/> Propostas em aberto</span>
          <strong>{money(summary.open_offer_total)}</strong>
          <small>{summary.open_offer_count} proposta(s) não acordada(s) — fora do subtotal</small>
        </div>
      </div>

      <div className="event-financial-pending">
        <span>
          <strong>{summary.pending_fee_count}</strong>
          {" "}convite(s) ativo(s) sem cachê fechado
        </span>
        <span>
          {summary.unquoted_count} ainda sem proposta
        </span>
        {summary.inactive_count > 0 && <span>
          {summary.inactive_count} recusado(s)/cancelado(s) fora dos totais
        </span>}
      </div>

      {summary.active_count > 0 && summary.pending_fee_count > 0 &&
        <p className="event-financial-warning">
          <CircleHelp size={16}/>
          O total de cachês da banda ainda pode aumentar: há convidados sem valor acordado.
          Não considerar os valores ausentes como R$ 0.
        </p>}

      {summary.invitation_count === 0 &&
        <p className="event-financial-no-invites">
          Você ainda não convidou músicos para este evento.
          O valor exibido não representa o custo final da banda.
        </p>}

      {summary.invitation_count > 0 && <>
        <Button variant="ghost" type="button" className="event-financial-breakdown-toggle"
          aria-expanded={showBreakdown} onClick={() => setShowBreakdown(value => !value)}>
          <span>Ver cachês por músico ({summary.invitation_count} convite(s))</span>
          {showBreakdown ? <ChevronUp size={17}/> : <ChevronDown size={17}/>}
        </Button>

        {showBreakdown && <div className="event-financial-breakdown">
          {summary.items.map(item => {
            const status = badgeFor(item);
            const inactive = item.invitation_status === "declined" ||
              item.invitation_status === "cancelled";
            return <div key={item.invitation_id} className={"event-financial-row" +
              (inactive ? " is-inactive" : "")}>
              <div className="event-financial-person">
                <strong>{item.musician_name}</strong>
                <StatusChip label={status.text} status={status.type==="confirmed"?"success":status.type==="agreed"||status.type==="proposed"||status.type==="missing"?"warning":"neutral"}/>
              </div>
              <div className="event-financial-person-amount">
                {inactive
                  ? <><strong>Não computado</strong><small>Convite inativo</small></>
                  : item.agreed_amount != null
                    ? <><strong>{money(item.agreed_amount)}</strong><small>Acordado</small></>
                    : item.last_offer_amount != null
                      ? <><strong>{money(item.last_offer_amount)}</strong><small>Última proposta · não acordada</small></>
                      : <><strong>A definir</strong><small>Sem valor acordado</small></>}
              </div>
            </div>;
          })}
        </div>}
      </>}

      <Link className="event-financial-negotiate"
        href={"/convites?evento=" + encodeURIComponent(eventId)}>
        Negociar cachês e acompanhar convites deste show <ArrowRight size={15}/>
      </Link>
      <p className="event-financial-footer">
        Dados disponíveis apenas para o organizador. Proposta não é acordo;
        acordo de cachê não significa participação confirmada ou pagamento realizado.
        O resumo não inclui despesas extras, faturamento ou receita do evento.
      </p>
    </>}
  </section>;
}
