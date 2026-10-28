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
const billing=read("src/domains/billing/services/finance-service.ts");
const csv=read("src/domains/billing/model/finance-csv.ts");
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
 assert.match(inbox,/saveThreadAvailability/);
 assert.match(read("src/domains/booking/services/booking-service.ts"),/stage_hiring_availability/);
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
 assert.match(billing,/stage_finance_organizer_overview/);
 assert.match(billing,/stage_my_show_history/);
 assert.match(money,/EventBudgetPanel/);
 assert.match(money,/Exportar CSV/);
 assert.match(money,/Resultado líquido estimado/);
 assert.match(money,/buildFinanceCsv/);
  assert.match(read("src/domains/navigation/workspace-navigation.ts"),/\/financeiro/);
  assert.match(read("src/domains/navigation/workspace-navigation.ts"),/\/conversas/);
});

test("monthly finance compares projected net and actual cash without assuming payment",()=>{
 assert.match(money,/buildFinanceReport/);
 assert.doesNotMatch(money,/\.reduce\(/);
 assert.match(money,/Resultado líquido previsto/);
 assert.match(money,/Saldo de caixa registrado/);
 assert.match(money,/m\.hasMissing\?"Parcial/);
});

test("financial overview includes outstanding receivables and unpaid commitments",()=>{
 assert.match(money,/pendingReceivables,pendingPayables,pendingIncomplete/);
 assert.match(money,/A receber \(estimado\)/);
 assert.match(money,/Compromissos a pagar/);
 assert.match(money,/pendingIncomplete\?"Parcial/);
});

test("per-show financial summaries and detailed CSV preserve unknown values",()=>{
 assert.match(money,/Resultado líquido previsto:/);
 assert.match(money,/Resultado estimado:/);
 assert.match(money,/A receber: <strong>/);
 assert.match(money,/A pagar: <strong>/);
 assert.match(money,/stage-flow-financeiro-detalhado\.csv/);
 assert.match(csv,/Compromissos a pagar.*Resultado líquido previsto.*Saldo de caixa registrado.*Valores incompletos/);
 assert.match(csv,/value\.cents === null \? ""/);
 assert.match(money,/buildFinanceCsv/);
});

test("advanced singer reports use Pro entitlement while core finances remain available",()=>{
 const plans=read("app/planos/page.tsx");
 assert.match(plans,/Relatórios financeiros avançados do cantor/);
 assert.match(plans,/Controle financeiro básico por show/);
 assert.match(plans,/Galeria profissional, vídeos e destaques/);
 assert.match(billing,/stage_my_pro_site_publication/);
 assert.match(billing,/entitlement\?\.entitled\s*===\s*true/);
 assert.match(money,/reportAccess\?<section className="finance-two">/);
 assert.match(money,/reportAccess&&<p>Resultado líquido previsto:/);
 assert.match(money,/reportAccess&&<p>Resultado estimado:/);
 assert.match(money,/href="\/planos"/);
 assert.match(money,/disabled=\{loading\|\|Boolean\(visibleError\)\|\|coverageLimited\|\|!hasAny\|\|!reportAccessReady\}/);
});

test("locked Pro modules show blurred preview and upgrade without hiding free accounting",()=>{
 const lock=read("components/pro-feature-lock.tsx");
 const styles=read("components/pro-feature-lock.css");
 const pro=read("app/meu-perfil-artistico/site-profissional/pro-publish-controls.tsx");
 assert.match(lock,/Assinar versão Pro/);
 assert.match(lock,/href="\/assinatura"/);
 assert.match(lock,/aria-hidden="true" inert/);
 assert.match(styles,/filter:blur\(13px\)/);
 assert.match(money,/ProFeatureLock title="Relatórios financeiros Pro"/);
 assert.match(pro,/ProFeatureLock title="Personalização Pro do perfil"/);
 assert.match(money,/EventBudgetPanel/);
});

test("subscription landing never creates payments and reads server-side entitlement",()=>{
 const landing=read("app/assinatura/page.tsx");
 const plan=read("app/planos/page.tsx");
 assert.match(landing,/stage_my_pro_site_publication/);
 assert.match(landing,/Assinatura ainda indisponível/);
 assert.match(landing,/Não estamos recebendo pagamentos/);
 assert.match(plan,/href="\/assinatura"/);
 assert.doesNotMatch(landing,/signUp\(|checkout\.sessions|stripe\.checkout|service_role/i);
});

test("musician fee negotiation leads to confirmation without bypassing financial approval",()=>{
 const invites=read("app/meus-convites/page.tsx");
 const negotiation=read("components/fee-negotiation.tsx")+read("src/domains/booking/services/negotiation-service.ts");
 const sql=read("supabase/private_fee_negotiations_migration.sql");
 const respond=func(sql,"stage_respond_invite");
 assert.match(respond,/if p_accept and exists/);
 assert.match(respond,/f\.agreed_amount is null/);
 assert.match(respond,/then return 'fee_pending'/);
 assert.match(respond,/i\.musician_id = auth\.uid\(\)/);
 assert.match(invites,/data === "fee_pending"/);
 assert.match(invites,/setFeeFocus\(\(prev\) => \(\{ invitationId: invite\.id, request: prev\.request \+ 1 \}\)\)/);
 assert.match(invites,/openRequest=\{feeFocus\.invitationId === invite\.id \? feeFocus\.request : 0\}/);
 assert.match(invites,/invitationStatus=\{invite\.status\}/);
 assert.match(invites,/onConfirmParticipation=\{invite\.status === "pending" \? \(\) => void respond\(invite, true\) : undefined\}/);
 assert.match(negotiation,/useEffect\(\(\) => \{/);
 assert.match(negotiation,/if \(openRequest <= 0\) return/);
 assert.match(negotiation,/setExpanded\(true\)/);
 assert.match(negotiation,/scrollIntoView/);
 assert.match(negotiation,/data\.agreed_amount !== null && onConfirmParticipation/);
 assert.match(negotiation,/Confirmar presença no show/);
 assert.match(negotiation,/effectiveStatus === "pending"/);
 assert.match(negotiation,/stage_fee_details/);
 assert.match(negotiation,/stage_accept_fee/);
 assert.doesNotMatch(invites,/\.from\("stage_fee_negotiations"\)/);
 assert.doesNotMatch(negotiation,/\.from\("stage_fee_negotiations"\)/);
 assert.match(invites,/\/eventos\/operacao\?evento=/);
});
