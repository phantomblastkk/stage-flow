import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const read=p=>readFileSync(resolve(process.cwd(),p),"utf8");
const chat=read("supabase/hiring_chat_whatsapp_migration.sql");
const finance=read("supabase/finance_dashboard_migration.sql");
const inbox=read("app/conversas/page.tsx");
const catalog=read("components/marketplace-catalog.tsx");
const money=read("app/financeiro/page.tsx");
const worker=read("app/api/stage-chat/whatsapp-dispatch/route.ts");
const dashboard=read("app/painel/page.tsx");
function func(sql,name){
 const start=sql.indexOf("create or replace function public."+name+"(");
 assert.notEqual(start,-1,"Missing "+name);
 const end=sql.indexOf("\n$$;",start);
 assert.notEqual(end,-1,"Unterminated "+name);
 return sql.slice(start,end);
}
test("hiring chat never publicly reveals contact info or messages",()=>{
 assert.match(chat,/create table if not exists public\.stage_hiring_messages/);
 assert.match(chat,/create table if not exists public\.stage_hiring_whatsapp_preferences/);
 assert.match(chat,/revoke all on public\.%I from public,anon,authenticated/);
 const readMessages=func(chat,"stage_hiring_messages");
 assert.match(readMessages,/auth\.uid\(\) in \(t\.requester_id,t\.musician_id\)/);
 assert.match(func(chat,"stage_hiring_list"),/auth\.uid\(\) in \(requester_id,musician_id\)/);
 assert.doesNotMatch(readMessages,/phone_e164/);
 assert.match(func(chat,"stage_hiring_start"),/stage_hiring_can_start/);
 assert.match(func(chat,"stage_hiring_start"),/requester_id=v_user and musician_id=p_musician_id/);
 assert.match(func(chat,"stage_hiring_send"),/for update/);
 assert.match(func(chat,"stage_hiring_send"),/sender_id=auth\.uid\(\)/);
 assert.match(func(chat,"stage_hiring_send"),/opted_in=true/);
 assert.match(func(chat,"stage_hiring_availability"),/t\.musician_id=auth\.uid\(\)/);
 assert.match(chat,/revoke all on function public\.stage_hiring_send\(uuid,text\) from public,anon,authenticated/);
});

test("WhatsApp is opted in, deferred and server-only",()=>{
 assert.match(chat,/opted_in boolean not null default false/);
 assert.match(chat,/stage_hiring_whatsapp_outbox/);
 assert.match(chat,/p_consent is not null/);
 assert.match(chat,/status='expired'/);
 assert.match(worker,/STAGE_CHAT_WHATSAPP_ENABLED==="true"/);
 assert.match(worker,/STAGE_CHAT_CRON_SECRET/);
 assert.match(worker,/SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(worker,/WHATSAPP_CLOUD_ACCESS_TOKEN/);
 assert.match(worker,/type:"template"/);
 assert.match(worker,/messaging_product:"whatsapp"/);
 assert.doesNotMatch(inbox,/service_role|WHATSAPP_CLOUD_ACCESS_TOKEN/);
 assert.match(inbox,/stage_hiring_whatsapp_settings/);
 assert.match(inbox,/stage_hiring_availability/);
 assert.match(catalog,/\/conversas\?musico=/);
});

test("finance controls require ownership and never move money",()=>{
 assert.match(finance,/create table if not exists public\.stage_finance_musician_payments/);
 assert.match(finance,/enable row level security/);
 assert.match(finance,/revoke all on public\.stage_finance_musician_payments from public,anon,authenticated/);
 const overview=func(finance,"stage_finance_organizer_overview");
 assert.match(overview,/producer_id=auth\.uid\(\)/);
 assert.match(overview,/category='transport'/);
 assert.match(overview,/b\.received_amount/);
 assert.match(overview,/pay\.paid_amount/);
 assert.match(func(finance,"stage_finance_save_musician_payment"),/e\.producer_id=auth\.uid\(\)/);
 assert.match(func(finance,"stage_finance_event_team"),/producer_id=auth\.uid\(\)/);
 assert.doesNotMatch(finance,/\bpg_net\b|\bhttp_post\b/i);
 assert.match(money,/stage_finance_organizer_overview/);
 assert.match(money,/stage_my_show_history/);
 assert.match(money,/EventBudgetPanel/);
 assert.match(money,/Exportar CSV/);
 assert.match(money,/Resultado líquido estimado/);
 assert.match(money,/safeCsvCell/);
 assert.match(dashboard,/href: "\/financeiro"/);
 assert.match(dashboard,/href: "\/conversas"/);
});

test("monthly finance compares projected net and actual cash without assuming payment",()=>{
 assert.match(money,/projected:0,hasMissing:false/);
 assert.match(money,/x\.projected\+=val\(r\.gross_revenue\)-val\(r\.expense_total\)-val\(r\.musician_agreed\)/);
 assert.match(money,/x\.projected\+=val\(r\.personal_fee\)-val\(r\.personal_expenses\)/);
 assert.match(money,/Resultado líquido previsto/);
 assert.match(money,/Saldo de caixa registrado/);
 assert.match(money,/m\.hasMissing\?"Parcial/);
});

test("financial overview includes outstanding receivables and unpaid commitments",()=>{
 assert.match(money,/const pendingReceivables=/);
 assert.match(money,/Math\.max\(0,val\(r\.gross_revenue\)-val\(r\.received\)\)/);
 assert.match(money,/Math\.max\(0,val\(r\.personal_fee\)-val\(r\.personal_received\)\)/);
 assert.match(money,/const pendingExpenses=/);
 assert.match(money,/const pendingFees=/);
 assert.match(money,/A receber \(estimado\)/);
 assert.match(money,/Compromissos a pagar/);
 assert.match(money,/pendingIncomplete\?"Parcial/);
});
