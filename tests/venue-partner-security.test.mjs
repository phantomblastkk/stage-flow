import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(),path),"utf8");
const scoped = read("supabase/venue_partner_management_migration.sql");
const venueBase = read("supabase/venue_calendar_gallery_suggestions_migration.sql");
const adminBase = read("supabase/venue_admin_migration.sql");
const portal = read("app/parceiros/page.tsx");
const partnerRoute = read("app/parceiros/[id]/programacao/page.tsx");
const adminRoute = read("app/admin/casas/[id]/programacao/page.tsx");
const editor = read("components/venue-programming-workspace.tsx");
const home = read("app/painel/page.tsx");
const globalAdmin = read("app/admin/casas/page.tsx");

function sqlFunction(sql,name){
  const start=sql.indexOf("create or replace function public."+name+"(");
  assert.notEqual(start,-1, "Missing SQL function: "+name);
  const end=sql.indexOf("\n$$;",start);
  assert.notEqual(end,-1, "Unterminated function: "+name);
  const body=sql.slice(start,end+4);
  assert.doesNotMatch(body,/\ncreate or replace function\b/,"Nested/broken function definition: "+name);
  return body;
}
function compareFunction(name,matcher) {
  const body=sqlFunction(scoped,name);
  assert.match(body,matcher,"Scoped authorization absent in "+name);
  assert.doesNotMatch(body,/if not public\.stage_venue_is_admin\(\)/,"Partner RPC accidentally admin-only");
}
function noPartnerAdminFunction(name){
  assert.doesNotMatch(scoped,new RegExp("create or replace function public\\."+name+"\\("));
}

test("independent base migrations are structurally coherent",()=>{
  for(const sql of [venueBase,adminBase,scoped]){
    const opens=(sql.match(/\bas \$\$/g)||[]).length;
    const closes=(sql.match(/\$\$;/g)||[]).length;
    assert.equal(opens,closes,"Unbalanced SQL dollar delimiters");
    assert.equal((sql.match(/^begin;$/gm)||[]).length,1);
    assert.equal((sql.match(/^commit;$/gm)||[]).length,1);
  }
  assert.match(venueBase,/create table if not exists public\.stage_venue_calendar_events/);
  assert.doesNotMatch(sqlFunction(venueBase,"stage_venue_public_month"),/\bpublic\.events\b/);
});

test("manager check is scoped to venue and requires active official partner",()=>{
  const body=sqlFunction(scoped,"stage_venue_can_manage");
  assert.match(body,/m\.venue_id=p_venue_id/);
  assert.match(body,/m\.profile_id=auth\.uid\(\)/);
  assert.match(body,/v\.active and v\.is_official and v\.is_partner/);
  assert.match(body,/public\.stage_venue_is_admin\(\)/);
  assert.match(scoped,/revoke all on public\.stage_venue_managers from public,anon,authenticated/);
  assert.match(scoped,/alter table public\.stage_venue_managers enable row level security/);
});

test("partner listing returns only linked venues, not global registry",()=>{
  const body=sqlFunction(scoped,"stage_venue_partner_access");
  assert.match(body,/m\.profile_id=auth\.uid\(\)/);
  assert.match(body,/v\.active and v\.is_official and v\.is_partner/);
  assert.doesNotMatch(body,/auth\.users/);
  assert.doesNotMatch(portal,/stage_venue_admin_list/);
  assert.match(portal,/stage_venue_partner_access/);
});

test("calendar and gallery RPCs authorize the venue before changing data",()=>{
  compareFunction("stage_venue_calendar_admin_list",/stage_venue_can_manage\(p_venue_id\)/);
  compareFunction("stage_venue_calendar_admin_save",/stage_venue_can_manage\(v_venue\)/);
  compareFunction("stage_venue_calendar_admin_flyer",/stage_venue_can_manage\(v_venue\)/);
  compareFunction("stage_venue_calendar_admin_delete",/stage_venue_can_manage\(v_venue\)/);
  compareFunction("stage_venue_gallery_admin_add",/stage_venue_can_manage\(p_venue_id\)/);
  compareFunction("stage_venue_gallery_admin_remove",/stage_venue_can_manage\(v_venue\)/);
  assert.match(sqlFunction(scoped,"stage_venue_calendar_admin_save"),
    /where id=v_id and venue_id=v_venue for update/);
});

test("logo, cover and global venue settings cannot be delegated",()=>{
  const upload=sqlFunction(scoped,"stage_venue_media_can_upload");
  assert.match(upload,/split_part\(p_path,'\/',2\) in \('gallery','flyer'\)/);
  assert.match(upload,/stage_venue_can_manage\(split_part\(p_path,'\/',1\)::uuid\)/);
  noPartnerAdminFunction("stage_venue_admin_save");
  noPartnerAdminFunction("stage_venue_admin_list");
  assert.match(sqlFunction(scoped,"stage_venue_admin_set_manager"),/if not public\.stage_venue_is_admin\(\)/);
  assert.match(sqlFunction(scoped,"stage_venue_admin_managers"),/if not public\.stage_venue_is_admin\(\)/);
  assert.match(globalAdmin,/stage_venue_admin_set_manager/);
});

test("partner editor and global admin share UI but not data permissions",()=>{
  assert.match(partnerRoute,/<VenueProgrammingWorkspace mode="partner"\/>/);
  assert.match(adminRoute,/<VenueProgrammingWorkspace mode="admin"\/>/);
  assert.match(editor,/mode==="admin"/);
  assert.match(editor,/stage_venue_partner_access/);
  assert.match(editor,/stage_venue_calendar_admin_save/);
  assert.match(editor,/stage_venue_gallery_admin_add/);
  assert.doesNotMatch(portal,/supabase\.from\("venues"\)/);
  assert.match(home,/href: "\/parceiros"/);
});

test("no deployment is enabled for develop",()=>{
  const cfg=JSON.parse(read("vercel.json"));
  assert.equal(cfg.git?.deploymentEnabled?.develop,false);
});
