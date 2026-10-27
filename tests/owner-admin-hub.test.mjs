import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const read=path=>readFileSync(resolve(process.cwd(),path),"utf8");
const sql=read("supabase/stage_owner_admin_hub_migration.sql");
const page=read("app/admin/central/page.tsx");
const css=read("app/admin/central/central.css");
const metadata=read("app/admin/central/layout.tsx");
const badge=read("components/stage-verified-badge.tsx");
const hook=read("lib/use-stage-verified.ts");

function functionSql(name){
 const start=sql.indexOf("create or replace function public."+name+"(");
 assert.ok(start>=0,"Missing "+name);
 const end=sql.indexOf("\n$$;",start);
 assert.ok(end>start,"Unterminated "+name);
 return sql.slice(start,end);
}

test("owner admin is a unique server-granted account with no table API or self-registration",()=>{
 assert.match(sql,/create table if not exists public\.stage_owner_admins/);
 assert.match(sql,/singleton smallint not null default 1 unique check\(singleton=1\)/);
 for(const table of ["stage_owner_admins","stage_admin_verifications","stage_owner_admin_audit"]){
  assert.match(sql,new RegExp("alter table public\\."+table+" enable row level security"));
  assert.match(sql,new RegExp("revoke all on table public\\."+table+" from PUBLIC,anon,authenticated"));
  assert.doesNotMatch(sql,new RegExp("grant (?:select|insert|update|delete|all) on (?:table )?public\\."+table+" to authenticated","i"));
 }
 assert.doesNotMatch(sql,/insert into public\.stage_owner_admins/);
 assert.match(functionSql("stage_owner_admin_status"),/auth\.uid\(\) is not null/);
 assert.match(functionSql("stage_owner_admin_status"),/where o\.profile_id=auth\.uid\(\)/);
 assert.doesNotMatch(sql,/raw_user_meta_data|service_role|next_public|current_user\s*=\s*'postgres'/i);
});

test("all private owner reports and mutations validate owner at database boundary",()=>{
 for(const name of [
  "stage_owner_admin_metrics","stage_owner_admin_users","stage_owner_admin_venues",
  "stage_owner_admin_set_verified","stage_owner_admin_review_venue","stage_owner_admin_history"
 ]){
  assert.match(functionSql(name),/if not public\.stage_owner_admin_status\(\) then/);
  assert.match(sql,new RegExp("grant execute on function public\\."+name+"\\("));
  assert.match(sql,new RegExp("revoke all on function public\\."+name+"\\("));
 }
 assert.match(functionSql("stage_owner_admin_users"),/from auth\.users u/);
 assert.match(functionSql("stage_owner_admin_users"),/p_order not in \('oldest','newest'\)/);
 assert.match(functionSql("stage_owner_admin_users"),/limit 30 offset p_page\*30/);
 assert.match(functionSql("stage_owner_admin_venues"),/approval_status='pending'/);
 assert.match(functionSql("stage_owner_admin_review_venue"),/public\.stage_venue_admin_review\(p_venue_id,p_decision\)/);
 assert.match(functionSql("stage_owner_admin_review_venue"),/insert into public\.stage_owner_admin_audit/);
});

test("verification uses an independent owner-controlled registry, not user-editable metadata",()=>{
 const setBadge=functionSql("stage_owner_admin_set_verified");
 assert.match(setBadge,/p_kind not in \('singer','musician','venue'\)/);
 assert.match(setBadge,/is_singer=true/);
 assert.match(setBadge,/is_musician=true/);
 assert.match(setBadge,/is_official=true and approval_status='approved'/);
 assert.match(setBadge,/insert into public\.stage_admin_verifications/);
 assert.match(setBadge,/delete from public\.stage_admin_verifications/);
 assert.match(setBadge,/insert into public\.stage_owner_admin_audit/);
 const publicStatus=functionSql("stage_public_verified");
 assert.match(publicStatus,/returns boolean/);
 assert.match(publicStatus,/p\.is_singer and p\.is_public/);
 assert.match(publicStatus,/m\.is_published and p\.is_musician/);
 assert.match(publicStatus,/h\.active and h\.is_official/);
 assert.match(publicStatus,/h\.approval_status='approved'/);
 assert.match(sql,/grant execute on function public\.stage_public_verified\(text,text\) to anon,authenticated/);
 assert.doesNotMatch(publicStatus,/auth\.users|verified_by|email|phone/);
});

