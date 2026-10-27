import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(),path),"utf8");
const scoped = read("supabase/venue_partner_management_migration.sql");
const suggestionWorkflow = read("supabase/venue_suggestions_workflow_migration.sql");
const venueBase = read("supabase/venue_calendar_gallery_suggestions_migration.sql");
const adminBase = read("supabase/venue_admin_migration.sql");
const portal = read("app/parceiros/page.tsx");
const partnerRoute = read("app/parceiros/[id]/programacao/page.tsx");
const adminRoute = read("app/admin/casas/[id]/programacao/page.tsx");
const editor = read("components/venue-programming-workspace.tsx");
const home = read("app/painel/page.tsx");
const globalAdmin = read("app/admin/casas/page.tsx");
const signup = read("app/cadastro/page.tsx");

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

test("administrator can guide manager registration and safely share access",()=>{
  assert.match(globalAdmin,/stage_venue_admin_set_manager/);
  assert.match(globalAdmin,/result==="account_not_found"/);
  assert.match(globalAdmin,/managerNeedsSignup/);
  assert.match(globalAdmin,/\/cadastro/);
  assert.match(globalAdmin,/\/parceiros/);
  assert.match(globalAdmin,/encodeURIComponent\(managerMessage\(/);
  assert.match(globalAdmin,/window\.confirm\(/);
  assert.match(globalAdmin,/revokeManager\(manager\.email,manager\.display_name\)/);
  assert.match(globalAdmin,/result!=="granted" && result!=="revoked"/);
  assert.match(globalAdmin,/\/cadastro\?parceiro=1/);
  assert.match(signup,/setPartnerOnboarding\(true\)/);
  assert.match(signup,/setArtistKind\("none"\)/);
  assert.match(signup,/somente ela pode liberar sua programação/);
  assert.doesNotMatch(globalAdmin,/supabase\.auth\.admin\./);
});

test("house daily workflow shows upcoming priorities without bypassing scoped RPCs",()=>{
  assert.match(editor,/const nextShows=useMemo/);
  assert.match(editor,/upcomingWithoutFlyer/);
  assert.match(editor,/setShowForm\(\{id:item\.id/);
  assert.match(editor,/setPendingFlyer\(null\)/);
  assert.match(editor,/chooseFlyerForNewShow/);
  assert.match(editor,/file\.size>5\*1024\*1024/);
  assert.match(editor,/savedId=result\.id/);
  assert.match(editor,/await attachFlyer\(result\.id,pendingFlyer\)/);
  assert.match(editor,/stage_venue_calendar_admin_save/);
  assert.match(editor,/stage_venue_calendar_admin_flyer/);
  assert.doesNotMatch(editor,/\.from\("stage_venue_calendar_events"\)\.(?:insert|upsert|update|delete)\(/);
});

test("suggestion workflow preserves messages and scopes status edits by house",()=>{
  const setter=sqlFunction(suggestionWorkflow,"stage_venue_suggestion_set_status");
  const reader=sqlFunction(suggestionWorkflow,"stage_venue_calendar_admin_list");
  assert.match(suggestionWorkflow,/add column if not exists review_status text not null default 'pending'/);
  assert.match(suggestionWorkflow,/check \(review_status in \('pending','reviewing','resolved'\)\)/);
  assert.match(suggestionWorkflow,/revoke all on public\.stage_venue_artist_suggestions from public,anon,authenticated/);
  assert.match(suggestionWorkflow,/grant execute on function public\.stage_venue_suggestion_set_status\(uuid,text\) to authenticated/);
  assert.match(setter,/if auth\.uid\(\) is null then return 'forbidden'/);
  assert.match(setter,/if not public\.stage_venue_can_manage\(v_venue\) then return 'forbidden'/);
  assert.match(setter,/where s\.id=p_id and s\.venue_id=v_venue/);
  assert.doesNotMatch(setter,/\bdelete\b/i);
  assert.match(reader,/'review_status',s\.review_status/);
  assert.match(reader,/stage_venue_can_manage\(p_venue_id\)/);
  assert.match(editor,/stage_venue_suggestion_set_status/);
  assert.match(editor,/setSuggestionFilter/);
  assert.match(editor,/filteredSuggestions/);
  assert.match(editor,/suggestionCounts/);
  assert.doesNotMatch(editor,/\.from\("stage_venue_artist_suggestions"\)/);
});

test("no deployment is enabled for develop",()=>{
  const cfg=JSON.parse(read("vercel.json"));
  assert.equal(cfg.git?.deploymentEnabled?.develop,false);
});


test("artist venue suggestions remain private until explicit global admin approval",()=>{
  const approval=read("supabase/venue_approval_workflow_migration.sql");
  const suggestion=read("app/locais/page.tsx");
  const admin=read("app/admin/casas/page.tsx");
  const review=sqlFunction(approval,"stage_venue_admin_review");
  const submit=sqlFunction(approval,"stage_venue_submit");
  const mine=sqlFunction(approval,"stage_venue_my_submissions");
  const guard=sqlFunction(approval,"stage_venue_enforce_approval");
  assert.match(approval,/add column if not exists approval_status text not null default 'pending'/);
  assert.match(approval,/stage_venue_unapproved_not_public/);
  assert.match(approval,/active=false and is_official=false and is_partner=false/);
  assert.match(approval,/slug is null and logo_path is null and cover_path is null/);
  assert.match(approval,/revoke insert \(name,address,city_id,submitted_by\) on public\.venues from authenticated/);
  assert.match(submit,/auth\.uid\(\) is null/);
  assert.match(submit,/stage_venue_submit/);
  assert.match(submit,/active,approval_status/);
  assert.match(submit,/false,'pending'/);
  assert.match(submit,/where submitted_by=auth\.uid\(\)/);
  assert.match(guard,/new\.approval_status:='pending'/);
  assert.match(guard,/new\.is_official:=false/);
  assert.match(guard,/new\.logo_path:=null/);
  assert.match(review,/if not public\.stage_venue_is_admin\(\)/);
  assert.match(review,/v_status<>'pending'/);
  assert.match(review,/p_decision not in \('approved','rejected'\)/);
  assert.match(review,/is_official=false,is_partner=false/);
  assert.match(mine,/submitted_by=auth\.uid\(\)/);
  assert.match(approval,/grant execute on function public\.stage_venue_submit\(text,bigint,text\) to authenticated/);
  assert.match(approval,/grant execute on function public\.stage_venue_admin_review\(uuid,text\) to authenticated/);
  assert.match(suggestion,/\.rpc\("stage_venue_submit"/);
  assert.match(suggestion,/\.rpc\("stage_venue_my_submissions"/);
  assert.doesNotMatch(suggestion,/\.from\("venues"\)\.insert/);
  assert.match(suggestion,/Aguardando análise/);
  assert.match(admin,/\.rpc\("stage_venue_admin_review"/);
  assert.match(admin,/onClick=\{\(\)=>void reviewVenue\("approved"\)\}/);
  assert.match(admin,/onClick=\{\(\)=>void reviewVenue\("rejected"\)\}/);
  assert.match(admin,/form\.approval_status!=="approved"/);
  assert.match(admin,/Gerenciar programação, flyers e fotos/);
});


test("admin approval atomically publishes official venue URL; rejection stays private",()=>{
 const approval=read("supabase/venue_approval_official_profile_migration.sql");
 const review=sqlFunction(approval,"stage_venue_admin_review");
 const page=read("app/admin/casas/page.tsx");
 const publicRpc=sqlFunction(venueBase,"stage_public_venue");
 const month=sqlFunction(venueBase,"stage_venue_public_month");
 const highlights=sqlFunction(venueBase,"stage_venue_public_highlights");
 assert.match(review,/if not public\.stage_venue_is_admin\(\)/);
 assert.match(review,/where v\.id=p_venue_id for update/);
 assert.match(review,/if v_status<>'pending' then return 'already_reviewed'/);
 assert.match(review,/if p_decision='approved' then/);
 assert.match(review,/replace\(p_venue_id::text,'-',''\)/);
 assert.match(review,/approval_status='approved'/);
 assert.match(review,/active=true,is_official=true,is_partner=false/);
 assert.match(review,/slug=v_slug,logo_path=null,cover_path=null/);
 assert.match(review,/approval_status='rejected'/);
 assert.match(review,/active=false,is_official=false,is_partner=false/);
 assert.match(review,/slug=null,logo_path=null,cover_path=null/);
 assert.match(approval,/revoke all on function public\.stage_venue_admin_review\(uuid,text\)/);
 assert.match(approval,/grant execute on function public\.stage_venue_admin_review\(uuid,text\)/);
 assert.match(publicRpc,/v\.active and v\.is_official and v\.slug=p_slug/);
 assert.match(month,/is_official and active/);
 assert.match(highlights,/is_official and active/);
 assert.match(page,/perfil oficial e a URL foram criados/);
 assert.match(page,/perfil oficial e seu endereço público/);
 assert.match(page,/form\.approval_status==="approved" && form\.is_official/);
 assert.match(page,/form\.approval_status==="approved" && <div className="venue-admin-media/);
});


test("singer sees a public venue link only after approval",()=>{
 const sql=read("supabase/venue_approved_submitter_links_migration.sql");
 const own=sqlFunction(sql,"stage_venue_my_submissions");
 const page=read("app/locais/page.tsx");
 assert.match(own,/where submitted_by=auth\.uid\(\)/);
 assert.match(own,/when v\.approval_status='approved'/);
 assert.match(own,/v\.active and v\.is_official then v\.slug else null end/);
 assert.match(own,/order by created_at desc limit 50/);
 assert.match(sql,/revoke all on function public\.stage_venue_my_submissions\(\)/);
 assert.match(sql,/grant execute on function public\.stage_venue_my_submissions\(\)/);
 assert.match(page,/item\.approval_status==="approved"&&item\.slug/);
 assert.match(page,/\/casa\/"\+encodeURIComponent\(item\.slug\)/);
 assert.match(page,/Aprovada — perfil oficial criado/);
 assert.doesNotMatch(page,/\.from\("venues"\)\.insert/);
});


test("new public shows with a selected flyer wait for media attachment before publication",()=>{
  const editor=read("components/venue-programming-workspace.tsx");
  const styles=read("app/admin/casas/[id]/programacao/programacao.css");
  const stage=editor.indexOf('const publishAfterFlyer=showForm.status==="published" && !!pendingFlyer && !wasPublished;');
  const draft=editor.indexOf('p_event:{...details,status:publishAfterFlyer?"draft":showForm.status}',stage);
  const attach=editor.indexOf('await attachFlyer(result.id,pendingFlyer);',draft);
  const publish=editor.indexOf('p_event:{...details,id:result.id,status:"published"}',attach);
  assert.ok(stage>=0,"staged publication must include new shows and previously saved drafts with pending flyers");
  assert.ok(editor.includes('const wasPublished=shows.some(x=>x.id===showForm.id && x.status==="published")'));
  assert.ok(draft>stage,"new show must be saved as private draft first");
  assert.ok(attach>draft,"flyer should be attached after the draft is created");
  assert.ok(publish>attach,"public status must be requested only after flyer attachment");
  assert.ok(editor.includes('status:publishAfterFlyer?"draft":prev.status'));
  assert.ok(editor.includes('setError("O show foi salvo como rascunho, sem publicação pública.'));
  assert.ok(editor.includes('if(!published){'));
  assert.ok(editor.includes('Um show novo ou rascunho marcado como publicado só será liberado'));
  assert.ok(editor.includes('O arquivo selecionado continua disponível neste formulário.'));
  assert.ok(editor.includes('showForm.id?"Selecionar flyer ao salvar (opcional)"'));
  assert.ok(editor.includes('setPendingFlyer(null);'));
  assert.match(styles,/\.venue-program-launch-guide/);
  assert.match(styles,/@media\(max-width:560px\)/);
});

test("approved house editing has publication guide and scoped public preview",()=>{
  const editor=read("components/venue-programming-workspace.tsx");
  assert.ok(editor.includes('mode==="admin"&&house.approval_status!=="approved"'));
  assert.ok(editor.includes('Esta casa ainda não possui perfil oficial ativo e aprovado.'));
  assert.ok(editor.includes('aria-label="Preparar página pública da casa"'));
  assert.ok(editor.includes('mode==="admin"?'));
  assert.ok(editor.includes('href="/admin/casas"'));
  assert.ok(editor.includes('publicSlug&&<Link'));
  assert.ok(editor.includes('href={"/casa/"+publicSlug}'));
  assert.ok(editor.includes('publishedFlyers=shows.filter(x=>x.status==="published"&&!!x.flyer_path).length'));
  assert.ok(editor.includes('onClick={()=>setTab("galeria")}'));
  assert.ok(editor.includes('Rascunhos não aparecem no calendário público.'));
  assert.ok(editor.includes('O flyer aparece com o show publicado'));
  assert.match(editor,/stage_venue_calendar_admin_save/);
  assert.match(editor,/stage_venue_gallery_admin_add/);
  assert.doesNotMatch(editor,/\.from\("stage_venue_calendar_events"\)\.insert\(/);
});


test("unapproved venues cannot host calendars, galleries or publicly readable media",()=>{
  const sql=read("supabase/venue_pending_content_isolation_migration.sql");
  const canManage=sqlFunction(sql,"stage_venue_can_manage");
  const media=sqlFunction(sql,"stage_venue_media_can_upload");
  assert.match(canManage,/v\.approval_status='approved'/);
  assert.match(canManage,/v\.active and v\.is_official/);
  assert.match(canManage,/public\.stage_venue_is_admin\(\)/);
  assert.match(canManage,/m\.venue_id=v\.id and m\.profile_id=auth\.uid\(\)/);
  assert.match(media,/v\.approval_status='approved'/);
  assert.match(media,/split_part\(p_path,'\/',2\) in \('logo','cover'\)/);
  assert.match(media,/split_part\(p_path,'\/',2\) in \('gallery','flyer'\)/);
  assert.match(media,/stage_venue_can_manage\(v\.id\)/);
  assert.match(sql,/revoke all on function public\.stage_venue_can_manage\(uuid\)/);
  assert.match(sql,/revoke all on function public\.stage_venue_media_can_upload\(text\)/);
  assert.match(sql,/grant execute on function public\.stage_venue_media_can_upload\(text\) to authenticated/);
  assert.match(sql,/grant execute on function public\.stage_venue_can_manage\(uuid\) to authenticated/);
  const rpc=sqlFunction(scoped,"stage_venue_calendar_admin_save");
  assert.match(rpc,/stage_venue_can_manage\(v_venue\)/);
  assert.match(sqlFunction(scoped,"stage_venue_gallery_admin_add"),
    /stage_venue_can_manage\(p_venue_id\)/);
});


test("public show sharing resolves only published events returned by the public month RPC",()=>{
 const publicPage=read("app/casa/[slug]/page.tsx");
 const editor=read("components/venue-programming-workspace.tsx");
 const calendar=sqlFunction(venueBase,"stage_venue_public_month");
 assert.match(calendar,/status='published'/);
 assert.match(publicPage,/url\.searchParams\.set\("mes",venueDayKey\(show\.starts_at\)\.slice\(0,7\)\)/);
 assert.match(publicPage,/url\.searchParams\.set\("show",show\.id\)/);
 assert.match(publicPage,/new URLSearchParams\(window\.location\.search\)/);
 assert.match(publicPage,/setLinkedShow\(\{id:id\.toLowerCase\(\),month:monthKey\}\)/);
 assert.match(publicPage,/venueMonthKey\(month\)!==linkedShow\.month/);
 assert.match(publicPage,/events\.find\(e=>e\.id===linkedShow\.id&&e\.status==="published"\)/);
 assert.match(publicPage,/if\(show\)\{setFocusedShow\(show\)/);
 assert.match(publicPage,/setLinkedShow\(null\)/);
 assert.match(publicPage,/\.rpc\("stage_venue_public_month"/);
 assert.doesNotMatch(publicPage,/\.rpc\("stage_venue_calendar_admin_list"/);
 assert.doesNotMatch(publicPage,/\.from\("stage_venue_calendar_events"\)/);
 assert.match(publicPage,/Copiar link deste show/);
 assert.match(editor,/const selectedPublishedShow=shows\.find\(x=>/);
 assert.match(editor,/x\.id===showForm\.id&&x\.status==="published"/);
 assert.match(editor,/Copiar link/);
 assert.match(editor,/Ver show publicado/);
 assert.match(editor,/url\.searchParams\.set\("show",selectedPublishedShow\.id\)/);
 assert.match(editor,/\.status==="published"/);
});


test("mobile flyer preview cleans up temporary URLs and broken files are not queued",()=>{
 const editor=read("components/venue-programming-workspace.tsx");
 const css=read("app/admin/casas/[id]/programacao/programacao.css");
 assert.match(editor,/const \[pendingFlyerPreview,setPendingFlyerPreview\] = useState<string\|null>\(null\)/);
 assert.match(editor,/const preview=URL\.createObjectURL\(pendingFlyer\)/);
 assert.match(editor,/return \(\)=>URL\.revokeObjectURL\(preview\)/);
 assert.match(editor,/src=\{pendingFlyerPreview\} alt="Prévia local do flyer selecionado"/);
 assert.match(editor,/onError=\{\(\)=>\{setPendingFlyer\(null\);setError\(/);
 assert.match(editor,/Escolha outro arquivo JPG, PNG ou WebP/);
 assert.match(editor,/Selec(?:ionado|ionado):/);
 assert.match(editor,/pendingFlyer\.size\/1024\/1024/);
 assert.match(css,/\.venue-program-flyer-preview/);
 assert.match(css,/@media\(max-width:420px\)/);
});

test("public show and approved admin workspace use native mobile sharing with copy fallback",()=>{
 const editor=read("components/venue-programming-workspace.tsx");
 const page=read("app/casa/[slug]/page.tsx");
 const css=read("app/casa/[slug]/venue-public.css");
 assert.match(editor,/async function sharePublishedShow\(\)/);
 assert.match(editor,/if\(!navigator\.share\)\{/);
 assert.match(editor,/await navigator\.share\(\{title:selectedPublishedShow\.title,url\}\)/);
 assert.match(editor,/err\.name==="AbortError"/);
 assert.match(editor,/Compartilhar show/);
 assert.match(editor,/Copiar link/);
 assert.match(editor,/const selectedPublishedShow=shows\.find\(x=>/);
 assert.match(page,/async function shareShow\(show:HouseShow\)/);
 assert.match(page,/if\(!navigator\.share\)\{await copyShowLink\(show\);return;\}/);
 assert.match(page,/await navigator\.share\(\{title:show\.title,url\}\)/);
 assert.match(page,/err\.name==="AbortError"/);
 assert.match(page,/Compartilhar show/);
 assert.match(page,/Copiar link deste show/);
 assert.match(css,/\.venue-public-share-actions/);
 assert.match(css,/@media\(max-width:540px\)/);
});
