import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const read=path=>readFileSync(resolve(process.cwd(),path),"utf8");
const sql=read("supabase/stage_workspace_activity_bounded_migration.sql");
const overview=read("src/domains/dashboard/components/workspace-overview.tsx");
const next=read("src/domains/dashboard/components/workspace-next-step.tsx");
const nav=read("src/domains/navigation/components/workspace-sidebar.tsx");
const ui=read("src/components/ui/index.tsx");
const styles=read("src/domains/navigation/components/workspace-shell.css");

test("six private activity origins are capped before union, and final feed never exceeds eight",()=>{
 const branches=(sql.match(/order by 6 desc,1 desc limit 8\)/g)||[]).length;
 assert.equal(branches,6,"one bounded query per activity origin");
 assert.match(sql,/order by created_at desc,id limit 8/);
 assert.match(sql,/where n.recipient_id=v_uid/);
 assert.match(sql,/where b.artist_id=v_uid/);
 assert.match(sql,/and \(i.musician_id=v_uid or e.producer_id=v_uid\)/);
 assert.match(sql,/where v.target_id=v_uid/);
 assert.match(sql,/where i.musician_id=v_uid and f.received_amount>0/);
 assert.match(sql,/where e.producer_id=v_uid and b.received_amount>0/);
 assert.match(sql,/v_uid uuid:=auth.uid\(\)/);
 assert.match(sql,/if v_uid is null then return jsonb_build_object\('status','login_required'\)/);
 assert.match(sql,/revoke all on function public.stage_workspace_overview\(\) from public,anon,authenticated/);
 assert.match(sql,/grant execute on function public.stage_workspace_overview\(\) to authenticated/);
 assert.doesNotMatch(sql,/insert into public\.|update public\.|delete from public\.|service_role/i);
});

test("dashboard displays a contextual priority instead of empty cards while still loading",()=>{
 assert.match(next,/export function nextWorkspaceAction/);
 assert.match(next,/metrics.pending_invites>0/);
 assert.match(next,/metrics.pending_contacts>0/);
 assert.match(next,/metrics.unread_conversations>0/);
 assert.match(next,/metrics.shows_week>0/);
 assert.match(next,/role.isMusician/);
 assert.match(next,/role.isSinger/);
 for(const href of ["/meu-portfolio","/minha-disponibilidade","/meus-convites","/meu-perfil-artistico","/marketplace"]){
  assert.ok(next.includes(href),"Journey missing "+href);
 }
 assert.match(overview,/<WorkspaceNextStep/);
 assert.match(overview,/\{data&&<div className="sf-workspace-columns">/);
 assert.match(overview,/\{data&&<Card className="sf-workspace-action-card">/);
 assert.equal((next.match(/\.rpc\(/g)||[]).length,0,"Do not add redundant dashboard calls");
 assert.match(styles,/@media\(max-width:530px\)/);
 assert.match(styles,/sf-workspace-next-step/);
});

test("mobile drawer traps focus, recovers on escape and prioritizes invitations for musicians",()=>{
 assert.match(nav,/role="dialog" aria-modal="true"/);
 assert.match(nav,/closeRef.current\?\.focus\(\)/);
 assert.match(nav,/event.key==="Tab"/);
 assert.match(nav,/event.key==="Escape"/);
 assert.match(nav,/first\.focus\(\)/);
 assert.match(nav,/last\.focus\(\)/);
 assert.match(nav,/document.body.style.overflow="hidden"/);
 assert.match(nav,/role.isMusician\?"\/meus-convites":"\/conversas"/);
});

test("shared UI has roving keyboard tabs, safe buttons and announced input guidance",()=>{
 assert.match(ui,/<button type="button" \{\.\.\.props\}/);
 assert.match(ui,/aria-describedby=\{helpId\}/);
 assert.match(ui,/tabIndex=\{t.id===value\?0:-1\}/);
 assert.match(ui,/event.key==="ArrowRight"/);
 assert.match(ui,/event.key==="ArrowLeft"/);
 assert.match(ui,/event.key==="Home"/);
 assert.match(ui,/event.key==="End"/);
 assert.match(ui,/aria-controls=\{t.panelId\}/);
 assert.match(ui,/role="dialog" aria-modal="true"/);
});


test("QA-only safe RLS corrections retain ownership and reduce row-scoped auth evaluations",()=>{
 const rls=read("supabase/stage_workspace_rls_events_invitations_migration.sql");
 const venue=read("supabase/stage_workspace_venue_submit_rls_optimization.sql");
 for(const name of [
  "Producers can view own events",
  "Producers can create own events",
  "Producers can update own events",
  "Producers can delete own events",
  "Musicians can view own invitations",
  "Producers can invite musicians to own events",
  "Musicians can respond to own invitations"
 ])assert.ok(rls.includes('alter policy "'+name+'"'));
 assert.match(rls,/\(select auth.uid\(\)\)=producer_id/);
 assert.match(rls,/\(select auth.uid\(\)\)=musician_id/);
 assert.match(rls,/p.role='producer'::public.account_role/);
 assert.match(rls,/stage_hiring_proposals_musician_fk_idx/);
 assert.match(rls,/stage_hiring_proposals_requester_fk_idx/);
 assert.match(rls,/stage_hiring_threads_event_fk_idx/);
 assert.match(venue,/\(select auth.uid\(\)\)=submitted_by/);
 for(const doc of [rls,venue])assert.doesNotMatch(doc,/drop policy|grant select on|grant all|disable row level security|delete from|update public\./i);
});
