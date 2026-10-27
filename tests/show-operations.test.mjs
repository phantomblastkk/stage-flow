import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const read=path=>readFileSync(resolve(process.cwd(),path),"utf8");
const sql=read("supabase/show_operations_migration.sql");
const page=read("app/eventos/operacao/page.tsx");
const agenda=read("app/eventos/page.tsx");
const history=read("app/meus-shows/page.tsx");
const recurring=read("app/shows-recorrentes/page.tsx");
const panel=read("components/event-budget-panel.tsx");
function fn(name){
 const start=sql.indexOf("create or replace function public."+name+"(");
 assert.notEqual(start,-1,"Missing RPC "+name);
 const end=sql.indexOf("\n$$;",start);
 assert.notEqual(end,-1,"Incomplete "+name);
 return sql.slice(start,end);
}
test("operational briefing and tasks are private tables with no direct API access",()=>{
 assert.match(sql,/alter table public\.stage_show_operations enable row level security/);
 assert.match(sql,/alter table public\.stage_show_operation_tasks enable row level security/);
 assert.match(sql,/revoke all on public\.stage_show_operations from public,anon,authenticated/);
 assert.match(sql,/revoke all on public\.stage_show_operation_tasks from public,anon,authenticated/);
 assert.match(sql,/references public\.events\(id\) on delete cascade/);
});
test("only event organizer can manage briefing, checklists and closure",()=>{
 for(const name of ["stage_show_ops_save","stage_show_ops_seed","stage_show_ops_task_save",
    "stage_show_ops_task_toggle","stage_show_ops_task_remove","stage_show_ops_close"]){
  const source=fn(name);
  assert.match(source,/producer_id=auth\.uid\(\)/,name+" must enforce ownership");
  assert.match(source,/for update/,name+" should serialize per event");
  assert.match(source,/cancelled/,name+" must handle cancelled event");
  assert.match(sql,new RegExp("revoke all on function public\\."+name+"\\("));
  assert.match(sql,new RegExp("grant execute on function public\\."+name+"\\("));
 }
});
test("accepted musician sees logistical briefing but not organizer tasks or finance",()=>{
 const source=fn("stage_show_ops_overview");
 assert.match(source,/i\.musician_id=auth\.uid\(\)/);
 assert.match(source,/i\.status='accepted'/);
 assert.match(source,/v_event\.status<>'cancelled'/);
 assert.match(source,/not v_owner and not v_participant/);
 assert.match(source,/if v_owner then/);
 assert.match(source,/v_tasks:='\[\]'::jsonb/);
 assert.match(source,/else null end/);
 assert.match(source,/transport_plan/);
 assert.match(source,/equipment_plan/);
 assert.doesNotMatch(source,/stage_event_budget|stage_event_expenses|fee_amount/);
});
test("template is repeat-safe and closing does not change show status or money",()=>{
 const seed=fn("stage_show_ops_seed");
 const close=fn("stage_show_ops_close");
 assert.match(seed,/on conflict\(event_id,template_code\) do nothing/);
 assert.match(seed,/Registrar despesas e pagamentos realizados/);
 assert.match(seed,/Confirmar local e horário/);
 assert.match(sql,/unique\(event_id,template_code\)/);
 assert.match(close,/v_e\.starts_at>now\(\)/);
 assert.match(close,/category='closing' and not done/);
 assert.match(close,/closing_pending/);
 assert.match(close,/p_reopen/);
 assert.doesNotMatch(close,/update public\.events|update public\.stage_event_budget|update public\.stage_event_expenses/);
});
test("show operations UI links calendar, recurring dates, history, and existing finance",()=>{
 assert.match(page,/stage_show_ops_overview/);
 assert.match(page,/stage_show_ops_save/);
 assert.match(page,/stage_show_ops_seed/);
 assert.match(page,/stage_show_ops_task_save/);
 assert.match(page,/stage_show_ops_task_toggle/);
 assert.match(page,/stage_show_ops_task_remove/);
 assert.match(page,/stage_show_ops_close/);
 assert.match(page,/<EventBudgetPanel eventId=\{eventId\}\/>/);
 assert.match(page,/can_edit/);
 assert.match(page,/Encerramento pós-show/);
 assert.match(agenda,/\/eventos\/operacao\?evento=/);
 assert.match(recurring,/\/eventos\/operacao\?evento=/);
 assert.match(history,/\/eventos\/operacao\?evento=/);
 assert.match(panel,/stage_my_event_budget/);
 assert.doesNotMatch(page,/SUPABASE_SERVICE_ROLE_KEY|WHATSAPP_CLOUD_ACCESS_TOKEN/);
});


test("day-of-show mobile overview uses only authorized briefing fields",()=>{
 const css=read("app/eventos/operacao/operacao.css");
 const source=fn("stage_show_ops_overview");
 assert.match(page,/!owner&&<section className="ops-day-quick"/);
 assert.match(page,/id="dia-do-show" aria-labelledby="ops-day-title"/);
 assert.match(page,/Dia do show, sem correria/);
 assert.match(page,/Chegada da equipe/);
 assert.match(page,/Passagem de som/);
 assert.match(page,/Abertura das portas/);
 assert.match(page,/Início da apresentação/);
 assert.match(page,/Local informado/);
 assert.match(page,/Ponto de encontro/);
 assert.match(page,/Contato no local/);
 assert.match(page,/endereço completo não está disponível/i);
 assert.match(page,/\/notificacoes/);
 assert.match(page,/async function updateDayBriefing\(\)/);
 assert.match(page,/await refresh\(eventId\)/);
 assert.match(page,/navigator\.clipboard\.writeText\(lines\.join\("\\n"\)\)/);
 assert.match(page,/copying\|\|quickRefreshing|quickRefreshing\|\|copying/);
 const copied=page.slice(page.indexOf("async function copyDayBriefing()"),page.indexOf("const tasks=data?.tasks||[]"));
 assert.match(copied,/event\.title/);
 assert.match(copied,/info\.contact_name/);
 assert.match(copied,/info\.equipment_plan/);
 assert.doesNotMatch(copied,/private_details|backstage_notes|closing_notes|fee_amount|expense|stage_finance/i);
 assert.match(source,/i\.status='accepted'/);
 assert.match(source,/v_tasks:='\[\]'::jsonb/);
 assert.match(source,/else null end/);
 assert.match(css,/\.ops-day-quick/);
 assert.match(css,/@media\(max-width:570px\)/);
 assert.match(css,/\.ops-day-actions \.btn/);
});
