"use client";
import {useRef} from "react";
import {ChevronLeft,ChevronRight,Save} from "lucide-react";
import "./mobile-editor-wizard.css";

export type EditorStep={value:number;label:string};

export default function MobileEditorWizard({
 steps,active,onChange,formId,disabled=false,saveDisabled=false
}:{
 steps:readonly EditorStep[];active:number;onChange:(value:number)=>void;
 formId:string;disabled?:boolean;saveDisabled?:boolean;
}){
 const root=useRef<HTMLDivElement>(null);
 const index=Math.max(0,steps.findIndex(s=>s.value===active));
 const current=steps[index];
 function go(value:number){
  if(disabled)return;
  onChange(value);
  requestAnimationFrame(()=>root.current?.scrollIntoView({block:"start",behavior:"smooth"}));
 }
 function save(){
  if(disabled||saveDisabled)return;
  const form=document.getElementById(formId) as HTMLFormElement|null;
  if(!form)return;
  const invalid=form.querySelector<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>(":invalid");
  if(invalid){
   const step=invalid.closest<HTMLElement>("[data-editor-step]")?.dataset.editorStep;
   if(step!==undefined&&steps.some(item=>item.value===Number(step)))onChange(Number(step));
   requestAnimationFrame(()=>{
    invalid.focus({preventScroll:false});
    invalid.reportValidity();
   });
   return;
  }
  form.requestSubmit();
 }
 return <div ref={root} className="sf-editor-wizard" aria-label="Etapas de edição do perfil">
  <div className="sf-editor-wizard-head">
   <span className="sf-editor-wizard-count">ETAPA {index+1} DE {steps.length}</span>
   <strong aria-live="polite">{current.label}</strong>
  </div>
  <div className="sf-editor-wizard-progress" role="progressbar"
   aria-label="Progresso na edição" aria-valuemin={1}
   aria-valuemax={steps.length} aria-valuenow={index+1}>
   <span style={{width:((index+1)/steps.length*100)+"%"}}/>
  </div>
  <nav className="sf-editor-wizard-tabs" aria-label="Ir para uma etapa">
   {steps.map((step,i)=><button type="button" key={step.value}
    aria-current={step.value===active?"step":undefined}
    className={step.value===active?"is-active":""}
    onClick={()=>go(step.value)} disabled={disabled}>
    <span>{i+1}</span>{step.label}
   </button>)}
  </nav>
  <div className="sf-editor-wizard-actions">
   <button type="button" className="sf-editor-wizard-back"
    onClick={()=>go(steps[index-1].value)} disabled={disabled||index===0}>
    <ChevronLeft size={17}/> Voltar
   </button>
   {index+1<steps.length&&<button type="button" className="sf-editor-wizard-next"
    onClick={()=>go(steps[index+1].value)} disabled={disabled}>
    Próxima etapa <ChevronRight size={17}/>
   </button>}
   <button type="button" className="sf-editor-wizard-save"
    onClick={save} disabled={disabled||saveDisabled}
    title={saveDisabled?"Reserve seu endereço público antes de publicar":"Salvar suas alterações"}>
    <Save size={16}/> Salvar
   </button>
  </div>
  <p>Você pode voltar entre as etapas sem perder o que digitou. As alterações só são gravadas quando você toca em <strong>Salvar</strong>.</p>
 </div>;
}
