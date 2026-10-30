import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const read=(path)=>readFileSync(resolve(process.cwd(),path),"utf8");
const schema=read("supabase/account_identity_dual_roles_migration.sql");
const guards=read("supabase/account_identity_role_guards_migration.sql");
const signup=read("app/cadastro/page.tsx");
const dashboard=read("app/painel/page.tsx");
const hub=read("app/minha-conta/page.tsx");
const css=read("app/minha-conta/minha-conta.css");

function fn(text,name){
 const p=text.indexOf("create or replace function public."+name+"(");
 assert.notEqual(p,-1,"Missing "+name);
 const end=text.indexOf("\n$$;",p);
 assert.notEqual(end,-1,"Unterminated "+name);
 return text.slice(p,end);
}

test("signup maps singer, musician and dual activity onto the same public artistic identity",()=>{
 assert.match(signup,/type Activity = "singer" \| "musician" \| "both" \| null/);
 assert.match(signup,/Canta e toca/);
 assert.match(signup,/artist_kind: isArtist \? artistKind : null/);
 assert.match(signup,/is_musician: isArtist && \(artistKind === "support" \|\| alsoMusician\)/);
 assert.match(schema,/chosen_musician := chosen_artist and/);
 assert.match(schema,/chosen_singer := chosen_artist and chosen_kind = 'lead'/);
 assert.match(schema,/is_singer, is_musician, plan_code/);
 assert.doesNotMatch(schema,/set plan_code='artist_plus'/);
});

test("profile hub keeps separate roles inside one public artistic identity",()=>{
 assert.match(dashboard,/<NotificationBell\/>\s*<DashboardAccountMenu/);
 assert.match(dashboard,/isOwnerAdmin=\{isOwnerAdmin\}/);
 const menu=read("components/dashboard-account-menu.tsx");
 assert.match(menu,/href="\/minha-conta"/);
 assert.match(menu,/href="\/perfil-artistico"/);
 assert.match(menu,/href="\/perfis"/);
 assert.match(menu,/isOwnerAdmin&&<Link/);
 assert.match(menu,/event\.key==="Escape"/);
  assert.ok(dashboard.includes("profile?.is_singer&&profile.is_musician&&"));
  assert.ok(dashboard.includes('changeExperience("support")'));
  assert.ok(dashboard.includes("isSinger={Boolean(profile?.is_singer)}"));
 assert.match(hub,/Meus perfis e funções/);
 assert.match(hub,/Cantor \/ artista principal/);
 assert.match(hub,/Músico \/ instrumentista/);
 assert.match(hub,/href=\{"\/"\+encodeURIComponent\(account\.username\)\}/);
 assert.match(hub,/account\.username&&account\.is_public/);
 assert.match(hub,/Perfil Artístico|perfil artístico|perfil único/);
 assert.match(hub,/\/perfil-artistico/);
 assert.match(hub,/\/perfil-artistico\?aba=instrumentista/);
 assert.match(hub,/stage_my_account_identity/);
 assert.match(hub,/stage_account_enable_role/);
 assert.match(css,/@media\(max-width:770px\)/);
});

test("60-day identity cooldown is server-enforced and cannot be bypassed by resetting timestamps",()=>{
 assert.match(schema,/add column if not exists display_name_changed_at timestamptz/);
 assert.match(schema,/add column if not exists username_changed_at timestamptz/);
 const guard=fn(schema,"stage_guard_profile_identity_changes");
 assert.match(guard,/old\.display_name_changed_at \+ interval '60 days'/);
 assert.match(guard,/old\.username_changed_at \+ interval '60 days'/);
 assert.match(guard,/new\.display_name_changed_at:=old\.display_name_changed_at/);
 assert.match(guard,/new\.username_changed_at:=old\.username_changed_at/);
 assert.match(schema,/before update on public\.profiles for each row/);
 const update=fn(schema,"stage_update_account_identity");
 assert.match(update,/where id=auth\.uid\(\) for update/);
 assert.match(update,/name_cooldown/);
 assert.match(update,/username_cooldown/);
 assert.match(update,/reserved_username/);
 assert.match(update,/username_taken/);
 assert.match(hub,/Próxima alteração do nome/);
 assert.match(hub,/Próxima alteração do @/);
 assert.match(hub,/stage_update_account_identity/);
});

