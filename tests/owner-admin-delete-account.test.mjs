import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const read=path=>readFileSync(resolve(process.cwd(),path),"utf8");
const route=read("app/api/admin/accounts/[id]/route.ts");
const modal=read("app/admin/central/delete-account-dialog.tsx");
const css=read("app/admin/central/delete-account-dialog.css");
const page=read("app/admin/central/page.tsx");
const migration=read("supabase/stage_owner_admin_account_deletion_migration.sql");

test("account deletion is server-only and authenticates owner via trusted token and RPC",()=>{
 assert.match(route,/export async function DELETE/);
 assert.match(route,/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
 assert.match(route,/SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(route,/caller\.auth\.getUser\(token\)/);
 assert.match(route,/caller\.rpc\("stage_owner_admin_status"\)/);
 assert.match(route,/isOwner!==true/);
 assert.match(route,/stillOwner!==true/);
 assert.match(route,/request\.headers\.get\("origin"\)/);
 assert.match(route,/fetchSite!=="same-origin"/);
 assert.match(route,/getUserById\(id\)/);
 assert.match(route,/admin\.auth\.admin\.deleteUser\(id,false\)/);
 assert.doesNotMatch(page,/SUPABASE_SERVICE_ROLE_KEY|\.auth\.admin\.deleteUser|delete from auth\.users/i);
 assert.doesNotMatch(modal,/SUPABASE_SERVICE_ROLE_KEY|\.auth\.admin\.deleteUser/i);
});
test("owner account and active paid subscriptions cannot be removed",()=>{
 assert.match(route,/user\.id===id/);
 assert.match(route,/ownerResult\.data/);
 assert.match(route,/stage_owner_admins/);
 assert.match(route,/blockedSubscriptions/);
 assert.match(route,/trialing/);
 assert.match(route,/past_due/);
 assert.match(route,/billing_review_required/);
 assert.match(page,/user\.id===ownerId/);
 assert.match(page,/Conta proprietária protegida/);
 assert.match(page,/Revisar assinatura antes de excluir/);
});
test("deletion demands exact server-verified confirmation and explicit intent",()=>{
 assert.match(route,/body\.understood!==true/);
 assert.match(route,/expected="EXCLUIR "\+\(target\.email\|\|id\)/);
 assert.match(route,/body\.confirmation!==expected/);
 assert.match(modal,/const required="EXCLUIR "\+target/);
 assert.match(modal,/checked=\{understood\}/);
 assert.match(modal,/typed!==required/);
 assert.match(modal,/showModal\(\)/);
 assert.match(modal,/aria-labelledby="sf-delete-title"/);
 assert.match(modal,/aria-describedby="sf-delete-description"/);
 assert.match(modal,/Cancelar/);
 assert.match(modal,/Excluir conta definitivamente/);
 assert.match(css,/@media\(max-width:560px\)/);
 assert.match(css, /min-height:50px/);
});
test("audit is fail-closed, private, rate-limited and records request outcomes",()=>{
 for(const event of ["account_deletion_requested","account_deleted","account_deletion_failed"]){
  assert.ok(migration.includes(event));
  assert.ok(route.includes(event));
 }
 assert.match(migration,/stage_owner_admin_audit_kind_check/);
 assert.match(migration,/stage_owner_admin_audit_action_check/);
 assert.match(migration,/begin;/);
 assert.match(migration,/commit;/);
 assert.doesNotMatch(migration,/delete\s+from\s+auth\.users|grant\s+.*authenticated|insert into public\.stage_owner_admins/i);
 assert.match(route,/if\(requested\.error\)return json\("audit_unavailable",503\)/);
 assert.match(route,/if\(count>=5\)return json\("rate_limited",429\)/);
 assert.match(route,/account_has_dependencies/);
 assert.match(page,/account_deletion_requested/);
 assert.match(page,/account_deleted/);
 assert.match(page,/account_deletion_failed/);
});
test("UI integrates account-specific action into existing users list without deleting users during render",()=>{
 assert.match(page,/<th>Gerenciar<\/th>/);
 assert.match(page,/setSelectedDelete\(user\)/);
 assert.match(page,/<DeleteAccountDialog/);
 assert.match(page,/setSelectedDelete\(null\)/);
 assert.match(page,/reload\(\)/);
 assert.match(page,/kindText:Record<AuditKind,string>/);
 assert.doesNotMatch(page,/fetch\("\/api\/admin\/accounts/);
 assert.match(modal,/method:"DELETE"/);
 assert.match(modal,/credentials:"same-origin"/);
 assert.match(modal,/session\.access_token/);
 assert.match(modal,/onDeleted\(\)/);
});
