"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCheck, CircleAlert, Clock3, History, LoaderCircle, Plus, RefreshCw, Send, ShieldCheck, Trash2, UserRound, UserRoundX, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./equipe-show.css";

type InviteStatus="pending"|"accepted"|"declined"|"cancelled";
type HistoryItem={musician_name:string|null;status:InviteStatus;assigned_at:string;released_at:string|null;reason:string|null};
type Slot={
 id:string;label:string;suggested_musician_id:string|null;suggested_musician_name:string|null;
 invitation_id:string|null;musician_id:string|null;musician_name:string|null;
 invitation_status:InviteStatus|null;history:HistoryItem[];
};
type ExistingInvite={id:string;musician_id:string;name:string|null;status:InviteStatus};
type Overview={
 status:string;event_title:string;event_starts_at:string;
 event_status:"draft"|"published"|"completed"|"cancelled";
 slots:Slot[];unassigned:ExistingInvite[];
};
type Candidate={musician_id:string;musician_name:string};
type Team={id:string;name:string;member_count:number};
const statusLabels:Record<InviteStatus,string>={
 pending:"Aguardando resposta",accepted:"Confirmado",declined:"Recusou",cancelled:"Cancelado"
};
const errors:Record<string,string>={
 login_required:"Faça login para continuar.",
 forbidden:"Você não pode gerenciar a formação deste show.",
 event_closed:"Este show já aconteceu ou foi encerrado. A formação está disponível apenas para consulta.",
 invalid:"Confira o instrumento, músico ou mensagem informados.",
 team_not_found:"Esta equipe não pertence à sua conta.",
 empty_team:"A formação selecionada ainda não tem integrantes.",
 lineup_full:"Limite de 40 vagas por apresentação.",
 active_assignment:"Esta vaga tem um convite pendente ou confirmado. Cancele-o explicitamente antes de substituir.",
 closed_invite:"Este músico já possui um convite recusado ou cancelado para este show. Não vamos reabri-lo automaticamente.",
 assigned_elsewhere:"Este convite já ocupa outra posição da formação.",
 not_previous_invitee:"Convide primeiro pelo fluxo tradicional ou inclua esse músico em uma equipe sua.",
 invalid_musician:"A conta selecionada não está habilitada como músico.",
 invalid_reason:"Escreva o motivo da saída (mínimo 5 e máximo 250 caracteres).",
 has_assignment:"Esta vaga possui um convite associado. Libere o convite antes.",
 has_history:"Esta vaga tem histórico de substituição e não pode ser apagada.",
 not_found:"Registro não encontrado.",
 empty:"Não há músico ativo nesta vaga."
};
const say=(v:string|undefined)=>errors[v||""]||"Não foi possível concluir. Atualize a página e tente novamente.";
const date=(v:string)=>new Date(v).toLocaleString("pt-BR",{dateStyle:"long",timeStyle:"short",timeZone:"America/Sao_Paulo"});
const statusKind=(slot:Slot):"open"|InviteStatus=>slot.invitation_status??"open";

