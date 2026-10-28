"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity, ArrowLeft, ArrowRight, CalendarDays, ChartNoAxesCombined,
  CheckCircle2, CircleHelp, Clock3, Eye, ExternalLink, Guitar,
  LoaderCircle, LockKeyhole, MousePointerClick, RefreshCw,
  Search, ShieldCheck, Sparkles, Users
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./performance.css";

type RangeDays=7|30|90;
type MetricKey = "portfolio_views"|"search_impressions"|
  "featured_impressions"|"marketplace_profile_opens"|"invitations_received";
type Totals=Record<MetricKey,number>;
type Daily=Totals & {day:string};
type Performance={
  status: "ok"|"login_required"|"artist_required"|"invalid_range";
  days:RangeDays;
  start_date:string;
  end_date:string;
  name:string;
  slug:string|null;
  portfolio_published:boolean;
  listed_in_marketplace:boolean;
  marketplace_launched:boolean;
  totals:Totals;
  daily:Daily[];
  invitation_status: {
    accepted:number;pending:number;declined:number;cancelled:number;
  };
};
const metrics: {key:MetricKey;name:string;desc:string}[] = [
  {key:"portfolio_views",name:"Visitas ao portfólio",desc:"Acessos registrados na sua página gratuita."},
  {key:"search_impressions",name:"Aparições na busca",desc:"Cartões retornados nas buscas do marketplace."},
  {key:"featured_impressions",name:"Exibições nos destaques",desc:"Aparições na vitrine dos mais avaliados."},
  {key:"marketplace_profile_opens",name:"Aberturas via catálogo",desc:"Cliques em links para o seu portfólio no marketplace."},
  {key:"invitations_received",name:"Convites recebidos",desc:"Convites criados no Stage Flow no período."}
];
const format=new Intl.NumberFormat("pt-BR");
function count(n:number|null|undefined){
  return format.format(Number.isFinite(n)?Number(n):0);
}
function dayLabel(value:string){
  const date=new Date(value+"T12:00:00");
  return Number.isNaN(date.getTime())?value:date.toLocaleDateString("pt-BR",{
    day:"2-digit",month:"short"
  });
}
function percent(n:number,total:number){
  if(!total)return 0;
  return Math.round(n/total*100);
}

