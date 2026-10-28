"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Handshake, LoaderCircle, Send, Wallet } from "lucide-react";

import type { FeeData } from "@/src/domains/booking/negotiation-types";
import { useFeeNegotiation } from "@/src/domains/booking/hooks/use-fee-negotiation";
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

function FeeNegotiationPanel({ invitationId, perspective, onChanged, openRequest = 0, invitationStatus, onConfirmParticipation, confirmingParticipation = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [countering, setCountering] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const other = perspective === "organizer" ? "músico" : "contratante";
  const {data,loading,busy,feedback,hasError,loadFee,send,accept,phase}=useFeeNegotiation(invitationId,onChanged);

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
    if(await send(amount,note,other)){setAmount("");setNote("");setCountering(false);}
  }
  async function acceptOffer() { if(await accept())setCountering(false); }

  const effectiveStatus = invitationStatus ?? data?.status;
  const canOffer = (phase === "ready" || phase === "error") && !!data && effectiveStatus === "pending" && data.agreed_amount == null
    && (!data.has_offer || !data.last_by_me);
  const canAccept = (phase === "ready" || phase === "error") && !!data && effectiveStatus === "pending" && data.agreed_amount == null
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
              inputMode="decimal" disabled={busy} required placeholder="Ex.: 350,00" value={amount} onChange={e => setAmount(e.target.value)}/>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor={"fee-note-" + invitationId}>Mensagem (opcional)</label>
            <textarea id={"fee-note-" + invitationId} value={note} onChange={e => setNote(e.target.value)}
              maxLength={500} rows={2} disabled={busy} placeholder="Ex.: valor para apresentação de 3 horas"
              style={{ width: "100%", padding: 12, border: "1px solid var(--line)", borderRadius: 10, background: "var(--panel)", color: "var(--text)" }}/>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="submit" className="btn btn-primary" disabled={busy}><Send size={15}/>{busy ? "Enviando..." : "Enviar proposta"}</button>
            {countering && <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => setCountering(false)}>Cancelar</button>}
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

// A new invitation gets a fresh controller and drafts; old async handlers cannot target its UI.
export default function FeeNegotiation(props: Props) {
  return <FeeNegotiationPanel key={props.invitationId} {...props}/>;
}
