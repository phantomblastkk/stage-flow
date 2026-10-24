import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const load=path=>readFileSync(resolve(process.cwd(),path),"utf8");
const sql=load("supabase/musician_smart_schedule_migration.sql");
const guard=load("supabase/musician_schedule_proposal_guard_migration.sql");
const page=load("app/minha-disponibilidade/page.tsx");
const props=load("components/hiring-proposals.tsx");
const dash=load("app/painel/page.tsx");
function fn(source,name){
 const at=source.indexOf("create or replace function public."+name+"(");
 assert.notEqual(at,-1,"Missing function "+name);
 const end=source.indexOf("\n$$;",at);
 assert.notEqual(end,-1,"Unterminated function "+name);
 return source.slice(at,end);
}
test("private musician calendar: blocks, weekly recurrence and owner-only edits",()=>{
 assert.match(sql,/create table if not exists public\.stage_musician_availability_rules/);
 assert.match(sql,/alter table public\.stage_musician_availability_rules enable row level security/);
 assert.match(sql,/revoke all on public\.stage_musician_availability_rules from public,anon,authenticated/);
 assert.match(fn(sql,"stage_musician_schedule_list"),/musician_id=auth\.uid\(\)/);
 assert.match(fn(sql,"stage_musician_schedule_save"),/auth\.uid\(\)/);
 assert.match(fn(sql,"stage_musician_schedule_save"),/limit_reached/);
 assert.match(fn(sql,"stage_musician_schedule_remove"),/musician_id=auth\.uid\(\)/);
 assert.match(sql,/check\(end_minute between 1 and 1440\)/);
});
test("private availability check hides details and catches existing accepted invites",()=>{
 const fnSrc=fn(sql,"stage_musician_schedule_check");
 assert.match(fnSrc,/auth\.uid\(\)<>p_musician_id/);
 assert.match(fnSrc,/auth\.uid\(\) in \(t\.requester_id,t\.musician_id\)/);
 assert.match(fnSrc,/r\.kind='weekly'/);
 assert.match(fnSrc,/r\.kind='day'/);
 assert.match(fnSrc,/i\.status='accepted'/);
 assert.match(fnSrc,/e\.starts_at<p_end/);
 assert.match(fnSrc,/coalesce\(e\.ends_at,e\.starts_at\+interval '4 hours'\)>p_start/);
 assert.match(fnSrc,/p\.status='pending'/);
 assert.match(fnSrc,/return 'possible_conflict'/);
 assert.match(fnSrc,/return 'busy'/);
 assert.doesNotMatch(fnSrc,/return jsonb_build_object\('title'/);
});
test("accepting a chat proposal checks conflicts atomically under musician lock",()=>{
 const sender=fn(guard,"stage_hiring_proposal_send");
 const accept=fn(guard,"stage_hiring_proposal_decide");
 assert.match(sender,/stage_musician_schedule_check/);
 assert.match(sender,/schedule_conflict/);
 assert.match(accept,/pg_advisory_xact_lock/);
 assert.match(accept,/stage_musician_schedule_check/);
 assert.match(accept,/schedule_conflict/);
 assert.match(accept,/insert into public\.invitations/);
 assert.match(accept,/linked_invitation_id=v_invitation/);
 assert.match(guard,/grant execute on function public\.stage_hiring_proposal_decide/);
});
test("scheduling UI is private, integrated and exposes no contacts or secrets",()=>{
 assert.match(page,/stage_musician_schedule_list/);
 assert.match(page,/stage_musician_schedule_save/);
 assert.match(page,/stage_musician_schedule_remove/);
 assert.match(page,/stage_musician_schedule_check/);
 assert.match(page,/Banda fixa semanal/);
 assert.match(page,/Compromissos semanais/);
 assert.match(page,/4 horas/);
 assert.match(dash,/href: "\/minha-disponibilidade"/);
 assert.match(props,/Verificar conflito antes de enviar/);
 assert.match(props,/schedule_conflict/);
 assert.doesNotMatch(page,/SUPABASE_SERVICE_ROLE_KEY|WHATSAPP_CLOUD_ACCESS_TOKEN/);
});
