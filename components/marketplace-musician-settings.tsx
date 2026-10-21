"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays, CheckCircle2, Clock3, Guitar, LoaderCircle,
  LockKeyhole, Plus, Save, ShieldCheck, Trash2, Users
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./marketplace-musician-settings.css";

type Mode = "ask"|"accepting"|"unavailable";
type Preference = {
  listed:boolean;
  availability_mode:Mode;
  blocked_dates:string[];
};

const blank:Preference = {
  listed:false,availability_mode:"ask",blocked_dates:[]
};
function todayKey(){
  const d=new Date();
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),
    String(d.getDate()).padStart(2,"0")].join("-");
}
function latestKey(){
  const d=new Date();d.setDate(d.getDate()+366);
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),
    String(d.getDate()).padStart(2,"0")].join("-");
}
function dateLabel(day:string) {
  const date=new Date(day+"T12:00:00");
  return Number.isNaN(date.getTime())?day:
    date.toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"});
}

export default function MarketplaceMusicianSettings({portfolioPublished}:{portfolioPublished:boolean}) {
  const [value,setValue] = useState<Preference>(blank);
  const [blockedInput,setBlockedInput]=useState("");
  const [ready,setReady]=useState(false);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  useEffect(()=>{
    let active=true;
    async function load() {
      const {data,error:loadError}=await createClient().rpc("stage_my_marketplace_settings");
      if(!active)return;
      if(loadError){
        setError("Execute marketplace_private_launch_migration.sql no Supabase para configurar sua participação no futuro marketplace.");
      }else if(data && typeof data.listed==="boolean"){
        setValue({
          listed:data.listed===true,
          availability_mode:["ask","accepting","unavailable"].includes(data.availability_mode)
            ? data.availability_mode : "ask",
          blocked_dates:Array.isArray(data.blocked_dates)?data.blocked_dates:[]
        });
        setReady(true);
      }else{
        setError("Esta configuração é reservada a contas com função de músico.");
      }
      setLoading(false);
    }
    void load();
    return()=>{active=false;};
  },[]);

  function addDate(){
    setError("");setNotice("");
    if(!blockedInput||blockedInput<todayKey()||blockedInput>latestKey()){
      setError("Escolha uma data entre hoje e os próximos 366 dias.");return;
    }
    if(value.blocked_dates.includes(blockedInput)){
      setBlockedInput("");return;
    }
    if(value.blocked_dates.length>=45){
      setError("Máximo de 45 datas não disponíveis.");return;
    }
    setValue(current=>({...current,
      blocked_dates:[...current.blocked_dates,blockedInput].sort()}));
    setBlockedInput("");
  }

  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!ready||busy)return;
    setBusy(true);setError("");setNotice("");
    const {data,error:saveError}=await createClient().rpc("stage_save_marketplace_settings",{
      p_listed:value.listed,
      p_availability_mode:value.availability_mode,
      p_blocked_dates:value.blocked_dates
    });
    const reasons:Record<string,string>={
      publish_portfolio_first:"Publique e salve seu portfólio gratuito antes de autorizar o catálogo.",
      invalid_date:"Uma data bloqueada está fora do intervalo permitido.",
      too_many_dates:"Há datas indisponíveis demais.",
      artist_required:"Esta configuração requer uma conta de músico."
    };
    if(saveError||data!=="saved"){
      setError(saveError?.message||reasons[String(data)]||
        "Não foi possível salvar a configuração do marketplace.");
    }else{
      setNotice(value.listed
        ? "Preferência salva. Seu perfil estará elegível quando o marketplace for lançado pelo Stage Flow, mas não está publicado no catálogo geral agora."
        : "Participação desativada. Seu portfólio gratuito continua independente do marketplace.");
    }
    setBusy(false);
  }

  return <section className="mp-market-settings" aria-label="Participação no futuro marketplace">
    <div className="mp-market-settings-header">
      <div>
        <span className="mp-market-eyebrow"><Users size={15}/> FUTURO MARKETPLACE</span>
        <h2>Encontre novos palcos.</h2>
        <p>Configure como quer aparecer na busca de músicos, quando o catálogo for liberado.</p>
      </div>
      <span className="mp-market-coming"><LockKeyhole size={13}/> EM BREVE</span>
    </div>
    {loading?<p className="mp-market-loading"><LoaderCircle size={16}/> Carregando configuração...</p>:
      <form className="mp-market-form" onSubmit={e=>void save(e)}>
        <label className="mp-market-join">
          <input type="checkbox" checked={value.listed} disabled={!ready||busy}
            onChange={e=>setValue(current=>({...current,listed:e.target.checked}))}/>
          <span><strong>Quero participar do Marketplace de Músicos</strong>
            <small>Autorizo que meu portfólio já publicado seja encontrado por organizadores quando o Stage Flow lançar o marketplace. Posso desativar essa opção quando quiser.</small></span>
        </label>
        {!portfolioPublished&&<p className="mp-market-hint">
          Primeiro publique e salve seu portfólio gratuito. Ele continua visível no seu próprio endereço, mesmo sem entrar no catálogo.
        </p>}

        <div className="mp-market-availability-control">
          <label htmlFor="mp-market-mode"><Clock3 size={15}/> Como está sua disponibilidade?</label>
          <select id="mp-market-mode" value={value.availability_mode} disabled={!ready||busy}
            onChange={e=>setValue(current=>({
              ...current,availability_mode:e.target.value as Mode
            }))}>
            <option value="ask">Sob consulta — pergunte antes de convidar</option>
            <option value="accepting">Recebendo propostas — sujeito a confirmação</option>
            <option value="unavailable">Indisponível — não receber novas propostas do catálogo</option>
          </select>
          <small>Este status não é confirmado automaticamente pela sua agenda de shows.</small>
        </div>

        <div className="mp-market-date-section">
          <label htmlFor="mp-market-block-date"><CalendarDays size={15}/> Datas que você não quer oferecer</label>
          <div className="mp-market-add-date">
            <input id="mp-market-block-date" type="date"
              min={todayKey()} max={latestKey()}
              disabled={!ready||busy} value={blockedInput}
              onChange={e=>setBlockedInput(e.target.value)}/>
            <button type="button" disabled={!ready||busy||!blockedInput}
              onClick={addDate}><Plus size={15}/> Bloquear data</button>
          </div>
          <p>O catálogo mostra apenas se a data consultada foi bloqueada. Não revela onde você estará tocando, com quem ou quanto receberá.</p>
          {value.blocked_dates.length>0&&<div className="mp-market-date-chips">
            {value.blocked_dates.map(day=><span key={day}>
              {dateLabel(day)}
              <button type="button" disabled={busy} aria-label={"Desbloquear "+dateLabel(day)}
                onClick={()=>setValue(current=>({...current,
                  blocked_dates:current.blocked_dates.filter(d=>d!==day)
                }))}><Trash2 size={13}/></button>
            </span>)}
          </div>}
        </div>
        <div className="mp-market-controls">
          <button type="submit" disabled={!ready||busy} className="mp-market-save">
            {busy?<LoaderCircle size={16}/>:<Save size={16}/>}
            {busy?"Salvando...":"Salvar minha preferência"}
          </button>
          <Link href="/marketplace" className="mp-market-link">Ver aviso de lançamento</Link>
        </div>
      </form>}
    {error&&<p role="alert" className="mp-market-error">{error}</p>}
    {notice&&<p role="status" className="mp-market-success"><CheckCircle2 size={16}/>{notice}</p>}
    <div className="mp-market-footer"><ShieldCheck size={17}/>
      <span><strong>Marketplace ainda não lançado.</strong> A aprovação de um músico para aparecer no futuro catálogo não libera o catálogo público, não cria cobrança e não altera o site Premium do cantor.</span>
    </div>
  </section>;
}
