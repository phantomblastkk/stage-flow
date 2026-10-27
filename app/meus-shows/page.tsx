"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock3,
  Coins, FileBarChart, Guitar, LoaderCircle, MapPin, Mic2,
  PencilLine, RefreshCw, Save, ShieldCheck, Wallet
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./meus-shows.css";

type ShowKind = "organized" | "participation";
type ShowStatus = "draft" | "published" | "cancelled" | "completed";
type ShowRow = {
  kind: ShowKind;record_id:string;event_id:string;title:string;
  venue:string|null;city:string|null;starts_at:string;event_status:ShowStatus;
  organizer_name:string|null;performed:boolean;manual_confirmed:boolean;
  client_fee:number|null;client_received:number|null;
  expenses_total:number|null;expenses_paid:number|null;
  team_agreed_total:number|null;team_unpriced_count:number;
  personal_fee:number|null;personal_fee_agreed:boolean;
  personal_received:number|null;personal_expenses:number|null;
  has_financial_record:boolean;
};
type Pane = "history" | "finance";
type Filter = "performed" | "unconfirmed" | "all";
type ShowView = "all" | "organized" | "participation";
const moneyFormat=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
const cash=(n:number|null|undefined)=>n==null?"Não informado":moneyFormat.format(Number(n));
const date=(v:string)=>new Date(v).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"medium",timeStyle:"short"});
const monthKey=(v:string)=>new Intl.DateTimeFormat("sv-SE",{
  timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit"
}).format(new Date(v));
const monthName=(key:string)=>new Date(key+"-15T12:00:00-03:00")
  .toLocaleDateString("pt-BR",{month:"long",year:"numeric",timeZone:"America/Sao_Paulo"});
const parseCash=(v:string)=>/^\d+(?:[,.]\d{1,2})?$/.test(v.trim())?
  Number(v.trim().replace(",",".")):null;
const inputCash=(n:number|null)=>n==null?"0,00":Number(n).toFixed(2).replace(".",",");

