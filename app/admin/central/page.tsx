"use client";

import {FormEvent,useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {
  Activity,ArrowDownToLine,ArrowLeft,ArrowRight,ArrowUpRight,
  BadgeCheck,Building2,CheckCircle2,ChevronLeft,ChevronRight,Clock3,
  ExternalLink,FileClock,Filter,LoaderCircle,LockKeyhole,Mic2,
  Music2,RefreshCw,Search,ShieldCheck,ShieldX,Sparkles,Users2
} from "lucide-react";
import {createClient} from "@/lib/supabase/client";
import StageVerifiedBadge from "@/components/stage-verified-badge";
import "./central.css";

type Tab="overview"|"users"|"venues"|"history";
type Kind="singer"|"musician"|"venue";
type Response<T>={status:string;items?:T[];total?:number;page?:number;page_size?:number};
type Metrics={
 status:string;users_total:number;users_7d:number;users_30d:number;
 singers:number;musicians:number;hybrids:number;producers:number;
 venues_total:number;venues_pending:number;venues_approved:number;
 venues_rejected:number;verified_profiles:number;verified_venues:number;
};
type Account={
 id:string;name:string;email:string|null;username:string|null;created_at:string;
 is_singer:boolean;is_musician:boolean;is_producer:boolean;is_public:boolean;
 plan_code:string;singer_verified:boolean;musician_verified:boolean;
};
type Venue={
 id:string;name:string;city:string|null;state:string|null;approval_status:"pending"|"approved"|"rejected";
 active:boolean;is_official:boolean;is_partner:boolean;slug:string|null;created_at:string;
 submitted_by_name:string|null;submitted_by_email:string|null;verified:boolean;
};
type ActivityRow={
 id:number;action:"verification_granted"|"verification_revoked"|"venue_approved"|"venue_rejected";
 kind:Kind;target_id:string;happened_at:string;actor_name:string|null;
};

const displayDate=(value:string)=>new Intl.DateTimeFormat("pt-BR",{
 dateStyle:"medium",timeStyle:"short",timeZone:"America/Sao_Paulo"
}).format(new Date(value));
const statusText:Record<string,string>={
 pending:"Aguardando",approved:"Aprovada",rejected:"Rejeitada"
};
const kindText:Record<Kind,string>={singer:"Cantor",musician:"Músico",venue:"Casa"};
const actionText:Record<ActivityRow["action"],string>={
 verification_granted:"Concedeu verificação",verification_revoked:"Retirou verificação",
 venue_approved:"Aprovou casa",venue_rejected:"Rejeitou casa"
};

function escapeCsv(value:unknown){
 const raw=String(value??"");
 const safe=/^[=+@\-\t\r]/.test(raw)?"'"+raw:raw;
 return '"'+safe.replaceAll('"','""')+'"';
}

export default function CentralAdministrativa(){
 const router=useRouter();
 const [checking,setChecking]=useState(true);
 const [authorized,setAuthorized]=useState(false);
 const [fatal,setFatal]=useState("");
 const [tab,setTab]=useState<Tab>("overview");
 const [metrics,setMetrics]=useState<Metrics|null>(null);
 const [users,setUsers]=useState<Account[]>([]);
 const [userCount,setUserCount]=useState(0);
 const [userPage,setUserPage]=useState(0);
 const [order,setOrder]=useState<"oldest"|"newest">("oldest");
 const [typedSearch,setTypedSearch]=useState("");
 const [search,setSearch]=useState("");
 const [venues,setVenues]=useState<Venue[]>([]);
 const [venueCount,setVenueCount]=useState(0);
 const [venuePage,setVenuePage]=useState(0);
 const [venueFilter,setVenueFilter]=useState<"all"|"pending"|"approved"|"rejected">("all");
 const [history,setHistory]=useState<ActivityRow[]>([]);
 const [historyPage,setHistoryPage]=useState(0);
 const [busy,setBusy]=useState("");
 const [loadingData,setLoadingData]=useState(false);
 const [feedback,setFeedback]=useState("");
 const [feedbackError,setFeedbackError]=useState(false);
 const [revision,setRevision]=useState(0);

 useEffect(()=>{
  let active=true;
  void (async()=>{
   try{
    const db=createClient();
    const {data:{user},error:sessionError}=await db.auth.getUser();
    if(!active)return;
    if(sessionError)throw sessionError;
    if(!user){router.replace("/login?next=%2Fadmin%2Fcentral");return;}
    const {data,error}=await db.rpc("stage_owner_admin_status");
    if(!active)return;
    if(error)throw error;
    if(data===true)setAuthorized(true);
    else setFatal("Acesso indisponível para esta conta.");
   }catch{if(active)setFatal("Não foi possível verificar a autorização desta sessão.");}
   finally{if(active)setChecking(false);}
  })();
  return()=>{active=false;};
 },[router]);

 const reload=useCallback(()=>setRevision(v=>v+1),[]);
 useEffect(()=>{
  if(!authorized)return;
  let active=true;
  void (async()=>{
   try{
    const db=createClient();
    const {data,error}=await db.rpc("stage_owner_admin_metrics");
    if(!active)return;
    if(error||!data||data.status!=="ok")throw new Error("Sem permissão para os indicadores.");
    setMetrics(data as Metrics);
   }catch{if(active){setFeedbackError(true);setFeedback("Não foi possível atualizar os indicadores.");}}
  })();
  return()=>{active=false;};
 },[authorized,revision]);

 useEffect(()=>{
  if(!authorized)return;
  let active=true;
  setLoadingData(true);
  void(async()=>{
   const {data,error}=await createClient().rpc("stage_owner_admin_users",{
    p_order:order,p_search:search,p_page:userPage
   });
   if(!active)return;
   if(error||!data||data.status!=="ok"){
    setFeedbackError(true);setFeedback("Não foi possível carregar os usuários.");
    setUsers([]);
   }else{
    const list=data as Response<Account>;
    setUsers(list.items||[]);setUserCount(list.total||0);
   }
   setLoadingData(false);
  })();
  return()=>{active=false;};
 },[authorized,order,search,userPage,revision]);

 useEffect(()=>{
  if(!authorized)return;
  let active=true;
  void(async()=>{
   const {data,error}=await createClient().rpc("stage_owner_admin_venues",{
    p_status:venueFilter,p_page:venuePage
   });
   if(!active)return;
   if(error||!data||data.status!=="ok"){
    setFeedbackError(true);setFeedback("Não foi possível carregar as casas.");
    setVenues([]);
   }else{
    const list=data as Response<Venue>;
    setVenues(list.items||[]);setVenueCount(list.total||0);
   }
  })();
  return()=>{active=false;};
 },[authorized,venueFilter,venuePage,revision]);

 useEffect(()=>{
  if(!authorized)return;
  let active=true;
  void(async()=>{
   const {data,error}=await createClient().rpc("stage_owner_admin_history",{
    p_page:historyPage
   });
   if(!active)return;
   if(error||!data||data.status!=="ok")return;
   setHistory((data as Response<ActivityRow>).items||[]);
  })();
  return()=>{active=false;};
 },[authorized,historyPage,revision]);

 const verifiedUsers=useMemo(()=>users.filter(u=>u.singer_verified||u.musician_verified).length,[users]);

 async function setVerification(kind:Kind,id:string,current:boolean,name:string){
  if(busy)return;
  const verb=current?"retirar o selo de":"conceder o selo a";
  if(!window.confirm("Confirma "+verb+" "+name+"? Esta mudança aparecerá no perfil público."))return;
  const key=kind+":"+id;setBusy(key);setFeedback("");
  try{
   const {data,error}=await createClient().rpc("stage_owner_admin_set_verified",{
    p_kind:kind,p_target_id:id,p_verified:!current
   });
   if(error||!["saved","unchanged"].includes(String(data)))throw new Error(error?.message||
     (data==="not_approved"?"A casa precisa ser aprovada e oficial antes de receber um selo.":"Não foi possível alterar este selo."));
   setFeedbackError(false);
   setFeedback(data==="unchanged"?"O estado do selo já estava atualizado.":"Selo de "+kindText[kind]+" "+(!current?"concedido.":"removido."));
   reload();
  }catch(err){
   setFeedbackError(true);setFeedback(err instanceof Error?err.message:"Falha ao alterar verificação.");
  }finally{setBusy("");}
 }

 async function reviewVenue(venue:Venue,decision:"approved"|"rejected"){
  if(busy||venue.approval_status!=="pending")return;
  const verb=decision==="approved"?"APROVAR":"REJEITAR";
  if(!window.confirm(verb+" a casa "+venue.name+"? A decisão fica registrada no histórico administrativo."))return;
  setBusy("review:"+venue.id);setFeedback("");
  try{
   const {data,error}=await createClient().rpc("stage_owner_admin_review_venue",{
    p_venue_id:venue.id,p_decision:decision
   });
   if(error||data!==decision)throw new Error(error?.message||
    (data==="already_reviewed"?"Esta solicitação já foi analisada.":data==="forbidden"?"Falta a permissão de administrar casas.":"A decisão não pôde ser salva."));
   setFeedbackError(false);setFeedback(decision==="approved"?"Casa aprovada e perfil oficial disponibilizado.":"Solicitação rejeitada.");
   reload();
  }catch(err){
   setFeedbackError(true);setFeedback(err instanceof Error?err.message:"Falha ao analisar solicitação.");
  }finally{setBusy("");}
 }

 function exportPage(){
  if(!users.length)return;
  const header=["ID","Nome","Email","Username","Cadastro","Cantor","Músico","Produtor","Plano","Verificado cantor","Verificado músico"];
  const values=users.map(u=>[
   u.id,u.name,u.email,u.username,u.created_at,
   u.is_singer?"Sim":"Não",u.is_musician?"Sim":"Não",u.is_producer?"Sim":"Não",
   u.plan_code,u.singer_verified?"Sim":"Não",u.musician_verified?"Sim":"Não"
  ]);
  const csv="\uFEFF"+[header,...values].map(row=>row.map(escapeCsv).join(";")).join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  const link=document.createElement("a");
  link.href=url;link.download="stageflow-usuarios-pagina-"+(userPage+1)+".csv";link.click();
  URL.revokeObjectURL(url);
 }

 const userPages=Math.max(1,Math.ceil(userCount/30));
 const venuePages=Math.max(1,Math.ceil(venueCount/30));

 if(checking)return <main className="sf-admin-gate">
  <LoaderCircle size={22} className="sf-admin-spin"/>
  <span>Verificando acesso privado...</span>
 </main>;
 if(!authorized)return <main className="sf-admin-gate">
  <ShieldX size={34}/><h1>Página indisponível</h1>
  <p>{fatal||"Esta área não está disponível."}</p>
  <Link href="/" className="btn btn-quiet">Voltar ao StageFlow</Link>
 </main>;

 return <main className="sf-admin">
  <div className="sf-admin-shell">
   <aside className="sf-admin-rail">
    <Link href="/" className="sf-admin-brand"><span>SF<span>.</span></span><strong>STAGEFLOW</strong></Link>
    <div className="sf-admin-identity"><LockKeyhole size={15}/> ACESSO DO PROPRIETÁRIO</div>
    <nav aria-label="Seções da central administrativa" className="sf-admin-nav">
     {([
      ["overview","Visão geral",Activity],["users","Usuários",Users2],
      ["venues","Casas e aprovação",Building2],["history","Histórico",FileClock]
     ] as const).map(([value,label,Icon])=>
      <button key={value} type="button" onClick={()=>setTab(value)}
       className={tab===value?"active":""} aria-current={tab===value?"page":undefined}>
       <Icon size={18}/><span>{label}</span>{value==="venues"&&metrics?.venues_pending?
        <b>{metrics.venues_pending}</b>:null}
      </button>
     )}
    </nav>
    <div className="sf-admin-rail-bottom">
     <ShieldCheck size={17}/>
     <p>Dados privados e ações protegidos pelo Supabase. A URL não concede acesso.</p>
     <Link href="/painel"><ArrowLeft size={15}/> Meu painel</Link>
    </div>
   </aside>
   <div className="sf-admin-content">
    <header className="sf-admin-top">
     <div><span className="sf-admin-kicker"><Sparkles size={15}/> CENTRO DE CONTROLE</span>
      <h1>{tab==="overview"?"Visão geral":tab==="users"?"Usuários cadastrados":tab==="venues"?"Casas e aprovações":"Histórico administrativo"}</h1>
      <p>{tab==="overview"?"Seus indicadores e ações do StageFlow, em um só lugar.":tab==="users"?"Cadastros organizados por data, com verificação individual.":tab==="venues"?"Aprove casas, acompanhe solicitações e gerencie perfis oficiais.":"Registro de decisões e alterações de selos na plataforma."}</p>
     </div>
     <button type="button" className="sf-admin-refresh" onClick={reload}>
      <RefreshCw size={17}/> Atualizar
     </button>
    </header>
    {feedback&&<div className={"sf-admin-feedback"+(feedbackError?" error":"")} role={feedbackError?"alert":"status"}>
     {feedbackError?<ShieldX size={18}/>:<CheckCircle2 size={18}/>}
     <span>{feedback}</span><button type="button" onClick={()=>setFeedback("")} aria-label="Dispensar aviso">×</button>
    </div>}

    {tab==="overview"&&<>
     <section className="sf-admin-stats" aria-label="Indicadores gerais">
      {([
       ["Usuários cadastrados",metrics?.users_total,Users2],
       ["Novos em 7 dias",metrics?.users_7d,Activity],
       ["Novos em 30 dias",metrics?.users_30d,Clock3],
       ["Casas aguardando",metrics?.venues_pending,Building2],
       ["Cantores",metrics?.singers,Mic2],
       ["Músicos",metrics?.musicians,Music2],
       ["Contas híbridas",metrics?.hybrids,Users2],
       ["Selos atribuídos",(metrics?.verified_profiles??0)+(metrics?.verified_venues??0),BadgeCheck]
      ] as const).map(([title,value,Icon])=>
       <article className="sf-admin-stat" key={title}>
        <div><span>{title}</span><Icon size={20}/></div>
        <strong>{value===undefined?"—":value.toLocaleString("pt-BR")}</strong>
       </article>
      )}
     </section>
     <div className="sf-admin-overview-grid">
      <section className="sf-admin-panel">
       <div className="sf-admin-panel-heading"><div><span>FLUXO DE CASAS</span><h2>Solicitações pendentes</h2></div>
        <button onClick={()=>setTab("venues")} type="button">Ver todas <ArrowRight size={15}/></button></div>
       {venues.filter(v=>v.approval_status==="pending").slice(0,5).length?
        <div className="sf-admin-mini-list">
         {venues.filter(v=>v.approval_status==="pending").slice(0,5).map(v=>
          <div key={v.id}><span className="sf-admin-mini-icon"><Building2 size={19}/></span>
           <div><strong>{v.name}</strong><small>{[v.city,v.state].filter(Boolean).join(" · ")||"Local não informado"}</small></div>
           <button type="button" onClick={()=>setTab("venues")}>Analisar</button>
          </div>)}
        </div>:<p className="sf-admin-empty">Não há solicitações pendentes nesta página.</p>}
      </section>
      <section className="sf-admin-panel">
       <div className="sf-admin-panel-heading"><div><span>ACESSO RÁPIDO</span><h2>Ferramentas de gestão</h2></div></div>
       <div className="sf-admin-shortcuts">
        <button onClick={()=>setTab("users")} type="button"><Users2 size={21}/><span><strong>Ver todos os usuários</strong><small>Datas, funções e selos</small></span><ArrowUpRight size={17}/></button>
        <button onClick={()=>setTab("venues")} type="button"><Building2 size={21}/><span><strong>Aprovar solicitações</strong><small>Casas recebidas no StageFlow</small></span><ArrowUpRight size={17}/></button>
        <Link href="/admin/casas"><Sparkles size={21}/><span><strong>Editar casas oficiais</strong><small>Cadastro, responsáveis e conteúdo</small></span><ArrowUpRight size={17}/></Link>
        <button onClick={()=>setTab("history")} type="button"><FileClock size={21}/><span><strong>Histórico de decisões</strong><small>Selos e aprovações</small></span><ArrowUpRight size={17}/></button>
       </div>
      </section>
     </div>
     <div className="sf-admin-context">
      <ShieldCheck size={19}/>
      <p>Os perfis de cantor e músico podem receber selos independentes. Casas precisam ser aprovadas e oficiais antes de receber a verificação. <strong>O selo não altera planos, pagamentos ou direitos de acesso.</strong></p>
     </div>
    </>}

    {tab==="users"&&<section className="sf-admin-panel sf-admin-table-panel">
     <div className="sf-admin-controls">
      <form onSubmit={(e:FormEvent)=>{e.preventDefault();setUserPage(0);setSearch(typedSearch.trim());}} className="sf-admin-search">
       <Search size={18}/><input value={typedSearch} onChange={e=>setTypedSearch(e.target.value)}
        maxLength={80} placeholder="Pesquisar nome, @ ou e-mail" aria-label="Pesquisar contas"/>
       <button type="submit">Buscar</button>
      </form>
      <label className="sf-admin-select-label"><Filter size={16}/>
       <select value={order} onChange={e=>{setOrder(e.target.value as "oldest"|"newest");setUserPage(0);}}>
        <option value="oldest">Mais antigos primeiro</option>
        <option value="newest">Mais recentes primeiro</option>
       </select>
      </label>
      <button type="button" className="sf-admin-export" disabled={!users.length} onClick={exportPage}>
       <ArrowDownToLine size={17}/> Exportar página CSV
      </button>
     </div>
     <div className="sf-admin-count"><span>{userCount.toLocaleString("pt-BR")} cadastros encontrados</span>
      <span>{verifiedUsers} com algum selo nesta página</span></div>
     <div className="sf-admin-table-scroll">
      <table><thead><tr><th>Conta</th><th>Cadastro</th><th>Funções</th><th>Plano</th><th>Verificação StageFlow</th></tr></thead>
       <tbody>{users.map(user=><tr key={user.id}>
        <td><strong>{user.name}</strong><small>{user.email||"Sem e-mail"}{user.username?" · @"+user.username:""}</small>
         {user.username&&user.is_public&&<Link href={"/"+encodeURIComponent(user.username)} target="_blank">Abrir perfil <ExternalLink size={12}/></Link>}
        </td>
        <td className="sf-admin-date">{displayDate(user.created_at)}</td>
        <td><div className="sf-admin-tags">{user.is_singer&&<span>Cantor</span>}{user.is_musician&&<span>Músico</span>}{user.is_producer&&<span>Produtor</span>}{!user.is_singer&&!user.is_musician&&!user.is_producer&&<span>Conta</span>}</div></td>
        <td><span className="sf-admin-plan">{user.plan_code||"free"}</span></td>
        <td><div className="sf-admin-verification-actions">
         {user.is_singer&&<button type="button" disabled={Boolean(busy)}
          className={user.singer_verified?"on":""} onClick={()=>void setVerification("singer",user.id,user.singer_verified,user.name)}>
          <BadgeCheck size={15}/>{user.singer_verified?"Retirar selo cantor":"Verificar cantor"}
         </button>}
         {user.is_musician&&<button type="button" disabled={Boolean(busy)}
          className={user.musician_verified?"on":""} onClick={()=>void setVerification("musician",user.id,user.musician_verified,user.name)}>
          <BadgeCheck size={15}/>{user.musician_verified?"Retirar selo músico":"Verificar músico"}
         </button>}
         {!user.is_singer&&!user.is_musician&&<span className="sf-admin-muted">Sem perfil artístico</span>}
        </div></td>
       </tr>)}</tbody>
      </table>
     </div>
     {!loadingData&&!users.length&&<p className="sf-admin-empty">Nenhum cadastro corresponde à pesquisa.</p>}
     <div className="sf-admin-pagination">
      <span>Página {userPage+1} de {userPages} · {Math.min(userPage*30+1,Math.max(userCount,1))}–{Math.min((userPage+1)*30,userCount)} de {userCount}</span>
      <div><button type="button" disabled={userPage===0} onClick={()=>setUserPage(p=>p-1)}><ChevronLeft size={16}/> Anterior</button>
      <button type="button" disabled={userPage>=userPages-1} onClick={()=>setUserPage(p=>p+1)}>Próxima <ChevronRight size={16}/></button></div>
     </div>
    </section>}

    {tab==="venues"&&<section className="sf-admin-panel sf-admin-table-panel">
     <div className="sf-admin-panel-heading"><div><span>MODERAÇÃO</span><h2>Cadastro e aprovação de casas</h2></div>
      <Link href="/admin/casas" className="sf-admin-deep-link">Cadastro completo <ArrowUpRight size={16}/></Link>
     </div>
     <div className="sf-admin-filter-buttons" role="group" aria-label="Filtrar solicitações">
      {(["all","pending","approved","rejected"] as const).map(value=>
       <button type="button" key={value} className={venueFilter===value?"active":""}
        onClick={()=>{setVenueFilter(value);setVenuePage(0);}}>
        {value==="all"?"Todas":statusText[value]}
       </button>)}
     </div>
     <p className="sf-admin-count">{venueCount} casas encontradas. Aprovar cria o perfil oficial pelo fluxo já existente.</p>
     <div className="sf-admin-venue-list">
      {venues.map(venue=><article className="sf-admin-venue" key={venue.id}>
       <div className="sf-admin-venue-mark"><Building2 size={21}/></div>
       <div className="sf-admin-venue-details">
        <div className="sf-admin-venue-title"><strong>{venue.name}</strong>
         <span className={"sf-admin-status "+venue.approval_status}>{statusText[venue.approval_status]}</span>
         {venue.verified&&<StageVerifiedBadge compact/>}
        </div>
        <p>{[venue.city,venue.state].filter(Boolean).join(" · ")||"Local não informado"}
         {" · "} Enviada em {displayDate(venue.created_at)}</p>
        {(venue.submitted_by_name||venue.submitted_by_email)&&<small>Solicitada por: {venue.submitted_by_name||venue.submitted_by_email}</small>}
       </div>
       <div className="sf-admin-venue-actions">
        {venue.approval_status==="pending"&&<>
         <button disabled={Boolean(busy)} className="approve" type="button" onClick={()=>void reviewVenue(venue,"approved")}>
          <CheckCircle2 size={16}/> Aprovar
         </button>
         <button disabled={Boolean(busy)} className="reject" type="button" onClick={()=>void reviewVenue(venue,"rejected")}>
          <ShieldX size={16}/> Rejeitar
         </button>
        </>}
        {venue.approval_status==="approved"&&venue.is_official&&<>
         <button disabled={Boolean(busy)} className={venue.verified?"verified":""} type="button"
          onClick={()=>void setVerification("venue",venue.id,venue.verified,venue.name)}>
          <BadgeCheck size={16}/>{venue.verified?"Retirar selo":"Verificar casa"}
         </button>
         {venue.slug&&<Link href={"/casa/"+encodeURIComponent(venue.slug)} target="_blank">
          <ExternalLink size={16}/> Ver perfil
         </Link>}
        </>}
        <Link href="/admin/casas"><ArrowUpRight size={16}/> Editar cadastro</Link>
       </div>
      </article>)}
     </div>
     {!venues.length&&<p className="sf-admin-empty">Nenhuma casa neste filtro.</p>}
     <div className="sf-admin-pagination"><span>Página {venuePage+1} de {venuePages}</span><div>
      <button disabled={venuePage===0} onClick={()=>setVenuePage(p=>p-1)}><ChevronLeft size={16}/> Anterior</button>
      <button disabled={venuePage>=venuePages-1} onClick={()=>setVenuePage(p=>p+1)}>Próxima <ChevronRight size={16}/></button>
     </div></div>
    </section>}

    {tab==="history"&&<section className="sf-admin-panel sf-admin-table-panel">
     <div className="sf-admin-panel-heading"><div><span>AUDITORIA</span><h2>Últimas alterações</h2></div>
      <span className="sf-admin-muted">Somente leitura</span>
     </div>
     <div className="sf-admin-history">
      {history.map(item=><article key={item.id}>
       <span className="sf-admin-history-symbol">{item.action.includes("verification")?<BadgeCheck size={19}/>:<Building2 size={19}/>}</span>
       <div><strong>{actionText[item.action]}</strong><p>{kindText[item.kind]} · {item.target_id}</p>
        <small>Por {item.actor_name||"Administração"} · {displayDate(item.happened_at)}</small>
       </div>
      </article>)}
     </div>
     {!history.length&&<p className="sf-admin-empty">Nenhuma ação registrada.</p>}
     <div className="sf-admin-pagination"><span>Página {historyPage+1}</span><div>
      <button type="button" disabled={historyPage===0} onClick={()=>setHistoryPage(p=>p-1)}><ChevronLeft size={16}/> Anterior</button>
      <button type="button" disabled={history.length<30} onClick={()=>setHistoryPage(p=>p+1)}>Próxima <ChevronRight size={16}/></button>
     </div></div>
    </section>}

    <footer className="sf-admin-footer">
     <span><ShieldCheck size={15}/> Administração StageFlow · apenas proprietário autorizado</span>
     <Link href="/painel">Voltar ao painel <ArrowUpRight size={15}/></Link>
    </footer>
   </div>
  </div>
 </main>;
}