test("free musician role enrollment is authenticated, and editing musician data cannot bypass its grant",()=>{
 const enroll=fn(schema,"stage_account_enable_role");
 assert.match(enroll,/auth\.uid\(\) is null/);
 assert.match(enroll,/p_role not in \('singer','musician'\)/);
 assert.match(enroll,/where id=auth\.uid\(\)/);
 assert.match(schema,/revoke all on function public\.stage_account_enable_role\(text\) from public,anon,authenticated/);
 assert.match(schema,/grant execute on function public\.stage_account_enable_role\(text\) to authenticated/);
 assert.match(fn(schema,"stage_my_musician_portfolio"),/p\.is_musician = true/);
 assert.match(fn(schema,"stage_save_musician_portfolio_v3"),/p\.is_musician = true/);
 assert.match(fn(schema,"stage_guard_musician_portfolio_role"),/p\.is_musician=true/);
 assert.match(fn(schema,"stage_marketplace_musician_guard"),/p\.is_musician=true/);
 assert.match(fn(guards,"stage_choose_artist_experience"),/p_kind='lead' and is_singer=true/);
 assert.match(fn(guards,"stage_choose_artist_experience"),/p_kind='support' and is_musician=true/);
 assert.match(fn(guards,"stage_guard_profile_role_username"),/not old\.is_singer/);
});

test("new signup resolves the artist kind before assigning singer and musician roles",()=>{
 const repair=read("supabase/account_signup_role_initialization_fix_migration.sql");
 for(const source of [schema,repair]){
  const signup=fn(source,"handle_new_user");
  const kindResolved=signup.indexOf("chosen_kind := null;");
  const singerAssigned=signup.indexOf("chosen_singer := chosen_artist");
  const musicianAssigned=signup.indexOf("chosen_musician := chosen_artist");
  assert.ok(kindResolved >= 0,"artist-kind branch must exist");
  assert.ok(singerAssigned > kindResolved,"singer role must be set after artist kind");
  assert.ok(musicianAssigned > kindResolved,"musician role must be set after artist kind");
  assert.match(signup,/chosen_kind := case when chosen_username is not null then 'lead' else 'support' end/);
  assert.match(signup,/chosen_artist and \(chosen_kind = 'support'/);
  assert.match(signup,/is_singer, is_musician, plan_code/);
 }
});


test("dual activity is one deliberate choice at signup and adding roles later retains confirmation",()=>{
 assert.match(signup,/\["both","Canta e toca",UsersRound\]/);
 assert.match(signup,/activity === "both"/);
 assert.match(signup,/um único perfil público/);
 assert.match(hub,/role="dialog" aria-modal="true"/);
 assert.match(hub,/confirmationText\.trim\(\)\.toLocaleUpperCase\("pt-BR"\)!=="ATIVAR"/);
 assert.match(hub,/confirmationChecked/);
 assert.match(hub,/onClick=\{event=>openRoleConfirmation\("singer",event\)\}/);
 assert.match(hub,/onClick=\{event=>openRoleConfirmation\("musician",event\)\}/);
 assert.match(hub,/event\.key==="Escape"/);
 assert.match(hub,/window\.requestAnimationFrame\(\(\)=>roleOrigin\.current\?\.focus\(\)\)/);
 assert.doesNotMatch(hub,/\.from\("profiles"\)\.update\(\{is_singer|\.from\("profiles"\)\.update\(\{is_musician/);
});

test("profile settings have unified artistic role tabs, real email/password controls, and independent data visibility",()=>{
 for(const section of ["Visão geral","Perfil de cantor","Atuação como músico","Dados pessoais","E-mail e segurança","Privacidade"]){
  assert.ok(hub.includes(section),section+" should be offered");
 }
 assert.match(hub,/aria-label="Áreas do meu perfil"/);
 assert.match(hub,/window\.addEventListener\("popstate"/);
 assert.match(hub,/stage_my_account_identity/);
 assert.match(hub,/\.auth\.updateUser\(\{email:proposed\}\)/);
 assert.match(hub,/\.auth\.updateUser\(\{password\}\)/);
 assert.match(hub,/password\.length<12/);
 assert.match(hub,/password!==passwordAgain/);
 assert.match(hub,/account\.is_public/);
 assert.match(hub,/account\.musician_published/);
 assert.match(hub,/account\.is_singer/);
 assert.match(hub,/account\.is_musician/);
 assert.match(hub,/\/perfil-artistico/);
 assert.match(hub,/\/perfil-artistico\?aba=instrumentista/);
 assert.doesNotMatch(hub,/SERVICE_ROLE|NEXT_PUBLIC_SUPABASE_SERVICE/);
 assert.match(css,/\.account-shell/);
 assert.match(css,/@media\(max-width:770px\)/);
});
