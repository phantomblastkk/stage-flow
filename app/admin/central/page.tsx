"use client";

import {FormEvent,useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {
  Activity,ArrowDownToLine,ArrowLeft,ArrowRight,ArrowUpRight,
  BadgeCheck,Building2,CheckCircle2,ChevronLeft,ChevronRight,Clock3,
  ExternalLink,FileClock,Filter,LoaderCircle,LockKeyhole,Mic2,Crown,Gift,
  Music2,RefreshCw,Search,ShieldCheck,ShieldX,Sparkles,Trash2,Users2
} from "lucide-react";
import {createClient} from "@/lib/supabase/client";
import StageVerifiedBadge from "@/components/stage-verified-badge";
import DeleteAccountDialog from "./delete-account-dialog";
import "./central.css";

type Tab="overview"|"users"|"venues"|"history";
type Kind="singer"|"musician"|"venue";
type AuditKind=Kind|"account";
type ProAccess={id:string;manual_granted:boolean;paid_entitled:boolean;effective_entitled:boolean};
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
 id:number;action:"verification_granted"|"verification_revoked"|"venue_approved"|"venue_rejected"|"pro_access_granted"|"pro_access_revoked"|"account_deletion_requested"|"account_deleted"|"account_deletion_failed";
 kind:AuditKind;target_id:string;happened_at:string;actor_name:string|null;
};

