"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2, Copy, Crown, ExternalLink, Globe2,
  LockKeyhole, Rocket, ShieldCheck, Unplug, RefreshCw
} from "lucide-react";
import {Button,InlineNotice,LoadingState} from "@/src/components/ui";
import { createClient } from "@/lib/supabase/client";
import ProFeatureLock from "@/components/pro-feature-lock";
import "./pro-publish-controls.css";

type Publication = {
  entitled:boolean;
  published:boolean;
  username:string|null;
  profile_public:boolean;
  url_path:string|null;
};

function isPublication(value: unknown): value is Publication {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.entitled === "boolean" && typeof row.published === "boolean" &&
    typeof row.profile_public === "boolean" &&
    (row.username === null || typeof row.username === "string") &&
    (row.url_path === null || typeof row.url_path === "string");
}

type Props={
  active?:boolean;
  unsaved:boolean;
  draftReady:boolean;
  galleryBusy:boolean;
  galleryLoading:boolean;
};

export default function ProSitePublicationControls({
  active=true,unsaved,draftReady,galleryBusy,galleryLoading
}:Props){
  const [info,setInfo]=useState<Publication|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [copied,setCopied]=useState(false);
  const canonicalProfilePath=info?.username?"/"+encodeURIComponent(info.username):null;

  const [verified,setVerified]=useState(false);
  const verifiedRef=useRef(false);
  const mounted=useRef(false);
  const activeRef=useRef(active);
  const reading=useRef(false);
  const writing=useRef(false);
  const readVersion=useRef(0);

  const readStatus=useCallback(async(preserveMessage=false)=>{
    if(!mounted.current||reading.current)return false;
    reading.current=true;
    const version=++readVersion.current;
    const current=()=>mounted.current&&version===readVersion.current;
    verifiedRef.current=false;setVerified(false);setLoading(true);setError("");setCopied(false);
    if(!preserveMessage)setMessage("");
    try{
      const {data,error:loadError}=await createClient().rpc("stage_my_pro_site_publication");
      if(!current())return false;
      if(loadError||!isPublication(data))throw new Error("publication_status_unavailable");
      setInfo(data);setVerified(true);verifiedRef.current=true;
      return true;
    }catch{
      if(current())setError("Não foi possível verificar a publicação. Consulte novamente antes de ativar ou desativar os recursos Pro.");
      return false;
    }finally{
      if(current()){reading.current=false;setLoading(false);}
    }
  },[]);

  const load=useCallback(async()=>{
    if(writing.current||!activeRef.current)return;
    await readStatus();
  },[readStatus]);

  useEffect(()=>{
    mounted.current=true;
    return()=>{mounted.current=false;readVersion.current++;reading.current=false;verifiedRef.current=false;};
  },[]);

  // Re-check eligibility on return, without resetting the parent's design or gallery.
  useEffect(()=>{
    activeRef.current=active;
    if(active)void load();
    else{setVerified(false);verifiedRef.current=false;setLoading(false);}
    return()=>{readVersion.current++;reading.current=false;verifiedRef.current=false;};
  },[active,load]);

  async function toggle(publish:boolean){
    if(!activeRef.current||!verifiedRef.current||!info||writing.current||reading.current)return;
    if(publish&&(!info.entitled||!info.profile_public||!info.username))return;
    if(!publish&&!info.published)return;
    if(publish&&(unsaved||!draftReady)){
      setError("Salve primeiro o tema, a cor e a organização das seções do seu rascunho.");
      return;
    }
    if(publish&&(galleryBusy||galleryLoading)){
      setError("Conclua primeiro as alterações da galeria de fotos e vídeos.");
      return;
    }
    const wasPublished=info.published;
    if(!window.confirm(publish
      ?wasPublished?"Republicar os recursos Pro no seu perfil público? As alterações salvas do visual e da galeria substituirão a versão Pro publicada no mesmo endereço.":"Ativar os recursos Pro no seu perfil público? As fotos e vídeos selecionados no rascunho serão exibidos no mesmo endereço do cantor. Você pode desativá-los depois."
      :"Desativar os recursos Pro publicados? Seu perfil de cantor continua no mesmo endereço com as funções pagas bloqueadas."
    ))return;
    writing.current=true;verifiedRef.current=false;
    setBusy(true);setVerified(false);setError("");setMessage("");
    try{
      const {data,error:actionError}=await createClient().rpc(
        "stage_set_pro_site_published",{p_publish:publish}
      );
      if(!mounted.current)return;
      const messages:Record<string,string>={
        login_required:"Entre novamente na sua conta para publicar.",
        artist_required:"Sua conta precisa ter a função de cantor/artista.",
        pro_access_required:"O acesso Pro ainda não foi habilitado para sua conta.",
        publish_free_profile_first:"Publique seu perfil gratuito de cantor e configure um @ antes.",
        save_draft_first:"Salve as configurações de tema e seções do rascunho antes de publicar.",
        photo_missing:"Uma foto da galeria não está mais disponível. Revise a galeria.",
        invalid:"Não foi possível identificar o estado desejado."
      };
      if(actionError||data!==(publish?"published":"unpublished")){
        setError((!actionError&&messages[String(data)])||
          "Não foi possível confirmar a alteração. Consulte o estado da publicação antes de tentar novamente.");
        return;
      }
      setMessage(publish
        ?wasPublished?"Recursos Pro atualizados no seu perfil! O endereço público continua o mesmo.":"Recursos Pro ativados no seu perfil! O endereço público continua o mesmo."
        :"A versão Pro foi retirada do ar. Seu perfil público continua disponível com funções Pro bloqueadas.");
      if(activeRef.current)await readStatus(true);
    }catch{
      if(mounted.current)setError("Não foi possível confirmar a alteração. Consulte o estado da publicação antes de tentar novamente.");
    }finally{
      writing.current=false;
      if(mounted.current)setBusy(false);
    }
  }

  async function copyLink(){
    if(!verifiedRef.current||!info?.published||!canonicalProfilePath)return;
    const version=readVersion.current;
    try{
      await navigator.clipboard.writeText(window.location.origin+canonicalProfilePath);
      if(mounted.current&&version===readVersion.current)setCopied(true);
    }catch{
      if(mounted.current&&version===readVersion.current)setError("Não foi possível copiar automaticamente. Abra o endereço e copie pelo navegador.");
    }
  }

  return <section className="pro-publish-controls" aria-label="Publicar recursos Pro no perfil do cantor">
    <div className="pro-publish-head">
      <div>
        <span className="pro-publish-eyebrow"><Globe2 aria-hidden="true" size={16}/> PUBLICAÇÃO DOS RECURSOS PRO</span>
        <h2>Um perfil, mais possibilidades.</h2>
        <p>Seu perfil gratuito já tem um endereço público. Escolha quando aplicar o visual e as galerias Pro a essa mesma página.</p>
      </div>
      <span className={"pro-publish-status"+(!verified?"":info?.published?" is-live":info?.entitled?" is-entitled":"")}>
        {!verified?<><RefreshCw aria-hidden="true" size={15}/>{busy?"ATUALIZANDO PUBLICAÇÃO":loading?"VERIFICANDO PUBLICAÇÃO":"STATUS INDISPONÍVEL"}</>:
          info?.published?<><CheckCircle2 aria-hidden="true" size={15}/> PRO PUBLICADO</>:
          info?.entitled?<><Crown aria-hidden="true" size={15}/> PRO LIBERADO · PUBLICAÇÃO PENDENTE</>:
          <><LockKeyhole aria-hidden="true" size={15}/> PRO NÃO LIBERADO</>}
      </span>
    </div>

    {verified&&!loading&&info?.entitled&&!info.published&&
      <div className="pro-publish-ready-notice"><InlineNotice>
        <span>Seu acesso Pro já está ativo! Para que o novo visual, as fotos e os vídeos apareçam ao público,
        salve seu design e clique em <strong>Ativar recursos Pro</strong> abaixo. A publicação é sua escolha,
        e seu perfil gratuito continua no ar enquanto isso.</span>
      </InlineNotice></div>}
    {verified&&!loading&&!busy&&<Button variant="secondary" onClick={()=>void load()}>Atualizar publicação</Button>}
    {loading||busy?<LoadingState label={busy?"Atualizando publicação...":"Verificando disponibilidade da publicação..."}/>:!verified||!info?<div className="pro-publish-setup-error">
      <InlineNotice tone="danger">{error||"Consulte o estado da publicação para continuar."}</InlineNotice>
      <Button variant="secondary" onClick={()=>void load()}><RefreshCw aria-hidden="true" size={15}/> Verificar novamente</Button>
    </div>:<div className="pro-publish-grid">
      <div className="pro-publish-info">
        <div className="pro-publish-checklist">
          <div><span>{info.entitled?<CheckCircle2 aria-hidden="true" size={16}/>:<LockKeyhole aria-hidden="true" size={16}/>}</span>
            <div><strong>Acesso aos recursos Pro</strong>
              <small>{info.entitled?"Habilitado para sua conta.":
                "Recurso incluído nos planos pagos de cantores. A contratação online ainda não está disponível."}</small>
            </div>
          </div>
          <div><span>{info.profile_public&&info.username?<CheckCircle2 aria-hidden="true" size={16}/>:<LockKeyhole aria-hidden="true" size={16}/>}</span>
            <div><strong>Perfil de cantor publicado</strong>
              <small>{info.profile_public&&info.username
                ?"Seu perfil gratuito @" + info.username + " está publicado."
                :"Publique sua página gratuita e escolha um @ para continuar."}</small>
            </div>
          </div>
          <div><span>{draftReady&&!unsaved?<CheckCircle2 aria-hidden="true" size={16}/>:<LockKeyhole aria-hidden="true" size={16}/>}</span>
            <div><strong>Visual salvo</strong>
              <small>{draftReady&&!unsaved
                ?"Seu tema e suas seções estão salvos."
                :"Salve primeiro o design do rascunho."}</small>
            </div>
          </div>
        </div>
        {!info.entitled&&<ProFeatureLock title="Personalização Pro do perfil" description="Libere temas especiais e galerias no mesmo perfil público do cantor. Subdomínio é um benefício futuro, ainda não ativado.">
          <div className="pro-publish-checklist">
            <div><span><Crown aria-hidden="true" size={16}/></span><div><strong>Temas e galeria Pro</strong><small>Personalização da mesma página</small></div></div>
            <div><span><Globe2 aria-hidden="true" size={16}/></span><div><strong>Subdomínio do artista</strong><small>Incluído no plano Pro</small></div></div>
          </div>
        </ProFeatureLock>}
        <p className="pro-publish-privacy"><ShieldCheck aria-hidden="true" size={15}/>
          Só o conteúdo escolhido para a publicação fica acessível. Convites, negociações,
          contatos recebidos e dados financeiros permanecem privados.
        </p>
      </div>

      <div className="pro-publish-action-area">
        {canonicalProfilePath&&<div className="pro-publish-url">
          <span>Endereço único do seu perfil de cantor</span>
          <strong>{typeof window!=="undefined"?window.location.origin+canonicalProfilePath:canonicalProfilePath}</strong>
        </div>}
        {info.published&&canonicalProfilePath&&<div className="pro-publish-links">
          <Link className="sf-ui-button sf-ui-button-secondary" href={canonicalProfilePath} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" size={15}/> Abrir meu perfil
          </Link>
          <Button variant="secondary" onClick={()=>void copyLink()}>
            {copied?<CheckCircle2 aria-hidden="true" size={15}/>:<Copy aria-hidden="true" size={15}/>}
            {copied?"Link copiado!":"Copiar endereço"}
          </Button>
        </div>}
        <Button
          disabled={!verified||!active||!info.entitled||!info.profile_public||!info.username||
            busy||galleryBusy||galleryLoading||!draftReady||unsaved}
          onClick={()=>void toggle(true)}>
          {info.published?<RefreshCw aria-hidden="true" size={17}/>:<Rocket aria-hidden="true" size={17}/>}
          {busy?"Salvando publicação...":info.published
            ?"Republicar alterações":"Ativar recursos Pro"}
        </Button>
        {info.published&&<Button variant="danger"
          disabled={!verified||!active||busy} onClick={()=>void toggle(false)}>
          <Unplug aria-hidden="true" size={16}/> Desativar versão Pro
        </Button>}
        <small className="pro-publish-info-text">
          {info.published
            ?"Seu perfil único usa o último visual e a galeria Pro que você publicou. Alterações no editor só entram ao republicar."
            :"Publicar exige confirmação. Não cria subdomínio nem altera cobrança ou assinatura."}
        </small>
      </div>
    </div>}
    {error&&!loading&&!busy&&verified&&info&&<div className="pro-publish-feedback"><InlineNotice tone="danger">{error}</InlineNotice></div>}
    {message&&<div className="pro-publish-feedback"><InlineNotice tone="success">{message}</InlineNotice></div>}
  </section>;
}
