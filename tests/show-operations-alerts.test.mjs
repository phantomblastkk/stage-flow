import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const read=path=>readFileSync(resolve(process.cwd(),path),"utf8");
const sql=read("supabase/show_operations_alerts_migration.sql");
const inbox=read("app/notificacoes/page.tsx");
const bell=read("components/notification-bell.tsx");
const ops=read("app/eventos/operacao/page.tsx");

function fn(name){
 const start=sql.indexOf("create or replace function public."+name+"(");
 assert.notEqual(start,-1,"Missing function: "+name);
 const end=sql.indexOf("\n$$;",start);
 assert.notEqual(end,-1,"Unterminated function: "+name);
 return sql.slice(start,end);
}
test("operative alerts extend the existing inbox, without new public endpoints",()=>{
 assert.match(sql,/stage_internal_notifications_source_type_check/);
 assert.match(sql,/stage_internal_notifications_event_code_check/);
 assert.match(sql,/'operations'/);
 assert.match(sql,/'show_briefing_changed'/);
 assert.match(sql,/drop trigger if exists stage_notify_show_briefing/);
 assert.match(sql,/after insert or update of/);
 assert.match(sql,/on public\.stage_show_operations/);
 assert.match(sql,/revoke all on function public\.stage_notify_show_briefing_trigger\(\)/);
 assert.doesNotMatch(sql,/\bhttp_post\b|\bpg_net\b|whatsapp\.com|graph\.facebook\.com|service_role/);
});
test("alerts require confirmed musicians, active future event and exclude notes",()=>{
 const src=fn("stage_notify_show_briefing_trigger");
 assert.match(src,/i\.status='accepted'/);
 assert.match(src,/i\.musician_id is not null/);
 assert.match(src,/i\.musician_id<>v_owner/);
 assert.match(src,/e\.status not in \('cancelled','completed'\)/);
 assert.match(src,/e\.starts_at>now\(\)/);
 assert.match(src,/v_fields text\[\]/);
 assert.match(src,/if cardinality\(v_fields\)=0 then return new/);
 for(const field of ["arrival_at","soundcheck_at","doors_at","meeting_point",
                      "contact_name","transport_plan","equipment_plan"]){
  assert.match(src,new RegExp("new\\."+field+" is distinct from old\\."+field));
 }
 assert.doesNotMatch(src,/new\.backstage_notes|new\.closing_notes|new\.closed_at/);
 assert.match(src,/left\('Show '/);
 assert.match(src,/array_to_string\(v_fields,', '\)/);
});
test("operational notice is coalesced per event and reopens as unread",()=>{
 const src=fn("stage_notify_show_briefing_trigger");
 assert.match(src,/select distinct i\.musician_id/);
 assert.match(src,/source_type,source_id,event_code,event_id,title,summary/);
 assert.match(src,/new\.event_id,'show_briefing_changed'/);
 assert.match(src,/on conflict\(recipient_id,source_type,source_id,event_code\)/);
 assert.match(src,/created_at=excluded\.created_at/);
 assert.match(src,/read_at=null/);
});
test("center and bell open the correct private operational briefing",()=>{
 assert.match(inbox,/source_type==="operations"/);
 assert.match(bell,/source_type === "operations"/);
 assert.match(inbox,/\/eventos\/operacao\?evento=/);
 assert.match(bell,/\/eventos\/operacao\?evento=/);
 assert.match(inbox,/show_briefing_changed:"Atualização da operação"/);
 assert.match(bell,/code === "show_briefing_changed"/);
 assert.match(ops,/Mudanças nesses dados geram avisos na Central de Notificações/);
 assert.match(ops,/Anotações privadas não geram avisos/);
 assert.doesNotMatch(inbox,/\.from\("stage_internal_notifications"\)/);
 assert.doesNotMatch(bell,/\.from\("stage_internal_notifications"\)/);
});
