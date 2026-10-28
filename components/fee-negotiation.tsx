"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Handshake, LoaderCircle, Send, Wallet } from "lucide-react";

import {Button,Input,Textarea,InlineNotice,LoadingState} from "@/src/components/ui";
import "@/src/domains/booking/components/booking-ui.css";
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

  return <div ref={panelRef} className="sf-booking-fee">
    <Button variant="ghost" onClick={() => void toggle()} aria-expanded={expanded} className="sf-booking-fee-toggle">
      <span className="sf-booking-inline"><Wallet size={16}/> Cachê e propostas privadas</span>
      {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
    </Button>
    {expanded && <div className="sf-booking-fee-body">
      <p className="sf-booking-muted">Somente você e {perspective === "organizer" ? "o músico deste convite" : "o responsável por este show"} têm acesso aos valores e à negociação.</p>
      {loading && <LoadingState label="Carregando negociação…"/>}
      {!loading && data && <>
        {data.agreed_amount !== null ? <InlineNotice tone="success">
          <strong className="sf-booking-inline"><Check size={17}/> Valor fechado: {money(data.agreed_amount)}</strong>
          <p>{perspective === "musician" && effectiveStatus === "pending" ? "Cachê acordado! Agora confirme sua participação no convite." : "Cachê acordado exclusivamente para esta apresentação."}</p>
        </InlineNotice> : data.has_offer && data.last_amount !== null ? <InlineNotice>
          <span className="sf-booking-muted">Última proposta de {data.last_by_me ? "você" : other}</span>
          <strong className="sf-booking-fee-value">{money(data.last_amount)}</strong>
          {data.last_note && <p>“{data.last_note}”</p>}
          {data.last_by_me && <p>Aguardando resposta do {other}.</p>}
        </InlineNotice> : <p className="sf-booking-muted">Nenhuma proposta enviada ainda. Você pode iniciar a negociação.</p>}
        {perspective === "musician" && effectiveStatus === "pending" && data.agreed_amount !== null && onConfirmParticipation && <Button disabled={confirmingParticipation || busy} onClick={onConfirmParticipation}>
          {confirmingParticipation ? <LoaderCircle size={16}/> : <Check size={16}/>} {confirmingParticipation ? "Confirmando presença..." : "Confirmar presença no show"}
        </Button>}
        {canAccept && !countering && <div className="sf-booking-action-grid">
          <Button disabled={busy} onClick={() => void acceptOffer()}>{busy ? <LoaderCircle size={16}/> : <Check size={16}/>} Aceitar {money(data.last_amount!)}</Button>
          <Button variant="ghost" disabled={busy} onClick={() => setCountering(true)}><Handshake size={16}/> Contraproposta</Button>
        </div>}
        {canOffer && (!data.has_offer || countering) && <form onSubmit={sendOffer} className="sf-booking-form">
          <Input label={countering ? "Sua contraproposta (R$)" : "Sua proposta (R$)"} id={"fee-" + invitationId} type="number" min="0.01" max="999999.99" step="0.01"
            inputMode="decimal" disabled={busy} required placeholder="Ex.: 350,00" value={amount} onChange={e => setAmount(e.target.value)}/>
          <Textarea label="Mensagem (opcional)" id={"fee-note-" + invitationId} value={note} onChange={e => setNote(e.target.value)}
            maxLength={500} rows={2} disabled={busy} placeholder="Ex.: valor para apresentação de 3 horas"/>
          <div className="sf-booking-actions">
            <Button type="submit" disabled={busy}><Send size={15}/>{busy ? "Enviando..." : "Enviar proposta"}</Button>
            {countering && <Button variant="ghost" disabled={busy} onClick={() => setCountering(false)}>Cancelar</Button>}
          </div>
        </form>}
        {(data.history || []).length > 0 && <div className="sf-booking-history">
          <strong>Histórico privado</strong>
          {data.history.map((item, index) => <div key={index} className="sf-booking-history-row">
            <span className="sf-booking-muted">{item.by_me ? "Você" : other}{item.note ? " • " + item.note : ""}</span><strong>{money(item.amount)}</strong>
          </div>)}
        </div>}
      </>}
      {!loading && <Button variant="ghost" onClick={() => void loadFee()} disabled={busy}>Atualizar negociação</Button>}
      {feedback && <InlineNotice tone={hasError ? "danger" : "success"}>{feedback}</InlineNotice>}
    </div>}
  </div>;
}

// A new invitation gets a fresh controller and drafts; old async handlers cannot target its UI.
export default function FeeNegotiation(props: Props) {
  return <FeeNegotiationPanel key={props.invitationId} {...props}/>;
}
