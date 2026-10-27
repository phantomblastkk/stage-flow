import {BadgeCheck} from "lucide-react";
import "./stage-verified-badge.css";

type Props={compact?:boolean;className?:string};

/** An official StageFlow designation, never an external social-network endorsement. */
export default function StageVerifiedBadge({compact=false,className=""}:Props){
 return <span className={"sf-verified"+(compact?" sf-verified-compact":"")+(className?" "+className:"")}
  role="img" aria-label="Verificado pelo StageFlow" title="Verificado pelo StageFlow">
  <BadgeCheck size={compact?18:21} strokeWidth={2.5} aria-hidden="true"/>
  <span>{compact?"Verificado":"Verificado pelo StageFlow"}</span>
 </span>;
}
