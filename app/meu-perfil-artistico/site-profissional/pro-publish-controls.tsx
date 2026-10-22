"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2, Copy, Crown, ExternalLink, Globe2, LoaderCircle,
  LockKeyhole, Rocket, ShieldCheck, Unplug, RefreshCw
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./pro-publish-controls.css";

type Publication = {
  entitled:boolean;
  published:boolean;
  username:string|null;
  profile_public:boolean;
  url_path:string|null;
};

type Props={
  unsaved:boolean;
  draftReady:boolean;
  galleryBusy:boolean;
  galleryLoading:boolean;
};

export default function ProSitePublicationControls({
  unsaved,draftReady,galleryBusy,galleryLoading
}:Props){
  const [info,setInfo]=useState<Publication|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [copied,setCopied]=useState(false);

  async function load(){
    const {data,error:loadError}=await createClient().rpc(
      "stage_my_pro_site_publication"
    );
    if(loadError||!data){
      setInfo(null);
      setError(loadError?.code==="PGRST202"||loadError?.code==="42883"
        ?"Execute pro_artist_publication_migration.sql no Supabase para ativar a publicação."
        :"Não foi possível verificar sua autorização Pro.");
    }else{
      setInfo(data as Publication);
      setError("");
    }
    setLoading(false);
  }

  useEffect(()=>{void load();},[]);

  async function toggle(publish:boolean){
    if(!info||busy)return;
    if(publish&&(unsaved||!draftReady)){
      setError("Salve primeiro o tema, a cor e a organização das seções do seu rascunho.");
      return;
    }
    if(publish&&(galleryBusy||galleryLoading)){
      setError("Conclua primeiro as alterações da galeria de fotos e vídeos.");
      return;
    }
    if(publish&&!window.confirm(
      "Publicar seu site Pro para qualquer pessoa acessar? Fotos e vídeos da galeria do rascunho serão incluídos nesta versão pública. Você poderá retirar o site do ar depois."
    ))return;
    if(!publish&&!window.confirm(
      "Retirar seu site Pro do ar? O endereço público ficará indisponível, mas o rascunho, a galeria e seu perfil gratuito serão preservados."
    ))return;
    setBusy(true);setError("");setMessage("");
    const {data,error:actionError}=await createClient().rpc(
      "stage_set_pro_site_published",{p_publish:publish}
    );
    const messages:Record<string,string>={
      login_required:"Entre novamente na sua conta para publicar.",
      artist_required:"Sua conta precisa ter a função de cantor/artista.",
      pro_access_required:"O acesso Pro ainda não foi habilitado para sua conta.",
      publish_free_profile_first:"Publique seu perfil gratuito de cantor e configure um @ antes.",
      save_draft_first:"Salve as configurações de tema e seções do rascunho antes de publicar.",
      photo_missing:"Uma foto da galeria não está mais disponível. Revise a galeria.",
      invalid:"Não foi possível identificar o estado desejado."
    };
    if(actionError || data!==(publish?"published":"unpublished")){
      setError(actionError?.message||messages[String(data)]||
        "Não foi possível alterar a publicação. Tente novamente.");
    }else{
      setInfo(current=>current?{...current,published:publish}:current);
      setMessage(publish
        ?"Seu site Pro foi publicado! Compartilhe o novo endereço com seus fãs e contratantes."
        :"Seu site Pro saiu do ar. O rascunho e o perfil gratuito foram preservados.");
    }
    setBusy(false);
  }

  async function copyLink(){
    if(!info?.url_path)return;
    try{
      await navigator.clipboard.writeText(window.location.origin+info.url_path);
      setCopied(true);
    }catch{
      setError("Não foi possível copiar automaticamente. Abra o endereço e copie pelo navegador.");
    }
  }

  return <section className="pro-publish-controls" aria-label="Publicar site Pro do cantor">
    <div className="pro-publish-head">
      <div>
        <span className="pro-publish-eyebrow"><Globe2 size={16}/> PUBLICAÇÃO DO SITE PRO</span>
        <h2>Seu palco, agora na internet.</h2>
        <p>Transforme seu rascunho em um site profissional para compartilhar.
          É você quem decide quando publicar ou retirar do ar.</p>
      </div>
      <span className={"pro-publish-status"+(info?.published?" is-live":"")}>
        {info?.published?<><CheckCircle2 size={15}/> PUBLICADO</>:
          <><LockKeyhole size={15}/> NÃO PUBLICADO</>}
      </span>
    </div>

    {loading?<p className="pro-publish-loading">
      <LoaderCircle size={16}/> Verificando disponibilidade da publicação...
    </p>:!info?<p className="pro-publish-warning">
      {error||"A publicação ainda não foi configurada no Supabase."}
    </p>:<div className="pro-publish-grid">
      <div className="pro-publish-info">
        <div className="pro-publish-checklist">
          <div><span>{info.entitled?<CheckCircle2 size={16}/>:<LockKeyhole size={16}/>}</span>
            <div><strong>Acesso ao site Pro</strong>
              <small>{info.entitled?"Habilitado para sua conta.":
                "Ainda não habilitado. A autorização é gerenciada pelo Stage Flow."}</small>
            </div>
          </div>
          <div><span>{info.profile_public&&info.username?<CheckCircle2 size={16}/>:<LockKeyhole size={16}/>}</span>
            <div><strong>Perfil de cantor publicado</strong>
              <small>{info.profile_public&&info.username
                ?"Seu perfil gratuito @" + info.username + " está publicado."
                :"Publique sua página gratuita e escolha um @ para continuar."}</small>
            </div>
          </div>
          <div><span>{draftReady&&!unsaved?<CheckCircle2 size={16}/>:<LockKeyhole size={16}/>}</span>
            <div><strong>Visual salvo</strong>
              <small>{draftReady&&!unsaved
                ?"Seu tema e suas seções estão salvos."
                :"Salve primeiro o design do rascunho."}</small>
            </div>
          </div>
        </div>
        {!info.entitled&&<p className="pro-publish-entitlement-note">
          <Crown size={15}/> O Stage Flow ainda não realiza cobrança automática do adicional Pro.
          O acesso precisa ser autorizado administrativamente; salvar o rascunho não libera o site.
        </p>}
        <p className="pro-publish-privacy"><ShieldCheck size={15}/>
          Só o conteúdo escolhido para a publicação fica acessível. Convites, negociações,
          contatos recebidos e dados financeiros permanecem privados.
        </p>
      </div>

      <div className="pro-publish-action-area">
        {info.url_path&&<div className="pro-publish-url">
          <span>Endereço do seu site Pro</span>
          <strong>{typeof window!=="undefined"?window.location.origin+info.url_path:info.url_path}</strong>
        </div>}
        {info.published&&info.url_path&&<div className="pro-publish-links">
          <Link href={info.url_path} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15}/> Abrir meu site
          </Link>
          <button type="button" onClick={()=>void copyLink()}>
            {copied?<CheckCircle2 size={15}/>:<Copy size={15}/>}
            {copied?"Link copiado!":"Copiar endereço"}
          </button>
        </div>}
        <button type="button"
          className={"pro-publish-main-button"+(info.published?" is-update":"")}
          disabled={!info.entitled||!info.profile_public||!info.username||
            busy||galleryBusy||galleryLoading||!draftReady||unsaved}
          onClick={()=>void toggle(true)}>
          {busy?<LoaderCircle size={17}/>:info.published?<RefreshCw size={17}/>:<Rocket size={17}/>}
          {busy?"Salvando publicação...":info.published
            ?"Republicar alterações":"Publicar site Pro"}
        </button>
        {info.published&&<button type="button" className="pro-publish-unpublish"
          disabled={busy} onClick={()=>void toggle(false)}>
          <Unplug size={16}/> Retirar site Pro do ar
        </button>}
        <small className="pro-publish-info-text">
          {info.published
            ?"A página pública usa o último design e a galeria que você publicou. Alterações no editor só entram ao republicar."
            :"Publicar exige confirmação. Não cria subdomínio nem altera cobrança ou assinatura."}
        </small>
      </div>
    </div>}
    {error&&!loading&&info&&<p role="alert" className="pro-publish-error">{error}</p>}
    {message&&<p role="status" className="pro-publish-success">
      <CheckCircle2 size={17}/>{message}
    </p>}
  </section>;
}
