"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Flag, ShieldCheck, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, InlineNotice, Select, Textarea } from "@/src/components/ui";
import "./marketplace-report-dialog.css";

export type ReportTarget = {
  type: "musician" | "review";
  id: string;
  label: string;
};

const reasons = [
  {value:"spam",label:"Spam ou propaganda enganosa"},
  {value:"impersonation",label:"Falsidade de identidade"},
  {value:"inappropriate",label:"Conteúdo ofensivo ou inadequado"},
  {value:"misleading",label:"Informações falsas ou suspeitas"},
  {value:"other",label:"Outro motivo"}
] as const;

type Props = {
  target: ReportTarget;
  signedIn: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
};

export default function MarketplaceReportDialog({target,signedIn,onClose,onSubmitted}:Props) {
  const [reason,setReason]=useState<string>("misleading");
  const [details,setDetails]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!signedIn||busy||success)return;
    setBusy(true);setError("");
    const {data,error:rpcError}=await createClient().rpc("stage_marketplace_report",{
      p_type:target.type,
      p_target_id:target.id,
      p_reason:reason,
      p_details:details.trim()
    });
    if(rpcError||data!=="submitted"){
      const messages:Record<string,string>={
        already_reported:"Você já enviou uma denúncia sobre este conteúdo, que continua em análise.",
        rate_limited:"Você atingiu o limite de denúncias das últimas 24 horas.",
        not_found:"Este conteúdo não está mais disponível no marketplace.",
        own_profile:"Você não pode denunciar seu próprio perfil.",
        own_review:"Você não pode denunciar sua própria avaliação.",
        not_released:"A denúncia está disponível apenas para participantes do laboratório.",
        login_required:"Entre na sua conta para denunciar.",
        invalid:"Confira o motivo e o texto informado."
      };
      setError(rpcError?.message||messages[String(data)]||
        "Não foi possível enviar a denúncia. Tente novamente.");
    }else{
      setSuccess("Denúncia registrada para revisão humana. Ela não remove o perfil ou a avaliação automaticamente.");
      onSubmitted?.();
    }
    setBusy(false);
  }

  return <div className="market-report-backdrop" onClick={onClose}>
    <section className="market-report-dialog" role="dialog" aria-modal="true"
      aria-label={"Denunciar "+target.label}
      onClick={event=>event.stopPropagation()}>
      <header className="market-report-header">
        <div><span><Flag size={16}/> CENTRAL DE CONFIANÇA</span>
          <h2>Denunciar {target.type==="review"?"avaliação":"perfil"}</h2>
          <p>{target.label}</p></div>
        <Button variant="ghost" onClick={onClose} aria-label="Fechar denúncia"><X size={20}/></Button>
      </header>
      <div className="market-report-body">
        {!signedIn?<div className="market-report-login">
          <p>Faça login para registrar uma denúncia. O catálogo não publica seu nome nem os detalhes da denúncia.</p>
          <Link href="/login" className="sf-ui-button sf-ui-button-primary">Entrar na conta</Link>
        </div>:success?<div className="market-report-success">
          <InlineNotice tone="success">{success}</InlineNotice>
          <Button onClick={onClose}>Concluir</Button>
        </div>:<form onSubmit={event=>void submit(event)}>
          <p>Relate apenas problemas reais. Sua denúncia será analisada por um moderador autorizado antes de qualquer ação.</p>
          <Select label="Qual é o problema?" id="market-report-reason" required
            value={reason} onChange={e=>setReason(e.target.value)} disabled={busy}>
            {reasons.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
          <Textarea label="Descreva o ocorrido (opcional)" id="market-report-details" rows={4} maxLength={900}
            hint={details.length+"/900 caracteres"}
            value={details} disabled={busy}
            onChange={e=>setDetails(e.target.value)}
            placeholder="Descreva o problema para ajudar na análise, sem informar telefones ou documentos pessoais."/>
          {error&&<InlineNotice tone="danger">{error}</InlineNotice>}
          <Button type="submit" loading={busy} disabled={busy}>
            {!busy&&<Flag size={16}/>}
            {busy?"Enviando...":"Enviar denúncia"}
          </Button>
        </form>}
        <div className="market-report-privacy"><ShieldCheck size={15}/>
          O relato fica privado na central de moderação e não altera automaticamente a posição do músico.
        </div>
      </div>
    </section>
  </div>;
}
