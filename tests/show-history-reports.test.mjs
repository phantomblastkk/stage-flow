import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read=(file)=>readFileSync(resolve(process.cwd(),file),"utf8");
const sql=read("supabase/show_history_reports_migration.sql");
const page=read("app/meus-shows/page.tsx");
const dashboard=read("app/painel/page.tsx");
const getFn=(name)=>{
  const first=sql.indexOf("create or replace function public."+name+"(");
  assert.notEqual(first,-1,"Missing function "+name);
  const last=sql.indexOf("\n$$;",first);
  assert.notEqual(last,-1,"Missing SQL function terminator "+name);
  return sql.slice(first,last);
};
test("show archive only reads own events or accepted invitations",()=>{
  const fn=getFn("stage_my_show_history");
  assert.match(fn,/producer_id=auth\.uid\(\)/);
  assert.match(fn,/musician_id=auth\.uid\(\) and status='accepted'/);
  assert.match(fn,/e\.producer_id<>auth\.uid\(\)/);
  assert.match(fn,/coalesce\(h\.self_confirmed,false\)/);
  assert.match(fn,/e\.status='completed'/);
  assert.match(fn,/e\.status<>'cancelled'/);
  assert.match(sql,/grant execute on function public\.stage_my_show_history\(\) to authenticated/);
  assert.match(sql,/revoke all on public\.stage_show_participation_finance from public,anon,authenticated/);
  assert.match(sql,/revoke all on public\.stage_show_owner_history from public,anon,authenticated/);
  assert.match(sql,/alter table public\.stage_show_participation_finance enable row level security/);
});

test("only authenticated participant can track personal receipt and expenses",()=>{
  const fn=getFn("stage_show_save_participation_finance");
  assert.match(fn,/i\.musician_id=auth\.uid\(\)/);
  assert.match(fn,/i\.status='accepted'/);
  assert.match(fn,/e\.producer_id<>auth\.uid\(\)/);
  assert.match(fn,/round\(p_received,2\)<>p_received/);
  assert.doesNotMatch(fn,/update public\.stage_fee_negotiations/i);
  assert.match(sql,/grant execute on function public\.stage_show_save_participation_finance\(uuid,numeric,numeric\)/);
});

test("performed is explicit and individual, never automatically inferred by date",()=>{
  const fn=getFn("stage_show_set_performed");
  assert.match(fn,/producer_id=auth\.uid\(\)/);
  assert.match(fn,/i\.musician_id=auth\.uid\(\)/);
  assert.match(fn,/if v_date>now\(\) then return 'too_early'/);
  assert.match(fn,/status<>'cancelled'/);
  assert.doesNotMatch(fn,/update public\.events/i);
  assert.match(page,/stage_show_set_performed/);
  assert.match(page,/Marcar como realizado/);
  assert.match(page,/Realização não confirmada/);
  assert.match(page,/event_status==="cancelled"/);
});

test("history, optional financial breakdown and all roles are connected",()=>{
  assert.match(page,/stage_my_show_history/);
  assert.match(page,/stage_show_save_participation_finance/);
  assert.match(page,/Relatórios financeiros \(opcional\)/);
  assert.match(page,/kind==="organized"/);
  assert.match(page,/kind==="participation"/);
  assert.match(page,/href=\{"\/eventos\?evento="/);
  assert.match(read("src/domains/navigation/workspace-navigation.ts"),/\/meus-shows/);
  assert.doesNotMatch(page,/\.from\("stage_show_participation_finance"\)/);
  assert.match(read("app/meus-shows/meus-shows.css"),/show-history-list/);
});


test("next gigs are visible before past history with private mobile briefing shortcuts",()=>{
  const fn=getFn("stage_my_show_history");
  const css=read("app/meus-shows/meus-shows.css");
  assert.match(fn,/musician_id=auth\.uid\(\) and status='accepted'/);
  assert.match(fn,/producer_id=auth\.uid\(\)/);
  assert.match(page,/const upcoming=useMemo\(\(\)=>scoped\.filter\(r=>/);
  assert.match(page,/r\.event_status!=="cancelled"&&r\.event_status!=="completed"/);
  assert.match(page,/new Date\(r\.starts_at\)\.getTime\(\)>Date\.now\(\)/);
  assert.match(page,/sort\(\(a,b\)=>new Date\(a\.starts_at\)\.getTime\(\)-new Date\(b\.starts_at\)\.getTime\(\)\)/);
  assert.match(page,/\.slice\(0,6\)/);
  assert.match(page,/aria-label="Próximas apresentações"/);
  assert.match(page,/upcoming\.map\(\(r,index\)=>/);
  assert.match(page,/href=\{"\/eventos\/operacao\?evento="\+encodeURIComponent\(r\.event_id\)\}/);
  assert.match(page,/href="\/notificacoes"/);
  assert.match(page,/href="\/meus-convites"/);
  assert.match(page,/Alterações de horários e logística podem gerar avisos/);
  assert.match(css,/\.show-history-upcoming-list/);
  assert.match(css,/@media\(max-width:720px\)/);
  assert.match(css,/@media\(max-width:450px\)/);
  assert.doesNotMatch(page,/\.from\("invitations"\)|\.from\("stage_show_operations"\)/);
});
