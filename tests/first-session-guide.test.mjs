import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {createRequire} from "node:module";

const root=process.cwd();
const get=path=>readFileSync(resolve(root,path),"utf8");
const ts=createRequire(import.meta.url)("typescript");
const model=get("src/domains/dashboard/model/first-session-guide.ts");
const output=ts.transpileModule(model,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {guideMode,buildGuide}=await import("data:text/javascript;base64,"+Buffer.from(output).toString("base64"));
const account=(overrides={})=>({
 id:"private-user-id",role:"musician",is_artist:true,is_producer:false,
 is_singer:false,is_musician:true,artist_kind:"support",display_name:"Teste",
 username:null,city:null,is_public:false,artist_avatar_path:null,...overrides
});

test("the initial guide uses verified role flags, never onboarding metadata",()=>{
 assert.equal(guideMode(account()),"musician");
 assert.equal(guideMode(account({is_singer:true,is_musician:true,artist_kind:"lead"})),"singer");
 assert.equal(guideMode(account({is_singer:true,is_musician:true,artist_kind:"support"})),"musician");
 assert.equal(guideMode(account({is_singer:false,is_musician:false,is_producer:true,is_artist:false,role:"producer"})),"organizer");
 assert.equal(guideMode(null),null);
});

test("musician progress is based on saved instruments, image, city and publication",()=>{
 const initial=buildGuide("musician",{instruments:[],genres:[],avatar_url:null,city:"",is_published:false});
 assert.equal(initial.percent,25);
 assert.equal(initial.next.id,"instruments");
 assert.equal(initial.next.href,"/perfil-artistico?aba=instrumentista");
 assert.equal(buildGuide("musician",{instruments:["Pandeiro"],genres:[],avatar_url:"valid-upload",city:"São Paulo",is_published:true}).percent,75);
 const later=buildGuide("musician",{instruments:["Pandeiro"],genres:["Pagode"],avatar_url:"valid-upload",city:"São Paulo",is_published:true});
 assert.equal(later.percent,100);
 assert.equal(later.next,null);
 assert.equal(later.tasks.filter(x=>x.done).length,4);
});
test("singer guide does not claim a profile is public merely because a username exists",()=>{
 const draft=buildGuide("singer",{username:"cantora",avatar_path:"saved",bio:"Samba",city:"São Paulo",is_public:false});
 assert.equal(draft.percent,75);
 assert.equal(draft.next.id,"publish");
 assert.equal(draft.next.href,"/perfil-artistico");
 const published=buildGuide("singer",{...{},username:"cantora",avatar_path:"saved",bio:"Samba",city:"São Paulo",is_public:true});
 assert.equal(published.percent,100);
});
test("organizer guide never uses upcoming shows as an all-time event count",()=>{
 assert.equal(buildGuide("organizer",null,null).percent,50);
 assert.equal(buildGuide("organizer",null,0).next.id,"event");
 assert.equal(buildGuide("organizer",null,1).percent,100);
 assert.equal(buildGuide("organizer",null,0).extra.href,"/marketplace");
});

test("dashboard mounts one guide, uses own account-scoped sources and leaves dismissal reversible",()=>{
 const dashboard=get("app/painel/page.tsx");
 const guide=get("src/domains/dashboard/components/first-session-guide.tsx");
 assert.match(dashboard,/<FirstSessionGuide\/>/);
 assert.ok(dashboard.indexOf("<FirstSessionGuide/>")<dashboard.indexOf("<WorkspaceOverview"));
 assert.match(guide,/stage_my_artist_page/);
 assert.match(guide,/stage_my_musician_portfolio/);
 assert.match(guide,/\.eq\("producer_id",profile!\.id\)/);
 assert.match(guide,/\.abortSignal\(request.signal\)/);
 assert.match(guide,/window\.localStorage\.setItem\(key,"hidden"\)/);
 assert.match(guide,/window\.localStorage\.removeItem\(key\)/);
 assert.match(guide,/stageflow:guide:v1:"\+profile.id\+":"\+mode/);
 assert.match(guide,/aria-valuenow=\{plan.percent\}/);
});
test("dashboard shortcuts do not ask musician-only users to create events",()=>{
 const source=get("src/domains/dashboard/components/workspace-overview.tsx");
 assert.match(source,/isProducer\|\|isSinger/);
 assert.match(source,/Prepare-se para o próximo convite/);
 assert.match(source,/\{\(isProducer\|\|isSinger\)&&<Link href="\/eventos\?novo=1"/);
 assert.match(source,/isMusician&&<Link href="\/minha-disponibilidade"/);
 assert.match(source,/\{\(isProducer\|\|isSinger\)&&<Card className="sf-operations-opportunities"/);
});
