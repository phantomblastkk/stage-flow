"use client";

import {FormEvent,useEffect,useRef,useState} from "react";
import {AlertTriangle,LoaderCircle,ShieldAlert,Trash2,X} from "lucide-react";
import {createClient} from "@/lib/supabase/client";
import "./delete-account-dialog.css";

export type DeletableAccount={id:string;name:string;email:string|null;created_at:string;plan_code:string};
type Props={user:DeletableAccount;onClose:()=>void;onDeleted:()=>void};
const errorText:Record<string,string>={
 unauthorized:"Sua sessão expirou. Entre novamente antes de excluir contas.",
 forbidden:"Esta ação é permitida somente ao proprietário autorizado.",
 protected_account:"A conta administradora não pode ser excluída.",
 not_found:"Esta conta não existe mais. Atualize a lista.",
 confirmation_required:"Confirme que compreendeu as consequências da exclusão.",
 confirmation_mismatch:"A confirmação digitada não corresponde à conta selecionada.",
 billing_review_required:"Esta conta possui ou pode possuir uma assinatura ativa. Revise e encerre as obrigações de cobrança antes da exclusão.",
 account_has_dependencies:"O banco ou o armazenamento possui vínculos que impedem a exclusão segura. Nenhum apagamento parcial foi realizado. Revise os vínculos antes de tentar novamente.",
 audit_unavailable:"A auditoria administrativa está indisponível. Por segurança, a conta não foi excluída.",
 admin_not_configured:"A exclusão ainda não está habilitada no servidor. Configure a chave administrativa e publique a migração de auditoria.",
 account_check_unavailable:"Não foi possível verificar as proteções dessa conta.",
 rate_limited:"Limite de exclusões administrativas atingido. Tente novamente mais tarde.",
 deletion_unavailable:"Não foi possível concluir a exclusão. Confira o histórico antes de tentar novamente."
};

export default function DeleteAccountDialog({user,onClose,onDeleted}:Props){
 const ref=useRef<HTMLDialogElement>(null);
 const [typed,setTyped]=useState("");
 const [understood,setUnderstood]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [result,setResult]=useState("");
 const target=user.email||user.id;
 const required="EXCLUIR "+target;
 useEffect(()=>{
  const dialog=ref.current;
  if(dialog&&!dialog.open)dialog.showModal();
  return()=>{if(dialog?.open)dialog.close();};
 },[]);
 async function submit(event:FormEvent){
  event.preventDefault();
  if(busy||!understood||typed!==required)return;
  setBusy(true);setError("");
  try{
   const {data:{session},error:sessionError}=await createClient().auth.getSession();
   if(sessionError||!session)throw Error("unauthorized");
   const response=await fetch("/api/admin/accounts/"+encodeURIComponent(user.id),{
    method:"DELETE",credentials:"same-origin",cache:"no-store",
    headers:{"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"},
    body:JSON.stringify({confirmation:typed,understood:true})
   });
   const data=await response.json().catch(()=>null) as {error?:string;status?:string;audit?:string}|null;
   if(!response.ok||data?.status!=="deleted")throw Error(data?.error||"deletion_unavailable");
   setResult(data.audit==="delayed"
    ?"Conta excluída, mas o registro final do histórico precisa de revisão. Não repita a exclusão."
    :"Conta excluída com sucesso.");
   onDeleted();
  }catch(e){
   const code=e instanceof Error?e.message:"deletion_unavailable";
   setError(errorText[code]||"Não foi possível excluir essa conta. Verifique o histórico e tente novamente.");
  }finally{setBusy(false);}
 }
 return <dialog ref={ref} className="sf-admin-delete-dialog"
  aria-labelledby="sf-delete-title" aria-describedby="sf-delete-description"
  onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
  <form onSubmit={event=>void submit(event)}>
   <div className="sf-delete-head">
    <div className="sf-delete-warning-icon"><ShieldAlert size={26} aria-hidden="true"/></div>
    <button type="button" aria-label="Fechar confirmação" onClick={onClose} disabled={busy}><X size={20}/></button>
   </div>
   <h2 id="sf-delete-title">Excluir conta permanentemente?</h2>
   <p id="sf-delete-description">Esta ação remove o acesso à conta no StageFlow e pode apagar
    os dados associados, como <strong>Perfil Artístico, agenda, convites e conversas</strong>.
    Não há botão para desfazer.</p>
   <dl className="sf-delete-summary">
    <div><dt>Conta selecionada</dt><dd>{user.name}</dd></div>
    <div><dt>E-mail</dt><dd>{user.email||"Sem e-mail"}</dd></div>
    <div><dt>Identificador</dt><dd><code>{user.id}</code></dd></div>
   </dl>
   <p className="sf-delete-billing"><AlertTriangle size={17} aria-hidden="true"/>
    A exclusão <strong>não cancela cobranças externas</strong>. Contas com assinatura ativa são bloqueadas.
    Dependências de outras pessoas ou arquivos podem impedir a exclusão.</p>
   <label className="sf-delete-checkbox">
    <input type="checkbox" checked={understood} disabled={busy}
     onChange={event=>setUnderstood(event.target.checked)}/>
    Entendo que a exclusão é permanente e pode remover dados relacionados.
   </label>
   <label htmlFor="sf-delete-confirm">Para confirmar, digite exatamente:</label>
   <div className="sf-delete-expected"><code>{required}</code></div>
   <input id="sf-delete-confirm" value={typed} onChange={e=>setTyped(e.target.value)}
    autoComplete="off" autoCorrect="off" spellCheck={false}
    disabled={busy||Boolean(result)} placeholder="Digite a frase de confirmação"/>
   {error&&<p className="sf-delete-error" role="alert">{error}</p>}
   {result&&<p className="sf-delete-success" role="status">{result}</p>}
   <div className="sf-delete-actions">
    <button type="button" onClick={onClose} disabled={busy} className="sf-delete-cancel">
     {result?"Fechar":"Cancelar"}
    </button>
    {!result&&<button type="submit" className="sf-delete-submit"
     disabled={busy||!understood||typed!==required}>
     {busy?<LoaderCircle size={18} className="sf-admin-spin"/>:<Trash2 size={17}/>}
     {busy?"Excluindo…":"Excluir conta definitivamente"}
    </button>}
   </div>
  </form>
 </dialog>;
}
