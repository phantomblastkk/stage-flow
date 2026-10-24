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
  assert.match(dashboard,/href: "\/meus-shows"/);
  assert.doesNotMatch(page,/\.from\("stage_show_participation_finance"\)/);
  assert.match(read("app/meus-shows/meus-shows.css"),/show-history-list/);
});
