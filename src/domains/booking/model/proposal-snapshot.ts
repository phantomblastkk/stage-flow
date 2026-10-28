import type {Proposal} from "../proposal-types";
import {parseFeeInput} from "./fee-input";
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const text=(value:unknown)=>value===null||typeof value==="string";
const date=(value:unknown)=>typeof value==="string"&&Number.isFinite(Date.parse(value));
const id=(value:unknown)=>typeof value==="string"&&uuid.test(value);
export function isProposalSnapshot(value:unknown):value is Proposal[]{
 return Array.isArray(value)&&value.every(row=>row&&typeof row==="object"&&id(row.id)&&
  typeof row.title==="string"&&text(row.venue)&&text(row.city)&&text(row.details)&&
  date(row.starts_at)&&date(row.created_at)&&(row.responded_at===null||date(row.responded_at))&&
  ["pending","accepted","declined","withdrawn"].includes(row.status)&&
  (row.fee_amount===null||(typeof row.fee_amount==="number"&&parseFeeInput(String(row.fee_amount))!==undefined))&&
  (row.linked_event_id===null||id(row.linked_event_id))&&(row.linked_invitation_id===null||id(row.linked_invitation_id)));
}
