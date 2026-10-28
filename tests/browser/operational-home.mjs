// All responses are synthetic fixtures. No live account, payment or Supabase access.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdir,writeFile} from "node:fs/promises";
import {setTimeout as delay} from "node:timers/promises";
import {chromium} from "playwright";
const api="https://example.supabase.co",origin="http://127.0.0.1:3104";
if(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_URL!==api)throw Error("Fixture-only test");
const actor="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",eventId="11111111-1111-4111-8111-111111111111",groupId="22222222-2222-4222-8222-222222222222",inviteId="33333333-3333-4333-8333-333333333333";
const encode=v=>Buffer.from(JSON.stringify(v)).toString("base64url");
const user={id:actor,aud:"authenticated",role:"authenticated",email:"fixture@example.test",created_at:"2026-01-01T00:00:00Z",app_metadata:{},user_metadata:{}};
const session={access_token:encode({alg:"HS256",typ:"JWT"})+"."+encode({sub:actor,role:"authenticated",exp:4102444800})+".fixture",refresh_token:"fixture",token_type:"bearer",expires_in:3600,expires_at:4102444800,user};
const profile={id:actor,role:"musician",display_name:"Henrique",is_artist:true,is_singer:false,is_musician:true,is_producer:true,artist_kind:"support",username:null,city:"São Paulo",is_public:false,artist_avatar_path:null};
const event={id:eventId,title:"Pagode na Casa Aurora",starts_at:new Date(Date.now()+86400000).toISOString(),venue:"Casa Aurora",city:"São Paulo",kind:"organized",status:"published"};
const owned={event_id:eventId,title:event.title,starts_at:event.starts_at,event_status:"published",has_budget:true,gross_revenue:4350,received:1000,expense_total:0,expense_paid:0,musician_agreed:0,musician_paid:0,musician_unpriced:0,transport_total:0,equipment_total:0,staff_total:0,food_total:0,other_total:0};
const ownGroupId="44444444-4444-4444-8444-444444444444";
const group={id:groupId,account_id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",name:"Pagode do Henrique",kind:"group",musical_type:"Grupo de Pagode",bio:"Pagode para a sua festa",city:"São Paulo",members:["João","Pedro","Henrique"],is_public:true,venue_id:null};
await mkdir("test-results",{recursive:true});
let serverLog="",browser;
const server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port","3104"],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:api,NEXT_PUBLIC_SUPABASE_ANON_KEY:"build-time-placeholder-not-a-real-secret"},stdio:["ignore","pipe","pipe"]});
server.stdout.on("data",d=>serverLog+=d);server.stderr.on("data",d=>serverLog+=d);
try{
 let ready=false;for(let i=0;i<120;i++){try{ready=(await fetch(origin+"/login")).ok;}catch{}if(ready)break;await delay(250);}assert.ok(ready,serverLog);
 browser=await chromium.launch({headless:true});
 for(const width of [360,768,1280]){
  const context=await browser.newContext({viewport:{width,height:900},timezoneId:"America/Sao_Paulo"});
  await context.addCookies([{name:"sb-example-auth-token",value:"base64-"+encode(session),url:origin,sameSite:"Lax"}]);
  const writes=[],errors=[],unhandled=[];let savedProfiles=[],failFinance=false,producer=width!==360;
  await context.route(api+"/**",async route=>{
   const req=route.request(),url=new URL(req.url()),rpc=url.pathname.split("/").at(-1),body=req.postDataJSON();let data=[],status=200;
   if(req.method()==="OPTIONS"){await route.fulfill({status:204,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"*"}});return;}
   if(url.pathname.endsWith("/user"))data=user;
   else if(rpc==="profiles"){assert.equal(url.searchParams.get("id"),"eq."+actor);data={...profile,is_producer:producer};}
   else if(rpc==="stage_owner_admin_status")data=false;
   else if(rpc==="stage_venue_partner_access")data={status:"ok",items:[]};
   else if(rpc==="stage_my_musician_portfolio")data={name:"Henrique",bio:"Músico de teste",city:"São Paulo",slug:"henrique",avatar_url:null,instagram_url:null,is_published:false};
   else if(rpc==="stage_workspace_overview")data={status:"ok",metrics:{shows_week:2,pending_invites:3,unread_conversations:1,pending_contacts:0,received_month:1000},upcoming:[event],activity:[],updated_at:new Date().toISOString()};
   else if(rpc==="stage_finance_organizer_overview"){if(failFinance){data={message:"Fixture failure"};status=503;}else data=[owned];}
   else if(rpc==="stage_my_show_history")data=[];
   else if(rpc==="stage_performance_profiles"){assert.equal(url.searchParams.get("account_id"),"eq."+actor);data=savedProfiles;}
   else if(rpc==="stage_save_performance_profile"){
    writes.push(body);if(body.p_kind==="producer")producer=true;
    const id=body.p_kind==="group"?ownGroupId:body.p_kind==="producer"?"55555555-5555-4555-8555-555555555555":"66666666-6666-4666-8666-666666666666";
    savedProfiles=[...savedProfiles.filter(row=>row.id!==id),{...group,id,account_id:actor,kind:body.p_kind,musical_type:body.p_type,name:body.p_name,members:body.p_members,is_public:body.p_public}];data={status:"saved",id};
   }
   else if(rpc==="events"){assert.equal(url.searchParams.get("producer_id"),"eq."+actor);data=[event];}
   else if(rpc==="stage_discover_performance_profiles")data={status:"ok",items:[group]};
   else if(rpc==="stage_performance_availability")data="free";
   else if(rpc==="stage_invite_performance_profile"){assert.equal(body.p_profile_id,groupId);assert.equal(body.p_event_id,eventId);assert.equal(body.p_fee,1500);writes.push(body);data={status:"sent",invitation_id:inviteId};}
   else if(rpc==="stage_fee_details")data={status:"pending",is_owner:true,has_offer:true,last_amount:1500,last_by_me:true,agreed_amount:null,history:[]};
   else if(rpc==="stage_my_invitations")data=[];
   else if(rpc==="stage_musician_whatsapp_preferences")data=null;
   else if(rpc==="stage_marketplace_preview_status")data={allowed:false};
   else {unhandled.push(rpc);data=[];}
   await route.fulfill({status,contentType:"application/json",headers:{"access-control-allow-origin":"*","access-control-allow-headers":"*"},body:JSON.stringify(data)});
  });
  const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
  await page.goto(origin+"/painel");
  await page.getByRole("heading",{name:event.title,exact:true}).waitFor();await page.getByText("Seu dinheiro, à vista",{exact:true}).waitFor();
  assert.match(await page.locator(".sf-operations-summary").innerText(),/3 convites/);
  assert.match(await page.locator(".sf-operations-finance").innerText(),/3\.350,00/);
  const mobile=width<=850;
  const nav=page.getByRole("navigation",{name:mobile?"Navegação principal no celular":"Navegação do StageFlow",exact:true});
  await nav.getByRole("link",{name:mobile?"Explorar":"Marketplace",exact:true}).waitFor();
  await nav.getByRole("link",{name:mobile?"Chats":"Financeiro",exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,"Dashboard overflows at "+width);
  await page.screenshot({path:`test-results/operational-home-${width}.png`,fullPage:true});
  if(width===360){
   for(const screen of [320,375,430]){
    await page.setViewportSize({width:screen,height:820});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),
      "Dashboard has horizontal overflow at "+screen+"px");
    const bottom=page.getByRole("navigation",{name:"Navegação principal no celular"});
    assert.equal(await bottom.getByRole("link").count(),5,"Five thumb destinations at "+screen+"px");
    await page.screenshot({path:`test-results/mobile-dashboard-${screen}.png`,fullPage:true});
   }
   await page.setViewportSize({width:360,height:900});
  }
  await nav.getByRole("link",{name:mobile?"Explorar":"Marketplace",exact:true}).click();
  await page.getByRole("heading",{name:/Encontre o músico certo/}).waitFor();
  if(width===360){
   for(const screen of [320,375,430]){
    await page.setViewportSize({width:screen,height:820});
    const overflow=await page.evaluate(()=>{
     const width=innerWidth;
     const overflow=document.documentElement.scrollWidth-width;
     const offenders=[...document.querySelectorAll("body *")]
      .map(el=>({tag:el.tagName,className:typeof el.className==="string"?el.className.slice(0,80):"",
        right:Math.round(el.getBoundingClientRect().right),left:Math.round(el.getBoundingClientRect().left)}))
      .filter(x=>x.right>width+2||x.left< -2).sort((a,b)=>b.right-a.right).slice(0,10);
     return {overflow,offenders};
    });
    assert.ok(overflow.overflow<=2,
      "Marketplace has horizontal overflow at "+screen+"px: "+JSON.stringify(overflow));
    await page.screenshot({path:`test-results/mobile-marketplace-${screen}.png`,fullPage:true});
   }
   await page.setViewportSize({width:360,height:900});
  }
  await page.goto(origin+"/meu-portfolio");await page.waitForURL(/\/perfil-artistico\?aba=instrumentista/);await page.getByRole("heading",{name:"Perfil Artístico",exact:true}).waitFor();
  if(width===360){
   const wizard=page.getByLabel("Etapas de edição do perfil");
   await page.locator('.sf-editor-wizard[data-wizard-ready="true"]').waitFor();
   await wizard.getByRole("button",{name:/Instrumentos/}).click();
   const instruments=page.locator("#portfolio-instruments");
   await instruments.fill("Cavaquinho, Pandeiro");
   await wizard.getByRole("button",{name:/Experiência/}).click();
   const state=await page.evaluate(()=>{
    const editor=document.querySelector(".mp-editor-workspace");
    const wizard=document.querySelector(".sf-editor-wizard");
    const active=wizard?.querySelector(".sf-editor-wizard-tabs .is-active");
    const instrument=document.querySelector("#portfolio-instruments");
    return {editorStep:editor?.getAttribute("data-editor-active"),
      activeButton:active?.textContent?.trim(),progress:wizard?.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow"),
      instrumentDisplay:instrument?getComputedStyle(instrument.closest("[data-editor-step]")).display:null};
   });
   if(state.editorStep!=="2"||await instruments.isVisible()){
    await page.screenshot({path:"test-results/operational-editor-experience-360.png",fullPage:true});
   }
   assert.equal(state.editorStep,"2","Step button must switch editor: "+JSON.stringify(state));
   assert.equal(await instruments.isVisible(),false,
    "Wizard must show only the active step on mobile: "+JSON.stringify(state));
   await wizard.getByRole("button",{name:/Instrumentos/}).click();
   await page.locator('.mp-editor-workspace[data-editor-active="1"]').waitFor();
   assert.equal(await instruments.inputValue(),"Cavaquinho, Pandeiro",
    "Switching steps must preserve the musician's unsaved draft");
   assert.equal(await instruments.isVisible(),true);
   // Janela baixa simula a area visivel reduzida pelo teclado mobile;
   // nao equivale a um teste de teclado fisico no Safari.
   await page.setViewportSize({width:375,height:520});
   await instruments.focus();
   await page.waitForTimeout(80);
   const field=await instruments.evaluate(el=>{
    const r=el.getBoundingClientRect();
    const guide=el.closest(".mp-editor-workspace")?.querySelector(".sf-editor-wizard");
    const nav=document.querySelector(".sf-workspace-bottom-nav");
    return {top:r.top,bottom:r.bottom,font:parseFloat(getComputedStyle(el).fontSize),
      guidePosition:guide?getComputedStyle(guide).position:null,
      bottomNav:nav?getComputedStyle(nav).display:null,
      viewport:innerHeight,overflow:document.documentElement.scrollWidth-innerWidth};
   });
   assert.equal(field.guidePosition,"static","Editor guide must stop sticking while a field has focus");
   assert.equal(field.bottomNav,"none","Keyboard focus must not be covered by fixed bottom navigation");
   assert.ok(field.font>=16,"Mobile inputs should not trigger iOS auto-zoom");
   assert.ok(field.overflow<=2,"Editor must not overflow at 375px and short height: "+JSON.stringify(field));
   assert.ok(field.bottom<=field.viewport+2&&field.top>=-2,
     "Focused editor field should be visible above keyboard-sized viewport: "+JSON.stringify(field));
   await page.screenshot({path:"test-results/mobile-editor-keyboard-375.png",fullPage:false});
   await instruments.blur();await page.setViewportSize({width:360,height:900});
  }
  const waitProfileSave=kind=>page.waitForResponse(r=>r.url().endsWith("/stage_save_performance_profile")&&r.request().postDataJSON()?.p_kind===kind);
  await page.goto(origin+"/perfis");await page.getByRole("button",{name:"Criar perfil",exact:true}).click();
  const form=page.getByRole("form",{name:"Editar perfil adicional"});await form.getByLabel("Tipo de perfil",{exact:true}).selectOption("group");
  await form.getByLabel("Nome",{exact:true}).fill("Pagode do Henrique");await form.getByLabel("Integrantes",{exact:false}).fill("João\nPedro\nHenrique");
  const groupSaved=waitProfileSave("group");
  await form.getByRole("button",{name:"Salvar perfil",exact:true}).click();await groupSaved;await page.getByText("Perfil salvo.",{exact:true}).waitFor();assert.equal(writes[0].p_kind,"group");assert.equal(writes[0].p_members.length,3);
  if(width===360){
   await page.getByRole("button",{name:"Criar perfil",exact:true}).click();
   await form.getByLabel("Tipo de perfil",{exact:true}).selectOption("producer");
   await form.getByLabel("Nome",{exact:true}).fill("Produção do Henrique");
   await form.getByRole("checkbox",{name:/Quero usar esta conta também como produtor/}).check();
   const producerSaved=waitProfileSave("producer");
   await form.getByRole("button",{name:"Salvar perfil",exact:true}).click();await producerSaved;await page.getByText("Perfil salvo.",{exact:true}).waitFor();
   await page.getByRole("button",{name:"Criar perfil",exact:true}).click();
   await form.getByLabel("Tipo de perfil",{exact:true}).selectOption("venue");
   await form.getByLabel("Nome",{exact:true}).fill("Casa do Henrique");
   const venueSaved=waitProfileSave("venue");
   await form.getByRole("button",{name:"Salvar perfil",exact:true}).click();await venueSaved;await page.getByText("Perfil salvo.",{exact:true}).waitFor();
   await page.getByRole("heading",{name:"Casa do Henrique",exact:true}).waitFor();
  }
  await page.screenshot({path:`test-results/operational-profiles-${width}.png`,fullPage:true});
  await page.goto(origin+"/contratar?evento="+eventId);await page.getByRole("button",{name:"Buscar perfis",exact:true}).click();
  await page.getByRole("button",{name:"Ver disponibilidade",exact:true}).click();await page.getByLabel("Cachê total proposto (R$)",{exact:true}).fill("1500");
  await page.getByRole("button",{name:"Enviar convite",exact:true}).click();await page.getByText(/Convite enviado\. Negocie/).waitFor();assert.equal(writes.at(-1).p_fee,1500);
  await page.screenshot({path:`test-results/operational-hiring-${width}.png`,fullPage:true});
  failFinance=true;await page.goto(origin+"/painel");await page.getByRole("alert").filter({hasText:"Não foi possível atualizar os recebimentos"}).waitFor();
  assert.deepEqual(errors,[],"Browser exceptions at "+width);await context.close();
 }
 console.log("PASS: dashboard at 360/768/1280, navigation, receipt failure, legacy profile, group creation, availability and invitation.");
}finally{await browser?.close();server.kill("SIGTERM");await writeFile("test-results/operational-server.log",serverLog);}
