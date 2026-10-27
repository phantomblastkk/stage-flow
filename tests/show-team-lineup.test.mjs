import { test } from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const read=p=>readFileSync(resolve(process.cwd(),p),"utf8");
const sql=read("supabase/show_team_lineup_migration.sql");
const page=read("app/eventos/equipe/page.tsx");
const invites=read("components/event-team-invites.tsx");
const recurring=read("app/shows-recorrentes/page.tsx");
function fn(name){
 const start=sql.indexOf("create or replace function public."+name+"(");
 assert.notEqual(start,-1,"Missing "+name);
 const end=sql.indexOf("\n$$;",start);
 assert.notEqual(end,-1,"Unclosed "+name);
 return sql.slice(start,end);
}
test("lineup roster is only visible to event owner",()=>{
 assert.match(sql,/alter table public\.stage_show_lineup_slots enable row level security/);
 assert.match(sql,/alter table public\.stage_show_lineup_assignments enable row level security/);
 assert.match(sql,/revoke all on public\.stage_show_lineup_slots from public,anon,authenticated/);
 assert.match(sql,/revoke all on public\.stage_show_lineup_assignments from public,anon,authenticated/);
 assert.match(fn("stage_show_lineup_overview"),/producer_id=auth\.uid\(\)/);
 assert.match(fn("stage_show_lineup_overview"),/stage_show_lineup_assignments/);
 assert.match(fn("stage_show_lineup_overview"),/stage_show_lineup_slots/);
});
test("all operations enforce ownership and closed-event restrictions",()=>{
 for(const name of ["stage_show_lineup_add_slot","stage_show_lineup_import_team",
 "stage_show_lineup_invite","stage_show_lineup_release","stage_show_lineup_remove_slot"]){
  const body=fn(name);
  assert.match(body,/producer_id=auth\.uid\(\)/,name+" must scope event owner");
  assert.match(body,/event_closed/,name+" must reject ended show");
  assert.match(sql,new RegExp("revoke all on function public\\."+name+"\\("));
  assert.match(sql,new RegExp("grant execute on function public\\."+name+"\\("));
 }
 assert.match(fn("stage_show_lineup_import_team"),/owner_id=auth\.uid\(\)/);
 assert.match(fn("stage_show_lineup_import_team"),/on conflict \(event_id,source_team_member_id\)/);
});
test("invite only known musicians and never overwrite accepted invitation",()=>{
 const body=fn("stage_show_lineup_invite");
 assert.match(body,/p\.is_artist=true/);
 assert.match(body,/not_previous_invitee/);
 assert.match(body,/v_current in \('pending','accepted'\)/);
 assert.match(body,/active_assignment/);
 assert.match(body,/assigned_elsewhere/);
 assert.match(body,/closed_invite/);
 assert.match(body,/insert into public\.invitations/);
 assert.match(body,/'pending'/);
 assert.match(body,/insert into public\.stage_show_lineup_assignments/);
});
test("releasing an accepted invitation requires explicit reason and is audited",()=>{
 const body=fn("stage_show_lineup_release");
 assert.match(body,/char_length\(v_reason\) not between 5 and 250/);
 assert.match(body,/v_status in \('pending','accepted'\)/);
 assert.match(body,/set status='cancelled',responded_at=now\(\)/);
 assert.match(body,/release_reason=v_reason/);
 assert.match(body,/current_invitation_id=null/);
 assert.match(fn("stage_show_lineup_remove_slot"),/has_history/);
 assert.match(fn("stage_show_lineup_remove_slot"),/has_assignment/);
 assert.match(page,/window\.confirm\(/);
 assert.match(page,/ATENÇÃO: esta ação CANCELARÁ/);
});
test("UI shows confirmed, pending, declined and open roles, connected to event",()=>{
 assert.match(page,/stage_show_lineup_overview/);
 assert.match(page,/stage_show_lineup_add_slot/);
 assert.match(page,/stage_show_lineup_import_team/);
 assert.match(page,/stage_show_lineup_invite/);
 assert.match(page,/stage_show_lineup_release/);
 assert.match(page,/stage_show_lineup_remove_slot/);
 assert.match(page,/Formação original/);
 assert.match(page,/Histórico/);
 assert.match(invites,/Gerenciar escala, confirmações e substituições deste show/);
 assert.match(recurring,/Gerenciar escala/);
 assert.doesNotMatch(page,/SUPABASE_SERVICE_ROLE_KEY|WHATSAPP_CLOUD_ACCESS_TOKEN/);
});
