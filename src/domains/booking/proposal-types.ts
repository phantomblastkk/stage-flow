export type HiringThread = {
  id:string;requested_date:string|null;event_id:string|null;
  availability:"awaiting"|"available"|"unavailable"|"ask_later";
  acting_as:"requester"|"musician";other_id:string;
};
export type ProposalStatus="pending"|"accepted"|"declined"|"withdrawn";
export type Proposal={
  id:string; title:string;venue:string|null;city:string|null;
  starts_at:string;fee_amount:number|null;details:string|null;
  status:ProposalStatus;created_at:string;responded_at:string|null;
  linked_event_id:string|null;linked_invitation_id:string|null
};