export default function ShowLineupPage(){
 const router=useRouter();
 const [id,setId]=useState("");
 const [info,setInfo]=useState<Overview|null>(null);
 const [teams,setTeams]=useState<Team[]>([]);
 const [candidates,setCandidates]=useState<Candidate[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const [label,setLabel]=useState("");
 const [teamId,setTeamId]=useState("");
 const [picks,setPicks]=useState<Record<string,string>>({});
 const [messages,setMessages]=useState<Record<string,string>>({});
 const [reasons,setReasons]=useState<Record<string,string>>({});
 const [expanded,setExpanded]=useState<string|null>(null);
 const [sequence,setSequence]=useState(0);

 const refresh=useCallback(async(eventId:string)=>{
  const db=createClient();
  const [overview,teamList,candidateList]=await Promise.all([
   db.rpc("stage_show_lineup_overview",{p_event_id:eventId}),
   db.rpc("stage_my_teams"),db.rpc("stage_team_candidates")
  ]);
  if(overview.error)throw overview.error;
  if(overview.data?.status!=="ok")throw Error(say(overview.data?.status));
  if(teamList.error)throw teamList.error;
  if(candidateList.error)throw candidateList.error;
  setInfo(overview.data as Overview);
  const teamRows=(teamList.data??[]) as Team[];
  setTeams(teamRows);
  setTeamId(curr=>curr&&teamRows.some(t=>t.id===curr)?curr:teamRows[0]?.id||"");
  setCandidates((candidateList.data??[]) as Candidate[]);
 },[]);
 useEffect(()=>{const eventId=new URLSearchParams(window.location.search).get("evento")||"";
  if(!/^[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(eventId)){
   setError("Selecione primeiro um show válido na agenda.");setLoading(false);return;
  }
  setId(eventId);let alive=true;
  async function load(){
   const {data:{user}}=await createClient().auth.getUser();
   if(!user){router.replace("/login");return;}
   try{await refresh(eventId);}catch(err){if(alive)setError(err instanceof Error?err.message:"Não foi possível carregar a formação.");}
   finally{if(alive)setLoading(false);}
  }
  void load();return()=>{alive=false};
 },[refresh,router]);
 const slots=info?.slots??[];
 const unassigned=info?.unassigned??[];
 const tally=useMemo(()=>{
  const joined=[...slots.map(s=>statusKind(s)),...unassigned.map(x=>x.status)];
  return {
   confirmed:joined.filter(x=>x==="accepted").length,
   pending:joined.filter(x=>x==="pending").length,
   declined:joined.filter(x=>x==="declined").length,
   open:joined.filter(x=>x==="open"||x==="cancelled").length
  };
 },[slots,unassigned]);
 const closed=!info||info.event_status==="cancelled"||info.event_status==="completed"||
   new Date(info.event_starts_at).getTime()<=Date.now();
 async function run(task:()=>PromiseLike<{data:any;error:any}>,done:(data:any)=>string){
  if(busy||!id)return;
  setBusy(true);setError("");setNotice("");
  try{
   const {data,error:rpcError}=await task();
   if(rpcError)throw rpcError;
   const status=typeof data==="string"?data:data?.status;
   if(status!=="ok"&&status!=="released"&&status!=="removed")throw Error(say(status));
   await refresh(id);
   setNotice(done(data));
  }catch(err){setError(err instanceof Error?err.message:"Falha ao salvar.");}
  finally{setBusy(false);}
 }
 function importTeam(){
  if(!teamId||closed||busy)return;
  if(!window.confirm("Copiar as posições da equipe para este show? Isto NÃO envia convites."))return;
  void run(()=>createClient().rpc("stage_show_lineup_import_team",{p_event_id:id,p_team_id:teamId}),
   d=>Number(d.created||0)+" vaga(s) adicionada(s). Nenhum convite foi enviado.");
 }
 function add(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(closed||!label.trim())return;
  void run(()=>createClient().rpc("stage_show_lineup_add_slot",{p_event_id:id,p_label:label.trim()}),
   ()=>{setLabel("");return "Nova posição adicionada.";});
 }
 function invite(slot:Slot){
  if(closed||busy)return;
  const musician=picks[slot.id]||slot.suggested_musician_id||"";
  const candidate=candidates.find(x=>x.musician_id===musician);
  if(!musician||!candidate){setError("Escolha um músico da sua lista de contatos profissionais.");return;}
  if(!window.confirm("Convidar "+candidate.musician_name+" para "+slot.label+"?"+
    "\n\nO convite será individual e ficará aguardando resposta. Nenhum WhatsApp será enviado automaticamente."))return;
  void run(()=>createClient().rpc("stage_show_lineup_invite",{
   p_slot_id:slot.id,p_musician_id:musician,p_message:messages[slot.id]?.trim()||null
  }),d=>d.new_invitation?"Convite enviado no Stage Flow. Aguardando resposta do músico.":
   "Convite existente vinculado à posição, sem duplicar solicitações.");
 }
 function release(slot:Slot){
  if(closed||busy||!slot.invitation_id)return;
  const why=(reasons[slot.id]||"").trim();
  if(why.length<5||why.length>250){setError("Informe o motivo da saída, entre 5 e 250 caracteres.");return;}
  if(!window.confirm("ATENÇÃO: esta ação CANCELARÁ o convite/participação de "+
    (slot.musician_name||"este músico")+" neste show, inclusive se ele já aceitou."+
    "\n\nIsso será registrado no histórico. Confirme diretamente com o músico, pois não haverá aviso WhatsApp automático. Deseja continuar?"))return;
  void run(()=>createClient().rpc("stage_show_lineup_release",{
    p_slot_id:slot.id,p_reason:why
  }),()=>{setReasons(o=>({...o,[slot.id]:""}));return "Participação cancelada e liberada. A vaga está pronta para convidar outra pessoa.";});
 }
 function remove(slot:Slot){
  if(closed||busy||!window.confirm("Excluir a vaga "+slot.label+"?"))return;
  void run(()=>createClient().rpc("stage_show_lineup_remove_slot",{p_slot_id:slot.id}),
   ()=> "Vaga removida.");
 }
 return <main className="lineup-page"><div className="container">
  <nav className="nav"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
   <Link className="btn btn-quiet" href="/eventos"><ArrowLeft size={16}/> Agenda</Link></nav>
  <header className="lineup-hero">
   <span className="eyebrow"><ShieldCheck size={14}/> GESTÃO PRIVADA POR SHOW</span>
   <h1>Formação do <span className="accent">show.</span></h1>
   <p>Convites, confirmações, vagas abertas e substituições em um só lugar. O cachê continua individual no financeiro.</p>
   {info&&<div className="lineup-context"><h2>{info.event_title}</h2><p><CalendarDays size={15}/> {date(info.event_starts_at)} · {info.event_status==="draft"?"Rascunho privado":info.event_status==="published"?"Publicado":info.event_status==="completed"?"Concluído":"Cancelado"}</p></div>}
  </header>
  {error&&<p className="lineup-feedback error" role="alert">{error}</p>}
  {notice&&<p className="lineup-feedback" role="status">{notice}</p>}
  {loading?<p className="lineup-loading"><LoaderCircle size={18}/> Carregando equipe...</p>:info&&<>
   <div className="lineup-stats">
    {[
     ["Confirmados",tally.confirmed,"confirmed"],
     ["Aguardando resposta",tally.pending,"pending"],
     ["Vagas livres / canceladas",tally.open,"open"],
     ["Recusados",tally.declined,"declined"]
    ].map(([name,total,kind])=><div key={name} className={"lineup-stat "+kind}><strong>{total}</strong><span>{name}</span></div>)}
   </div>
   {closed&&<p className="lineup-callout"><CircleAlert size={17}/> Este show já passou ou está encerrado. Os registros permanecem disponíveis, mas não é possível enviar ou cancelar novos convites.</p>}
   <div className="lineup-layout">
    <section className="lineup-section lineup-setup">
     <h2><Users size={19}/> Montar a formação</h2>
     <p>Copie posições de uma banda salva ou crie vagas separadas. Importar uma equipe não convida ninguém.</p>
     <div className="lineup-team-import">
      <label>Formação salva
       <select value={teamId} onChange={e=>setTeamId(e.target.value)} disabled={busy||closed}>
        {teams.length===0&&<option value="">Nenhuma formação salva</option>}
        {teams.map(t=><option key={t.id} value={t.id}>{t.name} · {t.member_count} integrantes</option>)}
       </select>
      </label>
      <button type="button" className="btn btn-quiet" onClick={importTeam}
       disabled={busy||closed||!teamId}><Users size={15}/> Importar vagas</button>
     </div>
     <Link href={"/equipes?evento="+encodeURIComponent(id)} className="lineup-secondary-link">Editar formações salvas</Link>
     <form onSubmit={add} className="lineup-add">
      <label>Adicionar uma posição
       <input value={label} onChange={e=>setLabel(e.target.value)}
        maxLength={80} minLength={2} required disabled={busy||closed}
        placeholder="Ex.: Bateria, baixo, backing vocal..."/>
      </label>
      <button className="btn btn-primary" disabled={busy||closed||label.trim().length<2} type="submit"><Plus size={15}/> Adicionar vaga</button>
     </form>
     <p className="lineup-footnote">Você também pode <Link href={"/convites?evento="+encodeURIComponent(id)}>consultar todos os convites do show</Link>, inclusive os enviados fora deste painel.</p>
    </section>
    <section className="lineup-section">
     <div className="lineup-heading"><h2><CheckCheck size={19}/> Escala de músicos</h2>
      <button className="btn btn-quiet" disabled={busy} onClick={()=>void refresh(id)} type="button"><RefreshCw size={14}/> Atualizar</button>
     </div>
     {slots.length===0?<div className="lineup-empty"><Users size={26}/>
       <p>Nenhuma posição cadastrada. Comece importando uma equipe ou adicionando uma vaga.</p></div>:
      <div className="lineup-slots">{slots.map(slot=><article className="lineup-slot" key={slot.id}>
       <div className="lineup-slot-head">
        <div><strong>{slot.label}</strong>{slot.suggested_musician_name&&
         <small>Formação original: {slot.suggested_musician_name}</small>}</div>
        <span className={"lineup-tag "+statusKind(slot)}>{slot.invitation_status?
          statusLabels[slot.invitation_status]:"Vaga sem confirmação"}</span>
       </div>
       {slot.invitation_id&&<div className="lineup-member">
        <UserRound size={17}/> {slot.musician_name||"Músico convidado"}
       </div>}
       {!closed&&(!slot.invitation_id||slot.invitation_status==="declined"||slot.invitation_status==="cancelled")&&
        <div className="lineup-invite">
         <label>Escolher músico
          <select value={picks[slot.id]??(slot.suggested_musician_id&&candidates.some(c=>c.musician_id===slot.suggested_musician_id)?slot.suggested_musician_id:"")}
           disabled={busy} onChange={e=>setPicks(x=>({...x,[slot.id]:e.target.value}))}>
           <option value="">Selecione um contato profissional</option>
           {candidates.map(c=><option key={c.musician_id} value={c.musician_id}>{c.musician_name}</option>)}
          </select>
         </label>
         <label>Mensagem do convite (opcional)
          <input value={messages[slot.id]||""} disabled={busy} maxLength={500}
           placeholder="Ex.: consegue tocar sábado?"
           onChange={e=>setMessages(x=>({...x,[slot.id]:e.target.value}))}/>
         </label>
         <button className="btn btn-primary" disabled={busy||candidates.length===0}
          type="button" onClick={()=>invite(slot)}><Send size={14}/> Convidar músico</button>
        </div>}
       {!closed&&slot.invitation_id&&
        <div className="lineup-release">
         <button className="lineup-expander" aria-expanded={expanded===slot.id} type="button"
          onClick={()=>setExpanded(v=>v===slot.id?null:slot.id)}>
          <UserRoundX size={15}/> Liberar vaga / substituir músico
         </button>
         {expanded===slot.id&&<>
          <p>Esta ação cancela a participação atual no Stage Flow, inclusive quando já confirmada. Combine a mudança diretamente com o músico.</p>
          <label>Motivo da substituição
           <textarea maxLength={250} rows={2} value={reasons[slot.id]||""}
            onChange={e=>setReasons(o=>({...o,[slot.id]:e.target.value}))}
            placeholder="Ex.: músico não poderá comparecer" />
          </label>
          <button type="button" className="btn btn-quiet" disabled={busy||!reasons[slot.id]||reasons[slot.id].trim().length<5}
           onClick={()=>release(slot)}>Cancelar participação e abrir vaga</button>
         </>}
        </div>}
       {slot.history?.length>0&&<details className="lineup-history">
        <summary><History size={14}/> Histórico ({slot.history.length})</summary>
        {slot.history.map((h,i)=><div className="lineup-history-record" key={i}>
          <strong>{h.musician_name||"Músico"}</strong><small>{date(h.assigned_at)}</small>
          {h.released_at&&<small>Saída registrada em {date(h.released_at)}{h.reason?" · "+h.reason:""}</small>}
        </div>)}
       </details>}
       {!closed&&!slot.invitation_id&&!(slot.history?.length)&&<button type="button"
        className="lineup-remove" disabled={busy} onClick={()=>remove(slot)}>
        <Trash2 size={14}/> Remover vaga vazia
       </button>}
      </article>)}</div>}
     {unassigned.length>0&&<div className="lineup-outside">
      <h3>Convites fora da escala</h3>
      <p>Estes convites foram feitos por outros caminhos. Eles contam nas confirmações, mas ainda não estão vinculados a uma vaga.</p>
      {unassigned.map(i=><div key={i.id} className="lineup-external"><span>{i.name||"Músico convidado"}</span>
       <small>{statusLabels[i.status]}</small></div>)}
     </div>}
    </section>
   </div>
   <p className="lineup-disclaimer">Acompanhamento de formação e convites. Substituições são registradas apenas no Stage Flow: não há disparo automático por WhatsApp, transferência financeira ou alteração retroativa de pagamentos.</p>
  </>}
 </div></main>;
}
