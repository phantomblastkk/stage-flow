"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight,
  Eye, EyeOff, Flag, RefreshCw, ShieldCheck
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, InlineNotice, LoadingState, Select, StatusChip, Textarea } from "@/src/components/ui";
import {showSaveFeedback} from "@/src/components/ui/save-feedback";
import "./moderation.css";

type Reason = "spam" | "impersonation" | "inappropriate" | "misleading" | "other";
type Action = "dismiss" | "hide" | "restore";
type Report = {
  id: string;
  target_type: "musician" | "review";
  musician_id: string;
  musician_name: string;
  review_id: string | null;
  review_comment: string | null;
  review_rating: number | null;
  reporter_name: string;
  reason: Reason;
  details: string;
  status: "open" | "dismissed" | "resolved";
  last_action: Action | null;
  moderator_note: string;
  created_at: string;
  reviewed_at: string | null;
  musician_hidden: boolean;
  review_hidden: boolean;
};
type ReportsResponse = {
  status: "ok" | "forbidden" | "invalid";
  items: Report[];
  total: number;
};
type Filter = "open" | "all" | "dismissed" | "resolved";
type Draft = { action: Action; note: string };

const reasons: Record<Reason,string> = {
  spam:"Spam ou divulgação enganosa",
  impersonation:"Falsidade de identidade",
  inappropriate:"Conteúdo inadequado",
  misleading:"Informação falsa ou suspeita",
  other:"Outros"
};
const labels: Record<Action,string> = {
  dismiss:"Arquivar denúncia (sem ocultar)",
  hide:"Ocultar do marketplace",
  restore:"Restaurar no marketplace"
};
const step = 30;

