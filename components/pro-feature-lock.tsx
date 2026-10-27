import Link from "next/link";
import { LockKeyhole, ArrowRight } from "lucide-react";
import "./pro-feature-lock.css";

type Props={title:string;description:string;children:React.ReactNode;href?:string};
export default function ProFeatureLock({title,description,children,href="/planos"}:Props){
 return <section className="stage-pro-locked" aria-label={title+" — exclusivo Pro"}>
   <div className="stage-pro-locked-preview" aria-hidden="true" inert>{children}</div>
   <div className="stage-pro-locked-overlay">
     <span className="stage-pro-locked-icon"><LockKeyhole size={22}/></span>
     <strong>{title}</strong>
     <p>{description}</p>
     <Link className="btn btn-primary" href={href}>Assinar versão Pro <ArrowRight size={16}/></Link>
     <small>Conheça os planos. A assinatura online ainda não está disponível.</small>
   </div>
 </section>;
}
