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
import "./financeiro.css";

const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
const cash=(n:number|null|undefined)=>n==null?"A definir":money.format(Number(n));
const val=(n:number|null|undefined)=>Number(n??0);
function yearMonth(value:string){return new Intl.DateTimeFormat("sv-SE",{
 timeZone:"America/Sao_Paulo",month:"2-digit",year:"numeric"
}).format(new Date(value));}
function monthLabel(value:string){return new Date(value+"-15T12:00:00-03:00").toLocaleDateString("pt-BR",{month:"long",year:"numeric"});}
function inputValue(amount:number){return Number(amount).toFixed(2).replace(".",",");}
function parseValue(text:string){return /^\d+(?:[.,]\d{1,2})?$/.test(text.trim())?Number(text.trim().replace(",",".")):null;}
function safeCsvCell(value:unknown){
 const t=String(value??"");
 const safe=/^[\s]*[=+@-]/.test(t)?"'"+t:t;
 return '"'+safe.replace(/"/g,'""')+'"';
}

export default function Financeiro(){
 const router=useRouter();
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
  const result=await loadFinance(createClient(),request.signal);
  if(request.signal.aborted)return;
  setReportAccess(result.reportAccess);setReportAccessReady(true);
  setCoverageLimited(result.coverageLimited);
  setOrganized(result.organized);setParticipations(result.participations);
 },[]);
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
 const years=useMemo(()=>[...new Set([...organized,...participations].map(r=>yearMonth(r.starts_at).slice(0,4)))].sort().reverse(),[organized,participations]);
 const visibleOwner=useMemo(()=>organized.filter(r=>r.event_status!=="cancelled" &&mode!=="musician"
  &&(year==="all"||yearMonth(r.starts_at).startsWith(year))
  &&(month==="all"||yearMonth(r.starts_at)===month)),[organized,mode,year,month]);
 const visibleMusician=useMemo(()=>participations.filter(r=>r.event_status!=="cancelled"&&mode!=="organizer"
  &&(year==="all"||yearMonth(r.starts_at).startsWith(year))
  &&(month==="all"||yearMonth(r.starts_at)===month)),[participations,mode,year,month]);
 const ownerRevenue=visibleOwner.filter(r=>r.gross_revenue!==null).reduce((n,r)=>n+val(r.gross_revenue),0);
 const musicianRevenue=visibleMusician.filter(r=>r.personal_fee!==null).reduce((n,r)=>n+val(r.personal_fee),0);
 const received=visibleOwner.reduce((n,r)=>n+val(r.received),0)+
   visibleMusician.reduce((n,r)=>n+val(r.personal_received),0);
 const extras=visibleOwner.reduce((n,r)=>n+val(r.expense_total),0);
 const extrasPaid=visibleOwner.reduce((n,r)=>n+val(r.expense_paid),0);
 const teamAgreed=visibleOwner.reduce((n,r)=>n+val(r.musician_agreed),0);
 const teamPaid=visibleOwner.reduce((n,r)=>n+val(r.musician_paid),0);
 const personalCost=visibleMusician.reduce((n,r)=>n+val(r.personal_expenses),0);
 const gross=ownerRevenue+musicianRevenue;
 const cashFlow=received-extrasPaid-teamPaid-personalCost;
 const projected=gross-extras-teamAgreed-personalCost;
 const missingRevenue=visibleOwner.filter(r=>r.gross_revenue===null).length+
   visibleMusician.filter(r=>r.personal_fee===null).length;
 const unpriced=visibleOwner.reduce((n,r)=>n+val(r.musician_unpriced),0);
 const incomplete=missingRevenue>0||unpriced>0;
 const hasAny=visibleOwner.length+visibleMusician.length>0;
 const categories=[
  {key:"transport",name:"Transporte",value:visibleOwner.reduce((n,r)=>n+val(r.transport_total),0)},
  {key:"equipment",name:"Equipamentos",value:visibleOwner.reduce((n,r)=>n+val(r.equipment_total),0)},
  {key:"staff",name:"Equipe externa",value:visibleOwner.reduce((n,r)=>n+val(r.staff_total),0)},
  {key:"food",name:"Alimentação",value:visibleOwner.reduce((n,r)=>n+val(r.food_total),0)},
  {key:"other",name:"Outras despesas",value:visibleOwner.reduce((n,r)=>n+val(r.other_total),0)},
  {key:"personal",name:"Despesas pessoais de músico",value:personalCost}
 ];
 const maxCategory=Math.max(1,...categories.map(c=>c.value));
 const monthly=useMemo(()=>{
  const groups=new Map<string,{key:string;count:number;gross:number;received:number;expenses:number;team:number;cash:number;projected:number;hasMissing:boolean}>();
  for(const r of visibleOwner){
   const key=yearMonth(r.starts_at);const x=groups.get(key)??{key,count:0,gross:0,received:0,expenses:0,team:0,cash:0,projected:0,hasMissing:false};
   x.count++;x.gross+=val(r.gross_revenue);x.received+=val(r.received);
   x.expenses+=val(r.expense_total);x.team+=val(r.musician_agreed);
   x.cash+=val(r.received)-val(r.expense_paid)-val(r.musician_paid);
   x.projected+=val(r.gross_revenue)-val(r.expense_total)-val(r.musician_agreed);
   x.hasMissing ||=r.gross_revenue===null||val(r.musician_unpriced)>0;
   groups.set(key,x);
  }
  for(const r of visibleMusician){
   const key=yearMonth(r.starts_at);const x=groups.get(key)??{key,count:0,gross:0,received:0,expenses:0,team:0,cash:0,projected:0,hasMissing:false};
   x.count++;x.gross+=val(r.personal_fee);x.received+=val(r.personal_received);
   x.expenses+=val(r.personal_expenses);x.cash+=val(r.personal_received)-val(r.personal_expenses);
   x.projected+=val(r.personal_fee)-val(r.personal_expenses);
   x.hasMissing ||=r.personal_fee===null;groups.set(key,x);
  }
  return [...groups.values()].sort((a,b)=>b.key.localeCompare(a.key));
 },[visibleOwner,visibleMusician]);
 const pendingReceivables=visibleOwner.reduce((n,r)=>n+Math.max(0,val(r.gross_revenue)-val(r.received)),0)+visibleMusician.reduce((n,r)=>n+Math.max(0,val(r.personal_fee)-val(r.personal_received)),0);
 const pendingExpenses=visibleOwner.reduce((n,r)=>n+Math.max(0,val(r.expense_total)-val(r.expense_paid)),0);
 const pendingFees=visibleOwner.reduce((n,r)=>n+Math.max(0,val(r.musician_agreed)-val(r.musician_paid)),0);
 const pendingIncomplete=missingRevenue>0||unpriced>0;
 const months=Array.from(new Set([...organized,...participations].filter(r=>year==="all"||yearMonth(r.starts_at).startsWith(year)).map(r=>yearMonth(r.starts_at)))).sort().reverse();

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
  const lines=[["Data","Tipo","Show","Local","Receita contratada","Recebido manual","A receber estimado","Custo extra","Custo músicos acordado","Custo músicos pago","Despesas pagas","Compromissos a pagar","Resultado líquido previsto","Saldo de caixa registrado","Valores incompletos"]];
  for(const r of visibleOwner)lines.push([r.starts_at,"Organizador",r.title,r.venue||r.city||"",
   r.gross_revenue??"",r.received,r.gross_revenue===null?"":Math.max(0,val(r.gross_revenue)-val(r.received)),r.expense_total,r.musician_agreed,r.musician_paid,r.expense_paid,Math.max(0,val(r.expense_total)-val(r.expense_paid))+Math.max(0,val(r.musician_agreed)-val(r.musician_paid)),r.gross_revenue===null?"":val(r.gross_revenue)-val(r.expense_total)-val(r.musician_agreed),val(r.received)-val(r.expense_paid)-val(r.musician_paid),r.gross_revenue===null||val(r.musician_unpriced)>0?"Sim":"Não"].map(String));
  for(const r of visibleMusician)lines.push([r.starts_at,"Músico",r.title,r.venue||r.city||"",
   r.personal_fee??"",r.personal_received??"",r.personal_fee===null?"":Math.max(0,val(r.personal_fee)-val(r.personal_received)),r.personal_expenses??"",0,0,r.personal_expenses??0,0,r.personal_fee===null?"":val(r.personal_fee)-val(r.personal_expenses),val(r.personal_received)-val(r.personal_expenses),r.personal_fee===null?"Sim":"Não"].map(String));
  const csv="\ufeff"+lines.map(row=>row.map(safeCsvCell).join(";")).join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="stage-flow-financeiro-detalhado.csv";a.click();URL.revokeObjectURL(url);
 }
 return <main className="finance-page"><div className="container">
  <nav className="nav"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
   <Link href="/painel" className="btn btn-quiet"><ArrowLeft size={15}/> Painel</Link></nav>
  <header className="finance-hero"><span className="eyebrow"><Wallet size={14}/> CONTROLE PRIVADO POR SHOW</span>
   <h1>Minha central <span className="accent">financeira.</span></h1>
   <p>Acompanhe receita bruta, cachês, transporte, outras despesas, valores pagos e resultado. Tudo organizado por show, sem obrigar você a cadastrar valores.</p>
  </header>
  {error&&<p className="finance-feedback is-error" role="alert">{error}</p>}
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
   {reportAccess?<button className="btn btn-quiet" type="button" disabled={loading||Boolean(error)||coverageLimited||!hasAny||!reportAccessReady} onClick={exportCsv}><Download size={15}/> Exportar CSV detalhado</button>:
    <Link className="btn btn-quiet" href="/planos"><LockKeyhole size={15}/> Exportação detalhada · Cantor Pro</Link>}
  </div>
  {loading?<LoadingState label="Carregando valores privados…"/>:error?<EmptyState title="Financeiro indisponível" description="Os valores não foram carregados. Tente novamente para consultar seu resumo." action={<Button onClick={()=>setNonce(n=>n+1)}>Tentar novamente</Button>}/>:<>
   {coverageLimited&&<p className="finance-warning" role="status"><CircleAlert size={17}/>O histórico disponível atingiu o limite de shows recentes. Os totais podem não incluir períodos antigos; a exportação está pausada para evitar um relatório incompleto.</p>}
   <section className="finance-kpis" aria-label="Resumo financeiro">
    {[
     ["Recebido registrado",cash(received),"Informado manualmente"],
     ["A receber (estimado)",cash(pendingReceivables),pendingIncomplete?"Parcial: valores ainda não definidos":"Valores contratados ainda não recebidos"],
     ["Compromissos a pagar",cash(pendingExpenses+pendingFees),"Despesas extras e cachês ainda não registrados como pagos"],
     ["Saldo de caixa registrado",cash(cashFlow),"Recebido − despesas pagas − cachês pagos"]
    ].map(([title,value,note])=><StatCard key={title} label={title} value={value} description={note}/>)}
   </section>
   <details className="finance-extra-summary">
    <summary>Ver receita, despesas e resultado estimado</summary>
    <div className="finance-kpis">
     {[
      ["Receita bruta contratada",cash(gross),missingRevenue?"Valores faltando":""],
      ["Despesas dos shows",cash(extras+personalCost),"Custos previstos e pessoais"],
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
      </div><span className="finance-event-total">{r.gross_revenue===null?"Receita não informada":cash(r.gross_revenue)}</span></div>
     <p>Recebido {cash(r.received)} · Despesas extras {cash(r.expense_total)} · Cachês acordados {cash(r.musician_agreed)} · Pagos à banda {cash(r.musician_paid)}</p>
     {reportAccess&&<p>Resultado líquido previsto: <strong>{r.gross_revenue===null?"A definir":cash(val(r.gross_revenue)-val(r.expense_total)-val(r.musician_agreed))}</strong>
      {r.gross_revenue===null||val(r.musician_unpriced)>0?" (parcial: valores pendentes)":""}
      {" · "}A receber: <strong>{r.gross_revenue===null?"A definir":cash(Math.max(0,val(r.gross_revenue)-val(r.received)))}</strong>
      {" · "}A pagar: <strong>{cash(Math.max(0,val(r.expense_total)-val(r.expense_paid))+Math.max(0,val(r.musician_agreed)-val(r.musician_paid)))}</strong></p>}
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
         <div><strong>{m.musician_name}</strong><small>Cachê registrado: {cash(m.fee)}</small></div>
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
       <span className="finance-event-total">{cash(r.personal_fee)}</span></div>
      {reportAccess&&<p>Resultado estimado: <strong>{r.personal_fee===null?"A definir":cash(val(r.personal_fee)-val(r.personal_expenses))}</strong>{" · "}A receber: <strong>{r.personal_fee===null?"A definir":cash(Math.max(0,val(r.personal_fee)-val(r.personal_received)))}</strong></p>}
      <p>Recebido pessoal {r.has_financial_record?cash(r.personal_received):"Não lançado"}
        {" · "}Despesas pessoais {r.has_financial_record?cash(r.personal_expenses):"Não lançadas"}</p>
      <Link className="btn btn-quiet" href="/meus-shows"><PencilLine size={14}/> Registrar meu recebimento</Link>
    </article>)}
    {!visibleOwner.length&&!visibleMusician.length&&<p className="finance-empty">Sem shows neste período. Use a agenda para cadastrar eventos, contratações e despesas.</p>}
   </section>
   <p className="finance-footer">Valores privados, lançados manualmente. O relatório não movimenta dinheiro, não presume pagamentos e não exibe o cachê de terceiros para músicos. Os shows cancelados ficam fora dos totais.</p>
  </>}
 </div></main>;
}
