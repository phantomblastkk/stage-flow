"use client";

import { parseFeeInput } from "@/src/domains/booking/model/fee-input";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Handshake, LoaderCircle, Send, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { readFeeDetails, offerFee, acceptFee } from "@/src/domains/booking/services/negotiation-service";

type OfferLog = { amount: number; by_me: boolean; note: string | null; date: string };
type FeeData = {
  status: "pending" | "accepted" | "declined" | "cancelled";
  is_owner: boolean;
  has_offer: boolean;
  last_amount: number | null;
  last_by_me: boolean;
  last_note: string | null;
  agreed_amount: number | null;
  history: OfferLog[];
};
type Props = {
  invitationId: string;
  perspective: "musician" | "organizer";
  onChanged?: () => void;
  openRequest?: number;
  invitationStatus?: FeeData["status"];
  onConfirmParticipation?: () => void;
  confirmingParticipation?: boolean;
};
const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export default function FeeNegotiation({ invitationId, perspective, onChanged, openRequest = 0, invitationStatus, onConfirmParticipation, confirmingParticipation = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<FeeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState("");
  const [hasError, setHasError] = useState(false);
  const [countering, setCountering] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const feeRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    setData(null);setAmount("");setNote("");setCountering(false);setFeedback("");
    return () => { feeRequest.current?.abort(); };
  }, [invitationId]);

  const other = perspective === "organizer" ? "músico" : "contratante";

  const loadFee = useCallback(async () => {
    feeRequest.current?.abort();
    const request = new AbortController();feeRequest.current = request;
    setLoading(true);
    const { data: result, error } = await readFeeDetails(createClient(), {
      p_invitation_id: invitationId,
    }).abortSignal(request.signal);
    if (request.signal.aborted) return;
    if (error) {
      setHasError(true);
      setFeedback("Não foi possível consultar as propostas. Tente novamente.");
    } else if (!result) {
      setHasError(true);
      setFeedback("Você não tem acesso à negociação deste convite.");
    } else {
      setData(result as FeeData);
      setHasError(false);
    }
    setLoading(false);
  }, [invitationId]);

  useEffect(() => {
    if (openRequest <= 0) return;
    setExpanded(true);
    setCountering(false);
    void loadFee();
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [openRequest, loadFee]);

  async function toggle() {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    await loadFee();
  }

  async function sendOffer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const parsed = parseFeeInput(amount);
    if (parsed === undefined) {
      setHasError(true);
      setFeedback("Informe um valor válido em reais com até duas casas decimais.");
      return;
    }
    setBusy(true);
    setFeedback("");
    const { data: result, error } = await offerFee(createClient(), {
      p_invitation_id: invitationId,
      p_amount: parsed,
      p_note: note.trim() || null,
    });
    if (error || result !== "offered") {
      const reason: Record<string, string> = {
        waiting_other: "Você já enviou uma proposta. Aguarde o outro lado responder.",
        closed: "Este convite já foi encerrado.",
        agreed: "O valor deste show já foi acordado.",
        invalid_amount: "Valor inválido. Informe um número maior que zero.",
        forbidden: "Esta negociação não pertence à sua conta.",
      };
      setHasError(true);
      setFeedback(error?.message || reason[String(result)] || "Não foi possível registrar a proposta.");
    } else {
      setHasError(false);
      setFeedback("Proposta enviada! Agora é a vez do " + other + " responder.");
      setAmount("");
      setNote("");
      setCountering(false);
      await loadFee();
      onChanged?.();
    }
    setBusy(false);
  }

  async function acceptOffer() {
    if (busy || !data?.last_amount || data.last_by_me) return;
    setBusy(true);
    setFeedback("");
    const { data: result, error } = await acceptFee(createClient(), {
      p_invitation_id: invitationId,
    });
    if (error || result !== "accepted") {
      const reason: Record<string, string> = {
        waiting_other: "A outra pessoa precisa aprovar sua proposta.",
        unclaimed: "O músico precisa abrir o convite antes de fechar o acordo.",
        closed: "Este convite já foi encerrado.",
      };
      setHasError(true);
      setFeedback(error?.message || reason[String(result)] || "Não foi possível aceitar a proposta.");
    } else {
      setHasError(false);
      setFeedback("Cachê acordado! O músico agora pode confirmar a participação.");
      setCountering(false);
      await loadFee();
      onChanged?.();
    }
    setBusy(false);
  }

  const effectiveStatus = invitationStatus ?? data?.status;
  const canOffer = !!data && effectiveStatus === "pending" && data.agreed_amount == null
    && (!data.has_offer || !data.last_by_me);
  const canAccept = !!data && effectiveStatus === "pending" && data.agreed_amount == null
    && data.has_offer && !data.last_by_me;

  return <div ref={panelRef} style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
    <button type="button" className="btn btn-quiet" onClick={() => void toggle()}
      aria-expanded={expanded} style={{ width: "100%", justifyContent: "space-between", padding: "10px 12px" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Wallet size={16}/> Cachê e propostas privadas</span>
      {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
    </button>
    {expanded && <div style={{ padding: "16px 3px 5px", display: "grid", gap: 12 }}>
      <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
        Somente você e {perspective === "organizer" ? "o músico deste convite" : "o responsável por este show"} têm acesso aos valores e à negociação.
      </p>
      {loading && <p style={{ color: "var(--muted)", fontSize: 13 }}><LoaderCircle size={15} style={{ display: "inline", verticalAlign: "middle" }}/> Carregando...</p>}
      {!loading && data && <>
        {data.agreed_amount !== null ? <div className="coming" style={{ margin: 0 }}>
          <strong style={{ display: "flex", alignItems: "center", gap: 7 }}><Check size={17}/> Valor fechado: {money(data.agreed_amount)}</strong>
          <p style={{ fontSize: 12, margin: "6px 0 0" }}>{perspective === "musician" && effectiveStatus === "pending" ? "Cachê acordado! Agora confirme sua participação no convite." : "Cachê acordado exclusivamente para esta apresentação."}</p>
        </div> : data.has_offer && data.last_amount !== null ? <div className="coming" style={{ margin: 0 }}>
          <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>Última proposta de {data.last_by_me ? "você" : other}</span>
          <strong style={{ display: "block", fontSize: 21, margin: "5px 0" }}>{money(data.last_amount)}</strong>
          {data.last_note && <p style={{ fontSize: 13, margin: "4px 0" }}>“{data.last_note}”</p>}
          {data.last_by_me && <p style={{ fontSize: 12, margin: "5px 0 0" }}>Aguardando resposta do {other}.</p>}
        </div> : <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Nenhuma proposta enviada ainda. Você pode iniciar a negociação.</p>}
        {perspective === "musician" && effectiveStatus === "pending" && data.agreed_amount !== null && onConfirmParticipation && <button type="button" className="btn btn-primary" disabled={confirmingParticipation || busy} onClick={onConfirmParticipation} style={{ justifyContent: "center" }}>
          {confirmingParticipation ? <LoaderCircle size={16}/> : <Check size={16}/>} {confirmingParticipation ? "Confirmando presença..." : "Confirmar presença no show"}
        </button>}
        {canAccept && !countering && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 8 }}>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void acceptOffer()}>
            {busy ? <LoaderCircle size={16}/> : <Check size={16}/>} Aceitar {money(data.last_amount!)}
          </button>
          <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => setCountering(true)}>
            <Handshake size={16}/> Contraproposta
          </button>
        </div>}
        {canOffer && (!data.has_offer || countering) && <form onSubmit={sendOffer} style={{ display: "grid", gap: 11 }}>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor={"fee-" + invitationId}>{countering ? "Sua contraproposta (R$)" : "Sua proposta (R$)"}</label>
            <input id={"fee-" + invitationId} type="number" min="0.01" max="999999.99" step="0.01"
              inputMode="decimal" required placeholder="Ex.: 350,00" value={amount} onChange={e => setAmount(e.target.value)}/>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor={"fee-note-" + invitationId}>Mensagem (opcional)</label>
            <textarea id={"fee-note-" + invitationId} value={note} onChange={e => setNote(e.target.value)}
              maxLength={500} rows={2} placeholder="Ex.: valor para apresentação de 3 horas"
              style={{ width: "100%", padding: 12, border: "1px solid var(--line)", borderRadius: 10, background: "var(--panel)", color: "var(--text)" }}/>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="submit" className="btn btn-primary" disabled={busy}><Send size={15}/>{busy ? "Enviando..." : "Enviar proposta"}</button>
            {countering && <button type="button" className="btn btn-quiet" onClick={() => setCountering(false)}>Cancelar</button>}
          </div>
        </form>}
        {(data.history || []).length > 0 && <div style={{ display: "grid", gap: 7 }}>
          <strong style={{ fontSize: 13 }}>Histórico privado</strong>
          {data.history.map((item, index) => <div key={index} style={{ display: "flex", justifyContent: "space-between", gap: 10, borderBottom: "1px solid var(--line)", paddingBottom: 7, fontSize: 12 }}>
            <span style={{ color: "var(--muted)", overflowWrap: "anywhere" }}>{item.by_me ? "Você" : other}{item.note ? " • " + item.note : ""}</span>
            <strong style={{ whiteSpace: "nowrap" }}>{money(item.amount)}</strong>
          </div>)}
        </div>}
      </>}
      {!loading && <button type="button" className="btn btn-quiet" style={{ justifyContent: "center", fontSize: 12 }} onClick={() => void loadFee()} disabled={busy}>Atualizar negociação</button>}
      {feedback && <div role={hasError ? "alert" : "status"} className="coming"
        style={hasError ? { borderColor: "#754343", background: "#281919", color: "#ffb5b5" } : {}}>{feedback}</div>}
    </div>}
  </div>;
}
