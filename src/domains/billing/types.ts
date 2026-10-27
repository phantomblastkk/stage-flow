export type Organized = {
 event_id:string;title:string;starts_at:string;venue:string|null;city:string|null;
 event_status:string;has_budget:boolean;gross_revenue:number|null;received:number;
 expense_total:number;expense_paid:number;transport_total:number;equipment_total:number;
 staff_total:number;food_total:number;other_total:number;
 musician_agreed:number;musician_paid:number;musician_unpriced:number;musician_unpaid_count:number;
};
export type Participation = {
 kind:"participation";record_id:string;event_id:string;title:string;starts_at:string;
 venue:string|null;city:string|null;event_status:string;personal_fee:number|null;
 personal_received:number|null;personal_expenses:number|null;has_financial_record:boolean;
};
export type TeamMember={
 invitation_id:string;musician_name:string;invitation_status:string;
 fee:number|null;fee_confirmed:boolean;paid_amount:number;
};
export type Mode="all"|"organizer"|"musician";
