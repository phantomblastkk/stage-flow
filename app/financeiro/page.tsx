"use client";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, CalendarDays, CircleAlert, Download, LockKeyhole, PencilLine, RefreshCw, Save, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import EventBudgetPanel from "@/components/event-budget-panel";
import ProFeatureLock from "@/components/pro-feature-lock";
import { Button, EmptyState, LoadingState, StatCard } from "@/src/components/ui";
import { FinanceSessionRequired, loadFinance, loadFinanceTeam, saveMusicianPayment } from "@/src/domains/billing/services/finance-service";
import type { Mode, Organized, Participation, TeamMember } from "@/src/domains/billing/types";
import { buildFinanceReport } from "@/src/domains/billing/model/finance-report";
import { buildFinanceCsv } from "@/src/domains/billing/model/finance-csv";
import { formatCents as cash, formatAmount, formatAmountInput as inputValue, parseAmountInput as parseValue, financeMonthLabel as monthLabel } from "@/src/domains/billing/model/money";
import { useAccount } from "@/src/domains/account/account-context";
import "./financeiro.css";

const EMPTY_REPORT=buildFinanceReport([],[],{mode:"all",year:"all",month:"all"});

export default function Financeiro(){
 const router=useRouter();
 const {snapshot:account}=useAccount();
 const profile=account.profile;
 const financeProfile=useMemo(()=>profile?{
  id:profile.id,is_artist:profile.is_artist,artist_kind:profile.artist_kind,username:profile.username
 }:undefined,[profile?.id,profile?.is_artist,profile?.artist_kind,profile?.username]);
 const [organized,setOrganized]=useState<Organized[]>([]);
 const [participations,setParticipations]=useState<Participation[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [mode,setMode]=useState<Mode>("all");
 const [year,setYear]=useState("all");
 const [month,setMonth]=useState("all");
 const [expanded,setExpanded]=useState<string|null>(null);
 const [team,setTeam]=useState<TeamMember[]>([]);
 const [teamError,setTeamError]=useState("");
 const [teamLoading,setTeamLoading]=useState(false);
 const teamRequest=useRef<AbortController|null>(null);
 useEffect(()=>()=>teamRequest.current?.abort(),[]);
 const [editPaid,setEditPaid]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState<string|null>(null);
 const [nonce,setNonce]=useState(0);
 const [reportAccess,setReportAccess]=useState(false);
 const [reportAccessReady,setReportAccessReady]=useState(false);
 const [coverageLimited,setCoverageLimited]=useState(false);
 const financeRequest=useRef<AbortController|null>(null);
 const load=useCallback(async()=>{
  financeRequest.current?.abort();
  const request=new AbortController();financeRequest.current=request;
  const result=await loadFinance(createClient(),request.signal,financeProfile);
  if(request.signal.aborted)return;
  setReportAccess(result.reportAccess);setReportAccessReady(true);
  setCoverageLimited(result.coverageLimited);
  setOrganized(result.organized);setParticipations(result.participations);
 },[financeProfile]);
 useEffect(()=>{
  let active=true;
  setLoading(true);setError("");
  void load().catch(error=>{
   if(!active||error?.name==="AbortError")return;
   if(error instanceof FinanceSessionRequired)router.replace("/login");
   else setError(error instanceof Error?error.message:"Erro ao carregar o financeiro.");
  }).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;financeRequest.current?.abort();};
 },[load,nonce,router]);
 const reportState=useMemo(()=>{
  try{return {report:buildFinanceReport(organized,participations,{mode,year,month}),error:""};}
  catch(error){return {report:null,error:error instanceof Error?error.message:"Não foi possível calcular o relatório."};}
 },[organized,participations,mode,year,month]);
 const visibleError=error||reportState.error;
 const {visibleOwner,visibleMusician,years,months,gross,received,expensesTotal,teamAgreed,
  cashFlow,projected,missingRevenue,incomplete,hasAny,categories,maxCategory,monthly,
  pendingReceivables,pendingPayables,pendingIncomplete}=reportState.report??EMPTY_REPORT;

 async function openTeam(id:string){
  if(busy)return;
  teamRequest.current?.abort();
  if(expanded===id){setExpanded(null);setTeamLoading(false);return;}
  const request=new AbortController();teamRequest.current=request;
  setExpanded(id);setTeam([]);setTeamError("");setEditPaid({});setTeamLoading(true);
  try{
   const rows=await loadFinanceTeam(createClient(),id,request.signal);
   if(request.signal.aborted)return;
   setTeam(rows);setEditPaid(Object.fromEntries(rows.map(r=>[r.invitation_id,inputValue(r.paid_amount)])));
  }catch(e){if(!request.signal.aborted)setTeamError(e instanceof Error?e.message:"Não foi possível consultar a equipe.");}
  finally{if(!request.signal.aborted)setTeamLoading(false);}
 }
 async function savePaid(e:FormEvent<HTMLFormElement>,invitationId:string){
  e.preventDefault();if(busy)return;
  const amount=parseValue(editPaid[invitationId]??"");
  if(amount===null){setTeamError("Valor inválido: use reais e até duas casas decimais.");return;}
  setBusy(invitationId);setTeamError("");setNotice("");
  try{
   await saveMusicianPayment(createClient(),invitationId,amount);
   setTeam(rows=>rows.map(r=>r.invitation_id===invitationId?{...r,paid_amount:amount}:r));
   setNotice("Pagamento registrado manualmente; nenhuma transferência foi realizada.");
   setNonce(value=>value+1);
  }catch(err){if(err instanceof FinanceSessionRequired)router.replace("/login");else setTeamError(err instanceof Error?err.message:"Erro ao salvar.");}
  finally{setBusy(null);}
 }
 function exportCsv(){
  if(loading||visibleError||coverageLimited||!reportAccess||!reportAccessReady||!hasAny||!reportState.report)return;
  try{
   const csv=buildFinanceCsv(reportState.report);
   const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
   const link=document.createElement("a");link.href=url;link.download="stage-flow-financeiro-detalhado.csv";
   document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch{setError("Não foi possível gerar o CSV. Atualize os dados e tente novamente.");}
 }
 return <main className="finance-page"><div className="container">
  <nav className="nav"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
   <Link href="/painel" className="btn btn-quiet"><ArrowLeft size={15}/> Painel</Link></nav>
  <header className="finance-hero"><span className="eyebrow"><Wallet size={14}/> CONTROLE PRIVADO POR SHOW</span>
   <h1>Minha central <span className="accent">financeira.</span></h1>
   <p>Acompanhe receita bruta, cachês, transporte, outras despesas, valores pagos e resultado. Tudo organizado por show, sem obrigar você a cadastrar valores.</p>
  </header>
  {visibleError&&<p className="finance-feedback is-error" role="alert">{visibleError}</p>}
  {notice&&<p className="finance-feedback" role="status">{notice}</p>}
  <details className="finance-filter-panel">
   <summary>Filtrar período e atuação <span>{mode==="all"?"Tudo":mode==="organizer"?"Organização":"Músico"} · {month!=="all"?monthLabel(month):year!=="all"?year:"Todos os períodos"}</span></summary>
   <div className="finance-controls">
   <label>Atuação <select value={mode} onChange={e=>setMode(e.target.value as Mode)}>
    <option value="all">Tudo</option><option value="organizer">Organização / produção</option>
    <option value="musician">Cachês de músico</option></select></label>
   <label>Ano <select value={year} onChange={e=>{setYear(e.target.value);setMonth("all");}}>
    <option value="all">Todos</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></label>
   <label>Mês <select value={month} onChange={e=>setMonth(e.target.value)}>
    <option value="all">Todos</option>{months.map(m=><option key={m} value={m}>{monthLabel(m)}</option>)}</select></label>
   </div>
  </details>
  <div className="finance-toolbar">
   <button className="btn btn-quiet" type="button" disabled={loading} onClick={()=>setNonce(n=>n+1)}><RefreshCw size={15}/> Atualizar</button>
   {reportAccess?<button className="btn btn-quiet" type="button" disabled={loading||Boolean(visibleError)||coverageLimited||!hasAny||!reportAccessReady} onClick={exportCsv}><Download size={15}/> Exportar CSV detalhado</button>:
    <Link className="btn btn-quiet" href="/planos"><LockKeyhole size={15}/> Exportação detalhada · Cantor Pro</Link>}
  </div>
  {loading?<LoadingState label="Carregando valores privados…"/>:visibleError?<EmptyState title="Financeiro indisponível" description="Atualize os dados para consultar seu resumo financeiro." action={<Button onClick={()=>setNonce(n=>n+1)}>Tentar novamente</Button>}/>:<>
   {coverageLimited&&<p className="finance-warning" role="status"><CircleAlert size={17}/>O histórico disponível atingiu o limite de shows recentes. Os totais podem não incluir períodos antigos; a exportação está pausada para evitar um relatório incompleto.</p>}
   <section className="finance-kpis" aria-label="Resumo financeiro">
    {[
     ["Recebido registrado",cash(received),"Informado manualmente"],
     ["A receber (estimado)",cash(pendingReceivables),pendingIncomplete?"Parcial: valores ainda não definidos":"Valores contratados ainda não recebidos"],
     ["Compromissos a pagar",cash(pendingPayables),"Despesas extras e cachês ainda não registrados como pagos"],
     ["Saldo de caixa registrado",cash(cashFlow),"Recebido − despesas pagas − cachês pagos"]
    ].map(([title,value,note])=><StatCard key={title} label={title} value={value} description={note}/>)}
   </section>
   <details className="finance-extra-summary">
    <summary>Ver receita, despesas e resultado estimado</summary>
    <div className="finance-kpis">
     {[
      ["Receita bruta contratada",cash(gross),missingRevenue?"Valores faltando":""],
      ["Despesas dos shows",cash(expensesTotal),"Custos previstos e pessoais"],
      ["Cachês acordados da equipe",cash(teamAgreed),"Custo de contratação"],
      ["Resultado líquido estimado",hasAny?cash(projected):"Sem dados",incomplete?"Parcial: há valores a definir":"Não é lucro bancário comprovado"]
     ].map(([title,value,note])=><StatCard key={title} label={title} value={value} description={note}/>)}
    </div>
   </details>
   {(incomplete||!hasAny)&&<p className="finance-warning"><CircleAlert size={17}/>
    {hasAny?"Os totais são parciais: há receitas ou cachês sem valor. O lucro líquido definitivo depende de todos os lançamentos e pagamentos.":"Nenhum valor registrado ainda. Cadastre um show ou registre seus custos para começar."}
   </p>}
   <details className="finance-reports">
    <summary>Análises por categoria e mês</summary>
   {reportAccess?<section className="finance-two">
    <div className="finance-panel"><h2><BarChart3 size={19}/> Despesas por categoria</h2>
     <p>Transporte, equipe externa, equipamentos e alimentação podem ser informados dentro de cada show.</p>
     <div className="finance-category-list">
      {categories.map(c=><div key={c.key} className="finance-category">
       <div><span>{c.name}</span><strong>{cash(c.value)}</strong></div>
       <span className="finance-bar-track"><span style={{width:Math.round(100*c.value/maxCategory)+"%"}}/></span>
      </div>)}
     </div>
    </div>
    <div className="finance-panel"><h2><CalendarDays size={19}/> Por mês</h2>
     <p>Compare o resultado estimado com o caixa registrado. Agrupamento pelo mês do show, não pelo dia do pagamento. Valores a receber e pagar são estimativas manuais, não cobranças automáticas.</p>
     {monthly.length?<div className="finance-month-list">{monthly.map(m=><div key={m.key} className="finance-month">
      <strong>{monthLabel(m.key)} <small>{m.count} shows</small></strong>
      <span>Receita informada {cash(m.gross)}</span><span>Recebido {cash(m.received)}</span>
      <span>Resultado líquido previsto <b>{m.hasMissing?"Parcial · ":""}{cash(m.projected)}</b></span>
      <span>Saldo de caixa registrado <b>{cash(m.cash)}</b></span>
      {m.hasMissing&&<small>Valores incompletos neste mês</small>}
     </div>)}</div>:<p className="fine">Sem shows neste período.</p>}
    </div>
   </section>:
   <ProFeatureLock title="Relatórios financeiros Pro" description="Desbloqueie análises mensais, gráficos e exportação detalhada. Seus lançamentos básicos seguem gratuitos.">
    <div className="finance-two" style={{padding:16}}>
     <div className="finance-panel"><h2>Despesas por categoria</h2><p>Transporte · Equipamentos · Equipe · Alimentação</p><div className="finance-bar-track"><span style={{width:"72%"}}/></div><div className="finance-bar-track"><span style={{width:"43%"}}/></div></div>
     <div className="finance-panel"><h2>Resultado por mês</h2><p>Receita, lucro previsto e saldo de caixa</p><strong>R$ — · R$ —</strong></div>
    </div>
   </ProFeatureLock>}
   </details>
   <section className="finance-panel finance-event-panel">
    <div className="finance-head"><div><h2>Financeiro por apresentação</h2>
     <p>Confira cada show e expanda para editar despesas, faturamento e cachês pagos.</p></div>
     <Link href="/eventos" className="btn btn-quiet"><CalendarDays size={15}/> Abrir agenda</Link></div>
    {visibleOwner.map(r=><article key={r.event_id} className="finance-event">
     <div className="finance-event-top"><div>
      <strong>{r.title}</strong><small>{new Date(r.starts_at).toLocaleString("pt-BR",{dateStyle:"medium",timeStyle:"short"})} · Organizador</small>
      </div><span className="finance-event-total">{r.financial.gross===null?"Receita não informada":cash(r.financial.gross)}</span></div>
     <p>Recebido {cash(r.financial.received)} · Despesas extras {cash(r.financial.expenses)} · Cachês acordados {cash(r.financial.team)} · Pagos à banda {cash(r.financial.teamPaid)}</p>
     {reportAccess&&<p>Resultado líquido previsto: <strong>{r.financial.gross===null?"A definir":cash(r.financial.projected)}</strong>
      {r.financial.partial?" (parcial: valores pendentes)":""}
      {" · "}A receber: <strong>{r.financial.gross===null?"A definir":cash(r.financial.receivable)}</strong>
      {" · "}A pagar: <strong>{cash(r.financial.payable)}</strong></p>}
     <button className="btn btn-quiet" type="button" disabled={Boolean(busy)} aria-expanded={expanded===r.event_id} aria-controls={"finance-detail-"+r.event_id}
       onClick={()=>void openTeam(r.event_id)}><PencilLine size={15}/>
       {expanded===r.event_id?"Fechar lançamento":"Editar financeiro e pagamentos"}</button>
     {expanded===r.event_id&&<div id={"finance-detail-"+r.event_id} className="finance-event-detail">
      <EventBudgetPanel eventId={r.event_id}/>
      <div className="finance-team">
       <h3>Pagamentos à banda</h3>
       <p>Registre quanto realmente foi pago para cada músico com convite aceito. Isso não envia Pix nem marca pagamento no perfil dele.</p>
       {teamError&&<p className="finance-feedback is-error">{teamError}</p>}
       {teamLoading&&<LoadingState label="Carregando pagamentos da equipe…"/>}
       {team.map(m=><form key={m.invitation_id} className="finance-team-row" onSubmit={e=>void savePaid(e,m.invitation_id)}>
         <div><strong>{m.musician_name}</strong><small>Cachê registrado: {formatAmount(m.fee)}</small></div>
         <label>Já pago (R$)<input aria-label={"Valor pago a "+m.musician_name} inputMode="decimal"
          value={editPaid[m.invitation_id]??""}
          onChange={e=>setEditPaid(v=>({...v,[m.invitation_id]:e.target.value}))}/></label>
         <button className="btn btn-quiet" type="submit" disabled={!!busy}><Save size={14}/> Salvar</button>
       </form>)}
       {!teamLoading&&!team.length&&!teamError&&<p className="fine">Nenhum músico com convite aceito neste show.</p>}
      </div>
     </div>}
    </article>)}
    {visibleMusician.map(r=><article key={"personal-"+r.record_id} className="finance-event">
      <div className="finance-event-top"><div><strong>{r.title}</strong>
       <small>{new Date(r.starts_at).toLocaleDateString("pt-BR")} · Participação como músico</small></div>
       <span className="finance-event-total">{cash(r.financial.gross)}</span></div>
      {reportAccess&&<p>Resultado estimado: <strong>{r.financial.gross===null?"A definir":cash(r.financial.projected)}</strong>{" · "}A receber: <strong>{r.financial.gross===null?"A definir":cash(r.financial.receivable)}</strong></p>}
      <p>Recebido pessoal {r.has_financial_record?cash(r.financial.received):"Não lançado"}
        {" · "}Despesas pessoais {r.has_financial_record?cash(r.financial.expenses):"Não lançadas"}</p>
      <Link className="btn btn-quiet" href="/meus-shows"><PencilLine size={14}/> Registrar meu recebimento</Link>
    </article>)}
    {!visibleOwner.length&&!visibleMusician.length&&<p className="finance-empty">Sem shows neste período. Use a agenda para cadastrar eventos, contratações e despesas.</p>}
   </section>
   <p className="finance-footer">Valores privados, lançados manualmente. O relatório não movimenta dinheiro, não presume pagamentos e não exibe o cachê de terceiros para músicos. Os shows cancelados ficam fora dos totais.</p>
  </>}
 </div></main>;
}
