"use client";

import { useEffect,useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button,Input,InlineNotice,LoadingState } from "@/src/components/ui";

type Preferences={
  status:string;phone?:string;verified?:boolean;
  share?:boolean;notifications?:boolean;
};
const digits=(value:string)=>value.replace(/[^0-9]/g,"");
const normalizePhone=(value:string)=>{
  const raw=digits(value);
  const formatted=raw.length===10||raw.length===11?"55"+raw:raw;
  return /^55[1-9][0-9]{9,10}$/.test(formatted)?formatted:null;
};
const maskedPhone=(value:string)=>value.length>6
  ? "+55 (***) *****-"+value.slice(-4):"Não cadastrado";

export default function AccountWhatsAppPrivacy(){
  const [prefs,setPrefs]=useState<Preferences|null>(null);
  const [phoneInput,setPhoneInput]=useState("");
  const [editing,setEditing]=useState(false);
  const [pending,setPending]=useState("");
  const [token,setToken]=useState("");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const [error,setError]=useState(false);
  const [share,setShare]=useState(false);
  const [notifications,setNotifications]=useState(false);

  async function reload(){
    const {data,error:loadError}=await createClient().rpc("stage_my_whatsapp_privacy");
    if(loadError||!data||data.status!=="ok")
      throw new Error("Não foi possível carregar o WhatsApp único. Confira se a migração está aplicada.");
    const value=data as Preferences;
    setPrefs(value);setPhoneInput(value.phone||"");
    setShare(Boolean(value.share));setNotifications(Boolean(value.notifications));
  }
  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const {data,error:loadError}=await createClient().rpc("stage_my_whatsapp_privacy");
        if(!active)return;
        if(loadError||!data||data.status!=="ok")
          throw new Error("Preferências temporariamente indisponíveis. A migração de telefone deve ser aplicada.");
        const value=data as Preferences;setPrefs(value);setPhoneInput(value.phone||"");
        setShare(Boolean(value.share));setNotifications(Boolean(value.notifications));
      }catch(err){if(active){setError(true);setMessage(err instanceof Error?err.message:"Falha ao carregar.");}}
      finally{if(active)setLoading(false);}
    })();
    return()=>{active=false;};
  },[]);

  async function requestPhoneCode(){
    const target=normalizePhone(phoneInput);
    if(!target){setError(true);setMessage("Informe um WhatsApp brasileiro válido com DDD.");return;}
    setBusy(true);setMessage("");setError(false);
    try{
      // OTP is issued by Auth, never by the browser. The old phone remains until confirmation.
      const {data:{user},error:userError}=await createClient().auth.getUser();
      if(userError||!user)throw new Error("Entre novamente para atualizar seu celular.");
      const current=digits(user.phone||"");
      const client=createClient();
      const result=current===target && !user.phone_confirmed_at
        ? await client.auth.resend({type:"sms",phone:"+"+target})
        : await client.auth.updateUser({phone:"+"+target});
      if(result.error)throw result.error;
      setPending("+"+target);setToken("");setEditing(false);
      setMessage("Código solicitado por SMS. Se o provedor ainda não estiver configurado, o envio não acontecerá.");
    }catch(err){setError(true);setMessage(err instanceof Error?err.message:"Não foi possível solicitar o código.");}
    finally{setBusy(false);}
  }
  async function verifyPhone(){
    if(!pending||!/^[0-9]{6,8}$/.test(token)){
      setError(true);setMessage("Informe o código numérico recebido.");return;
    }
    setBusy(true);setMessage("");setError(false);
    try{
      const db=createClient();
      const {error:verifyError}=await db.auth.verifyOtp({phone:pending,token,type:"phone_change"});
      if(verifyError)throw verifyError;
      await reload();
      setPending("");setToken("");
      setMessage("WhatsApp verificado. Todos os módulos passam a usar esse número.");
    }catch(err){setError(true);setMessage(err instanceof Error?err.message:"Não foi possível verificar o código.");}
    finally{setBusy(false);}
  }
  async function save(){
    if(!prefs?.verified){setError(true);setMessage("Verifique seu número antes de ativar as preferências.");return;}
    setBusy(true);setMessage("");setError(false);
    try{
      const {data,error:saveError}=await createClient().rpc("stage_set_whatsapp_privacy",{
        p_share:share,p_notifications:notifications
      });
      if(saveError||data?.status!=="ok")
        throw new Error(saveError?.message||"Não foi possível salvar as preferências.");
      setPrefs(data as Preferences);
      setMessage("Preferências atualizadas. Seu número continua privado e não é solicitado novamente.");
    }catch(err){setError(true);setMessage(err instanceof Error?err.message:"Falha ao salvar.");}
    finally{setBusy(false);}
  }

  return <article className="account-security-card" aria-label="WhatsApp e privacidade">
    <h3>Telefone e WhatsApp</h3>
    <p>Um único número para cadastro, marketplace, convites, equipes e mensagens. Nunca será publicado sem sua autorização.</p>
    {loading?<LoadingState label="Consultando telefone..."/>:<>
      <p><strong>{maskedPhone(prefs?.phone||"")}</strong> · {prefs?.verified?"Número verificado":"Verificação pendente"}</p>
      {!pending&&<div className="account-form">
        {(editing||!prefs?.verified)&&<Input id="account-whatsapp-change" label={prefs?.phone?"Número cadastrado / novo número":"Adicionar WhatsApp com DDD"}
          type="tel" autoComplete="tel" value={phoneInput} onChange={e=>setPhoneInput(e.target.value)}
          placeholder="(11) 99999-9999" disabled={busy}
          hint={prefs?.verified?"A troca só será concluída após informar o código recebido.":"Contas existentes podem verificar o número pré-preenchido sem digitá-lo novamente."}/>}
        {editing||!prefs?.verified
          ? <Button type="button" disabled={busy||!phoneInput.trim()} onClick={()=>void requestPhoneCode()}>
              {busy?"Solicitando...":prefs?.phone&&!prefs?.verified?"Verificar número cadastrado":"Enviar código de verificação"}
            </Button>
          : <Button variant="ghost" type="button" disabled={busy} onClick={()=>setEditing(true)}>Alterar número com verificação</Button>}
      </div>}
      {pending&&<div className="account-form">
        <p>Informe o código enviado para {maskedPhone(digits(pending))}. A troca só ocorrerá após a confirmação.</p>
        <Input id="account-phone-otp" label="Código de verificação" value={token} type="text"
          autoComplete="one-time-code" inputMode="numeric" maxLength={8} required
          onChange={e=>setToken(digits(e.target.value).slice(0,8))} disabled={busy}/>
        <Button type="button" disabled={busy||token.length<6} onClick={()=>void verifyPhone()}>
          {busy?"Verificando...":"Confirmar número"}
        </Button>
      </div>}
      <div className="account-form">
        <label><input type="checkbox" checked={notifications} onChange={e=>setNotifications(e.target.checked)} disabled={busy}/>
          {" "}Receber notificações de convites, propostas e shows pelo WhatsApp</label>
        <label><input type="checkbox" checked={share} onChange={e=>setShare(e.target.checked)} disabled={busy}/>
          {" "}Permitir que contratantes autorizados visualizem meu WhatsApp</label>
        <p>As duas permissões são independentes e podem ser revogadas. O envio automático depende da API oficial.</p>
        <Button type="button" onClick={()=>void save()} disabled={busy||!prefs?.verified}>
          {busy?"Salvando...":"Salvar preferências"}
        </Button>
      </div>
      {message&&<InlineNotice tone={error?"danger":"success"}>{message}</InlineNotice>}
    </>}
  </article>;
}
