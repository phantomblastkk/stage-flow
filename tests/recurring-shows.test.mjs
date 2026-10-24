import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const read=path=>readFileSync(resolve(process.cwd(),path),"utf8");
const sql=read("supabase/recurring_show_series_migration.sql");
const page=read("app/shows-recorrentes/page.tsx");
const dashboard=read("app/painel/page.tsx");
const teams=read("supabase/fixed_teams_migration.sql");

function fn(name){
 const at=sql.indexOf("create or replace function public."+name+"(");
 assert.notEqual(at,-1,"Missing "+name);
 const end=sql.indexOf("\n$$;",at);
 assert.notEqual(end,-1,"Unterminated "+name);
 return sql.slice(at,end);
}
test("weekly series is owned and protected, never readable by other users",()=>{
 assert.match(sql,/alter table public\.stage_recurring_show_series enable row level security/);
 assert.match(sql,/alter table public\.stage_recurring_show_occurrences enable row level security/);
 assert.match(sql,/revoke all on public\.stage_recurring_show_series from PUBLIC,anon,authenticated/);
 assert.match(sql,/revoke all on public\.stage_recurring_show_occurrences from PUBLIC,anon,authenticated/);
 assert.match(fn("stage_recurring_show_list"),/owner_id=auth\.uid\(\)/);
 assert.match(fn("stage_recurring_show_pause"),/where id=p_id and owner_id=auth\.uid\(\)/);
 assert.match(fn("stage_recurring_show_generate"),/where id=p_series_id and owner_id=auth\.uid\(\) for update/);
 assert.match(fn("stage_recurring_show_create"),/t\.owner_id=auth\.uid\(\)/);
});
test("recurring shows are drafts, idempotent and do not auto-invite anyone",()=>{
 const generator=fn("stage_recurring_show_generate");
 assert.match(generator,/v_series\.active/);
 assert.match(generator,/generate_series\(/);
 assert.match(generator,/not exists\(select 1 from public\.stage_recurring_show_occurrences/);
 assert.match(generator,/limit least\(8,52-v_existing\)/);
 assert.match(generator,/e\.producer_id=auth\.uid\(\)/);
 assert.match(generator,/insert into public\.events/);
 assert.match(generator,/'draft',false/);
 assert.match(generator,/insert into public\.stage_recurring_show_occurrences/);
 assert.doesNotMatch(generator,/insert into public\.invitations|stage_invite_team_to_event/i);
 const creator=fn("stage_recurring_show_create");
 assert.match(creator,/stage_recurring_show_generate\(v_id\)/);
 assert.match(creator,/p_ends_on>p_starts_on\+180/);
 assert.match(creator,/t\.owner_id=auth\.uid\(\)/);
 assert.doesNotMatch(creator,/stage_invite_team_to_event/);
});
test("existing teams require explicit confirmed invitations per occurrence",()=>{
 assert.match(teams,/create or replace function public\.stage_invite_team_to_event/);
 assert.match(teams,/on conflict \(event_id, musician_id\) do nothing/);
 assert.match(page,/stage_my_teams/);
 assert.match(page,/stage_recurring_show_list/);
 assert.match(page,/stage_recurring_show_generate/);
 assert.match(page,/stage_recurring_show_create/);
 assert.match(page,/stage_recurring_show_pause/);
 assert.match(page,/stage_invite_team_to_event/);
 assert.match(page,/window\.confirm\(/);
 assert.match(page,/Nenhum músico foi convidado automaticamente/);
 assert.match(page,/shows-recorrentes\.css/);
 assert.match(dashboard,/href: "\/shows-recorrentes"/);
});