export default function MyShowsPage(){
  const router=useRouter();
  const [rows,setRows]=useState<ShowRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [pane,setPane]=useState<Pane>("history");
  const [filter,setFilter]=useState<Filter>("performed");
  const [view,setView]=useState<ShowView>("all");
  const [year,setYear]=useState("all");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState<string|null>(null);
  const [editing,setEditing]=useState<string|null>(null);
  const [received,setReceived]=useState("0,00");
  const [expenses,setExpenses]=useState("0,00");
  const [nonce,setNonce]=useState(0);

  const refresh=useCallback(async()=>{
    const db=createClient();
    const {data:{user},error:authError}=await db.auth.getUser();
    if(authError||!user){router.replace("/login");return;}
    const {data,error:loadError}=await db.rpc("stage_my_show_history");
    if(loadError)throw loadError;
    if(!Array.isArray(data))throw Error("O histórico retornou dados inesperados.");
    setRows(data as ShowRow[]);
  },[router]);

  useEffect(()=>{
    let active=true;
    async function load(){
      try{await refresh()}catch(e){
        if(active)setError(e instanceof Error?e.message:"Não foi possível carregar seus shows.");
      }finally{if(active)setLoading(false)}
    }
    void load();
    return()=>{active=false};
  },[refresh,nonce]);

  const years=useMemo(()=>[...new Set(rows.map(x=>monthKey(x.starts_at).slice(0,4)))].sort().reverse(),[rows]);
  const scoped=useMemo(()=>rows.filter(r=>
    (view==="all"||r.kind===view)&&
    (year==="all"||monthKey(r.starts_at).startsWith(year))
  ),[rows,year,view]);
  const past=useMemo(()=>scoped.filter(r=>new Date(r.starts_at).getTime()<=Date.now()),[scoped]);
  const performed=past.filter(r=>r.performed&&r.event_status!=="cancelled");
  const unconfirmed=past.filter(r=>!r.performed&&r.event_status!=="cancelled");
  const selected=past.filter(r=>filter==="all"||(
    filter==="performed" ? r.performed&&r.event_status!=="cancelled"
      : !r.performed&&r.event_status!=="cancelled"
  ));

  const financialRows=scoped.filter(r=>r.event_status!=="cancelled");
  const owned=financialRows.filter(r=>r.kind==="organized");
  const played=financialRows.filter(r=>r.kind==="participation");
  const ownerTotals={
    priced:owned.filter(r=>r.client_fee!==null).length,
    expected:owned.reduce((a,r)=>a+Number(r.client_fee??0),0),
    received:owned.reduce((a,r)=>a+Number(r.client_received??0),0),
    expenses:owned.reduce((a,r)=>a+Number(r.expenses_total??0),0),
    paidExpenses:owned.reduce((a,r)=>a+Number(r.expenses_paid??0),0),
    team:owned.reduce((a,r)=>a+Number(r.team_agreed_total??0),0),
    unpriced:owned.reduce((a,r)=>a+Number(r.team_unpriced_count??0),0)
  };
  const musicianTotals={
    priced:played.filter(r=>r.personal_fee!==null).length,
    expected:played.reduce((a,r)=>a+Number(r.personal_fee??0),0),
    received:played.reduce((a,r)=>a+Number(r.personal_received??0),0),
    expenses:played.reduce((a,r)=>a+Number(r.personal_expenses??0),0),
    logged:played.filter(r=>r.has_financial_record).length
  };
  const months=useMemo(()=>{
    const groups=new Map<string,{key:string;shows:number;owned:number;played:number;informed:number;received:number}>();
    for(const row of financialRows){
      const key=monthKey(row.starts_at);
      const item=groups.get(key)??{key,shows:0,owned:0,played:0,informed:0,received:0};
      item.shows++;
      item.owned+=row.kind==="organized"?1:0;
      item.played+=row.kind==="participation"?1:0;
      item.informed+=Number(row.kind==="organized"?row.client_fee??0:row.personal_fee??0);
      item.received+=Number(row.kind==="organized"?row.client_received??0:row.personal_received??0);
      groups.set(key,item);
    }
    return [...groups.values()].sort((a,b)=>b.key.localeCompare(a.key));
  },[financialRows]);

  async function confirmPerformed(row:ShowRow,completed:boolean){
    if(busy)return;
    setBusy(row.record_id);setError("");setNotice("");
    try{
      const {data,error:rpcError}=await createClient().rpc("stage_show_set_performed",{
        p_record_id:row.record_id,p_kind:row.kind,p_performed:completed
      });
      if(rpcError)throw rpcError;
      if(data!=="saved")throw Error(data==="too_early"?"Não é possível confirmar um show futuro.":"Não foi possível confirmar esta apresentação.");
      await refresh();
      setNotice(completed?"Apresentação registrada no seu histórico pessoal.":"Confirmação pessoal desfeita.");
    }catch(e){setError(e instanceof Error?e.message:"Erro ao salvar a confirmação.");}
    finally{setBusy(null);}
  }
  function editFinance(row:ShowRow){
    setEditing(row.record_id);setReceived(inputCash(row.personal_received));
    setExpenses(inputCash(row.personal_expenses));setError("");setNotice("");
  }
  async function saveFinance(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!editing||busy)return;
    const incoming=parseCash(received),cost=parseCash(expenses);
    if(incoming===null||cost===null||incoming>9999999.99||cost>9999999.99){
      setError("Informe valores positivos com até duas casas decimais, sem pontos de milhar.");
      return;
    }
    setBusy(editing);setError("");setNotice("");
    try{
      const {data,error:rpcError}=await createClient().rpc("stage_show_save_participation_finance",{
        p_invitation_id:editing,p_received:incoming,p_expenses:cost
      });
      if(rpcError)throw rpcError;
      if(data!=="saved")throw Error("Não foi possível salvar o registro privado.");
      setEditing(null);await refresh();
      setNotice("Valores pessoais registrados. Isso não movimenta dinheiro nem informa pagamentos ao contratante.");
    }catch(err){setError(err instanceof Error?err.message:"Não foi possível salvar.");}
    finally{setBusy(null);}
  }
  const showCard=(r:ShowRow,financeMode:boolean)=><article key={r.kind+":"+r.record_id} className="show-history-card">
    <div className="show-history-card-header">
      <span className="show-history-type">{r.kind==="organized"?<Mic2 size={15}/>:<Guitar size={15}/>}
        {r.kind==="organized"?"Organização / show próprio":"Participação como músico"}
      </span>
      <span className={"show-history-status "+(r.event_status==="cancelled"?"cancelled":r.performed?"done":"pending")}>
        {r.event_status==="cancelled"?"Cancelado":r.performed?"Realizado":
          new Date(r.starts_at)>new Date()?"Agendado":"Realização não confirmada"}
      </span>
    </div>
    <h3>{r.title}</h3>
    <p className="show-history-meta"><CalendarDays size={15}/>{date(r.starts_at)}</p>
    {(r.venue||r.city)&&<p className="show-history-meta"><MapPin size={15}/>{[r.venue,r.city].filter(Boolean).join(" · ")}</p>}
    {r.kind==="participation"&&r.organizer_name&&<p className="show-history-meta">Organização: {r.organizer_name}</p>}
    {financeMode?<div className="show-history-finance-lines">
      {r.kind==="organized"?<>
        <span>Receita combinada <strong>{cash(r.client_fee)}</strong></span>
        <span>Recebido (informado) <strong>{r.has_financial_record?cash(r.client_received):"Não registrado"}</strong></span>
        <span>Cachês da equipe acordados <strong>{cash(r.team_agreed_total)}</strong></span>
        <span>Outras despesas previstas <strong>{cash(r.expenses_total)}</strong></span>
        {r.team_unpriced_count>0&&<small>{r.team_unpriced_count} músico(s) ainda sem cachê fechado.</small>}
      </>:<>
        <span>Cachê {r.personal_fee_agreed?"acordado":"informado"} <strong>{cash(r.personal_fee)}</strong></span>
        <span>Recebido pessoal (manual) <strong>{r.has_financial_record?cash(r.personal_received):"Não registrado"}</strong></span>
        <span>Despesas pessoais (manual) <strong>{r.has_financial_record?cash(r.personal_expenses):"Não registrado"}</strong></span>
      </>}
    </div>:null}
    <div className="show-history-actions">
      {r.event_status!=="cancelled"&&<Link className="btn btn-quiet"
        href={"/eventos/operacao?evento="+encodeURIComponent(r.event_id)}>
        <Clock3 size={15}/> {r.kind==="organized"?"Operação e checklist":"Horários do show"}
      </Link>}

      {r.event_status!=="cancelled"&&new Date(r.starts_at)<=new Date()&&
        (!r.performed||r.manual_confirmed&&r.event_status!=="completed")&&
        <button type="button" className="btn btn-quiet" disabled={!!busy}
          onClick={()=>void confirmPerformed(r,!r.manual_confirmed)}>
          <CheckCircle2 size={15}/>{r.manual_confirmed?"Desfazer confirmação":"Marcar como realizado"}
        </button>}
      {financeMode&&r.kind==="organized"&&<Link className="btn btn-quiet"
        href={"/eventos?evento="+encodeURIComponent(r.event_id)+"&equipe=1"}>
        <PencilLine size={15}/> Financeiro deste show <ArrowRight size={14}/>
      </Link>}
      {financeMode&&r.kind==="participation"&&<button type="button" className="btn btn-quiet"
        disabled={!!busy} onClick={()=>editFinance(r)}>
        <Wallet size={15}/> Registrar valores
      </button>}
    </div>
    {financeMode&&r.kind==="participation"&&editing===r.record_id&&
      <form className="show-history-finance-form" onSubmit={e=>void saveFinance(e)}>
        <div className="show-history-finance-inputs">
          <label>Quanto já recebeu (R$)
            <input value={received} onChange={e=>setReceived(e.target.value)} inputMode="decimal" required/>
          </label>
          <label>Despesas pessoais (R$)
            <input value={expenses} onChange={e=>setExpenses(e.target.value)} inputMode="decimal" required/>
          </label>
        </div>
        <p>Controle pessoal opcional. Não altera o cachê negociado nem confirma transferência bancária.</p>
        <div className="show-history-actions">
          <button className="btn btn-primary" type="submit" disabled={!!busy}><Save size={14}/> Salvar valores</button>
          <button className="btn btn-quiet" type="button" disabled={!!busy} onClick={()=>setEditing(null)}>Cancelar</button>
        </div>
      </form>}
  </article>;

  return <main className="show-history-page"><div className="container">
    <nav className="nav">
      <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
      <Link className="btn btn-quiet" href="/painel"><ArrowLeft size={16}/> Meu painel</Link>
    </nav>
    <header className="show-history-hero">
      <div className="eyebrow"><ShieldCheck size={14}/> ÁREA PESSOAL · NÃO PÚBLICA</div>
      <h1>Meus <span className="accent">shows.</span></h1>
      <p className="lead">Sua trajetória: apresentações organizadas, convites aceitos e valores que você escolher acompanhar.</p>
      <Link className="btn btn-quiet" href="/eventos"><CalendarDays size={16}/> Abrir agenda</Link>
    </header>
    <div className="show-history-tabs" role="group" aria-label="Áreas de meus shows">
      <button type="button" aria-pressed={pane==="history"} onClick={()=>setPane("history")}><CalendarDays size={17}/> Histórico de shows</button>
      <button type="button" aria-pressed={pane==="finance"} onClick={()=>setPane("finance")}><FileBarChart size={17}/> Relatórios financeiros (opcional)</button>
    </div>
    {error&&<p className="show-history-error" role="alert">{error}</p>}
    {notice&&<p className="show-history-success" role="status">{notice}</p>}
    <div className="show-history-controls">
      <label>Visualizar
        <select value={view} onChange={e=>setView(e.target.value as ShowView)}>
          <option value="all">Todos os meus shows</option>
          <option value="organized">Shows que organizei</option>
          <option value="participation">Shows em que participei</option>
        </select>
      </label>
      <label>Ano
        <select value={year} onChange={e=>setYear(e.target.value)}>
          <option value="all">Todos os anos</option>
          {years.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      <button type="button" className="btn btn-quiet" disabled={loading||!!busy}
        onClick={()=>{setNonce(v=>v+1);setNotice("");setError("");}}>
        <RefreshCw size={15}/> Atualizar
      </button>
    </div>
    {loading?<div className="feature"><LoaderCircle size={18}/> Carregando seus registros...</div>:
      pane==="history"?<>
        <div className="show-history-kpis">
          <span><CheckCircle2 size={18}/><strong>{performed.length}</strong> realizados</span>
          <span><Clock3 size={18}/><strong>{unconfirmed.length}</strong> a confirmar</span>
          <span><Mic2 size={18}/><strong>{performed.filter(x=>x.kind==="organized").length}</strong> próprios</span>
          <span><Guitar size={18}/><strong>{performed.filter(x=>x.kind==="participation").length}</strong> participações</span>
        </div>
        <div className="show-history-filters" role="group" aria-label="Situação das apresentações">
          {([["performed","Realizados"],["unconfirmed","A confirmar"],["all","Todos os passados"]] as const).map(([key,label])=>
            <button type="button" key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}
        </div>
        {selected.length?<div className="show-history-list">{selected.map(row=>showCard(row,false))}</div>:
          <div className="feature show-history-empty">Nenhuma apresentação encontrada neste filtro. Os shows entram aqui quando a data passa; marque como realizado para confirmar.</div>}
      </>:<>
        <p className="show-history-note"><Coins size={18}/> Relatórios privados, preenchimento facultativo. Os valores são os informados em cada show: não significam depósitos ou pagamentos bancários automaticamente confirmados.</p>
        <div className="show-history-financial-sections">
          {(view==="all"||view==="organized")&&<section className="show-history-report">
            <h2>Produção e shows próprios</h2>
            <p>Receita contratada, recebido manualmente, cachês acordados e despesas do organizador.</p>
            <div className="show-history-report-stats">
              <span>Receita combinada <strong>{cash(ownerTotals.expected)}</strong><small>{ownerTotals.priced} de {owned.length} shows têm receita cadastrada</small></span>
              <span>Recebido informado <strong>{cash(ownerTotals.received)}</strong></span>
              <span>Cachês acordados da equipe <strong>{cash(ownerTotals.team)}</strong></span>
              <span>Outras despesas previstas <strong>{cash(ownerTotals.expenses)}</strong></span>
              <span>Resultado previsto parcial <strong>{ownerTotals.priced?cash(ownerTotals.expected-ownerTotals.team-ownerTotals.expenses):"Não calculável"}</strong><small>Não é lucro realizado; faltam pagamentos da banda e valores não informados.</small></span>
            </div>
            {ownerTotals.unpriced>0&&<small>{ownerTotals.unpriced} cachê(s) de convites ativos ainda sem acordo; totais parciais.</small>}
          </section>}
          {(view==="all"||view==="participation")&&<section className="show-history-report">
            <h2>Meus cachês de músico</h2>
            <p>Somente os valores dos convites aceitos por você. Nenhum cachê de outros músicos é exibido.</p>
            <div className="show-history-report-stats">
              <span>Cachês acordados/informados <strong>{cash(musicianTotals.expected)}</strong><small>{musicianTotals.priced} de {played.length} participações com valor disponível</small></span>
              <span>Recebido informado <strong>{cash(musicianTotals.received)}</strong></span>
              <span>Despesas pessoais <strong>{cash(musicianTotals.expenses)}</strong></span>
              <span>Saldo pessoal registrado <strong>{musicianTotals.logged?cash(musicianTotals.received-musicianTotals.expenses):"Não registrado"}</strong><small>Somente dos valores que você digitou; não é lucro total.</small></span>
            </div>
          </section>}
        </div>
        <section className="show-history-report">
          <h2>Resumo por mês</h2>
          <p>Os totais misturam valores de produção e participação somente quando ambos os tipos estão selecionados.</p>
          {months.length?<div className="show-history-table-wrap"><table>
            <thead><tr><th>Mês</th><th>Shows</th><th>Valores informados</th><th>Recebimentos registrados</th></tr></thead>
            <tbody>{months.map(m=><tr key={m.key}>
              <td>{monthName(m.key)}</td><td>{m.shows}</td>
              <td>{cash(m.informed)}</td><td>{cash(m.received)}</td>
            </tr>)}</tbody>
          </table></div>:<p className="fine">Ainda não há shows para esse período.</p>}
        </section>
        <section className="show-history-report">
          <h2>Detalhamento dos shows</h2>
          <p>Para shows próprios, edite faturamento e despesas na agenda. Para participações, registre apenas seus valores pessoais aqui.</p>
          {financialRows.length?<div className="show-history-list">{financialRows.map(row=>showCard(row,true))}</div>:
            <div className="feature show-history-empty">Nenhum show encontrado neste período.</div>}
        </section>
      </>}
    <p className="fine show-history-footer">São mostrados até 300 shows próprios e 300 participações aceitas mais recentes. Datas passadas não são consideradas realizadas sem confirmação. Casas parceiras continuam usando somente o calendário.</p>
  </div></main>;
}