test("the owner dashboard is private, noindex, mobile-friendly and sorts signups",()=>{
 assert.match(page,/stage_owner_admin_status/);
 assert.match(page,/if\(!authorized\)return/);
 assert.match(page,/stage_owner_admin_metrics/);
 assert.match(page,/stage_owner_admin_users/);
 assert.match(page,/stage_owner_admin_venues/);
 assert.match(page,/stage_owner_admin_review_venue/);
 assert.match(page,/stage_owner_admin_set_verified/);
 assert.match(page,/stage_owner_admin_history/);
 assert.match(page,/useState<"oldest"\|"newest">\("oldest"\)/);
 assert.match(page,/Mais antigos primeiro/);
 assert.match(page,/Mais recentes primeiro/);
 assert.match(page,/Exportar página CSV/);
 assert.match(page,/window\.confirm/);
 assert.match(page,/href="\/admin\/casas"/);
 assert.doesNotMatch(page,/service_role|SUPABASE_SERVICE|raw_app_meta_data|\.from\("auth\.users"/i);
 assert.match(metadata,/index:false,follow:false,noarchive:true/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(css,/@media\(max-width:860px\)/);
});

test("public verification badge only appears when public RPC confirms a published profile",()=>{
 assert.match(badge,/Verificado pelo StageFlow/);
 assert.match(badge,/BadgeCheck/);
 assert.match(hook,/stage_public_verified/);
 assert.match(hook,/setVerified\(!error&&data===true\)/);
 for(const [file,kind] of [
  ["components/public-singer-site.tsx","singer"],
  ["app/musico/[slug]/page.tsx","musician"],
  ["app/casa/[slug]/page.tsx","venue"]
 ]){
  const code=read(file);
  assert.match(code,new RegExp('useStageVerified\\("'+kind+'"'));
 }
 assert.match(read("components/musician-portfolio-view.tsx"),/verified&&<StageVerifiedBadge compact\/>/);
 assert.match(read("components/public-singer-site.tsx"),/verified&&<StageVerifiedBadge compact\/>/);
 assert.match(read("app/casa/[slug]/page.tsx"),/verified&&<StageVerifiedBadge compact\/>/);
});


test("owner-only shortcut and a safe post-login return to the private dashboard",()=>{
 const panel=read("app/painel/page.tsx");
 const login=read("app/login/page.tsx");
 assert.match(panel,/stage_owner_admin_status/);
 assert.match(panel,/setIsOwnerAdmin\(!ownerAccessError&&ownerAccess===true\)/);
 assert.match(panel,/if \(isOwnerAdmin\) primary\.unshift/);
 assert.match(panel,/href:"\/admin\/central"/);
 assert.doesNotMatch(panel,/localStorage\.getItem\("isAdmin"\)|user\.email\s*===\s*"[^"]+"/);
 assert.match(page,/router\.replace\("\/login\?next=%2Fadmin%2Fcentral"\)/);
 assert.match(login,/get\("next"\) === "\/admin\/central"/);
 assert.match(login,/postLoginDestination\(\)/);
 assert.doesNotMatch(login,/location\.href\s*=\s*new URLSearchParams/);
});

test("main is the only active CI branch; commits never auto-deploy",()=>{
 for(const filename of [
  "stage-flow-build.yml","venue-security.yml","venue-staging-db.yml"
 ]){
  const yml=read(".github/workflows/"+filename);
  assert.match(yml,/branches: \[main\]/);
  assert.doesNotMatch(yml,/branches: \[develop\]/);
  assert.doesNotMatch(yml,/vercel\s+deploy|supabase\s+db\s+push|\bdeploy-to-production\b/i);
 }
 const vercel=JSON.parse(read("vercel.json"));
 assert.equal(vercel.git.deploymentEnabled.main,false);
 assert.equal(vercel.git.deploymentEnabled.develop,false);
 const policy=read("AGENTS.md");
 assert.match(policy,/branch `main`/);
 assert.match(policy,/NUNCA habilite deploy automático/);
});
