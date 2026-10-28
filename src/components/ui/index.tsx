"use client";

import {
  useEffect,useId,useRef,useState,
  type ButtonHTMLAttributes,type InputHTMLAttributes,type SelectHTMLAttributes,
  type ReactNode,type TextareaHTMLAttributes
} from "react";
import {AlertCircle,CheckCircle2,LoaderCircle,X} from "lucide-react";
import "./tokens.css";

type Intent="primary"|"secondary"|"ghost"|"danger";
type ButtonProps=ButtonHTMLAttributes<HTMLButtonElement>&{variant?:Intent;loading?:boolean};
export function Button({variant="primary",loading=false,disabled=false,className="",children,...props}:ButtonProps){
 return <button type="button" {...props} disabled={disabled||loading} className={"sf-ui-button sf-ui-button-"+variant+" "+className}>
  {loading&&<LoaderCircle size={16} className="sf-ui-spin" aria-hidden="true"/>}{children}
 </button>;
}
type FieldProps={label:string;hint?:string;error?:string};
export function Input({label,hint,error,id,className="",...props}:InputHTMLAttributes<HTMLInputElement>&FieldProps){
 const generated=useId();const fieldId=id||generated;
 const helpId=(hint||error)?fieldId+"-help":undefined;
 return <div className="sf-ui-field">
  <label htmlFor={fieldId}>{label}</label>
  <input {...props} id={fieldId} className={"sf-ui-input "+className}
   aria-describedby={helpId} aria-invalid={Boolean(error)}/>
  {(hint||error)&&<small id={helpId} className={error?"sf-ui-error":""}>{error||hint}</small>}
 </div>;
}
export function Select({label,hint,error,id,className="",children,...props}:SelectHTMLAttributes<HTMLSelectElement>&FieldProps){
 const generated=useId();const fieldId=id||generated;
 const helpId=(hint||error)?fieldId+"-help":undefined;
 return <div className="sf-ui-field">
  <label htmlFor={fieldId}>{label}</label>
  <select {...props} id={fieldId} className={"sf-ui-input "+className}
   aria-describedby={helpId} aria-invalid={Boolean(error)}>{children}</select>
  {(hint||error)&&<small id={helpId} className={error?"sf-ui-error":""}>{error||hint}</small>}
 </div>;
}
export function Textarea({label,hint,error,id,className="",...props}:TextareaHTMLAttributes<HTMLTextAreaElement>&FieldProps){
 const generated=useId();const fieldId=id||generated;
 const helpId=(hint||error)?fieldId+"-help":undefined;
 return <div className="sf-ui-field">
  <label htmlFor={fieldId}>{label}</label>
  <textarea {...props} id={fieldId} className={"sf-ui-input "+className}
   aria-describedby={helpId} aria-invalid={Boolean(error)}/>
  {(hint||error)&&<small id={helpId} className={error?"sf-ui-error":""}>{error||hint}</small>}
 </div>;
}
export function Card({children,className="",title,description}:{
 children:ReactNode;className?:string;title?:string;description?:string
}){
 return <section className={"sf-ui-card "+className}>
  {title&&<header className="sf-ui-card-header"><h2>{title}</h2>{description&&<p>{description}</p>}</header>}
  {children}
 </section>;
}
export function Badge({children,tone="neutral"}:{children:ReactNode;tone?:"neutral"|"success"|"warning"|"danger"}){
 return <span className={"sf-ui-badge sf-ui-badge-"+tone}>{children}</span>;
}
export function StatusChip({label,status}:{label:string;status:"neutral"|"success"|"warning"|"danger"}){
 return <Badge tone={status}><span className="sf-ui-status-dot"/>{label}</Badge>;
}
export function InlineNotice({children,tone="neutral"}:{children:ReactNode;tone?:"neutral"|"success"|"warning"|"danger"}){
 return <div role={tone==="danger"?"alert":"status"} className={"sf-ui-notice sf-ui-notice-"+tone}>{children}</div>;
}
export function Avatar({name,src,size="md"}:{name:string;src?:string|null;size?:"sm"|"md"|"lg"}){
 const [broken,setBroken]=useState(false);
 useEffect(()=>setBroken(false),[src]);
 const initials=name.trim().split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toLocaleUpperCase("pt-BR")||"SF";
 return <span aria-label={name} role="img" className={"sf-ui-avatar sf-ui-avatar-"+size}>
  {src&&!broken?<img src={src} alt="" onError={()=>setBroken(true)}/>:initials}
 </span>;
}
export function Tabs({tabs,value,onChange,label="Abas"}:{
 tabs:{id:string;label:string;panelId?:string}[];
 value:string;onChange:(v:string)=>void;label?:string
}){
 const refs=useRef<(HTMLButtonElement|null)[]>([]);
 return <div className="sf-ui-tabs" role="tablist" aria-label={label}>
  {tabs.map((t,index)=><button type="button" role="tab" key={t.id}
   ref={node=>{refs.current[index]=node;}}
   aria-selected={t.id===value} aria-controls={t.panelId}
   tabIndex={t.id===value?0:-1}
   className={t.id===value?"is-selected":""}
   onKeyDown={event=>{
    let next=-1;
    if(event.key==="ArrowRight")next=(index+1)%tabs.length;
    else if(event.key==="ArrowLeft")next=(index-1+tabs.length)%tabs.length;
    else if(event.key==="Home")next=0;
    else if(event.key==="End")next=tabs.length-1;
    if(next<0||!tabs.length)return;
    event.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
   }}
   onClick={()=>onChange(t.id)}>{t.label}</button>)}
 </div>;
}
export function EmptyState({icon,title,description,action}:{
 icon?:ReactNode;title:string;description:string;action?:ReactNode
}){
 return <div className="sf-ui-empty">
  {icon&&<span aria-hidden="true">{icon}</span>}
  <strong>{title}</strong><p>{description}</p>{action}
 </div>;
}
export function Skeleton({height=16,width="100%"}:{height?:number;width?:number|string}){
 return <span className="sf-ui-skeleton" aria-hidden="true" style={{height,width}}/>;
}
export function LoadingState({label="Carregando dados…"}:{label?:string}){
 return <div className="sf-ui-loading" role="status"><LoaderCircle className="sf-ui-spin" size={21}/>{label}</div>;
}
export function StatCard({label,value,icon,description,action}:{
 label:string;value:string|number;icon?:ReactNode;description?:string;action?:ReactNode
}){
 return <Card className="sf-ui-stat">
  <div className="sf-ui-stat-head"><span>{label}</span>{icon&&<span aria-hidden="true">{icon}</span>}</div>
  <strong>{value}</strong>
  {description&&<p>{description}</p>}
  {action&&<div className="sf-ui-stat-action">{action}</div>}
 </Card>;
}
export function Toast({message,tone="success",onClose}:{message:string;tone?:"success"|"danger";onClose:()=>void}){
 return <div role={tone==="danger"?"alert":"status"} className={"sf-ui-toast sf-ui-toast-"+tone}>
  {tone==="danger"?<AlertCircle size={18}/>:<CheckCircle2 size={18}/>}
  <span>{message}</span><button type="button" aria-label="Dispensar aviso" onClick={onClose}><X size={17}/></button>
 </div>;
}
type ModalProps={open:boolean;onClose:()=>void;title:string;children:ReactNode;footer?:ReactNode;description?:string};
export function Modal({open,onClose,title,description,children,footer}:ModalProps){
 const titleId=useId();
 const closeRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!open)return;
  const previous=document.activeElement as HTMLElement|null;
  const overflow=document.body.style.overflow;
  document.body.style.overflow="hidden";
  closeRef.current?.focus();
  const handler=(e:KeyboardEvent)=>{
   if(e.key==="Escape")onClose();
   if(e.key==="Tab"){
    const panel=closeRef.current?.closest('[role="dialog"]');
    const controls=Array.from(panel?.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]'
    )||[]);
    if(!controls.length)return;
    const first=controls[0],last=controls[controls.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
   }
  };
  document.addEventListener("keydown",handler);
  return ()=>{document.removeEventListener("keydown",handler);
   document.body.style.overflow=overflow;previous?.focus();};
 },[open,onClose]);
 if(!open)return null;
 return <div className="sf-ui-modal-layer">
  <button type="button" aria-label="Fechar janela" className="sf-ui-modal-backdrop" onClick={onClose}/>
  <section className="sf-ui-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
   <header><div><h2 id={titleId}>{title}</h2>{description&&<p>{description}</p>}</div>
    <button ref={closeRef} type="button" aria-label="Fechar" onClick={onClose}><X size={20}/></button>
   </header><div className="sf-ui-modal-body">{children}</div>
   {footer&&<footer>{footer}</footer>}
  </section>
 </div>;
}
export function Dialog({open,onClose,title,description,confirmLabel="Confirmar",busy=false,
 onConfirm,children,destructive=false}:ModalProps&{
 confirmLabel?:string;busy?:boolean;onConfirm:()=>void;destructive?:boolean
}){
 return <Modal open={open} onClose={onClose} title={title} description={description}
 footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button>
   <Button variant={destructive?"danger":"primary"} loading={busy} onClick={onConfirm}>{confirmLabel}</Button></>}>
  {children}
 </Modal>;
}
