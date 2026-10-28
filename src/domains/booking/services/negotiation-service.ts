import type { SupabaseClient } from "@supabase/supabase-js";
type BookingClient=Pick<SupabaseClient,"rpc">;
// Existing RPCs authorize participants and enforce acceptance/conflicts atomically.
export function readProposals(db:BookingClient,args:{p_thread_id:string}){return db.rpc("stage_hiring_proposals",args);}
export function readProposalPrefill(db:BookingClient,args:{p_thread_id:string}){return db.rpc("stage_hiring_proposal_prefill",args);}
export function checkProposalSchedule(db:BookingClient,args:{p_musician_id:string;p_start:string;p_end:string;p_thread_id:string;p_ignore_event:string|null}){return db.rpc("stage_musician_schedule_check",args);}
export function sendProposal(db:BookingClient,args:{p_thread_id:string;p_title:string;p_venue:string|null;p_city:string|null;p_starts_at:string;p_fee:number|null;p_details:string|null}){return db.rpc("stage_hiring_proposal_send",args);}
export function decideProposal(db:BookingClient,args:{p_proposal_id:string;p_accept:boolean}){return db.rpc("stage_hiring_proposal_decide",args);}
export function withdrawProposal(db:BookingClient,args:{p_proposal_id:string}){return db.rpc("stage_hiring_proposal_withdraw",args);}
export function readFeeDetails(db:BookingClient,args:{p_invitation_id:string}){return db.rpc("stage_fee_details",args);}
export function offerFee(db:BookingClient,args:{p_invitation_id:string;p_amount:number;p_note:string|null}){return db.rpc("stage_offer_fee",args);}
export function acceptFee(db:BookingClient,args:{p_invitation_id:string}){return db.rpc("stage_accept_fee",args);}
