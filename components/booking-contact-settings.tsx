"use client";

import {useEffect,useState} from "react";
import {Instagram,MessageCircle,Save,ShieldCheck} from "lucide-react";
import {createClient} from "@/lib/supabase/client";
import "./booking-contact-settings.css";
import {Button,Input,Textarea,LoadingState,EmptyState,InlineNotice} from "@/src/components/ui";

import type {BookingMode} from "@/lib/booking-contact";

const defaultGreeting="Olá! Vi seu perfil no StageFlow e gostaria de conversar sobre uma contratação.";
export default function BookingContactSettings({kind,instagramConfigured=false,formEnabled=false}:{
 kind:"singer"|"musician";instagramConfigured?:boolean;formEnabled?:boolean;
}){
 const [mode,setMode]=useState<BookingMode>("auto");
 const [phone,setPhone]=useState("");
 const [greeting,setGreeting]=useState(defaultGreeting);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState(false);
 const [readFailed,setReadFailed]=useState(false);
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  let active=true;
  void (async()=>{
   setLoading(true);setReadFailed(false);setMessage("");
   try{
    const {data,error:rpcError}=await createClient().rpc("stage_my_booking_contact",{p_kind:kind});
    if(!active)return;
    if(rpcError||data?.status!=="ok")throw Error("read_failed");
    setMode(data.mode as BookingMode);setPhone(data.phone||"");
    setGreeting(data.greeting||defaultGreeting);setError(false);
   }catch{
    if(active)setReadFailed(true);
   }finally{if(active)setLoading(false);}
  })();
  return ()=>{active=false;};
 },[kind,reload]);
 async function save(){
  if(saving||loading||readFailed)return;
  setSaving(true);setMessage("");setError(false);
  try{
   const {data,error:rpcError}=await createClient().rpc("stage_save_booking_contact",{
    p_kind:kind,p_mode:mode,p_phone:mode==="whatsapp"?phone:null,
    p_greeting:mode==="whatsapp"?greeting:""
   });
   if(rpcError||data!=="saved"){
    setError(true);
    setMessage(rpcError?"Não foi possível salvar o contato. Tente novamente.":
     data==="invalid_phone"?"Informe um WhatsApp brasileiro válido com DDD. Exemplo: 11987654321.":
     data==="instagram_required"?"Salve primeiro seu Instagram na seção de redes sociais do perfil.":
     data==="form_required"?"Ative primeiro o formulário de contratação do cantor.":"Não foi possível salvar o contato.");
   }else setMessage(mode==="off"
    ?"Contato para contratação atualizado! O botão de contratação está oculto."
    :"Contato para contratação atualizado! O botão aparece no perfil quando ele estiver publicado.");
  }catch{setError(true);setMessage("Não foi possível salvar o contato. Tente novamente.");}
  finally{setSaving(false);}
 }

 return <section className="booking-contact-settings" aria-label={"Contato para contratar "+(kind==="singer"?"o cantor":"o músico")}
  onKeyDown={event=>{if(event.key==="Enter"&&event.target instanceof HTMLInputElement)event.preventDefault();}}>
  <div className="booking-contact-heading">
   <span className="booking-contact-icon"><MessageCircle size={20}/></span>
   <div><h2>Como vão contratar você?</h2>
    <p>Escolha para onde vai o botão de contratação do seu perfil público.</p></div>
  </div>
  {loading?<LoadingState label="Carregando opções..."/>:readFailed?
   <EmptyState title="Não foi possível carregar o contato" description="Tente novamente para consultar suas preferências antes de alterá-las."
    action={<Button variant="secondary" onClick={()=>setReload(n=>n+1)}>Tentar novamente</Button>}/>:<>
   <fieldset className="booking-contact-options" disabled={saving}>
    <legend>Destino do botão de contratação</legend>
    {([
     ["auto","Usar contato já cadastrado","Mantém seu Instagram público ou formulário existente, quando disponível."],
     ["whatsapp","WhatsApp direto","Abre uma conversa com mensagem pronta."],
     ["instagram","Instagram","Abre o perfil que você cadastrou."],
     ...(kind==="singer"?[["form","Formulário StageFlow","Receba solicitações dentro do site."]]:[]),
     ["off","Não exibir contato","Oculta o botão e o formulário público de contratação."]
    ] as string[][]).map(([value,label,details])=><label key={value} className={mode===value?"is-selected":""}>
     <input type="radio" name={"booking-contact-"+kind} checked={mode===value}
      onChange={()=>setMode(value as BookingMode)}/>
     <span><strong>{label}</strong><small>{details}</small></span>
    </label>)}
   </fieldset>
   {mode==="auto"&&<p className="booking-contact-hint"><ShieldCheck size={16}/> O StageFlow usa o formulário já ativado pelo cantor ou o Instagram público. Escolha outro canal se quiser mudar.</p>}
   {mode==="whatsapp"&&<div className="booking-contact-details">
     <Input label="Número público para contratação (WhatsApp)" id={"booking-phone-"+kind} type="tel" autoComplete="tel-national" inputMode="tel"
      placeholder="11 98765-4321" value={phone} onChange={e=>setPhone(e.target.value)} maxLength={24} disabled={saving}
      hint="Somente este número informado voluntariamente será publicado ao selecionar WhatsApp. Seu telefone privado da conta nunca é usado."/>
     <Textarea label="Mensagem pronta para contratantes" id={"booking-greeting-"+kind} rows={3} maxLength={260} value={greeting}
      onChange={e=>setGreeting(e.target.value)} placeholder={defaultGreeting} disabled={saving}
      hint={`Use {artista} para inserir o nome do perfil na mensagem. ${greeting.length}/260`}/>
   </div>}
   {mode==="instagram"&&<p className="booking-contact-hint"><Instagram size={16}/>
     {instagramConfigured?"O botão vai abrir seu Instagram cadastrado.":
       "Antes de salvar, cadastre e salve o link do seu Instagram na área de redes sociais."}</p>}
   {mode==="form"&&<p className="booking-contact-hint"><ShieldCheck size={16}/>
     {formEnabled?"O formulário interno já está ativado.":"Ative primeiro o recebimento de pedidos pelo formulário na sua página de cantor."}</p>}
   <div className="booking-contact-footer">
    <span><ShieldCheck size={16}/> Você pode mudar isso quando quiser.</span>
    <Button onClick={()=>void save()} loading={saving}
     disabled={(mode==="instagram"&&!instagramConfigured)||(mode==="form"&&!formEnabled)}>
     {!saving&&<Save size={16}/>} {saving?"Salvando...":"Salvar contato"}
    </Button>
   </div>
   {message&&<InlineNotice tone={error?"danger":"success"}>{message}</InlineNotice>}
  </>}
 </section>;
}
