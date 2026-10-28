import type { Organized, Participation } from "../../billing/types";
import {buildFinanceReport} from "../../billing/model/finance-report";
import {financeMonthKey} from "../../billing/model/money";

/** Reuse Finance's cent arithmetic and exclude self-participation and cancellations. */
export function operationalSummary(organized:Organized[],participations:Participation[],now=new Date()) {
 const ids=new Set(organized.map(row=>row.event_id));
 const guest=participations.filter(row=>!ids.has(row.event_id));
 const all=buildFinanceReport(organized,guest,{mode:"all",year:"all",month:"all"});
 const month=buildFinanceReport(organized,guest,{mode:"all",year:"all",month:financeMonthKey(now.toISOString())});
 const rows=[...all.visibleOwner,...all.visibleMusician];
 return {month,all,
  recent:rows.filter(row=>row.financial.received>0).sort((a,b)=>b.starts_at.localeCompare(a.starts_at)).slice(0,3),
  upcoming:rows.filter(row=>(row.financial.receivable??0)>0).sort((a,b)=>a.starts_at.localeCompare(b.starts_at)).slice(0,3)};
}
export function greeting(now=new Date()) {
 const hour=Number(new Intl.DateTimeFormat("pt-BR",{hour:"numeric",hourCycle:"h23",timeZone:"America/Sao_Paulo"}).format(now));
 return hour<12?"Bom dia":hour<18?"Boa tarde":"Boa noite";
}
