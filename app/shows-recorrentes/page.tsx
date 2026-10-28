"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CalendarDays, CalendarPlus2, ChevronDown, ChevronUp,
  CircleAlert, Clock3, LoaderCircle, PauseCircle,
  PlayCircle, RefreshCw, Repeat2, Send, Users
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, EmptyState, InlineNotice, Input, LoadingState, Select, StatusChip, Textarea } from "@/src/components/ui";
import "./shows-recorrentes.css";

type Team={id:string;name:string;member_count:number};
type Occurrence={
 event_id:string;day:string;title:string;starts_at:string;
 status:"draft"|"published"|"cancelled"|"completed";
 invites_sent:number;
};
type Series={
 id:string;title:string;description:string|null;venue:string|null;city:string|null;
 weekday:number;starts_on:string;ends_on:string;local_start:string;
 duration_minutes:number;team_id:string|null;team_name:string|null;
 team_members:number;active:boolean;occurrences:Occurrence[];
};
const weekdays=["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"];
const showDay=(s:string)=>new Date(s+"T12:00:00Z")
  .toLocaleDateString("pt-BR",{timeZone:"UTC",dateStyle:"medium"});
const showWhen=(s:string)=>new Date(s).toLocaleString("pt-BR",{
  timeZone:"America/Sao_Paulo",dateStyle:"medium",timeStyle:"short"
});
function dayKey(d:Date){
  return new Intl.DateTimeFormat("sv-SE",{timeZone:"America/Sao_Paulo",
   year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
}
function inDays(base:string,count:number){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(base))return "";
 const d=new Date(base+"T12:00:00Z");
 d.setUTCDate(d.getUTCDate()+count);
 return d.toISOString().slice(0,10);
}
function isoWeekday(s:string){const d=new Date(s+"T12:00:00Z").getUTCDay();return d===0?7:d;}
const statuses:Record<Occurrence["status"],string>={
 draft:"Rascunho",published:"Publicado",cancelled:"Cancelado",completed:"Concluído"
};
const descriptions:Record<string,string>={
 invalid:"Revise datas, dia da semana, horário e duração. O período máximo é de 180 dias.",
 duplicate:"Já existe uma programação semanal com esse nome, dia e horário inicial.",
 team_not_found:"Esta formação não pertence à sua conta.",
 limit_reached:"Limite de programações ou ocorrências atingido.",
 not_found:"A programação não foi encontrada na sua conta.",
 paused:"Reative esta programação para gerar novas datas.",
 login_required:"Entre na sua conta para continuar.",
 forbidden:"Sua conta não tem permissão para essa ação."
};
function reason(code?:string){return descriptions[code||""]||"Não foi possível concluir esta operação.";}

export default function RecurringShowsPage(){
 const router=useRouter();
 const today=dayKey(new Date());
 const [teams,setTeams]=useState<Team[]>([]);
 const [series,setSeries]=useState<Series[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [title,setTitle]=useState("");
 const [description,setDescription]=useState("");
 const [venue,setVenue]=useState("");
 const [city,setCity]=useState("");
 const [weekday,setWeekday]=useState(isoWeekday(today));
 const [startsOn,setStartsOn]=useState(today);
 const [endsOn,setEndsOn]=useState(()=>inDays(today,56));
 const [startTime,setStartTime]=useState("18:00");
 const [duration,setDuration]=useState("240");
 const [teamId,setTeamId]=useState("");
 const [expanded,setExpanded]=useState<string|null>(null);

 const load=useCallback(async()=>{
  const db=createClient();
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError||!user){router.replace("/login");return;}
  const [s,t]=await Promise.all([
    db.rpc("stage_recurring_show_list"),db.rpc("stage_my_teams")
  ]);
  if(s.error)throw s.error;
  if(t.error)throw t.error;
  if(!Array.isArray(s.data)||!Array.isArray(t.data))
    throw Error("O banco retornou um resultado inesperado.");
  setSeries(s.data as Series[]);
  setTeams(t.data as Team[]);
 },[router]);
 useEffect(()=>{let mounted=true;
  void load().catch(e=>{if(mounted)setError(e instanceof Error?e.message:"Não foi possível carregar a programação.");})
    .finally(()=>{if(mounted)setLoading(false)});
  return()=>{mounted=false};
 },[load]);

 async function refreshList(){
  setLoading(true);setError("");
  try{await load();}
  catch(err){setError(err instanceof Error?err.message:"Não foi possível atualizar a programação.");}
  finally{setLoading(false);}
 }
 async function create(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;
  setError("");setNotice("");setBusy("create");
  try{
   const {data,error:rpcError}=await createClient().rpc("stage_recurring_show_create",{
    p_title:title.trim(),p_description:description.trim()||null,
    p_venue:venue.trim()||null,p_city:city.trim()||null,
    p_team_id:teamId||null,p_weekday:weekday,
    p_starts_on:startsOn,p_ends_on:endsOn,
    p_start_time:startTime,p_duration:Number(duration)
   });
   if(rpcError)throw rpcError;
   if(data?.status!=="created")throw Error(reason(data?.status));
   setTitle("");setDescription("");setVenue("");setCity("");
   setNotice("Programação cadastrada: "+Number(data.created||0)+" show(s) criado(s) como rascunho. "+
    (Number(data.skipped_conflicts||0)>0?"Algumas datas coincidiram com eventos existentes e foram ignoradas. ":"")+
    "Nenhum músico foi convidado automaticamente.");
   await load();setExpanded(data.series_id);
  }catch(err){setError(err instanceof Error?err.message:"Erro ao cadastrar.");}
  finally{setBusy(null);}
 }
 async function generate(item:Series){
  if(busy)return;setBusy("generate:"+item.id);setError("");setNotice("");
  try{
   const {data,error:rpcError}=await createClient().rpc("stage_recurring_show_generate",{
    p_series_id:item.id
   });
   if(rpcError)throw rpcError;
   if(data?.status!=="ok")throw Error(reason(data?.status));
   await load();setExpanded(item.id);
   setNotice(Number(data.created||0)>0?
     Number(data.created)+" novas datas foram incluídas na agenda como rascunhos. Nenhum convite foi enviado.":
     "Não há novas datas disponíveis neste período. "+
       (Number(data.skipped_conflicts||0)>0?"Algumas já possuem show no mesmo horário.":""));
  }catch(err){setError(err instanceof Error?err.message:"Não foi possível gerar as datas.");}
  finally{setBusy(null);}
 }
 async function pause(item:Series){
  if(busy)return;
  if(!window.confirm(item.active?
   "Pausar esta programação? Shows e convites já criados serão mantidos. Apenas a geração de novas datas será interrompida.":
   "Reativar esta programação para permitir gerar novas datas?"))return;
  setBusy("toggle:"+item.id);setError("");setNotice("");
  try{
   const {data,error:rpcError}=await createClient().rpc("stage_recurring_show_pause",{
    p_id:item.id,p_active:!item.active
   });
   if(rpcError||data!=="saved")throw Error(reason(String(data)));
   await load();setNotice(item.active?"Programação pausada. Shows existentes foram preservados.":"Programação reativada.");
  }catch(err){setError(err instanceof Error?err.message:"Não foi possível alterar o status.");}
  finally{setBusy(null);}
 }
 async function invite(item:Series,event:Occurrence){
  if(!item.team_id||!item.team_members||busy)return;
  if(!window.confirm("Enviar convites individuais aos "+item.team_members+" integrante(s) de “"+
    item.team_name+"” para o show de "+showDay(event.day)+"?\n\n"+
    "Cada músico poderá aceitar ou recusar. Nenhum WhatsApp será enviado automaticamente."))return;
  setBusy("invite:"+event.event_id);setError("");setNotice("");
  try{
   const {data,error:rpcError}=await createClient().rpc("stage_invite_team_to_event",{
     p_team_id:item.team_id,p_event_id:event.event_id,p_message:
      "Convite para a programação semanal: "+item.title+". Confirme disponibilidade e cachê individualmente."
   });
   if(rpcError)throw rpcError;
   if(data?.status!=="sent")throw Error(reason(data?.status));
   await load();setExpanded(item.id);
   setNotice(Number(data.created||0)+" novo(s) convite(s) individual(is) registrado(s). "+
     Number(data.existing||0)+" integrante(s) já tinham convite para essa data.");
  }catch(err){setError(err instanceof Error?err.message:"Falha ao convidar.");}
  finally{setBusy(null);}
 }

 return <main className="recurring-page"><div className="container">
   <nav className="nav">
    <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
    <Link className="sf-ui-button sf-ui-button-ghost" href="/painel"><ArrowLeft size={15}/> Meu painel</Link>
   </nav>
   <header className="recurring-hero">
    <span className="eyebrow"><Repeat2 size={15}/> ORGANIZAÇÃO SEMANAL DE SHOWS</span>
    <h1>Shows <span className="accent">recorrentes.</span></h1>
    <p>Cadastre uma programação fixa uma única vez. O Stage Flow prepara as datas na agenda, permite reaproveitar sua equipe e mantém os convites individuais sob seu controle.</p>
    <div className="recurring-hero-actions">
     <Link href="/eventos" className="sf-ui-button sf-ui-button-ghost"><CalendarDays size={16}/> Minha agenda</Link>
     <Link href="/equipes" className="sf-ui-button sf-ui-button-ghost"><Users size={16}/> Minhas equipes</Link>
    </div>
   </header>
   {error&&<div className="recurring-feedback"><InlineNotice tone="danger">{error}</InlineNotice></div>}
   {notice&&<div className="recurring-feedback"><InlineNotice tone="success">{notice}</InlineNotice></div>}
   <div className="recurring-layout">
    <section className="recurring-create">
     <h2><CalendarPlus2 size={19}/> Nova programação semanal</h2>
     <p>As oito primeiras datas são geradas como <strong>rascunhos privados</strong>. Você escolhe quando publicar ou convidar a equipe.</p>
     <form onSubmit={e=>void create(e)}>
      <Input label="Nome do show *" value={title} onChange={e=>setTitle(e.target.value)} minLength={3} maxLength={140}
        placeholder="Ex.: Pagode de toda sexta" required/>
      <div className="recurring-pair">
       <Select label="Dia da semana" value={weekday} onChange={e=>setWeekday(Number(e.target.value))}>
         {weekdays.map((w,i)=><option key={w} value={i+1}>{w}</option>)}
        </Select>
       <Input label="Horário do show" type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} required/>
      </div>
      <div className="recurring-pair">
       <Input label="Início do período" type="date" min={today} value={startsOn}
         onChange={e=>{setStartsOn(e.target.value);if(endsOn<e.target.value)setEndsOn(inDays(e.target.value,56));}} required/>
       <Input label="Última data da temporada" type="date" min={startsOn} max={inDays(startsOn,180)}
         value={endsOn} onChange={e=>setEndsOn(e.target.value)} required/>
      </div>
      <div className="recurring-pair">
       <Input label="Local do show" value={venue} onChange={e=>setVenue(e.target.value)}
         maxLength={140} placeholder="Casa de show ou bar"/>
       <Input label="Cidade" value={city} onChange={e=>setCity(e.target.value)}
         maxLength={100} placeholder="São Paulo"/>
      </div>
      <div className="recurring-pair">
       <Select label="Duração prevista" value={duration} onChange={e=>setDuration(e.target.value)}>
         <option value="120">2 horas</option>
         <option value="180">3 horas</option>
         <option value="240">4 horas</option>
         <option value="300">5 horas</option>
         <option value="360">6 horas</option>
         <option value="480">8 horas</option>
        </Select>
       <Select label="Equipe fixa (opcional)" value={teamId} onChange={e=>setTeamId(e.target.value)}>
         <option value="">Definir equipe depois</option>
         {teams.map(t=><option key={t.id} value={t.id}>{t.name} ({t.member_count})</option>)}
        </Select>
      </div>
      <Textarea label="Observações do show (opcional)" value={description} maxLength={500} rows={2}
        onChange={e=>setDescription(e.target.value)}
        placeholder="Ex.: abertura da casa, equipamento e outras informações"/>
      <Button type="submit" disabled={!!busy||loading}>
       {busy==="create"?<LoaderCircle size={16}/>:<CalendarPlus2 size={16}/>}
       Criar e gerar primeiras datas
      </Button>
      <p className="recurring-hint">Até 180 dias por temporada. Novas datas podem ser geradas em lotes de 8, até 52 por série. Shows antigos não são sobrescritos.</p>
     </form>
    </section>
    <section className="recurring-list">
     <div className="recurring-heading">
      <h2>Minhas programações</h2>
      <Button variant="ghost" type="button" disabled={!!busy||loading}
       onClick={()=>void refreshList()}><RefreshCw size={15}/> Atualizar</Button>
     </div>
     {loading?<LoadingState label="Carregando programações..."/>:
       series.length===0?(error?
        <EmptyState title="Programação indisponível" description="Atualize os dados para consultar suas temporadas." action={<Button onClick={()=>void refreshList()}>Tentar novamente</Button>}/>:
        <EmptyState icon={<Repeat2 size={32}/>} title="Sem programação recorrente ainda" description="Crie sua primeira agenda semanal no formulário ao lado."/>):
       <div className="recurring-cards">
        {series.map(s=><article className="recurring-card" aria-label={"Programação " + s.title} key={s.id}>
         <div className="recurring-card-top">
          <div><StatusChip label={s.active?"Ativa":"Pausada"} status={s.active?"success":"warning"}/><h3>{s.title}</h3></div>
          <Button variant="ghost" type="button" disabled={!!busy} className="recurring-toggle" aria-label={(s.active?"Pausar programação ":"Reativar programação ")+s.title} title={s.active?"Pausar":"Reativar"}
           onClick={()=>void pause(s)}>{s.active?<PauseCircle size={20}/>:<PlayCircle size={20}/>}</Button>
         </div>
         <p><Clock3 size={15}/> Toda {weekdays[s.weekday-1]?.toLowerCase()}, às {s.local_start} · {s.duration_minutes/60}h previstas</p>
         <p><CalendarDays size={15}/> {showDay(s.starts_on)} até {showDay(s.ends_on)}</p>
         <p><Users size={15}/> {s.team_name?
           s.team_name+" · "+s.team_members+" músico(s)":"Sem equipe definida"}</p>
         <div className="recurring-card-actions">
          <Button type="button" disabled={!!busy||!s.active}
           onClick={()=>void generate(s)}><CalendarPlus2 size={15}/> Gerar próximas 8</Button>
          <Button variant="ghost" type="button" disabled={!!busy}
           aria-expanded={expanded===s.id}
           onClick={()=>setExpanded(v=>v===s.id?null:s.id)}>
           {s.occurrences.length} show(s) {expanded===s.id?<ChevronUp size={15}/>:<ChevronDown size={15}/>}
          </Button>
         </div>
         {expanded===s.id&&<div className="recurring-occurrences">
          <h4>Eventos da temporada</h4>
          {s.occurrences.map(e=><div className="recurring-occurrence" key={e.event_id}>
           <div><strong>{showWhen(e.starts_at)}</strong>
            <small>{statuses[e.status]} · {e.invites_sent} convite(s) registrado(s)</small></div>
           <div className="recurring-occurrence-actions">
            <Link href={"/eventos?evento="+encodeURIComponent(e.event_id)+"&equipe=1"}
             className="sf-ui-button sf-ui-button-ghost">Ver show</Link>
            <Link href={"/eventos/equipe?evento="+encodeURIComponent(e.event_id)}
             className="sf-ui-button sf-ui-button-ghost">Gerenciar escala</Link>
             <Link href={"/eventos/operacao?evento="+encodeURIComponent(e.event_id)}
              className="sf-ui-button sf-ui-button-ghost">Checklist e operação</Link>
            {s.team_id&&s.team_members>0&&e.status!=="cancelled"&&e.status!=="completed"&&
             <Button variant="ghost" type="button" disabled={!!busy}
              onClick={()=>void invite(s,e)}><Send size={14}/> Convidar equipe</Button>}
           </div>
          </div>)}
          {!s.occurrences.length&&<p>Sem datas geradas. Verifique se o período ainda tem datas futuras.</p>}
         </div>}
        </article>)}
       </div>}
     <p className="recurring-safety"><CircleAlert size={16}/>
      Pausar uma programação não cancela apresentações já criadas. Convites só são enviados quando você clicar em “Convidar equipe” e confirmar.</p>
    </section>
   </div>
 </div></main>;
}