const displayDate=(value:string)=>new Intl.DateTimeFormat("pt-BR",{
 dateStyle:"medium",timeStyle:"short",timeZone:"America/Sao_Paulo"
}).format(new Date(value));
const statusText:Record<string,string>={
 pending:"Aguardando",approved:"Aprovada",rejected:"Rejeitada"
};
const kindText:Record<AuditKind,string>={singer:"Cantor",musician:"Músico",venue:"Casa",account:"Conta"};
const actionText:Record<ActivityRow["action"],string>={
 verification_granted:"Concedeu verificação",verification_revoked:"Retirou verificação",
 venue_approved:"Aprovou casa",venue_rejected:"Rejeitou casa",
  pro_access_granted:"Concedeu cortesia Pro",pro_access_revoked:"Retirou cortesia Pro",
  account_deletion_requested:"Solicitou exclusão de conta",account_deleted:"Excluiu conta",
  account_deletion_failed:"Exclusão bloqueada ou não concluída"
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
 const [ownerId,setOwnerId]=useState("");
 const [selectedDelete,setSelectedDelete]=useState<Account|null>(null);
 const [fatal,setFatal]=useState("");
 const [tab,setTab]=useState<Tab>("overview");
 const [metrics,setMetrics]=useState<Metrics|null>(null);
 const [users,setUsers]=useState<Account[]>([]);
 const [proByUser,setProByUser]=useState<Record<string,ProAccess>>({});
 const [proReady,setProReady]=useState(false);
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
    if(sessionError){
     // A missing session should open the login form. A session that cannot
     // be validated due to a network error must not be mistaken for logout.
     const {data:{session}}=await db.auth.getSession();
     if(!active)return;
     if(session)throw sessionError;
    }
    if(!user){router.replace("/login?next=%2Fadmin%2Fcentral");return;}
    const {data,error}=await db.rpc("stage_owner_admin_status");
    if(!active)return;
    if(error)throw error;
    if(data===true){setAuthorized(true);setOwnerId(user.id);}
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
  setLoadingData(true);setProReady(false);setProByUser({});
  void(async()=>{
   const db=createClient();
   const {data,error}=await db.rpc("stage_owner_admin_users",{
    p_order:order,p_search:search,p_page:userPage
   });
   if(!active)return;
   if(error||!data||data.status!=="ok"){
    setFeedbackError(true);setFeedback("Não foi possível carregar os usuários.");
    setUsers([]);
   }else{
    const list=data as Response<Account>;
    const accounts=list.items||[];
    setUsers(accounts);setUserCount(list.total||0);
    if(accounts.length){
     const {data:proData,error:proError}=await db.rpc("stage_owner_admin_pro_snapshot",{
      p_ids:accounts.map(account=>account.id)
     });
     if(!active)return;
     if(proError||!proData||proData.status!=="ok"||!Array.isArray(proData.items)){
      setFeedbackError(true);
      setFeedback("Não foi possível consultar as permissões Pro. Atualize a lista antes de conceder ou retirar acessos.");
     }else{
      const statuses=proData.items as ProAccess[];
      setProByUser(Object.fromEntries(statuses.map(item=>[item.id,item])));
      setProReady(true);
     }
    }else{
     setProReady(true);
    }
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

 async function setProAccess(user:Account,status:ProAccess){
  if(busy||!proReady||!user.is_singer||(status.paid_entitled&&!status.manual_granted))return;
  const removing=status.manual_granted;
  const warning=removing
   ?"Retirar a cortesia Pro de "+user.name+"? As galerias, temas e publicação Pro deixarão de ficar disponíveis se a pessoa não tiver uma assinatura ativa. A assinatura paga, se existir, NÃO será cancelada."
   :"Conceder cortesia Pro gratuita a "+user.name+"? Isso libera os recursos Pro do perfil de cantor sem criar uma cobrança ou alterar o plano comercial.";
  if(!window.confirm(warning))return;
  setBusy("pro:"+user.id);setFeedback("");
  try{
   const {data,error}=await createClient().rpc("stage_owner_admin_set_pro_access",{
    p_target_id:user.id,p_enabled:!removing
   });
   if(error||!["saved","unchanged","subscription_active"].includes(String(data))){
    throw new Error(error?.message||
      (data==="forbidden"?"Apenas o proprietário pode alterar cortesias Pro.":
       data==="singer_required"?"O usuário precisa ter uma função ativa de cantor.":
        "Não foi possível alterar o acesso Pro."));
   }
   setFeedbackError(false);
   setFeedback(data==="unchanged"?"A permissão já estava atualizada.":
     data==="subscription_active"?"A conta possui uma assinatura Pro ativa; não é possível cancelar esse acesso por cortesia.":
     removing?"Cortesia Pro retirada. A assinatura paga, se houver, continua ativa.":
             "Cortesia Pro concedida! O cantor já pode habilitar os recursos Pro e decidir o que publicar.");
   reload();
  }catch(err){
   setFeedbackError(true);setFeedback(err instanceof Error?err.message:"Falha ao alterar cortesia Pro.");
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
  if(!users.length||!proReady)return;
  const header=["ID","Nome","Email","Username","Cadastro","Cantor","Músico","Produtor","Plano","Pro cortesia","Pro por assinatura","Pro ativo","Verificado cantor","Verificado músico"];
  const values=users.map(u=>[
   u.id,u.name,u.email,u.username,u.created_at,
   u.is_singer?"Sim":"Não",u.is_musician?"Sim":"Não",u.is_producer?"Sim":"Não",
   u.plan_code,proByUser[u.id]?.manual_granted?"Sim":"Não",proByUser[u.id]?.paid_entitled?"Sim":"Não",
   proByUser[u.id]?.effective_entitled?"Sim":"Não",u.singer_verified?"Sim":"Não",u.musician_verified?"Sim":"Não"
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
      <h1>{tab==="overview"?"Visão geral":tab==="users"?"Usuários e acessos Pro":tab==="venues"?"Casas e aprovações":"Histórico administrativo"}</h1>
      <p>{tab==="overview"?"Seus indicadores e ações do StageFlow, em um só lugar.":tab==="users"?"Pesquise contas, gerencie selos, cortesias Pro e exclusões com confirmação.":tab==="venues"?"Aprove casas, acompanhe solicitações e gerencie perfis oficiais.":"Registro de decisões, selos, cortesias Pro e aprovações."}</p>
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
        <button onClick={()=>setTab("users")} type="button"><Gift size={21}/><span><strong>Conceder ou retirar Pro</strong><small>Cortesias gratuitas por cantor, sem cobrança</small></span><ArrowUpRight size={17}/></button>
        <button onClick={()=>setTab("venues")} type="button"><Building2 size={21}/><span><strong>Aprovar solicitações</strong><small>Casas recebidas no StageFlow</small></span><ArrowUpRight size={17}/></button>
        <Link href="/admin/casas"><Sparkles size={21}/><span><strong>Editar casas oficiais</strong><small>Cadastro, responsáveis e conteúdo</small></span><ArrowUpRight size={17}/></Link>
        <button onClick={()=>setTab("history")} type="button"><FileClock size={21}/><span><strong>Histórico de decisões</strong><small>Selos e aprovações</small></span><ArrowUpRight size={17}/></button>
       </div>
      </section>
     </div>
     <div className="sf-admin-context">
      <ShieldCheck size={19}/>
      <p>Você pode conceder e retirar <strong>cortesia Pro</strong> para cantores na aba Usuários. O selo de verificação é independente do Pro. Cortesias não alteram o plano ou a assinatura paga, e toda mudança fica no histórico.</p>
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
      <button type="button" className="sf-admin-export" disabled={!users.length||!proReady} onClick={exportPage}>
       <ArrowDownToLine size={17}/> Exportar página CSV
      </button>
     </div>
     <div className="sf-admin-count"><span>{userCount.toLocaleString("pt-BR")} cadastros encontrados</span>
      <span>{verifiedUsers} com algum selo nesta página</span></div>
     <p className="sf-admin-pro-guidance"><Crown size={17}/> Cortesia Pro é um benefício manual e gratuito para cantores. Não modifica pagamentos ou plano contratado. Retirar a cortesia não cancela uma assinatura Pro ativa; a publicação Pro depende da decisão do cantor.</p>
     <div className="sf-admin-table-scroll">
      <table><thead><tr><th>Conta</th><th>Cadastro</th><th>Funções</th><th>Plano</th><th>Acesso Pro</th><th>Verificação StageFlow</th><th>Gerenciar</th></tr></thead>
       <tbody>{users.map(user=><tr key={user.id}>
        <td><strong>{user.name}</strong><small>{user.email||"Sem e-mail"}{user.username?" · @"+user.username:""}</small>
         {user.username&&user.is_public&&<Link href={"/"+encodeURIComponent(user.username)} target="_blank">Abrir perfil <ExternalLink size={12}/></Link>}
        </td>
        <td className="sf-admin-date">{displayDate(user.created_at)}</td>
        <td><div className="sf-admin-tags">{user.is_singer&&<span>Cantor</span>}{user.is_musician&&<span>Músico</span>}{user.is_producer&&<span>Produtor</span>}{!user.is_singer&&!user.is_musician&&!user.is_producer&&<span>Conta</span>}</div></td>
        <td><span className="sf-admin-plan" title="Plano comercial, não alterado por cortesias Pro">{user.plan_code||"free"}</span></td>
        <td><div className="sf-admin-pro-actions">
         {!user.is_singer?<span className="sf-admin-muted">Disponível para cantores</span>:
          !proReady?<span className="sf-admin-muted">Consultando acesso...</span>:
          proByUser[user.id]?<>
           <span className={"sf-admin-pro-label"+(proByUser[user.id].effective_entitled?" is-on":"")}>
            <Crown size={14}/>{proByUser[user.id].paid_entitled?"Pro por assinatura":
              proByUser[user.id].manual_granted?"Pro cortesia":"Pro não liberado"}
           </span>
           {proByUser[user.id].paid_entitled&&proByUser[user.id].manual_granted&&
            <small className="sf-admin-muted">Assinatura + cortesia</small>}
           {proByUser[user.id].paid_entitled&&!proByUser[user.id].manual_granted?
            <small className="sf-admin-muted">Assinatura ativa: não é possível retirar aqui</small>:
            <button type="button" className={proByUser[user.id].manual_granted?"remove":""}
             disabled={Boolean(busy)||!proReady}
             onClick={()=>void setProAccess(user,proByUser[user.id])}>
             <Gift size={15}/>{proByUser[user.id].manual_granted?"Retirar cortesia Pro":"Conceder Pro"}
            </button>}
          </>:<span className="sf-admin-muted">Indisponível. Atualize.</span>}
        </div></td>
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
        <td><div className="sf-admin-account-actions">
         {user.id===ownerId?<span className="sf-admin-muted">Conta proprietária protegida</span>:
          ["artist_plus","studio"].includes(user.plan_code)||proByUser[user.id]?.paid_entitled?
           <span className="sf-admin-muted">Revisar assinatura antes de excluir</span>:
           <button type="button" className="sf-admin-account-delete"
            disabled={Boolean(busy)||loadingData} onClick={()=>setSelectedDelete(user)}>
            <Trash2 size={15}/> Excluir conta
           </button>}
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
      <p className="sf-admin-pro-guidance"><Building2 size={18}/> Para a casa aparecer com sua logo na página inicial, ela precisa estar ativa, oficial e marcada como parceira. Abra o cadastro da casa, marque <strong>Casa parceira</strong> e envie o logotipo. <Link href="/admin/casas">Editar casas <ArrowUpRight size={14}/></Link></p>
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
        {venue.approval_status==="approved"&&(!venue.is_official||!venue.is_partner)&&<Link href="/admin/casas"><Building2 size={15}/> Configurar parceira</Link>}
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
       <span className="sf-admin-history-symbol">{item.action.startsWith("account_")?<Trash2 size={19}/>:item.action.includes("verification")?<BadgeCheck size={19}/>:item.action.startsWith("pro_access_")?<Crown size={19}/>:<Building2 size={19}/>}</span>
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

    {selectedDelete&&<DeleteAccountDialog key={selectedDelete.id} user={selectedDelete}
     onClose={()=>setSelectedDelete(null)} onDeleted={()=>{
      setSelectedDelete(null);
      setFeedbackError(false);
      setFeedback("Conta excluída. A lista de usuários e o histórico foram atualizados.");
      reload();
     }}/>}
    <footer className="sf-admin-footer">
     <span><ShieldCheck size={15}/> Administração StageFlow · apenas proprietário autorizado</span>
     <Link href="/painel">Voltar ao painel <ArrowUpRight size={15}/></Link>
    </footer>
   </div>
  </div>
 </main>;
}
