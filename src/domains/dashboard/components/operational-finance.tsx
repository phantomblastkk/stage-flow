"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowUpRight,CalendarDays,Wallet} from "lucide-react";
import {createClient} from "@/lib/supabase/client";
import {useAccount} from "../../account/account-context";
import {loadFinance} from "../../billing/services/finance-service";
import {formatCents} from "../../billing/model/money";
import {operationalSummary} from "../model/operational-summary";
import {Card,LoadingState,StatCard} from "@/src/components/ui";

type Summary=ReturnType<typeof operationalSummary>;
export default function OperationalFinance({revision=0}:{revision?:number}) {
 const {snapshot:account}=useAccount();
 const [data,setData]=useState<Summary|null>(null),[error,setError]=useState("");
 const [limited,setLimited]=useState(false);
 useEffect(()=>{
  const request=new AbortController();setData(null);setError("");
  void loadFinance(createClient(),request.signal,account.profile??undefined).then(result=>{
   if(request.signal.aborted)return;
   setData(operationalSummary(result.organized,result.participations));setLimited(result.coverageLimited);
  }).catch(()=>{if(!request.signal.aborted)setError("Não foi possível atualizar os recebimentos. Abra o Financeiro ou tente atualizar o painel.");});
  return()=>request.abort();
 },[account.user?.id,account.profile?.id,revision]);
 if(error)return <Card><p role="alert">{error}</p><Link href="/financeiro">Abrir Financeiro</Link></Card>;
 if(!data)return <LoadingState label="Consultando seus recebimentos…"/>;
 const list=(rows:Summary["recent"],pending:boolean)=>rows.length?<ul className="sf-operations-money-list">{rows.map(row=><li key={row.event_id+("record_id" in row?row.record_id:"")}>
  <Link href={"/financeiro?evento="+encodeURIComponent(row.event_id)}><span>{row.title}<small>Show em {new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeZone:"America/Sao_Paulo"}).format(new Date(row.starts_at))}</small></span><strong>{formatCents(pending?row.financial.receivable:row.financial.received)}</strong></Link>
 </li>)}</ul>:<p className="sf-operations-muted">{pending?"Nenhum valor pendente registrado.":"Nenhum recebimento registrado."}</p>;
 return <section aria-label="Resumo financeiro" className="sf-operations-finance">
  <div className="sf-workspace-stat-grid">
   <StatCard label="Shows do mês" value={data.month.visibleOwner.length+data.month.visibleMusician.length} icon={<CalendarDays size={20}/>} action={<Link href="/eventos">Ver shows</Link>}/>
   <StatCard label="Receita do mês" value={formatCents(data.month.gross)} icon={<Wallet size={20}/>} description="Receita e cachês acordados dos shows do mês."/>
   <StatCard label="A receber" value={formatCents(data.all.pendingReceivables)} icon={<Wallet size={20}/>} description="Saldo dos valores registrados, em todos os períodos."/>
   <StatCard label="Recebido no mês" value={formatCents(data.month.received)} icon={<Wallet size={20}/>} description="Recebimentos registrados para shows do mês."/>
  </div>
  {(limited||data.all.incomplete)&&<p role="status" className="sf-operations-muted">{limited?"Resumo parcial: o limite de histórico foi atingido. ":""}{data.all.incomplete?"Há shows com valores ainda não definidos. ":""}Confira os lançamentos no Financeiro.</p>}
  <Card><div className="sf-workspace-pane-head"><h2>Seu dinheiro, à vista</h2><Link href="/financeiro">Financeiro completo <ArrowUpRight size={16}/></Link></div>
   <div className="sf-workspace-columns"><div><h3>Últimos recebimentos registrados</h3>{list(data.recent,false)}</div><div><h3>Próximos recebimentos</h3>{list(data.upcoming,true)}</div></div>
   <p className="sf-operations-muted">Registros por data do show. A data efetiva de pagamento e a liquidação bancária não são informadas por este resumo.</p>
  </Card>
 </section>;
}
