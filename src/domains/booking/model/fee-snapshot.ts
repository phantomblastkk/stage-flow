import type {FeeData} from "../negotiation-types";
const amount=(value:unknown)=>typeof value==="number"&&Number.isFinite(value)&&value>0&&value<=999999.99&&Math.abs(value*100-Math.round(value*100))<0.000001;
const optionalAmount=(value:unknown)=>value===null||amount(value);
export function isFeeSnapshot(value:unknown):value is FeeData{
 if(!value||typeof value!=="object")return false;
 const row=value as Record<string,unknown>;
 return ["pending","accepted","declined","cancelled"].includes(String(row.status))&&
  typeof row.is_owner==="boolean"&&typeof row.has_offer==="boolean"&&(typeof row.last_by_me==="boolean"||(row.has_offer===false&&row.last_by_me===null))&&
  row.has_offer===(row.last_amount!==null)&&
  optionalAmount(row.last_amount)&&optionalAmount(row.agreed_amount)&&
  (row.last_note===null||typeof row.last_note==="string")&&Array.isArray(row.history)&&
  row.history.every(item=>item&&typeof item==="object"&&amount(item.amount)&&typeof item.by_me==="boolean"&&
   (item.note===null||typeof item.note==="string")&&typeof item.date==="string");
}
