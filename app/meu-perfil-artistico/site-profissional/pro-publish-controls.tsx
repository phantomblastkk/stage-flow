"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2, Copy, Crown, ExternalLink, Globe2, LoaderCircle,
  LockKeyhole, Rocket, ShieldCheck, Unplug, RefreshCw
} from "lucide-react";
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

  async function load(){
    setLoading(true);
    setMessage("");
    try {
      const {data,error:loadError}=await createClient().rpc(
        "stage_my_pro_site_publication"
      );
      if(loadError||!data){
        setInfo(null);
        const missing=loadError?.code==="PGRST202"||loadError?.code==="42883";
        setError(missing
          ? "A função de publicação Pro não foi encontrada. A versão anterior do SQL tinha um erro de sintaxe que podia interromper a instalação. Execute o arquivo pro_artist_publication_migration.sql atualizado e depois clique em Verificar novamente."
          : loadError
            ? "Erro do Supabase ("+loadError.code+"): "+loadError.message
            : "A sessão atual não retornou um perfil de cantor. Entre novamente na conta de artista.");
      }else{
        setInfo(data as Publication);
        setError("");
      }
    }catch(err){
      setInfo(null);
      setError("Erro ao consultar o Supabase: "+(err instanceof Error?err.message:"falha inesperada"));
    }
    setLoading(false);
  }

  // When returning from the free data tab, re-read publication eligibility.
  // Draft choices stay mounted in the parent and are not reset here.
  useEffect(()=>{if(active)void load();},[active]);

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
      "Ativar os recursos Pro no seu perfil público? As fotos e vídeos selecionados no rascunho serão exibidos no mesmo endereço do cantor. Você pode desativá-los depois."
    ))return;
    if(!publish&&!window.confirm(
      "Desativar os recursos Pro publicados? Seu perfil de cantor continua no mesmo endereço com as funções pagas bloqueadas."
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
        ?"Recursos Pro ativados no seu perfil! O endereço público continua o mesmo."
        :"A versão Pro foi retirada do ar. Seu perfil público continua disponível com funções Pro bloqueadas.");
    }
    setBusy(false);
  }

  async function copyLink(){
    if(!canonicalProfilePath)return;
    try{
      await navigator.clipboard.writeText(window.location.origin+canonicalProfilePath);
      setCopied(true);
    }catch{
      setError("Não foi possível copiar automaticamente. Abra o endereço e copie pelo navegador.");
    }
  }

  return <section className="pro-publish-controls" aria-label="Publicar recursos Pro no perfil do cantor">
    <div className="pro-publish-head">
      <div>
        <span className="pro-publish-eyebrow"><Globe2 size={16}/> PUBLICAÇÃO DOS RECURSOS PRO</span>
        <h2>Um perfil, mais possibilidades.</h2>
        <p>Seu perfil gratuito já tem um endereço público. Escolha quando aplicar o visual e as galerias Pro a essa mesma página.</p>
      </div>
      <span className={"pro-publish-status"+(info?.published?" is-live":info?.entitled?" is-entitled":"")}>
        {info?.published?<><CheckCircle2 size={15}/> PRO PUBLICADO</>:
          info?.entitled?<><Crown size={15}/> PRO LIBERADO · PUBLICAÇÃO PENDENTE</>:
          <><LockKeyhole size={15}/> PRO NÃO LIBERADO</>}
      </span>
    </div>

    {!loading&&info?.entitled&&!info.published&&
      <p className="pro-publish-ready-notice"><Crown size={19}/>
        Seu acesso Pro já está ativo! Para que o novo visual, as fotos e os vídeos apareçam ao público,
        salve seu design e clique em <strong>Ativar recursos Pro</strong> abaixo. A publicação é sua escolha,
        e seu perfil gratuito continua no ar enquanto isso.
      </p>}
    {loading?<p className="pro-publish-loading">
      <LoaderCircle size={16}/> Verificando disponibilidade da publicação...
    </p>:!info?<div className="pro-publish-setup-error" role="alert">
      <p className="pro-publish-warning">
        {error||"A publicação ainda não foi configurada no Supabase."}
      </p>
      <button type="button" className="pro-publish-verify-button"
        onClick={()=>void load()}><RefreshCw size={15}/> Verificar novamente</button>
    </div>:<div className="pro-publish-grid">
      <div className="pro-publish-info">
        <div className="pro-publish-checklist">
          <div><span>{info.entitled?<CheckCircle2 size={16}/>:<LockKeyhole size={16}/>}</span>
            <div><strong>Acesso aos recursos Pro</strong>
              <small>{info.entitled?"Habilitado para sua conta.":
                "Recurso incluído nos planos pagos de cantores. A contratação online ainda não está disponível."}</small>
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
        {!info.entitled&&<ProFeatureLock title="Personalização Pro do perfil" description="Libere temas especiais e galerias no mesmo perfil público do cantor. Subdomínio é um benefício futuro, ainda não ativado.">
          <div className="pro-publish-checklist">
            <div><span><Crown size={16}/></span><div><strong>Temas e galeria Pro</strong><small>Personalização da mesma página</small></div></div>
            <div><span><Globe2 size={16}/></span><div><strong>Subdomínio do artista</strong><small>Incluído no plano Pro</small></div></div>
          </div>
        </ProFeatureLock>}
        <p className="pro-publish-privacy"><ShieldCheck size={15}/>
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
          <Link href={canonicalProfilePath} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15}/> Abrir meu perfil
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
            ?"Republicar alterações":"Ativar recursos Pro"}
        </button>
        {info.published&&<button type="button" className="pro-publish-unpublish"
          disabled={busy} onClick={()=>void toggle(false)}>
          <Unplug size={16}/> Desativar versão Pro
        </button>}
        <small className="pro-publish-info-text">
          {info.published
            ?"Seu perfil único usa o último visual e a galeria Pro que você publicou. Alterações no editor só entram ao republicar."
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
