import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const read=p=>readFileSync(resolve(process.cwd(),p),"utf8");
const panel=read("app/painel/page.tsx");
const nav=read("src/domains/navigation/workspace-navigation.ts");
const sidebar=read("src/domains/navigation/components/workspace-sidebar.tsx");
const dashboard=read("src/domains/dashboard/components/workspace-overview.tsx");
const overviewSql=read("supabase/stage_workspace_overview_migration.sql");
const ui=read("src/components/ui/index.tsx");
const css=read("src/components/ui/tokens.css");
test("workspace preserves existing URLs while grouping actions for artists and producers",()=>{
 for(const route of ["/painel","/eventos","/minha-disponibilidade","/meus-shows",
  "/meus-convites","/conversas","/convites","/marketplace","/financeiro",
  "/meu-portfolio","/meu-perfil-artistico","/meu-desempenho",
  "/minha-conta","/notificacoes","/admin/central"]){
  assert.ok(nav.includes(route),"Missing navigation route "+route);
 }
 assert.match(nav,/role.isMusician/);
 assert.match(nav,/role.isSinger/);
 assert.match(nav,/role.isOwnerAdmin/);
 assert.match(nav,/if\(role.partnerHouseCount\)/);
 assert.match(panel,/<WorkspaceSidebar role=/);
 assert.match(panel,/<WorkspaceOverview isSinger=/);
 assert.doesNotMatch(panel,/primary\.map\(|secondary\.map\(|\.dashboard-shortcuts/);
});
test("mobile navigation has real accessible group control, escape and one-handed quick actions",()=>{
 assert.match(sidebar,/usePathname/);
 assert.match(sidebar,/aria-current=\{active\?"page":undefined\}/);
 assert.match(sidebar,/<details/);
 assert.match(sidebar,/<summary>/);
 assert.match(sidebar,/aria-label="Acesso rápido no celular"/);
 assert.match(sidebar,/event.key==="Escape"/);
 assert.match(sidebar,/document.body.style.overflow="hidden"/);
 const styles=read("src/domains/navigation/components/workspace-shell.css");
 assert.match(styles,/@media\(max-width:850px\)/);
 assert.match(styles,/env\(safe-area-inset-bottom\)/);
 assert.match(styles,/sf-workspace-bottom-nav/);
 assert.match(styles,/prefers-reduced-motion/);
});
test("dashboard numbers and activity are real private bounded database data",()=>{
 assert.match(overviewSql,/create or replace function public.stage_workspace_overview/);
 assert.match(overviewSql,/auth.uid\(\)/);
 assert.match(overviewSql,/where p.id=v_uid/);
 assert.match(overviewSql,/i.musician_id=v_uid and i.status='pending'/);
 assert.match(overviewSql,/h.requester_id=v_uid/);
 assert.match(overviewSql,/h.musician_id=v_uid/);
 assert.match(overviewSql,/n.recipient_id=v_uid/);
 assert.match(overviewSql,/b.artist_id=v_uid/);
 assert.match(overviewSql,/limit 6/);
 assert.match(overviewSql,/limit 8/);
 assert.match(overviewSql,/received_month/);
 assert.match(overviewSql,/revoke all on function public.stage_workspace_overview\(\) from public,anon,authenticated/);
 assert.match(overviewSql,/grant execute on function public.stage_workspace_overview\(\) to authenticated/);
 assert.doesNotMatch(overviewSql,/service_role|raw_user_meta_data|set plan_code/i);
 assert.match(dashboard,/stage_workspace_overview/);
 assert.match(dashboard,/!Array.isArray\(snapshot.upcoming\)/);
 assert.match(dashboard,/Contagem de conversas, não de mensagens individuais/);
 assert.match(dashboard,/Registros manuais de shows do mês/);
 assert.match(dashboard,/A atividade não é marcada como lida/);
});
test("all 15 reusable design system components are present and keyboard-accessible",()=>{
 for(const component of ["Button","Input","Select","Modal","Dialog","Toast","Card","Badge",
  "Avatar","Tabs","EmptyState","Skeleton","LoadingState","StatusChip","StatCard"]){
  assert.match(ui,new RegExp("export function "+component+"\\("));
 }
 assert.match(ui,/aria-modal="true"/);
 assert.match(ui,/if\(e.key==="Escape"\)onClose\(\)/);
 assert.match(ui,/if\(e.key==="Tab"\)/);
 assert.match(ui,/aria-invalid/);
 assert.match(ui,/aria-selected/);
 assert.match(ui,/onError=\{\(\)=>setBroken\(true\)\}/);
 assert.match(css,/--sf-ui-brand/);
 assert.match(css,/prefers-reduced-motion/);
});
test("private routes are excluded from search indexing; venue metadata is canonical",()=>{
 const robots=read("app/robots.ts");
 const venue=read("app/casa/[slug]/layout.tsx");
 assert.match(robots,/NEXT_PUBLIC_STAGE_FLOW_ENV==="homologation"/);
 for(const route of ["/admin/","/painel","/financeiro","/minha-conta","/notificacoes","/conversas"]){
  assert.ok(robots.includes(route));
 }
 assert.match(venue,/alternates:\{canonical\}/);
 assert.match(venue,/url:canonical/);
});