export default function MusicianPerformancePage(){
  const router=useRouter();
  const [range,setRange]=useState<RangeDays>(30);
  const [metric,setMetric]=useState<MetricKey>("portfolio_views");
  const [report,setReport]=useState<Performance|null>(null);
  const [authLoading,setAuthLoading]=useState(true);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [nonce,setNonce]=useState(0);

  useEffect(()=>{
    let active=true;
    async function check(){
      const {data:{user},error:authError}=await createClient().auth.getUser();
      if(!active)return;
      if(authError||!user){router.replace("/login");return;}
      setAuthLoading(false);
    }
    void check();
    return()=>{active=false;};
  },[router]);

  const refresh=useCallback(()=>setNonce(i=>i+1),[]);

  useEffect(()=>{
    if(authLoading)return;
    let active=true;
    async function load(){
      setLoading(true);setError("");
      const {data,error:rpcError}=await createClient().rpc(
        "stage_my_musician_performance",{p_days:range}
      );
      if(!active)return;
      if(rpcError){
        setReport(null);
        setError(rpcError.code==="PGRST202"||rpcError.code==="42883"
          ? "Para ativar seu painel, execute musician_performance_migration.sql no Supabase."
          : "Não foi possível consultar as estatísticas privadas. "+rpcError.message);
      }else if(!data||data.status!=="ok"){
        setReport(null);
        setError(data?.status==="artist_required"
          ? "Este painel é exclusivo para contas com função de músico/artista."
          : "Não foi possível carregar o desempenho desta conta.");
      }else{
        setReport(data as Performance);
      }
      setLoading(false);
    }
    void load();
    return()=>{active=false;};
  },[authLoading,range,nonce]);

  const buckets=useMemo(()=>{
    if(!report?.daily?.length)return [];
    const data=report.daily;
    const size=range===7?1:range===30?3:7;
    const grouped:{label:string;value:number;start:string;end:string}[]=[];
    for(let i=0;i<data.length;i+=size){
      const group=data.slice(i,i+size);
      const value=group.reduce((acc,item)=>acc+(Number(item[metric])||0),0);
      grouped.push({
        label:dayLabel(group[0].day),
        start:group[0].day,end:group[group.length-1].day,value
      });
    }
    return grouped;
  },[report,range,metric]);
  const maxBucket=Math.max(0,...buckets.map(b=>b.value));
  const totalInvitations=Number(report?.totals?.invitations_received||0);
  const acceptances=Number(report?.invitation_status?.accepted||0);
  const focus=metrics.find(m=>m.key===metric)??metrics[0];

  if(authLoading)return <main className="reach-loading">
    <LoaderCircle size={25}/><p>Confirmando acesso ao seu painel...</p>
  </main>;

  return <main className="reach-page">
    <div className="reach-container">
      <nav className="reach-nav">
        <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
        <Link className="reach-back" href="/painel"><ArrowLeft size={16}/> Voltar ao painel</Link>
      </nav>

      <header className="reach-header">
        <div className="reach-eyebrow"><ChartNoAxesCombined size={15}/> PORTFÓLIO / VISIBILIDADE</div>
        <div className="reach-heading">
          <div>
            <h1>Seu talento em <em>números.</em></h1>
            <p>Acompanhe o alcance do seu portfólio, sua visibilidade no marketplace
              e as oportunidades que chegaram até você.</p>
          </div>
          <button type="button" className="reach-refresh"
            disabled={loading} onClick={refresh}>
            <RefreshCw size={16}/> Atualizar
          </button>
        </div>
      </header>

      <div className="reach-private"><LockKeyhole size={16}/>
        <span><strong>Dados privados.</strong> Somente você acessa estas estatísticas.
          Não mostramos quem visitou seu perfil e não rastreamos dados pessoais de visitantes no banco.</span>
      </div>

      <section className="reach-range-header" aria-label="Período das estatísticas">
        <div>
          <strong>Visão geral do desempenho</strong>
          <small>{report?dayLabel(report.start_date)+" a "+dayLabel(report.end_date):
            "Selecione um intervalo"}</small>
        </div>
        <div className="reach-range-actions" role="group" aria-label="Selecionar intervalo">
          {([7,30,90] as RangeDays[]).map(days=><button key={days}
            type="button" disabled={loading} aria-pressed={range===days}
            onClick={()=>setRange(days)}>{days} dias</button>)}
        </div>
      </section>

      {loading?<div className="reach-empty" role="status"><LoaderCircle size={24}/>
        <h2>Calculando seu desempenho...</h2></div>:
        error?<div className="reach-error" role="alert"><CircleHelp size={21}/>
          <div><strong>Não foi possível carregar os dados.</strong><p>{error}</p></div>
        </div>:
        report&&<>
          <div className="reach-stats">
            <article className="reach-stat is-portfolio">
              <div className="reach-stat-icon"><Eye size={21}/></div>
              <span>Visitas ao portfólio</span>
              <strong>{count(report.totals.portfolio_views)}</strong>
              <small>Desde o início da coleta, neste período</small>
            </article>
            <article className="reach-stat is-search">
              <div className="reach-stat-icon"><Search size={21}/></div>
              <span>Aparições na busca</span>
              <strong>{count(report.totals.search_impressions)}</strong>
              <small>Exibições aproximadas do seu cartão</small>
            </article>
            <article className="reach-stat is-featured">
              <div className="reach-stat-icon"><Sparkles size={21}/></div>
              <span>Exibições nos destaques</span>
              <strong>{count(report.totals.featured_impressions)}</strong>
              <small>Vitrine dos músicos mais avaliados</small>
            </article>
            <article className="reach-stat is-invites">
              <div className="reach-stat-icon"><Users size={21}/></div>
              <span>Convites recebidos</span>
              <strong>{count(report.totals.invitations_received)}</strong>
              <small>Dados reais dos convites do Stage Flow</small>
            </article>
          </div>

          <div className="reach-content">
            <section className="reach-chart" aria-labelledby="reach-chart-heading">
              <div className="reach-chart-header">
                <div>
                  <span className="reach-small-kicker"><Activity size={15}/> EVOLUÇÃO DIÁRIA</span>
                  <h2 id="reach-chart-heading">Seu alcance ao longo do tempo</h2>
                  <p>Selecione uma métrica para entender sua evolução.</p>
                </div>
              </div>
              <div className="reach-metric-tabs" role="group" aria-label="Métrica do gráfico">
                {metrics.map(m=><button key={m.key} type="button"
                  aria-pressed={metric===m.key}
                  onClick={()=>setMetric(m.key)}>{m.name}</button>)}
              </div>
              <div className="reach-chart-focus">
                <div><strong>{count(report.totals[metric])}</strong>
                  <span>{focus.name.toLowerCase()} no período</span></div>
                <p>{focus.desc}</p>
              </div>
              <div className="reach-bars" role="img"
                aria-label={"Evolução de "+focus.name.toLowerCase()+
                  " em "+range+" dias, total "+count(report.totals[metric])}>
                {buckets.map((bucket,i)=><div className="reach-bar-column" key={bucket.start}>
                  <span className="reach-bar-value">{bucket.value>0?count(bucket.value):""}</span>
                  <div className="reach-bar-track" title={
                    bucket.start===bucket.end?dayLabel(bucket.start)+": "+count(bucket.value):
                      dayLabel(bucket.start)+" – "+dayLabel(bucket.end)+": "+count(bucket.value)}>
                    <span className={bucket.value===0?"is-zero":""}
                      style={{height:maxBucket>0?(bucket.value/maxBucket*100)+"%":"0%"}}/>
                  </div>
                  <small>{(range===7||i===0||i===buckets.length-1||i%2===0)
                    ?bucket.label:""}</small>
                </div>)}
              </div>
              <p className="reach-analytics-note"><CircleHelp size={15}/>
                São indicadores aproximados, não visitantes únicos. Por navegador,
                o sistema tenta contar apenas uma ocorrência por músico e dia.
                Exibições não comprovam que alguém visualizou cada cartão na tela.
              </p>
            </section>

            <aside className="reach-aside">
              <section className="reach-opportunities">
                <span className="reach-small-kicker"><Guitar size={15}/> OPORTUNIDADES</span>
                <h2>Convites e respostas</h2>
                <p>Situação atual dos convites recebidos dentro do período selecionado.</p>
                <div className="reach-invites-total">
                  <strong>{count(totalInvitations)}</strong>
                  <span>convite(s) recebido(s)</span>
                </div>
                <div className="reach-invite-state">
                  <div><span><CheckCircle2 size={15}/> Aceitos</span>
                    <strong>{count(acceptances)}</strong></div>
                  <div><span><Clock3 size={15}/> Pendentes</span>
                    <strong>{count(report.invitation_status.pending)}</strong></div>
                  <div><span>Recusados</span>
                    <strong>{count(report.invitation_status.declined)}</strong></div>
                  <div><span>Cancelados</span>
                    <strong>{count(report.invitation_status.cancelled)}</strong></div>
                </div>
                <div className="reach-acceptance">
                  <div><span>Taxa de aceite</span>
                    <strong>{percent(acceptances,totalInvitations)}%</strong></div>
                  <div className="reach-acceptance-track"><span
                    style={{width:percent(acceptances,totalInvitations)+"%"}}/></div>
                </div>
                <Link className="reach-aside-action" href="/meus-convites">
                  Ver meus convites <ArrowRight size={16}/>
                </Link>
              </section>
              <section className="reach-marketplace-status">
                <span className="reach-small-kicker"><ShieldCheck size={15}/> MARKETPLACE</span>
                <h2>{report.marketplace_launched?"Seu perfil no catálogo":"Catálogo em pré-lançamento"}</h2>
                <div className="reach-status-row">
                  <span>Portfólio gratuito</span>
                  <strong className={report.portfolio_published?"is-yes":"is-no"}>
                    {report.portfolio_published?"Publicado":"Não publicado"}</strong>
                </div>
                <div className="reach-status-row">
                  <span>Participação no catálogo</span>
                  <strong className={report.listed_in_marketplace?"is-yes":"is-no"}>
                    {report.listed_in_marketplace?"Autorizada":"Não ativada"}</strong>
                </div>
                <p>{!report.marketplace_launched
                  ?"O catálogo público continua em “Em breve”. Exibições registradas agora vêm apenas de testes autorizados."
                  :"As exibições passam a ser registradas quando seus cartões aparecem nas buscas e nos destaques."}</p>
                <Link className="reach-portfolio-link" href="/perfil-artistico?aba=instrumentista">
                  Gerenciar meu portfólio <ArrowRight size={15}/>
                </Link>
                {report.portfolio_published&&report.slug&&
                  <Link className="reach-portfolio-link" target="_blank"
                    rel="noopener noreferrer"
                    href={"/musico/"+encodeURIComponent(report.slug)}>
                    Ver página pública <ExternalLink size={15}/>
                  </Link>}
              </section>
            </aside>
          </div>
          <section className="reach-footnote">
            <CalendarDays size={17}/>
            <div><strong>Sobre estes números</strong>
              <p>Visitas e exibições começam a ser registradas após a migração de desempenho e não são recuperadas retroativamente.
                Os convites usam dados já existentes. O relatório não rastreia valores de cachê, faturamento ou usuários individuais,
                e não depende de uma assinatura Premium.</p>
            </div>
          </section>
        </>}
    </div>
  </main>;
}
