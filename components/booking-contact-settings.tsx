"use client";

import {useEffect,useState} from "react";
import {CheckCircle2,Instagram,LoaderCircle,MessageCircle,Save,ShieldCheck} from "lucide-react";
import {createClient} from "@/lib/supabase/client";
import "./booking-contact-settings.css";

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
 useEffect(()=>{
  let active=true;
  void (async()=>{
   setLoading(true);
   const {data,error:rpcError}=await createClient().rpc("stage_my_booking_contact",{p_kind:kind});
   if(!active)return;
   if(!rpcError&&data?.status==="ok"){
    setMode(data.mode as BookingMode);
    setPhone(data.phone||"");
    setGreeting(data.greeting||defaultGreeting);
    setError(false);
   }else{
    setError(true);
    setMessage("Não foi possível carregar suas preferências de contratação.");
   }
   setLoading(false);
  })();
  return ()=>{active=false;};
 },[kind]);
 async function save(){
  if(saving||loading)return;
  setSaving(true);setMessage("");setError(false);
  try{
   const {data,error:rpcError}=await createClient().rpc("stage_save_booking_contact",{
    p_kind:kind,p_mode:mode,p_phone:mode==="whatsapp"?phone:null,
    p_greeting:mode==="whatsapp"?greeting:""
   });
   if(rpcError||data!=="saved")throw Error(rpcError?.message||
    (data==="invalid_phone"?"Informe um WhatsApp brasileiro válido com DDD. Exemplo: 11987654321.":
     data==="instagram_required"?"Salve primeiro seu Instagram na seção de redes sociais do perfil.":
     data==="form_required"?"Ative primeiro o formulário de contratação do cantor.":
     "Não foi possível salvar o contato."));
   setMessage("Contato para contratação atualizado! O botão aparece no perfil quando ele estiver publicado.");
  }catch(e){setError(true);setMessage(e instanceof Error?e.message:"Falha ao salvar.");}
  setSaving(false);
 }
 return <section className="booking-contact-settings" aria-label={"Contato para contratar "+(kind==="singer"?"o cantor":"o músico")}>
  <div className="booking-contact-heading">
   <span className="booking-contact-icon"><MessageCircle size={20}/></span>
   <div><strong>Como vão contratar você?</strong>
    <p>Escolha para onde vai o botão de contratação do seu perfil público.</p></div>
  </div>
  {loading?<p className="booking-contact-hint"><LoaderCircle size={15}/> Carregando opções...</p>:<>
   <div className="booking-contact-options" role="group" aria-label="Destino do botão de contratação">
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
   </div>
   {mode==="auto"&&<p className="booking-contact-hint"><ShieldCheck size={16}/> O StageFlow usa o formulário já ativado pelo cantor ou o Instagram público. Escolha outro canal se quiser mudar.</p>}
   {mode==="whatsapp"&&<div className="booking-contact-details">
     <label htmlFor={"booking-phone-"+kind}>Número público para contratação (WhatsApp)</label>
     <input id={"booking-phone-"+kind} type="tel" autoComplete="tel-national" inputMode="tel"
      placeholder="11 98765-4321" value={phone} onChange={e=>setPhone(e.target.value)} maxLength={24}/>
     <small>Somente este número informado voluntariamente será publicado ao selecionar WhatsApp. Seu telefone privado da conta nunca é usado.</small>
     <label htmlFor={"booking-greeting-"+kind}>Mensagem pronta para contratantes</label>
     <textarea id={"booking-greeting-"+kind} rows={3} maxLength={260} value={greeting}
      onChange={e=>setGreeting(e.target.value)}
      placeholder={defaultGreeting}/>
     <small>Use <code>{"{artista}"}</code> para inserir o nome do perfil na mensagem. {greeting.length}/260</small>
   </div>}
   {mode==="instagram"&&<p className="booking-contact-hint"><Instagram size={16}/>
     {instagramConfigured?"O botão vai abrir seu Instagram cadastrado.":
       "Antes de salvar, cadastre e salve o link do seu Instagram na área de redes sociais."}</p>}
   {mode==="form"&&<p className="booking-contact-hint"><ShieldCheck size={16}/>
     {formEnabled?"O formulário interno já está ativado.":"Ative primeiro o recebimento de pedidos pelo formulário na sua página de cantor."}</p>}
   <div className="booking-contact-footer">
    <span><ShieldCheck size={16}/> Você pode mudar isso quando quiser.</span>
    <button type="button" className="btn btn-primary" onClick={()=>void save()}
     disabled={saving||(mode==="instagram"&&!instagramConfigured)||(mode==="form"&&!formEnabled)}>
     {saving?<LoaderCircle size={16}/>:<Save size={16}/>}
     {saving?"Salvando...":"Salvar contato"}
    </button>
   </div>
   {message&&<p className={"booking-contact-feedback"+(error?" is-error":"")} role={error?"alert":"status"}>
    {!error&&<CheckCircle2 size={16}/>} {message}
   </p>}
  </>}
 </section>;
}