export default function MarketplaceModeration() {
  const [authorized,setAuthorized] = useState<"loading"|"yes"|"no">("loading");
  const [filter,setFilter] = useState<Filter>("open");
  const [page,setPage] = useState(0);
  const [items,setItems] = useState<Report[]>([]);
  const [total,setTotal] = useState(0);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState<string|null>(null);
  const [error,setError] = useState("");
  const [success,setSuccess] = useState("");
  const [drafts,setDrafts] = useState<Record<string,Draft>>({});
  const [nonce,setNonce] = useState(0);

  const reload=useCallback(()=>setNonce(n=>n+1),[]);

  useEffect(()=>{
    let active=true;
    async function check() {
      const client=createClient();
      const {data:{user}}=await client.auth.getUser();
      if(!active)return;
      if(!user){setAuthorized("no");return;}
      const {data,error:checkError}=await client.rpc("stage_marketplace_moderator_status");
      if(!active)return;
      setAuthorized(!checkError&&data===true?"yes":"no");
    }
    void check();
    return ()=>{active=false;};
  },[]);

  useEffect(()=>{
    if(authorized!=="yes")return;
    let active=true;
    async function load(){
      setLoading(true);setError("");
      const {data,error:loadError}=await createClient().rpc(
        "stage_marketplace_moderation_reports",
        {p_filter:filter,p_limit:step,p_offset:page*step}
      );
      if(!active)return;
      const response=data as ReportsResponse|null;
      if(loadError||response?.status!=="ok"){
        setItems([]);setTotal(0);
        setError(loadError?.message||
          "Não foi possível consultar a fila privada de denúncias.");
      } else {
        setItems(Array.isArray(response.items)?response.items:[]);
        setTotal(Number(response.total)||0);
      }
      setLoading(false);
    }
    void load();
    return ()=>{active=false;};
  },[authorized,filter,page,nonce]);

  function draftFor(report:Report):Draft {
    return drafts[report.id] ?? {
      action:report.target_type==="review"?(report.review_hidden?"restore":"hide"):
        report.musician_hidden?"restore":"hide",
      note:""
    };
  }
  function setDraft(report:Report,patch:Partial<Draft>){
    setDrafts(prev=>{
      const current:Draft=prev[report.id] ?? {
        action:report.target_type==="review"
          ? (report.review_hidden?"restore":"hide")
          : (report.musician_hidden?"restore":"hide"),
        note:""
      };
      return {...prev,[report.id]:{...current,...patch}};
    });
  }
  async function applyAction(e:FormEvent<HTMLFormElement>,report:Report){
    e.preventDefault();
    if(busy)return;
    const {action,note}=draftFor(report);
    if(note.trim().length<5||note.trim().length>500){
      setError("Explique a decisão com pelo menos 5 e no máximo 500 caracteres.");
      return;
    }
    const question=action==="hide"
      ?"Ocultar este "+(report.target_type==="review"?"comentário/avaliação":"músico")+
        " do marketplace? Isso altera imediatamente rankings e buscas."
      :action==="restore"
        ?"Restaurar o conteúdo no marketplace? O registro ficará no histórico de moderação."
        :"Arquivar esta denúncia sem ocultar o conteúdo?";
    if(!window.confirm(question))return;
    setBusy(report.id);setError("");setSuccess("");
    const {data,error:rpcError}=await createClient().rpc(
      "stage_marketplace_moderate_report",
      {p_report_id:report.id,p_action:action,p_note:note.trim()}
    );
    if(rpcError||data!=="saved"){
      setError(rpcError?.message||(
        data==="target_not_found"
          ?"O conteúdo já não existe. Arquive a denúncia ou revise o caso."
          :"Não foi possível registrar esta decisão."
      ));
    }else{
      showSaveFeedback("Decisão de moderação salva com sucesso!");
      setSuccess("Decisão salva com histórico de auditoria. Os rankings e as buscas já refletem a moderação.");
      setDrafts(prev=>{
        const copy={...prev};delete copy[report.id];return copy;
      });
      reload();
    }
    setBusy(null);
  }

  if(authorized==="loading")return <main className="market-mod-gate">
    <LoadingState label="Verificando permissões de moderação..."/>
  </main>;
  if(authorized==="no")return <main className="market-mod-gate">
    <ShieldCheck size={39}/>
    <h1>Área restrita</h1>
    <p>A moderação é exclusiva das contas autorizadas no Supabase. Não é possível solicitar ou assumir essa permissão pelo site.</p>
    <Link href="/marketplace" className="sf-ui-button sf-ui-button-primary"><ArrowLeft size={15}/> Voltar ao marketplace</Link>
  </main>;

  const totalPages=Math.max(1,Math.ceil(total/step));
  return <main className="market-mod-page">
    <div className="market-mod-container">
      <nav className="market-mod-nav">
        <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
        <Link href="/marketplace"><ArrowLeft size={16}/> Voltar ao marketplace</Link>
      </nav>
      <header className="market-mod-header">
        <div>
          <span><ShieldCheck size={16}/> CONTROLE INTERNO / MODERAÇÃO</span>
          <h1>Central de <em>moderação.</em></h1>
          <p>Analise denúncias de músicos e avaliações. Nada é ocultado sem sua decisão e todas as ações deixam um registro interno.</p>
        </div>
        <Button variant="secondary" onClick={reload} disabled={loading||Boolean(busy)}>
          <RefreshCw size={16}/> Atualizar fila
        </Button>
      </header>
      <InlineNotice tone="warning">
        A moderação afeta apenas o marketplace. O portfólio gratuito independente não é excluído e nenhum plano ou assinatura é alterado.
      </InlineNotice>
      <div className="market-mod-toolbar">
        <div role="group" aria-label="Filtrar denúncias">
          {([
            ["open","Pendentes"],["all","Todas"],["resolved","Resolvidas"],
            ["dismissed","Arquivadas"]
          ] as [Filter,string][]).map(([value,label])=>
            <Button variant={filter===value?"primary":"secondary"} key={value} aria-pressed={filter===value}
              onClick={() => {setFilter(value);setPage(0);setError("");setSuccess("");}}>
              {label}
            </Button>)}
        </div>
        <strong>{total} ocorrência(s)</strong>
      </div>
      {error&&<InlineNotice tone="danger">{error}</InlineNotice>}
      {success&&<InlineNotice tone="success">{success}</InlineNotice>}
      {loading?<LoadingState label="Carregando denúncias..."/>:
        items.length===0?<div className="market-mod-empty"><ShieldCheck size={28}/>
          <h2>Nenhuma denúncia nessa categoria.</h2>
          <p>Novos relatos aparecerão nesta fila após o envio.</p>
        </div>:
        <div className="market-mod-list">
          {items.map(report=>{
            const hidden=report.target_type==="review"?report.review_hidden:report.musician_hidden;
            const draft=draftFor(report);
            return <article className="market-mod-item" key={report.id} aria-labelledby={"market-mod-title-"+report.id}>
              <div className="market-mod-item-top">
                <Badge>
                  {report.target_type==="review"?"Avaliação denunciada":"Perfil denunciado"}
                </Badge>
                <StatusChip status={report.status==="open"?"warning":report.status==="resolved"?"success":"neutral"}
                  label={report.status==="open"?"Pendente":report.status==="dismissed"?"Arquivada":"Resolvida"}/>
                <span className="market-mod-item-date">
                  {new Date(report.created_at).toLocaleString("pt-BR",{dateStyle:"medium",timeStyle:"short"})}
                </span>
              </div>
              <h2 id={"market-mod-title-"+report.id}>{report.musician_name}</h2>
              <div className="market-mod-item-badges">
                <Badge><Flag size={13}/> {reasons[report.reason]||"Outro motivo"}</Badge>
                <Badge tone={hidden?"danger":"neutral"}>
                  {hidden?<><EyeOff size={13}/> Oculto do marketplace</>:
                    <><Eye size={13}/> Visível no marketplace</>}
                </Badge>
              </div>
              <p className="market-mod-reporter">Enviado por {report.reporter_name}</p>
              {report.details && <blockquote>{report.details}</blockquote>}
              {report.target_type==="review"&&<div className="market-mod-review">
                <strong>Avaliação original</strong>
                {report.review_rating!==null&&<p>Nota: {report.review_rating}/5</p>}
                <p>{report.review_comment||"Comentário vazio ou avaliação excluída."}</p>
              </div>}
              {report.moderator_note&&<p className="market-mod-previous">
                Última decisão: {report.last_action?labels[report.last_action]:"Revisão"} — {report.moderator_note}
              </p>}
              <form className="market-mod-form" onSubmit={e=>void applyAction(e,report)}>
                <Select label="Decisão do moderador" id={"market-mod-action-"+report.id} value={draft.action}
                  disabled={busy===report.id}
                  onChange={e=>setDraft(report,{action:e.target.value as Action})}>
                  <option value="hide">{labels.hide}</option>
                  <option value="restore">{labels.restore}</option>
                  <option value="dismiss">{labels.dismiss}</option>
                </Select>
                <Textarea label="Justificativa interna obrigatória" hint={draft.note.length+"/500 caracteres · mínimo de 5"} id={"market-mod-note-"+report.id}
                  value={draft.note} maxLength={500} rows={2}
                  onChange={e=>setDraft(report,{note:e.target.value})}
                  placeholder="Ex.: avaliação contém ataques pessoais; ocultada após revisão."
                  disabled={busy===report.id} required minLength={5}/>
                <Button type="submit" loading={busy===report.id} disabled={Boolean(busy)||draft.note.trim().length<5}>
                  {busy!==report.id&&<CheckCircle2 size={15}/>}
                  {busy===report.id?"Registrando...":"Confirmar decisão"}
                </Button>
              </form>
            </article>;
          })}
        </div>}
      {!loading&&totalPages>1&&<div className="market-mod-pagination">
        <Button variant="secondary" disabled={page===0} onClick={()=>setPage(v=>v-1)}>
          <ChevronLeft size={16}/> Anterior
        </Button>
        <span>Página {page+1} de {totalPages}</span>
        <Button variant="secondary" disabled={page>=totalPages-1} onClick={()=>setPage(v=>v+1)}>
          Próxima <ChevronRight size={16}/>
        </Button>
      </div>}
      <footer className="market-mod-footer">
        <ShieldCheck size={16}/> As decisões afetam o marketplace e ficam no histórico interno de moderação.
      </footer>
    </div>
  </main>;
}
