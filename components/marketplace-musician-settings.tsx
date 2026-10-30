"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus, Save, ShieldCheck, Trash2, Users
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./marketplace-musician-settings.css";
import {Button,Input,Select,LoadingState,EmptyState,InlineNotice,Badge} from "@/src/components/ui";
import {showSaveFeedback} from "@/src/components/ui/save-feedback";

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
  const [readFailed,setReadFailed]=useState(false);
  const [reload,setReload]=useState(0);

  useEffect(()=>{
    let active=true;
    async function load() {
      setLoading(true);setReady(false);setReadFailed(false);setError("");setNotice("");
      try{
        const {data,error:loadError}=await createClient().rpc("stage_my_marketplace_settings");
        if(!active)return;
        if(loadError)throw Error("read_failed");
        if(data && typeof data.listed==="boolean"){
          setValue({listed:data.listed===true,
            availability_mode:["ask","accepting","unavailable"].includes(data.availability_mode)?data.availability_mode:"ask",
            blocked_dates:Array.isArray(data.blocked_dates)?data.blocked_dates:[]});
          setReady(true);
        }
      }catch{if(active)setReadFailed(true);}
      finally{if(active)setLoading(false);}
    }
    void load();return()=>{active=false;};
  },[reload]);

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
    try{
      const {data,error:saveError}=await createClient().rpc("stage_save_marketplace_settings",{
        p_listed:value.listed,p_availability_mode:value.availability_mode,p_blocked_dates:value.blocked_dates
      });
      const reasons:Record<string,string>={
        publish_portfolio_first:"Publique e salve seu perfil antes de autorizar o catálogo.",
        invalid_date:"Uma data bloqueada está fora do intervalo permitido.",
        too_many_dates:"Há datas indisponíveis demais.",
        artist_required:"Esta configuração requer uma conta de músico."
      };
      if(saveError||data!=="saved")setError(reasons[String(data)]||"Não foi possível salvar a configuração do marketplace.");
      else {showSaveFeedback("Preferências do Marketplace salvas com sucesso!");setNotice(value.listed
        ? "Preferências salvas. A exibição na busca segue a publicação do seu perfil e as condições do catálogo."
        : "Participação desativada. Seu perfil continua independente do marketplace.");}
    }catch{setError("Não foi possível salvar a configuração do marketplace. Tente novamente.");}
    finally{setBusy(false);}
  }

  return <section className="mp-market-settings" aria-label="Preferências do Marketplace">
    <div className="mp-market-settings-header">
      <div>
        <span className="mp-market-eyebrow"><Users size={15}/> MARKETPLACE</span>
        <h2>Encontre novos palcos.</h2>
        <p>Configure sua participação e disponibilidade na busca de músicos.</p>
      </div>
      <Badge>Preferências</Badge>
    </div>
    {loading?<LoadingState label="Carregando configuração..."/>:!ready?
      <EmptyState title={readFailed?"Não foi possível carregar suas preferências":"Preferências indisponíveis"}
        description={readFailed?"Tente novamente para consultar suas escolhas antes de alterá-las.":"Esta configuração requer uma conta com a função de músico."}
        action={<Button variant="secondary" onClick={()=>setReload(n=>n+1)}>Tentar novamente</Button>}/>:
      <form className="mp-market-form" onSubmit={e=>void save(e)}>
        <label className="mp-market-join">
          <input type="checkbox" checked={value.listed} disabled={busy}
            onChange={e=>setValue(current=>({...current,listed:e.target.checked}))}/>
          <span><strong>Quero participar do Marketplace de Músicos</strong>
            <small>Autorizo que meu perfil publicado seja encontrado por organizadores no Marketplace. Posso desativar essa opção quando quiser.</small></span>
        </label>
        {!portfolioPublished&&<InlineNotice tone="warning">
          Publique e salve seu perfil para autorizar sua participação no catálogo. Esta preferência não publica o perfil automaticamente.
        </InlineNotice>}
        <Select label="Como está sua disponibilidade?" id="mp-market-mode" value={value.availability_mode} disabled={busy}
          onChange={e=>setValue(current=>({...current,availability_mode:e.target.value as Mode}))}
          hint="Este status não é confirmado automaticamente pela sua agenda de shows.">
          <option value="ask">Sob consulta — pergunte antes de convidar</option>
          <option value="accepting">Recebendo propostas — sujeito a confirmação</option>
          <option value="unavailable">Indisponível — não receber novas propostas do catálogo</option>
        </Select>
        <div className="mp-market-date-section">
          <div className="mp-market-add-date">
            <Input label="Datas que você não quer oferecer" id="mp-market-block-date" type="date"
              min={todayKey()} max={latestKey()} disabled={busy} value={blockedInput}
              onChange={e=>setBlockedInput(e.target.value)}/>
            <Button variant="secondary" disabled={busy||!blockedInput} onClick={addDate}><Plus size={15}/> Bloquear data</Button>
          </div>
          <p>O catálogo mostra apenas se a data consultada foi bloqueada. Não revela onde você estará tocando, com quem ou quanto receberá.</p>
          {value.blocked_dates.length>0&&<div className="mp-market-date-chips">
            {value.blocked_dates.map(day=><span key={day}>
              {dateLabel(day)}
              <Button variant="ghost" disabled={busy} aria-label={"Desbloquear "+dateLabel(day)}
                onClick={()=>setValue(current=>({...current,blocked_dates:current.blocked_dates.filter(d=>d!==day)}))}><Trash2 size={15}/></Button>
            </span>)}
          </div>}
        </div>
        <div className="mp-market-controls">
          <Button type="submit" loading={busy}>
            {!busy&&<Save size={16}/>} {busy?"Salvando...":"Salvar minha preferência"}
          </Button>
          <Link href="/marketplace" className="sf-ui-button sf-ui-button-secondary">Explorar Marketplace</Link>
        </div>
      </form>}
    {error&&<InlineNotice tone="danger">{error}</InlineNotice>}
    {notice&&<InlineNotice tone="success">{notice}</InlineNotice>}
    <div className="mp-market-footer"><ShieldCheck size={17}/>
      <span><strong>Você controla sua participação.</strong> Preferências de catálogo não confirmam shows, não criam cobranças e não publicam seu perfil automaticamente.</span>
    </div>
  </section>;
}
