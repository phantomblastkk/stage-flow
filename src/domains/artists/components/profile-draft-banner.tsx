"use client";

import {RotateCcw,Trash2,ShieldCheck} from "lucide-react";
import "./profile-draft-banner.css";

type Props={
 pending:boolean;saveState:"idle"|"saved"|"unavailable";
 restore:()=>void;discard:()=>void;published:boolean
};
export default function ProfileDraftBanner({pending,saveState,restore,discard,published}:Props){
 if(pending)return <section className="sf-editor-draft sf-editor-draft-recovery" aria-label="Rascunho encontrado">
  <div><RotateCcw size={18} aria-hidden="true"/>
   <span><strong>Encontramos alterações nesta aba</strong>
    <small>Você pode recuperar o texto que estava digitando. Seu perfil publicado não foi alterado.</small></span></div>
  <div className="sf-editor-draft-actions">
   <button type="button" onClick={restore}>Recuperar rascunho</button>
   <button type="button" onClick={discard}>Descartar</button>
  </div>
 </section>;
 return <div className="sf-editor-draft sf-editor-draft-info" role="status">
  <ShieldCheck size={17} aria-hidden="true"/>
  <span>{saveState==="saved"
   ?"Alterações guardadas temporariamente nesta aba. Toque em Salvar para gravar na sua conta."
   :saveState==="unavailable"
    ?"Recuperação temporária indisponível neste navegador. Salve na sua conta antes de sair."
    :published
     ?"Seu perfil está publicado. Novas alterações só aparecem para visitantes depois de salvar."
     :"Seu perfil está privado. Toque em Salvar para guardar na conta; publicar é uma escolha separada."}</span>
 </div>;
}
