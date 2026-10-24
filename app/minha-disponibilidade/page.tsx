"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
 ArrowLeft, CalendarCheck2, CalendarClock, CalendarDays, ChevronLeft,
 ChevronRight, Clock3, Info, LoaderCircle, LockKeyhole, Plus,
 RefreshCw, ShieldCheck, Trash2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./disponibilidade.css";

type Rule={
 id:string;kind:"day"|"weekly";title:string;
 block_date:string|null;weekday:number|null;
 start_minute:number;end_minute:number;
 valid_from:string|null;valid_until:string|null;
};
type EventRow={event_id:string;title:string;starts_at:string;kind:string;event_status:string};
type Check="busy"|"possible_conflict"|"free"|"checking"|"error";
const days=["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
function isoToday(){return new Intl.DateTimeFormat("sv-SE",{timeZone:"America/Sao_Paulo",
 year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function isoDay(y:number,m:number,d:number){return [y,String(m+1).padStart(2,"0"),String(d).padStart(2,"0")].join("-");}
function plusDays(date:string,amount:number){const d=new Date(date+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+amount);return d.toISOString().slice(0,10);}
function weekday(date:string){const d=new Date(date+"T12:00:00Z").getUTCDay();return d===0?7:d;}
function minuteToTime(n:number){return String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");}
function timeToMinute(v:string){const [h,m]=v.split(":").map(Number);return h*60+m;}
function br(date:string){return new Date(date+"T12:00:00Z").toLocaleDateString("pt-BR",{timeZone:"UTC",dateStyle:"medium"});}
function displayMonth(y:number,m:number){return new Date(Date.UTC(y,m,15)).toLocaleDateString("pt-BR",{
 month:"long",year:"numeric",timeZone:"UTC"});}
function localDayFromISO(iso:string){return new Intl.DateTimeFormat("sv-SE",{timeZone:"America/Sao_Paulo",
 year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(iso));}
function describe(r:Rule){return r.start_minute===0&&r.end_minute===1440?
 "Dia inteiro":minuteToTime(r.start_minute)+"–"+(r.end_minute===1440?"24:00":minuteToTime(r.end_minute));}
function isBlocked(r:Rule,day:string){
 if(r.kind==="day")return r.block_date===day;
 return r.weekday===weekday(day)&&!!r.valid_from&&!!r.valid_until&&
   day>=r.valid_from&&day<=r.valid_until;
}
export default function AvailabilityCalendar(){
 const router=useRouter();
 const today=useMemo(()=>isoToday(),[]);
 const [month,setMonth]=useState(()=>{const t=isoToday();return {year:Number(t.slice(0,4)),index:Number(t.slice(5,7))-1};});
 const [selected,setSelected]=useState(()=>isoToday());
 const [rules,setRules]=useState<Rule[]>([]);
 const [shows,setShows]=useState<EventRow[]>([]);
 const [check,setCheck]=useState<Check>("checking");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [kind,setKind]=useState<"day"|"weekly">("day");
 const [title,setTitle]=useState("");
 const [fullDay,setFullDay]=useState(true);
 const [startTime,setStartTime]=useState("18:00");
 const [endTime,setEndTime]=useState("23:00");
 const [recurrenceDay,setRecurrenceDay]=useState(6);
 const [from,setFrom]=useState(()=>isoToday());
 const [until,setUntil]=useState(()=>plusDays(isoToday(),90));
 const [userId,setUserId]=useState<string|null>(null);

 const load=useCallback(async()=>{
  const db=createClient();
  const {data:{user}}=await db.auth.getUser();
  if(!user){router.replace("/login");return;}
  setUserId(user.id);
  const [rulesResult,eventsResult]=await Promise.all([
   db.rpc("stage_musician_schedule_list"),db.rpc("stage_my_show_history")
  ]);
  if(rulesResult.error)throw rulesResult.error;
  if(rulesResult.data?.status!=="ok"||!Array.isArray(rulesResult.data.items))
   throw Error("Não foi possível buscar os bloqueios.");
  setRules(rulesResult.data.items as Rule[]);
  if(!eventsResult.error&&Array.isArray(eventsResult.data)){
   setShows((eventsResult.data as EventRow[]).filter(s=>s.event_status!=="cancelled"));
  }
 },[router]);
 useEffect(()=>{let alive=true;
  void load().catch(e=>{if(alive)setError(e instanceof Error?e.message:"Não foi possível carregar sua agenda.");})
    .finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;};
 },[load]);
 useEffect(()=>{if(!userId)return;let alive=true;setCheck("checking");
  const db=createClient();
  const s=new Date(selected+"T00:00:00-03:00").toISOString();
  const e=new Date(plusDays(selected,1)+"T00:00:00-03:00").toISOString();
  void db.rpc("stage_musician_schedule_check",{
   p_musician_id:userId,p_start:s,p_end:e,p_thread_id:null,p_ignore_event:null
  }).then(({data,error})=>{
    if(alive)setCheck(error?"error":data==="busy"?"busy":
      data==="possible_conflict"?"possible_conflict":data==="free"?"free":"error");
  }).catch(()=>{if(alive)setCheck("error");});
  return()=>{alive=false};
 },[selected,userId,rules,shows]);

 const cells=useMemo(()=>{
  const first=new Date(Date.UTC(month.year,month.index,1));
  const offset=(first.getUTCDay()+6)%7;
  const last=new Date(Date.UTC(month.year,month.index+1,0)).getUTCDate();
  return Array.from({length:Math.ceil((offset+last)/7)*7},(_,i)=>{
   const number=i-offset+1;
   return number<1||number>last?null:isoDay(month.year,month.index,number);
  });
 },[month]);
 function changeMonth(direction:number){
  const d=new Date(Date.UTC(month.year,month.index+direction,1));
  setMonth({year:d.getUTCFullYear(),index:d.getUTCMonth()});
 }
 function choose(day:string){
  setSelected(day);
  setRecurrenceDay(weekday(day));
  setError("");setNotice("");
 }
 const selectedRules=rules.filter(r=>isBlocked(r,selected));
 const selectedShows=shows.filter(r=>localDayFromISO(r.starts_at)===selected);
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;
  setError("");setNotice("");
  const start=fullDay?0:timeToMinute(startTime);
  const end=fullDay?1440:timeToMinute(endTime);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end){
   setError("O horário final precisa ser depois do inicial, no mesmo dia.");return;
  }
  setBusy(true);
  try{
   const {data,error:rpcError}=await createClient().rpc("stage_musician_schedule_save",{
    p_kind:kind,p_title:title.trim()||"Indisponível",
    p_date:kind==="day"?selected:null,p_weekday:kind==="weekly"?recurrenceDay:null,
    p_start:start,p_end:end,p_from:kind==="weekly"?from:null,
    p_until:kind==="weekly"?until:null
   });
   if(rpcError)throw rpcError;
   if(data?.status!=="ok"){
    throw Error(data?.status==="limit_reached"?"Limite de 100 bloqueios atingido.":
     "Verifique o período e os horários escolhidos.");
   }
   setTitle("");setNotice(kind==="weekly"?
    "Compromisso semanal cadastrado!":"Data bloqueada na sua agenda.");
   await load();
  }catch(err){setError(err instanceof Error?err.message:"Não foi possível salvar.");}
  finally{setBusy(false);}
 }
 async function remove(rule:Rule){
  if(busy||!window.confirm("Excluir o bloqueio '"+rule.title+"' da sua agenda?"))return;
  setBusy(true);setError("");setNotice("");
  try{
   const {data,error:rpcError}=await createClient().rpc("stage_musician_schedule_remove",{
    p_id:rule.id
   });
   if(rpcError||data!=="removed")throw Error("Não foi possível remover este compromisso.");
   await load();setNotice("Bloqueio removido.");
  }catch(err){setError(err instanceof Error?err.message:"Erro ao remover.");}
  finally{setBusy(false);}
 }
 return <main className="smart-schedule-page"><div className="container">
  <nav className="nav"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
   <Link className="btn btn-quiet" href="/painel"><ArrowLeft size={15}/> Meu painel</Link></nav>
  <header className="smart-schedule-hero">
   <span className="eyebrow"><LockKeyhole size={14}/> CALENDÁRIO PESSOAL · PRIVADO</span>
   <h1>Minha <span className="accent">disponibilidade.</span></h1>
   <p>Bloqueie datas, cadastre bandas fixas e veja compromissos confirmados. O contratante só recebe um aviso de disponibilidade — seus detalhes pessoais ficam privados.</p>
  </header>
  {error&&<p className="smart-schedule-feedback is-error" role="alert">{error}</p>}
  {notice&&<p className="smart-schedule-feedback" role="status">{notice}</p>}
  {loading?<p className="smart-schedule-loading"><LoaderCircle size={18}/> Carregando sua agenda...</p>:
  <div className="smart-schedule-layout">
   <section className="smart-schedule-calendar" aria-label="Calendário mensal">
    <div className="smart-schedule-month">
     <button type="button" onClick={()=>changeMonth(-1)} aria-label="Mês anterior"><ChevronLeft size={20}/></button>
     <h2>{displayMonth(month.year,month.index)}</h2>
     <button type="button" onClick={()=>changeMonth(1)} aria-label="Próximo mês"><ChevronRight size={20}/></button>
    </div>
    <div className="smart-schedule-grid">
     {days.map(d=><span className="smart-schedule-day-label" key={d}>{d}</span>)}
     {cells.map((day,i)=>day?<button key={day} type="button" onClick={()=>choose(day)}
      className={"smart-schedule-day"+(day===selected?" selected":"")+
        (day===today?" today":"")+(rules.some(r=>isBlocked(r,day))?" blocked":"")+
        (shows.some(r=>localDayFromISO(r.starts_at)===day)?" has-show":"")}
      aria-pressed={selected===day} aria-label={"Selecionar "+br(day)}>
       {Number(day.slice(-2))}
       {(rules.some(r=>isBlocked(r,day))||shows.some(r=>localDayFromISO(r.starts_at)===day))&&
        <span className="smart-schedule-dot" aria-hidden="true"/>}
      </button>:<span key={"empty-"+i} className="smart-schedule-blank"/>)}
    </div>
    <div className="smart-schedule-legend">
     <span><i className="is-blocked"/> Bloqueio pessoal</span>
     <span><i className="is-show"/> Show na agenda</span>
    </div>
    <p className="smart-schedule-note"><Info size={15}/> Horários sem término cadastrado em convites são estimados em 4 horas para detectar possíveis conflitos.</p>
   </section>
   <section className="smart-schedule-editor">
    <div className="smart-schedule-selected">
     <div><span>DATA SELECIONADA</span><h2>{br(selected)}</h2></div>
     <span className={"smart-schedule-check "+check}>
      {check==="checking"?"Verificando...":check==="busy"?"Ocupado":check==="possible_conflict"?
       "Possível conflito":check==="free"?"Sem conflito registrado":"Não verificado"}
     </span>
    </div>
    {selectedRules.length>0&&<div className="smart-schedule-items">
     <h3>Seus bloqueios neste dia</h3>
     {selectedRules.map(r=><div key={r.id} className="smart-schedule-item">
      <div><strong>{r.title}</strong><small>{describe(r)} · {r.kind==="weekly"?"Toda semana":"Data única"}</small></div>
      <button type="button" disabled={busy} aria-label={"Remover "+r.title} onClick={()=>void remove(r)}><Trash2 size={16}/></button>
     </div>)}
    </div>}
    {selectedShows.length>0&&<div className="smart-schedule-items">
     <h3>Apresentações registradas</h3>
     {selectedShows.map(r=><div key={r.event_id+":"+r.kind} className="smart-schedule-item">
      <div><strong>{r.title}</strong>
       <small>{new Date(r.starts_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",timeZone:"America/Sao_Paulo"})} · {r.kind==="organized"?"Show próprio":"Participação confirmada"}</small></div>
      <CalendarCheck2 size={16}/>
     </div>)}
    </div>}
    <form className="smart-schedule-form" onSubmit={e=>void save(e)}>
     <h3><Plus size={17}/> Novo compromisso</h3>
     <div className="smart-schedule-switch" role="group" aria-label="Tipo de bloqueio">
      <button type="button" aria-pressed={kind==="day"} onClick={()=>setKind("day")}>Data específica</button>
      <button type="button" aria-pressed={kind==="weekly"} onClick={()=>setKind("weekly")}>Banda fixa semanal</button>
     </div>
     <label>Descrição particular (opcional)
      <input value={title} maxLength={100} onChange={e=>setTitle(e.target.value)}
       placeholder={kind==="weekly"?"Ex.: Banda fixa aos sábados":"Ex.: Evento particular / descanso"}/>
     </label>
     {kind==="weekly"&&<>
      <label>Dia da semana<select value={recurrenceDay} onChange={e=>setRecurrenceDay(Number(e.target.value))}>
       {days.map((d,i)=><option key={d} value={i+1}>{d}</option>)}</select></label>
      <div className="smart-schedule-time">
       <label>Válido a partir de<input type="date" required value={from}
         onChange={e=>setFrom(e.target.value)} min={plusDays(today,-1)}/></label>
       <label>Até<input type="date" required value={until} min={from}
         onChange={e=>setUntil(e.target.value)}/></label>
      </div>
     </>}
     <label className="smart-schedule-checkbox">
      <input type="checkbox" checked={fullDay} onChange={e=>setFullDay(e.target.checked)}/>
      Bloquear o dia inteiro
     </label>
     {!fullDay&&<div className="smart-schedule-time">
       <label>Das<input type="time" required value={startTime} onChange={e=>setStartTime(e.target.value)}/></label>
       <label>Até<input type="time" required value={endTime} onChange={e=>setEndTime(e.target.value)}/></label>
     </div>}
     <button type="submit" className="btn btn-primary" disabled={busy}>
      {busy?<LoaderCircle size={16}/>:<CalendarClock size={16}/>}
      {kind==="weekly"?"Salvar compromisso semanal":"Bloquear esta data"}
     </button>
     <p className="smart-schedule-note">Dados privados. Um bloqueio impede novos aceites de proposta conflitantes pelo chat; não cancela convites já aceitos.</p>
    </form>
   </section>
  </div>}
  <p className="smart-schedule-footer">Para modificar um compromisso, exclua e cadastre novamente. Os compromissos semanais vencem na data escolhida; não são infinitos.</p>
 </div></main>;
}
