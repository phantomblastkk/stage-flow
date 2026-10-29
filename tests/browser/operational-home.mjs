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
  const writes=[],portfolioWrites=[],storageWrites=[],contactWrites=[],marketWrites=[],artistWrites=[],claimWrites=[],bookingSettingWrites=[],errors=[],unhandled=[];let savedProfiles=[],failFinance=false,producer=width!==360,portfolioResult="invalid_price",storageImage,uploadGate,
   contactReadFail=true,marketReadFail=true,contactResult="invalid_phone",marketResult="publish_portfolio_first",contactGate,
   singerMode=false,singerUsername=null,singerBooking=false,claimResult="taken",artistResult="invalid_link",
   artistReadMode="ok",artistReads=0,bookingReadFail=false,bookingReads=0,bookingReadGate,bookingWriteFail=false,artistWriteFail=false,proMode=false,draftReadMode="failed",draftReads=0,draftReadGate,draftSaveFail=true,draftSaveGate;
  const designWrites=[],proPublishWrites=[],mediaWrites=[],privateDeletes=[];
  const photoId="77777777-7777-4777-8777-777777777777",videoId="88888888-8888-4888-8888-888888888888";
  let mediaReadMode="failed",mediaReads=0,mediaReadGate,mediaActionGate,mediaWriteMode="saved",signFail=true,deleteFileFail=false;
  let mediaRows=[{id:photoId,media_kind:"photo",title:"Foto privada inicial",storage_path:actor+"/"+photoId+".jpg",youtube_id:null,featured:false,display_order:0},
   {id:videoId,media_kind:"youtube",title:"Vídeo inicial",storage_path:null,youtube_id:"dQw4w9WgXcQ",featured:false,display_order:1}];
  await context.route(api+"/**",async route=>{
   const req=route.request(),url=new URL(req.url()),rpc=url.pathname.split("/").at(-1);let data=[],status=200;
   if(req.method()==="OPTIONS"){await route.fulfill({status:204,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"*"}});return;}
   if(req.method()==="POST"&&url.pathname.startsWith("/storage/v1/object/sign/stage-premium-drafts/")){
    assert.ok(url.pathname.includes(actor+"/"));assert.equal(req.postDataJSON().expiresIn,3600);
    await route.fulfill({status:signFail?503:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(signFail?{message:"private_backend_detail.sql"}:{signedURL:url.pathname.replace("/storage/v1","")+"?token=fixture"})});return;
   }
   if(req.method()==="DELETE"&&url.pathname==="/storage/v1/object/stage-premium-drafts"){
    const paths=req.postDataJSON().prefixes;assert.ok(paths.every(p=>p.startsWith(actor+"/")));
    privateDeletes.push(paths);
    await route.fulfill({status:deleteFileFail?503:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(deleteFileFail?{message:"private_backend_detail.sql"}:[])});return;
   }
   if(url.pathname.startsWith("/storage/v1/object/")){
    if(req.method()==="POST"){
     const bucket=proMode?"stage-premium-drafts":singerMode?"stage-artist-public":"stage-musician-media";
     assert.match(url.pathname,new RegExp("^/storage/v1/object/"+bucket+"/"+actor+"/[0-9a-f-]{36}\\.(jpg|png|webp)$"));
     assert.equal(req.headers()["x-upsert"],"false");
     storageWrites.push({path:url.pathname,bytes:req.postDataBuffer()?.length||0});
     if(uploadGate)await uploadGate;
     await route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({Key:url.pathname.split("/object/")[1]})});return;
    }
    assert.equal(req.method(),"GET","Removing an image must not delete an object");
    assert.ok(storageImage);
    await route.fulfill({status:200,contentType:"image/png",body:storageImage});return;
   }
   const body=req.postDataJSON();
   if(url.pathname.endsWith("/user"))data=user;
   else if(rpc==="profiles"){assert.equal(url.searchParams.get("id"),"eq."+actor);data={...profile,is_producer:producer,...(singerMode?{display_name:"Artista de teste",is_singer:true,is_musician:false,artist_kind:"lead",username:singerUsername}:{})};}
   else if(rpc==="stage_owner_admin_status")data=false;
   else if(rpc==="stage_venue_partner_access")data={status:"ok",items:[]};
   else if(rpc==="stage_my_musician_portfolio")data={name:"Henrique",bio:"Músico de teste",city:"São Paulo",slug:"henrique",avatar_url:null,instagram_url:null,is_published:false};
   else if(rpc==="stage_save_musician_portfolio_v4"){portfolioWrites.push(body);data=portfolioResult;}
   else if(rpc==="stage_my_booking_contact"){
    if(contactReadFail){status=503;data={message:"Fixture read failure"};}
    else data=singerMode?{status:"ok",mode:"auto",phone:"",greeting:"Olá {artista}"}:{status:"ok",mode:"whatsapp",phone:"11987654321",greeting:"Olá {artista}"};
   }
   else if(rpc==="stage_my_artist_page"){artistReads++;if(artistReadMode==="failed"){status=503;data={message:"private_backend_detail.sql"};}
    else if(artistReadMode==="missing")data=null;else data={name:"Artista de teste",username:singerUsername,bio:"Biografia inicial",headline:"Assinatura inicial",city:"São Paulo",instagram_url:null,youtube_url:null,spotify_url:null,is_public:false,custom_subdomain_enabled:false,accent:"violet",avatar_path:null,cover_path:null};}
   else if(rpc==="stage_my_premium_site_draft"){draftReads++;if(draftReadGate)await draftReadGate;
    if(draftReadMode==="failed"){status=503;data={message:"private_backend_detail.sql"};}
    else if(draftReadMode==="missing")data=null;
    else data={theme:"ivory",accent:"gold",section_order:["about","photos","videos","agenda","contact"],visible_sections:["about","agenda","contact"],updated_at:"2026-10-01T00:00:00Z"};}
   else if(rpc==="stage_save_premium_site_draft"){designWrites.push(body);if(draftSaveGate)await draftSaveGate;
    if(draftSaveFail){status=503;data={message:"private_backend_detail.sql"};}else data="saved";}
   else if(rpc==="stage_my_premium_site_media"){mediaReads++;if(mediaReadGate)await mediaReadGate;
    if(mediaReadMode==="failed"){status=503;data={message:"private_backend_detail.sql"};}
    else data=mediaReadMode==="missing"?null:mediaRows;}
   else if(["stage_add_premium_site_media","stage_rename_premium_site_media","stage_remove_premium_site_media","stage_feature_premium_site_media","stage_reorder_premium_site_media"].includes(rpc)){
    mediaWrites.push({rpc,body});if(mediaActionGate)await mediaActionGate;
    if(mediaWriteMode==="transport"){status=503;data={message:"private_backend_detail.sql"};}
    else if(mediaWriteMode!=="saved"&&mediaWriteMode!=="commit_then_fail")data=mediaWriteMode;
    else{
     if(rpc==="stage_add_premium_site_media")mediaRows.push({id:"99999999-9999-4999-8999-"+String(mediaWrites.length).padStart(12,"0"),media_kind:body.p_kind,title:body.p_title,storage_path:body.p_storage_path,youtube_id:body.p_youtube_id,featured:false,display_order:mediaRows.length});
     if(rpc==="stage_rename_premium_site_media")mediaRows=mediaRows.map(item=>item.id===body.p_id?{...item,title:body.p_title}:item);
     if(rpc==="stage_remove_premium_site_media")mediaRows=mediaRows.filter(item=>item.id!==body.p_id);
     if(mediaWriteMode==="commit_then_fail"){status=503;data={message:"private_backend_detail.sql"};}else data="saved";
    }
   }
   else if(rpc==="stage_my_pro_site_publication")data={entitled:true,published:false,username:singerUsername,profile_public:true,url_path:"/"+singerUsername};
   else if(rpc==="stage_set_pro_site_published"){proPublishWrites.push(body);data="forbidden";}
   else if(rpc==="stage_my_artist_booking_settings"){bookingReads++;if(bookingReadGate)await bookingReadGate;
    if(bookingReadFail){status=503;data={message:"private_backend_detail.sql"};}else data=singerBooking;}
   else if(rpc==="stage_set_artist_bookings_enabled"){bookingSettingWrites.push(body);if(bookingWriteFail){status=503;data={message:"private_backend_detail.sql"};}
    else{singerBooking=body.p_enabled;data="saved";}}
   else if(rpc==="stage_claim_artist_username"){claimWrites.push(body);if(claimResult==="claimed")singerUsername=body.p_username;data=claimResult;}
   else if(rpc==="stage_save_artist_page_v2"){artistWrites.push(body);if(artistWriteFail){status=503;data={message:"private_backend_detail.sql"};}else data=artistResult;}
   else if(rpc==="stage_save_booking_contact"){contactWrites.push(body);if(contactGate)await contactGate;data=contactResult;}
   else if(rpc==="stage_my_marketplace_settings"){
    if(marketReadFail){status=503;data={message:"Fixture read failure"};}
    else data={listed:false,availability_mode:"ask",blocked_dates:[]};
   }
   else if(rpc==="stage_save_marketplace_settings"){marketWrites.push(body);data=marketResult;}
   else if(rpc==="stage_workspace_overview")data={status:"ok",metrics:{shows_week:2,pending_invites:3,unread_conversations:1,pending_contacts:0,received_month:1000},upcoming:[event],activity:[],updated_at:new Date().toISOString()};
   else if(rpc==="stage_finance_organizer_overview"){if(failFinance){data={message:"Fixture failure"};status=503;}else data=[owned];}
   else if(rpc==="stage_my_show_history")data=[];
   else if(rpc==="stage_performance_profiles"){assert.equal(url.searchParams.get("account_id"),"eq."+actor);data=savedProfiles;}
   else if(rpc==="stage_save_performance_profile"){
    writes.push(body);if(body.p_kind==="producer")producer=true;
    const id=body.p_kind==="group"?ownGroupId:body.p_kind==="producer"?"55555555-5555-4555-8555-555555555555":"66666666-6666-4666-8666-666666666666";
    savedProfiles=[...savedProfiles.filter(row=>row.id!==id),{...group,id,account_id:actor,kind:body.p_kind,musical_type:body.p_type,name:body.p_name,members:body.p_members,is_public:body.p_public}];data={status:"saved",id};
   }
   else if(rpc==="events"){assert.equal(url.searchParams.get("producer_id"),"eq."+actor);
    if(proMode){assert.equal(url.searchParams.get("show_publicly"),"eq.true");assert.equal(url.searchParams.get("status"),"eq.published");assert.equal(url.searchParams.get("limit"),"40");}
    data=[event];}
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
  // Domain CSS must preserve dynamically composed theme/layout classes.
  await page.locator(".mp-editor-workspace").waitFor();
  const editorSteps=page.getByLabel("Etapas de edição do perfil");
  if(mobile)await page.locator('.sf-editor-wizard[data-wizard-ready="true"]').waitFor();
  const activate=async button=>{await button.focus();await button.press("Enter");};
  if(mobile)await activate(editorSteps.getByRole("button",{name:/Visual e fotos/}));
  const avatar=page.getByLabel("Foto de perfil (quadrada)",{exact:true}),cover=page.getByLabel("Imagem de capa (horizontal)",{exact:true});
  await avatar.focus();
  assert.equal(await avatar.evaluate(el=>el===document.activeElement),true,"Native file control must be keyboard focusable");
  assert.ok(await avatar.evaluate(el=>getComputedStyle(el).opacity!=="0"&&el.getBoundingClientRect().height>=44));
  await avatar.setInputFiles({name:"invalid.txt",mimeType:"text/plain",buffer:Buffer.from("fixture")});
  const imageError=page.locator(".mp-editor-workspace").getByRole("alert").filter({hasText:"Escolha uma imagem JPG, PNG ou WebP de no máximo 5 MB."});
  await imageError.waitFor();
  await avatar.setInputFiles({name:"too-large.png",mimeType:"image/png",buffer:Buffer.alloc(5*1024*1024+1)});
  await imageError.waitFor();
  assert.equal(storageWrites.length,0,"Rejected files must never reach Storage");
  const png=await page.evaluate(()=>{const c=document.createElement("canvas");c.width=40;c.height=60;const ctx=c.getContext("2d");ctx.fillStyle="#7650b0";ctx.fillRect(0,0,40,60);return c.toDataURL("image/png").split(",")[1];});
  storageImage=Buffer.from(png,"base64");
  let releaseUpload;uploadGate=new Promise(resolve=>{releaseUpload=resolve;});
  await avatar.setInputFiles({name:"portrait.png",mimeType:"image/png",buffer:storageImage});
  await page.locator('#avatar-upload[aria-busy="true"]').waitFor();
  assert.equal(await cover.isDisabled(),true,"Block competing upload");
  assert.equal(await page.locator("#musician-portfolio-form button[type=submit]").isDisabled(),true,"Block save during upload");
  releaseUpload();
  await page.getByRole("img",{name:"Foto selecionada",exact:true}).waitFor();
  assert.match(storageWrites[0].path,/\.jpg$/,"Portrait preparation remains active");
  assert.ok(storageWrites[0].bytes>0);
  uploadGate=null;
  await cover.setInputFiles({name:"cover.png",mimeType:"image/png",buffer:storageImage});
  await page.getByRole("button",{name:"Remover capa da página",exact:true}).waitFor();
  assert.equal(storageWrites.length,2);
  assert.equal(portfolioWrites.length,0,"Upload must not automatically save or publish");
  await page.locator("#mp-fotos").screenshot({path:`test-results/operational-portfolio-uploads-${width}.png`});
  await activate(page.getByRole("button",{name:"Remover da página",exact:true}));
  await activate(page.getByRole("button",{name:"Remover capa da página",exact:true}));
  assert.equal(storageWrites.length,2,"Removal only updates the local draft");
  const colors=page.getByRole("group",{name:"Cor de destaque",exact:true});
  await activate(colors.getByRole("button",{name:"Cor Ciano",exact:true}));
  assert.equal(await colors.getByRole("button",{name:"Cor Ciano",exact:true}).getAttribute("aria-pressed"),"true");
  await activate(colors.getByRole("button",{name:"Cor Violeta",exact:true}));
  assert.ok(await colors.getByRole("button",{name:"Cor Violeta",exact:true}).evaluate(el=>el.getBoundingClientRect().width)>=44);
  console.log(`PASS portfolio uploads ${width}px: visible native control, rejected files, synthetic upload, busy guard and local removal`);
  for(const [theme,label,bg] of [["midnight","Midnight","#0a0d14"],["ivory","Ivory","#f7f4ec"],["stage","Stage","#0b0712"]]){
   for(const [layout,layoutLabel] of [["spotlight","Destaque"],["minimal","Minimalista"]]){
    if(mobile)await activate(editorSteps.getByRole("button",{name:/Visual e fotos/}));
    const themeButton=page.locator(".mp-preset-list").getByRole("button",{name:new RegExp("^"+label)});
    await activate(themeButton);
    assert.equal(await themeButton.getAttribute("aria-pressed"),"true");
    await activate(page.locator("#mp-aparencia").getByRole("button",{name:new RegExp("^"+layoutLabel)}));
    if(mobile)await activate(editorSteps.getByRole("button",{name:/Contratação e publicação/}));
    const preview=page.locator(".mp-editor-preview .mp-shell");
    await preview.waitFor({state:"visible"});
    assert.ok((await preview.getAttribute("class")).includes("mp-theme-"+theme));
    assert.ok((await preview.getAttribute("class")).includes("mp-layout-"+layout));
    const style=await preview.evaluate(el=>({bg:getComputedStyle(el).getPropertyValue("--mp-bg").trim(),
     display:getComputedStyle(el.querySelector(".mp-identity")).display,
     overflow:el.scrollWidth-el.clientWidth}));
    assert.equal(style.bg,bg,"Theme variables must survive CSS extraction");
    assert.equal(style.display,"flex");
    assert.ok(style.overflow<=2,"Portfolio preview overflows: "+JSON.stringify(style));
    const overflow=await page.evaluate(()=>({amount:document.documentElement.scrollWidth-innerWidth,
     offenders:[...document.querySelectorAll(".mp-editor-workspace *")].map(el=>({
      tag:el.tagName,className:typeof el.className==="string"?el.className:"",
      right:Math.round(el.getBoundingClientRect().right),width:Math.round(el.getBoundingClientRect().width)
     })).filter(el=>el.right>innerWidth+2).slice(-10)}));
    if(overflow.amount>2)await page.screenshot({path:`test-results/operational-editor-overflow-${width}.png`,fullPage:true});
    assert.ok(overflow.amount<=2,"Editor overflows at "+width+": "+JSON.stringify(overflow));
    await preview.screenshot({path:`test-results/operational-portfolio-${theme}-${layout}-${width}.png`});
   }
  }
  const openPreview=page.getByRole("button",{name:"Abrir tela cheia",exact:true});
  await activate(openPreview);
  const previewDialog=page.getByRole("dialog",{name:"Prévia ampliada do portfólio"});
  await previewDialog.waitFor();
  const full=previewDialog.locator(".mp-shell");
  assert.ok((await full.getAttribute("class")).includes("mp-layout-minimal"));
  assert.equal(await full.locator(".mp-avatar").evaluate(el=>getComputedStyle(el).borderRadius),"50%");
  assert.ok(await previewDialog.evaluate(el=>el.scrollWidth<=el.clientWidth+2),"Full preview overflows at "+width);
  await previewDialog.screenshot({path:`test-results/operational-portfolio-full-${width}.png`});
  await page.keyboard.press("Escape");
  await previewDialog.waitFor({state:"hidden"});
  assert.equal(await openPreview.evaluate(el=>el===document.activeElement),true,"Closing preview restores focus");
  assert.equal(writes.length,0,"Preview changes must not save or publish profiles");
  assert.equal(portfolioWrites.length,0,"Theme previews must not persist the portfolio");
  if(mobile)await activate(editorSteps.getByRole("button",{name:/Contratação e publicação/}));
  const publication=page.locator("#mp-publicacao").getByRole("checkbox");
  await publication.focus();await publication.press("Space");
  assert.equal(await publication.isChecked(),true);
  assert.equal(portfolioWrites.length,0,"Publication selection requires an explicit save");
  await publication.press("Space");
  assert.equal(await publication.isChecked(),false);
  console.log(`PASS portfolio ${width}px: three themes, two layouts, expanded preview and no publication`);
  const step=async name=>{if(mobile)await activate(editorSteps.getByRole("button",{name}));};
  await step(/Instrumentos/);
  await page.getByLabel("Endereço da página *",{exact:true}).fill("Perfil-Teste");
  await page.getByLabel("Frase de destaque",{exact:true}).fill("Música ao vivo");
  await page.getByLabel("Sua apresentação",{exact:true}).fill("Apresentação profissional de teste");
  const bio=page.getByLabel("Sua apresentação",{exact:true});
  assert.equal(await bio.getAttribute("aria-describedby"),"portfolio-bio-help");
  assert.match(await page.locator("#portfolio-bio-help").innerText(),/\/700 caracteres/);
  assert.ok(await bio.evaluate(el=>el.getBoundingClientRect().height)>=44);
  await page.getByLabel("Cidade de atuação",{exact:true}).fill("São Paulo");
  await page.getByLabel("Instrumentos *",{exact:true}).fill("Cavaquinho, Pandeiro");
  await page.getByLabel("Estilos musicais",{exact:true}).fill("Samba, Pagode");
  await page.getByLabel("Link da apresentação principal",{exact:true}).fill("https://example.test/principal");
  await step(/Experiência/);
  await page.getByLabel("Anos de experiência (opcional)",{exact:true}).fill("5");
  await page.getByLabel("Formatos de apresentação",{exact:true}).fill("Banda completa, Eventos");
  await page.getByLabel("Projetos, apresentações ou experiências marcantes",{exact:true}).fill("Show de teste\nGravação de teste");
  await page.getByLabel("Regiões e disponibilidade para shows",{exact:true}).fill("São Paulo e região");
  await step(/Mídias/);
  await page.getByLabel("Mais vídeos ou apresentações (opcional)",{exact:true}).fill("https://example.test/extra");
  const instagram=page.getByLabel("Instagram",{exact:true});
  await instagram.fill("not-a-url");
  assert.equal(await instagram.evaluate(el=>el.checkValidity()),false,"Keep native URL validation");
  await instagram.fill("https://www.instagram.com/fixture");
  await page.getByLabel("Canal no YouTube",{exact:true}).fill("https://www.youtube.com/@fixture");
  await page.getByLabel("Spotify",{exact:true}).fill("https://open.spotify.com/artist/fixture");
  await step(/Contratação e publicação/);
  await activate(page.locator("#mp-cache").getByRole("button",{name:/^A partir de R/}));
  await page.getByLabel("Valor de referência em reais *",{exact:true}).fill("350.50");
  const savePortfolio=page.locator("#musician-portfolio-form .mp-editor-stickybar").getByRole("button",{name:"Salvar alterações",exact:true});
  await activate(savePortfolio);
  await page.locator(".mp-editor-workspace").getByRole("alert").filter({hasText:"Informe um valor maior que zero"}).waitFor();
  assert.equal(portfolioWrites.length,1);
  portfolioResult="saved";
  await activate(savePortfolio);
  await page.locator(".mp-editor-workspace").getByRole("status").filter({hasText:"Rascunho salvo."}).waitFor();
  assert.equal(portfolioWrites.length,2);
  const expected={p_slug:"perfil-teste",p_headline:"Música ao vivo",p_bio:"Apresentação profissional de teste",p_city:"São Paulo",
   p_instruments:["Cavaquinho","Pandeiro"],p_genres:["Samba","Pagode"],p_media_url:"https://example.test/principal",
   p_experience_years:5,p_performance_types:["Banda completa","Eventos"],p_career_highlights:["Show de teste","Gravação de teste"],
   p_availability_note:"São Paulo e região",p_additional_media_urls:["https://example.test/extra"],
   p_instagram_url:"https://www.instagram.com/fixture",p_youtube_url:"https://www.youtube.com/@fixture",p_spotify_url:"https://open.spotify.com/artist/fixture",
   p_price_mode:"from",p_reference_fee:350.5,p_is_published:false,p_theme:"stage",p_layout_style:"minimal"};
  for(const [key,value] of Object.entries(expected))assert.deepEqual(portfolioWrites[1][key],value,key+" must survive the shared controls");
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Saved editor overflows at "+width);
  await page.screenshot({path:`test-results/operational-portfolio-saved-${width}.png`,fullPage:true});
  console.log(`PASS portfolio form ${width}px: labeled fields, native validation, rejected save/retry and private draft payload`);
  const contact=page.getByRole("region",{name:"Contato para contratar o músico",exact:true});
  await contact.getByText("Não foi possível carregar o contato",{exact:true}).waitFor();
  assert.equal(await contact.getByRole("button",{name:"Salvar contato",exact:true}).count(),0,"Unknown contact preferences must not be overwritten");
  assert.equal(contactWrites.length,0);
  contactReadFail=false;
  await activate(contact.getByRole("button",{name:"Tentar novamente",exact:true}));
  const phone=contact.getByLabel("Número público para contratação (WhatsApp)",{exact:true});
  await phone.waitFor();
  assert.equal(await phone.inputValue(),"11987654321","Retry must restore stored preferences");
  await phone.fill("123");await phone.press("Enter");
  assert.equal(portfolioWrites.length,2,"Contact input Enter must not submit the parent profile form");
  assert.equal(contactWrites.length,0,"Contact changes require explicit save");
  await activate(contact.getByRole("button",{name:"Salvar contato",exact:true}));
  await contact.getByRole("alert").filter({hasText:"Informe um WhatsApp brasileiro válido"}).waitFor();
  await phone.fill("11999999999");
  contactResult="saved";
  let releaseContact;contactGate=new Promise(resolve=>{releaseContact=resolve;});
  await activate(contact.getByRole("button",{name:"Salvar contato",exact:true}));
  await contact.getByRole("button",{name:"Salvando...",exact:true}).waitFor();
  assert.equal(await phone.isDisabled(),true);
  assert.equal(await contact.getByRole("radio").first().isDisabled(),true);
  releaseContact();
  await contact.getByRole("status").filter({hasText:"Contato para contratação atualizado!"}).waitFor();
  assert.deepEqual(contactWrites[1],{p_kind:"musician",p_mode:"whatsapp",p_phone:"11999999999",p_greeting:"Olá {artista}"});
  contactGate=null;
  const offContact=contact.getByRole("radio",{name:/^Não exibir contato/});await offContact.focus();await offContact.press("Space");
  await activate(contact.getByRole("button",{name:"Salvar contato",exact:true}));
  await contact.getByRole("status").filter({hasText:"O botão de contratação está oculto."}).waitFor();
  assert.deepEqual(contactWrites[2],{p_kind:"musician",p_mode:"off",p_phone:null,p_greeting:""});
  const market=page.getByRole("region",{name:"Preferências do Marketplace",exact:true});
  await market.getByText("Não foi possível carregar suas preferências",{exact:true}).waitFor();
  assert.equal(await market.getByRole("button",{name:"Salvar minha preferência",exact:true}).count(),0);
  marketReadFail=false;
  await activate(market.getByRole("button",{name:"Tentar novamente",exact:true}));
  const participation=market.getByRole("checkbox");
  await participation.waitFor();assert.equal(await participation.isChecked(),false,"Do not enable participation by default");
  const date=market.getByLabel("Datas que você não quer oferecer",{exact:true});
  await date.fill("2020-01-01");await activate(market.getByRole("button",{name:"Bloquear data",exact:true}));
  await market.getByRole("alert").filter({hasText:"Escolha uma data entre hoje"}).waitFor();
  const day=await page.evaluate(()=>{const d=new Date();d.setDate(d.getDate()+2);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");});
  for(let i=0;i<2;i++){await date.fill(day);await activate(market.getByRole("button",{name:"Bloquear data",exact:true}));}
  assert.equal(await market.getByRole("button",{name:/^Desbloquear /}).count(),1,"Dates must remain unique");
  assert.equal(marketWrites.length,0,"Editing blocked dates must not submit the form");
  await market.getByLabel("Como está sua disponibilidade?",{exact:true}).selectOption("unavailable");
  await participation.focus();await participation.press("Space");
  await activate(market.getByRole("button",{name:"Salvar minha preferência",exact:true}));
  await market.getByRole("alert").filter({hasText:"Publique e salve seu perfil"}).waitFor();
  assert.deepEqual(marketWrites[0],{p_listed:true,p_availability_mode:"unavailable",p_blocked_dates:[day]});
  marketResult="saved";await participation.focus();await participation.press("Space");
  await activate(market.getByRole("button",{name:"Salvar minha preferência",exact:true}));
  await market.getByRole("status").filter({hasText:"Participação desativada."}).waitFor();
  assert.deepEqual(marketWrites[1],{p_listed:false,p_availability_mode:"unavailable",p_blocked_dates:[day]});
  assert.equal(portfolioWrites.length,2,"Preference actions never publish or resave the profile");
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Preference panels overflow at "+width);
  await contact.screenshot({path:`test-results/operational-contact-preferences-${width}.png`});
  await market.screenshot({path:`test-results/operational-market-preferences-${width}.png`});
  console.log(`PASS contact/market preferences ${width}px: read recovery, explicit consent, private dates, validation and no parent submit`);
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
      bottomNav:nav?getComputedStyle(nav).display:null,navTop:nav?nav.getBoundingClientRect().top:null,
      viewport:innerHeight,overflow:document.documentElement.scrollWidth-innerWidth};
   });
   assert.equal(field.guidePosition,"static","Editor guide must stop sticking while a field has focus");
   assert.notEqual(field.bottomNav,"none","Global navigation stays available while a field is focused");
   assert.equal(typeof field.navTop,"number","The global navigation must be present");
   assert.ok(field.font>=16,"Mobile inputs should not trigger iOS auto-zoom");
   assert.ok(field.overflow<=2,"Editor must not overflow at 375px and short height: "+JSON.stringify(field));
   assert.ok(field.bottom<=Math.min(field.viewport,field.navTop)+2&&field.top>=-2,
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
   await form.getByRole("button",{name:"Salvar perfil",exact:true}).click();await producerSaved;
   await page.getByRole("heading",{name:"Produção do Henrique",exact:true}).waitFor();
   // Alterar a função da conta força refresh do contexto; aguarde o novo painel
   // estabilizar antes de criar uma casa, como acontece em outra visita.
   await page.reload();
   await page.getByRole("heading",{name:"Produção do Henrique",exact:true}).waitFor();
   await page.getByRole("button",{name:"Criar perfil",exact:true}).click();
   await form.getByLabel("Tipo de perfil",{exact:true}).selectOption("venue");
   await form.getByLabel("Nome",{exact:true}).fill("Casa do Henrique");
   const venueForm=await form.evaluate(el=>({
    kind:el.querySelector("#managed-profile-kind")?.value,
    name:el.querySelector('input[maxlength="100"]')?.value,
    valid:el.checkValidity(),
    invalid:[...el.elements].filter(x=>x.validity&&!x.validity.valid).map(x=>({name:x.name,id:x.id,value:x.value,reason:x.validationMessage}))
   }));
   assert.ok(venueForm.valid&&venueForm.kind==="venue",
    "Venue form must be valid and selected before save: "+JSON.stringify(venueForm));
   const beforeVenueSave=writes.length;
   const venueSaveButton=form.getByRole("button",{name:"Salvar perfil",exact:true});
   await venueSaveButton.focus();
   assert.equal(await venueSaveButton.evaluate(button=>button===document.activeElement),true,
    "Venue save must be activated from the focused submit button");
   await venueSaveButton.press("Enter");
   for(let check=0;check<35&&writes.length===beforeVenueSave;check++)await delay(100);
   const submitted=await form.evaluate(el=>({
    kind:el.querySelector("#managed-profile-kind")?.value,
    valid:el.checkValidity(),
    disabled:el.querySelector('button[type="submit"]')?.disabled,
    name:el.querySelector('input[maxlength="100"]')?.value
   })).catch(()=>({formClosed:true}));
   assert.ok(writes.length>beforeVenueSave,
    "Saving a venue must invoke its RPC: "+JSON.stringify({venueForm,submitted,writes:writes.slice(-3)}));
   assert.equal(writes.at(-1).p_kind,"venue",
    "The venue kind must survive rapid typing: "+JSON.stringify(writes.at(-1)));
   await page.getByRole("heading",{name:"Casa do Henrique",exact:true}).waitFor();
  }
  await page.screenshot({path:`test-results/operational-profiles-${width}.png`,fullPage:true});
  await page.goto(origin+"/contratar?evento="+eventId);await page.getByRole("button",{name:"Buscar perfis",exact:true}).click();
  await page.getByRole("button",{name:"Ver disponibilidade",exact:true}).click();await page.getByLabel("Cachê total proposto (R$)",{exact:true}).fill("1500");
  await page.getByRole("button",{name:"Enviar convite",exact:true}).click();await page.getByText(/Convite enviado\. Negocie/).waitFor();assert.equal(writes.at(-1).p_fee,1500);
  await page.screenshot({path:`test-results/operational-hiring-${width}.png`,fullPage:true});
  failFinance=true;await page.goto(origin+"/painel");await page.getByRole("alert").filter({hasText:"Não foi possível atualizar os recebimentos"}).waitFor();
  // Reload the real route with a singer-only account; no component is mounted artificially.
  singerMode=true;contactReadFail=false;contactResult="saved";artistReadMode="failed";bookingReadFail=true;
  await page.goto(origin+"/perfil-artistico?aba=dados");
  const singer=page.locator(".singer-unified-editor");
  await singer.getByRole("alert").filter({hasText:"Não foi possível carregar seu perfil artístico."}).waitFor();
  assert.equal(artistReads,1);assert.equal(bookingReads,0);
  assert.equal(await singer.locator("#artist-main-form").count(),0,"A failed read must never become an empty editable profile");
  assert.equal(await singer.getByRole("button",{name:/Aparência e galerias/}).count(),0);
  assert.doesNotMatch(await singer.innerText(),/private_backend_detail|migration|Supabase/);
  await singer.screenshot({path:`test-results/operational-singer-read-failure-${width}.png`});
  assert.ok(await singer.evaluate(el=>el.scrollWidth<=el.clientWidth+2),"Recovery must not overflow");
  if(mobile){
   const recoveryLayout=await singer.locator(".artist-editor-recovery h2").evaluate(el=>{
    const menu=document.querySelector(".sf-workspace-mobile-trigger");
    return {titleTop:el.getBoundingClientRect().top,menuBottom:menu?.getBoundingClientRect().bottom};
   });
   assert.ok(typeof recoveryLayout.menuBottom==="number" && recoveryLayout.titleTop>=recoveryLayout.menuBottom,"Menu must not cover recovery title");
  }
  artistReadMode="missing";
  await activate(singer.getByRole("button",{name:"Tentar novamente",exact:true}));
  await singer.getByRole("alert").filter({hasText:"Esta conta não tem a função de artista habilitada."}).waitFor();
  assert.equal(await singer.getByRole("link",{name:"Conferir minha conta"}).getAttribute("href"),"/minha-conta");
  assert.equal(artistReads,2);assert.equal(bookingReads,0);assert.equal(artistWrites.length,0);
  artistReadMode="ok";
  await activate(singer.getByRole("button",{name:"Tentar novamente",exact:true}));
  const claim=singer.getByLabel("Escolher meu @ gratuito *",{exact:true});await claim.waitFor();
  const singerSteps=singer.getByLabel("Etapas de edição do perfil");
  if(mobile)await singer.locator('.sf-editor-wizard[data-wizard-ready="true"]').waitFor();
  const singerStep=async name=>{if(mobile)await activate(singerSteps.getByRole("button",{name}));};
  await singer.getByLabel("Frase de assinatura",{exact:true}).fill("Rascunho preservado após falha");
  await singerStep(/Publicar e contratar/);
  const bookingRegion=singer.getByRole("region",{name:"Recebimento de pedidos de contratação",exact:true});
  const bookingRetry=bookingRegion.getByRole("button",{name:"Tentar carregar preferência",exact:true});
  await bookingRetry.waitFor();
  assert.equal(await bookingRegion.getByRole("checkbox").isDisabled(),true);
  assert.equal(artistReads,3);assert.equal(bookingReads,1);
  await bookingRegion.screenshot({path:`test-results/operational-singer-preference-failure-${width}.png`});
  bookingReadFail=false;
  let releaseBookingRead;bookingReadGate=new Promise(resolve=>releaseBookingRead=resolve);
  await activate(bookingRetry);
  await bookingRegion.getByRole("status").filter({hasText:"Carregando preferência"}).waitFor();
  assert.equal(await bookingRegion.getByRole("checkbox").isDisabled(),true);
  assert.equal(await bookingRetry.count(),0,"No duplicate retry while loading");
  releaseBookingRead();bookingReadGate=undefined;
  await page.waitForFunction(()=>!document.querySelector("#artist-edit-booking input")?.disabled);
  assert.equal(bookingReads,2);assert.equal(artistReads,3,"Preference recovery must not reread the profile");
  assert.equal(artistWrites.length,0);assert.equal(bookingSettingWrites.length,0,"Reading false is not consent to write");
  await singerStep(/Identidade e fotos/);
  assert.equal(await singer.getByLabel("Frase de assinatura",{exact:true}).inputValue(),"Rascunho preservado após falha");
  console.log(`PASS singer read recovery ${width}px: failed/missing profile, explicit retries, independent preference retry and preserved draft`);
  const artistAvatar=singer.getByLabel("Foto de perfil",{exact:true}),artistCover=singer.getByLabel("Imagem de capa",{exact:true});
  await artistAvatar.focus();
  assert.equal(await artistAvatar.evaluate(el=>el===document.activeElement&&getComputedStyle(el).opacity!=="0"),true);
  assert.ok(await artistAvatar.evaluate(el=>el.getBoundingClientRect().height)>=44);
  const singerStorageStart=storageWrites.length;
  await artistAvatar.setInputFiles({name:"invalid.txt",mimeType:"text/plain",buffer:Buffer.from("fixture")});
  const singerFileError=singer.getByRole("alert").filter({hasText:"Selecione um arquivo JPG, PNG ou WebP com até 5 MB."});
  await singerFileError.waitFor();
  await artistAvatar.setInputFiles({name:"too-large.png",mimeType:"image/png",buffer:Buffer.alloc(5*1024*1024+1)});
  await singerFileError.waitFor();
  assert.equal(storageWrites.length,singerStorageStart);
  let releaseArtistUpload;uploadGate=new Promise(resolve=>{releaseArtistUpload=resolve;});
  await artistAvatar.setInputFiles({name:"singer-portrait.png",mimeType:"image/png",buffer:storageImage});
  await singer.locator('#artist-avatar-upload[aria-busy="true"]').waitFor();
  assert.equal(await artistCover.isDisabled(),true);
  assert.equal(await singer.locator('#artist-main-form button[type="submit"]').isDisabled(),true);
  releaseArtistUpload();
  await singer.getByRole("button",{name:"Remover foto",exact:true}).waitFor();
  assert.match(storageWrites[singerStorageStart].path,/\/stage-artist-public\/.+\.jpg$/);
  uploadGate=null;
  await artistCover.setInputFiles({name:"singer-cover.png",mimeType:"image/png",buffer:storageImage});
  await singer.getByRole("button",{name:"Remover capa",exact:true}).waitFor();
  assert.equal(storageWrites.length,singerStorageStart+2);
  assert.equal(artistWrites.length,0,"Uploading singer media never publishes the profile");
  await singer.locator("#artist-edit-photo").screenshot({path:`test-results/operational-singer-uploads-${width}.png`});
  await singerStep(/Publicar e contratar/);
  const singerPreview=singer.locator(".artist-free-editor-preview");
  await singerPreview.waitFor({state:"visible"});
  const singerPhoto=singerPreview.getByRole("img",{name:"Sua foto de perfil",exact:true});
  await singerPhoto.waitFor();
  assert.ok((await singerPhoto.getAttribute("src")).includes("/stage-artist-public/"+actor+"/"));
  await singerPreview.screenshot({path:`test-results/operational-singer-photo-preview-${width}.png`});
  await singerStep(/Identidade e fotos/);
  await activate(singer.getByRole("button",{name:"Remover foto",exact:true}));
  await activate(singer.getByRole("button",{name:"Remover capa",exact:true}));
  assert.equal(storageWrites.length,singerStorageStart+2,"Removing singer images only changes the local draft");
  const singerColors=singer.getByRole("group",{name:"Cor do perfil gratuito",exact:true});
  for(const [label,color] of [["Rosa","#e6a3c8"],["Azul","#72dce7"],["Roxo","#a99bff"]]){
   await singerStep(/Identidade e fotos/);
   const colorButton=singerColors.getByRole("button",{name:"Selecionar "+label,exact:true});
   await activate(colorButton);
   assert.equal(await colorButton.getAttribute("aria-pressed"),"true");
   assert.ok(await colorButton.evaluate(el=>el.getBoundingClientRect().height)>=44);
   await singerStep(/Publicar e contratar/);
   await singerPreview.waitFor({state:"visible"});
   assert.equal(await singerPreview.evaluate(el=>getComputedStyle(el).getPropertyValue("--artist-free-accent").trim()),color);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Singer appearance overflows at "+width);
   await singerPreview.screenshot({path:`test-results/operational-singer-color-${label}-${width}.png`});
  }
  assert.equal(artistWrites.length,0,"Appearance options must not implicitly submit the profile form");
  console.log(`PASS singer appearance ${width}px: visible uploads, size/type guards, busy isolation, local removal and three color previews`);
  await singerStep(/Publicar e contratar/);
  const publishSinger=singer.locator("#artist-edit-publicacao input[type=checkbox]");
  await publishSinger.focus();await publishSinger.press("Space");
  assert.equal(await singer.locator("#artist-main-form").getByRole("button",{name:"Salvar e publicar",exact:true}).isDisabled(),true,"Username is required before publication");
  assert.equal(artistWrites.length,0);
  await publishSinger.press("Space");
  await singerStep(/Identidade e fotos/);
  await claim.fill("Cantor-Teste");
  await activate(singer.getByRole("button",{name:"Reservar meu @",exact:true}));
  await singer.getByRole("alert").filter({hasText:"Este @ já pertence a outro artista"}).waitFor();
  claimResult="claimed";
  await activate(singer.getByRole("button",{name:"Reservar meu @",exact:true}));
  await singer.getByRole("status").filter({hasText:"Seu @ gratuito foi registrado!"}).waitFor();
  assert.deepEqual(claimWrites,[{p_username:"cantor-teste"},{p_username:"cantor-teste"}]);
  await singer.getByLabel("Frase de assinatura",{exact:true}).fill("Samba no palco");
  await singerStep(/Publicar e contratar/);
  const singerContact=singer.getByRole("region",{name:"Contato para contratar o cantor",exact:true});
  const formRadio=singerContact.getByRole("radio",{name:/^Formulário StageFlow/});
  await formRadio.waitFor();await formRadio.focus();await formRadio.press("Space");
  const singerContactSave=singerContact.getByRole("button",{name:"Salvar contato",exact:true});
  assert.equal(await singerContactSave.isDisabled(),true,"Do not offer an inactive internal form");
  const enableBookings=singer.locator("#artist-edit-booking input[type=checkbox]");
  bookingWriteFail=true;
  await enableBookings.focus();await enableBookings.press("Space");
  await bookingRegion.getByRole("status").filter({hasText:"Não foi possível alterar esta preferência."}).waitFor();
  assert.equal(await enableBookings.isChecked(),false,"Rejected preference must keep its confirmed state");
  assert.equal(await singerContactSave.isDisabled(),true);
  assert.doesNotMatch(await bookingRegion.innerText(),/private_backend_detail|migration|Supabase/);
  bookingWriteFail=false;
  await enableBookings.focus();await enableBookings.press("Space");
  await page.waitForFunction(()=>document.querySelector("#artist-edit-booking input[type=checkbox]")?.checked===true);
  assert.deepEqual(bookingSettingWrites,[{p_enabled:true},{p_enabled:true}]);
  for(let i=0;i<100&&!(await singerContactSave.isEnabled());i++)await delay(25);
  assert.equal(await singerContactSave.isEnabled(),true,"Confirmed form activation must unlock the contact action");
  await activate(singerContactSave);
  await singerContact.getByRole("status").filter({hasText:"Contato para contratação atualizado!"}).waitFor();
  assert.deepEqual(contactWrites.at(-1),{p_kind:"singer",p_mode:"form",p_phone:null,p_greeting:""});
  const singerInstagram=singerContact.getByRole("radio",{name:/^Instagram/});
  await singerInstagram.focus();await singerInstagram.press("Space");
  assert.equal(await singerContactSave.isDisabled(),true);
  await singerStep(/Apresentação/);
  const singerBio=singer.getByLabel("Apresentação artística",{exact:true});
  await singerBio.fill("História profissional de teste");
  assert.equal(await singerBio.getAttribute("aria-describedby"),"artist-bio-help");
  await singer.getByLabel("Cidade de atuação",{exact:true}).fill("Rio de Janeiro");
  await singerStep(/Redes sociais/);
  const singerSocial=singer.getByLabel("Instagram (opcional)",{exact:true});
  await singerSocial.fill("not-a-url");assert.equal(await singerSocial.evaluate(el=>el.checkValidity()),false);
  await singerSocial.fill("https://www.instagram.com/cantorfixture");
  await singer.getByLabel("YouTube (opcional)",{exact:true}).fill("https://www.youtube.com/@cantorfixture");
  await singer.getByLabel("Spotify (opcional)",{exact:true}).fill("https://open.spotify.com/artist/cantorfixture");
  await singerStep(/Publicar e contratar/);
  assert.equal(await singerContactSave.isDisabled(),true,"Unsaved social links must not unlock contact");
  const singerSave=singer.locator("#artist-main-form").getByRole("button",{name:"Salvar rascunho",exact:true});
  await activate(singerSave);
  await singer.getByRole("alert").filter({hasText:"Use links HTTPS completos"}).waitFor();
  assert.equal(await singerContactSave.isDisabled(),true,"Rejected profile saves must not unlock contact");
  artistResult="saved";
  await activate(singerSave);
  await singer.getByRole("status").filter({hasText:"Perfil salvo em modo privado."}).waitFor();
  assert.deepEqual(artistWrites[1],{p_bio:"História profissional de teste",p_city:"Rio de Janeiro",p_instagram_url:"https://www.instagram.com/cantorfixture",
   p_youtube_url:"https://www.youtube.com/@cantorfixture",p_spotify_url:"https://open.spotify.com/artist/cantorfixture",p_is_public:false,p_headline:"Samba no palco",p_accent:"violet",p_avatar_path:null,p_cover_path:null});
  assert.equal(await singerContactSave.isEnabled(),true,"A confirmed Instagram save must unlock contact without reloading");
  const instagramContactSaved=page.waitForResponse(response=>response.url().endsWith("/stage_save_booking_contact")&&response.request().postDataJSON()?.p_kind==="singer"&&response.request().postDataJSON()?.p_mode==="instagram");
  await activate(singerContactSave);
  await instagramContactSaved;
  await singerContact.getByRole("status").filter({hasText:"Contato para contratação atualizado!"}).waitFor();
  assert.deepEqual(contactWrites.at(-1),{p_kind:"singer",p_mode:"instagram",p_phone:null,p_greeting:""});
  assert.equal(artistWrites.length,2,"Contact selection must not resave/publish the singer");
  await publishSinger.focus();await publishSinger.press("Space");
  assert.equal(artistWrites.length,2,"Selecting publication does not save it");
  await activate(singer.locator("#artist-main-form").getByRole("button",{name:"Salvar e publicar",exact:true}));
  await singer.getByRole("status").filter({hasText:"Sua página gratuita foi publicada."}).waitFor();
  assert.equal(artistWrites.length,3);assert.equal(artistWrites.at(-1).p_is_public,true);
  assert.equal(await singer.getByRole("link",{name:"Visualizar página pública",exact:true}).getAttribute("href"),"/cantor-teste");
  await publishSinger.focus();await publishSinger.press("Space");
  assert.equal(artistWrites.length,3,"Selecting private mode also requires explicit save");
  await activate(singerSave);
  await singer.getByRole("status").filter({hasText:"Perfil salvo em modo privado."}).waitFor();
  assert.equal(artistWrites.length,4);assert.equal(artistWrites.at(-1).p_is_public,false);
  artistWriteFail=true;
  await activate(singerSave);
  await singer.getByRole("alert").filter({hasText:"Seus dados continuam aqui para tentar novamente."}).waitFor();
  assert.doesNotMatch(await singer.innerText(),/private_backend_detail|migration|Supabase/);
  assert.equal(await singer.getByLabel("Frase de assinatura",{exact:true}).inputValue(),"Samba no palco");
  artistWriteFail=false;
  await activate(singerSave);
  await singer.getByRole("status").filter({hasText:"Perfil salvo em modo privado."}).waitFor();
  assert.equal(artistWrites.length,6);assert.deepEqual(artistWrites[4],artistWrites[5],"Retry preserves the unsaved payload");
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Singer editor overflows at "+width);
  await singer.screenshot({path:`test-results/operational-singer-editor-${width}.png`});
  await singerContact.screenshot({path:`test-results/operational-singer-contact-${width}.png`});
  console.log(`PASS singer editor ${width}px: username guard/claim, shared fields, private save retry and confirmed contact prerequisites`);
  // The advanced editor is reached through its real, already-mounted parent tabs.
  proMode=true;artistReadMode="failed";
  const appearanceTab=singer.getByRole("navigation",{name:"Áreas do Perfil Artístico",exact:true}).getByRole("button",{name:/^Aparência e galerias/});
  await activate(appearanceTab);
  const advanced=singer.locator(".singer-pro-embedded");
  await advanced.getByRole("alert").filter({hasText:"Não foi possível abrir a prévia do seu perfil."}).waitFor();
  assert.equal(draftReads,0);assert.equal(designWrites.length,0);
  artistReadMode="ok";
  await activate(advanced.getByRole("button",{name:"Tentar abrir prévia",exact:true}));
  const design=advanced.getByRole("region",{name:"Personalização Pro do perfil de cantor",exact:true});
  const designSave=design.getByRole("button",{name:"Salvar rascunho",exact:true});
  const draftRetry=design.getByRole("button",{name:"Tentar carregar rascunho",exact:true});
  await draftRetry.waitFor();
  assert.equal(draftReads,1);
  assert.equal(await designSave.count(),0,"Unknown saved design must not expose a save action");
  assert.equal(await design.getByRole("button",{name:/^Concert/}).count(),0,"Do not display unconfirmed default options");
  const publishPro=advanced.getByRole("button",{name:/Ativar recursos Pro/});
  await publishPro.waitFor();assert.equal(await publishPro.isDisabled(),true);
  assert.doesNotMatch(await design.innerText(),/private_backend_detail|migration|Supabase/);
  await design.screenshot({path:`test-results/operational-pro-draft-failure-${width}.png`});
  let releaseDraftRead;draftReadMode="missing";draftReadGate=new Promise(resolve=>releaseDraftRead=resolve);
  await activate(draftRetry);
  await design.getByText("Carregando seu rascunho de aparência...",{exact:true}).waitFor();
  assert.equal(await draftRetry.count(),0);assert.equal(await designSave.count(),0);
  releaseDraftRead();draftReadGate=undefined;await draftRetry.waitFor();
  assert.equal(draftReads,2);assert.equal(designWrites.length,0,"Missing draft is not permission to overwrite");
  draftReadMode="ok";
  await activate(draftRetry);
  await design.getByRole("button",{name:/^Ivory/}).waitFor();
  for(let i=0;i<100&&await design.getByRole("button",{name:/^Ivory/}).isDisabled();i++)await delay(25);
  assert.equal(await design.getByRole("button",{name:/^Ivory/}).getAttribute("aria-pressed"),"true");
  assert.equal(await design.getByRole("button",{name:"Cor Dourado",exact:true}).getAttribute("aria-pressed"),"true");
  assert.equal(await design.getByRole("checkbox",{name:"Exibir seção Vídeos",exact:true}).isChecked(),false);
  assert.equal(await designSave.isDisabled(),true,"Confirmed unchanged draft is already saved");
  assert.equal(draftReads,3);
  await activate(design.getByRole("button",{name:/^Concert/}));
  await activate(design.getByRole("button",{name:"Cor Coral",exact:true}));
  const showVideos=design.getByRole("checkbox",{name:"Exibir seção Vídeos",exact:true});
  await showVideos.focus();await showVideos.press("Space");
  await activate(design.getByRole("button",{name:"Subir Vídeos",exact:true}));
  await activate(singer.getByRole("button",{name:/^Dados e publicação/}));
  artistReadMode="failed";await activate(appearanceTab);
  assert.equal(await design.getByRole("button",{name:/^Concert/}).getAttribute("aria-pressed"),"true");
  assert.equal(await design.getByRole("button",{name:"Cor Coral",exact:true}).getAttribute("aria-pressed"),"true");
  assert.equal(await showVideos.isChecked(),true);assert.equal(draftReads,3,"Revisiting must not reset the local design");
  assert.equal(await publishPro.isDisabled(),true,"Unsaved choices cannot be published");
  let releaseDraftSave;draftSaveGate=new Promise(resolve=>releaseDraftSave=resolve);
  await activate(designSave);
  await design.getByRole("button",{name:"Salvando...",exact:true}).waitFor();
  assert.equal(await design.getByRole("button",{name:/^Ivory/}).isDisabled(),true,"Pending save freezes its draft snapshot");
  releaseDraftSave();draftSaveGate=undefined;
  await design.getByRole("alert").filter({hasText:"Não foi possível salvar seu rascunho."}).waitFor();
  assert.equal(await design.getByRole("button",{name:/^Concert/}).getAttribute("aria-pressed"),"true");
  assert.doesNotMatch(await design.innerText(),/private_backend_detail|migration|Supabase/);
  draftSaveFail=false;await activate(designSave);
  await design.getByRole("status").filter({hasText:"Rascunho salvo!"}).waitFor();
  assert.equal(designWrites.length,2);assert.deepEqual(designWrites[0],designWrites[1]);
  assert.deepEqual(designWrites[1],{p_theme:"concert",p_accent:"coral",p_section_order:["about","videos","photos","agenda","contact"],p_visible_sections:["about","agenda","contact","videos"]});
  assert.equal(await designSave.isDisabled(),true);
  assert.equal(proPublishWrites.length,0,"Saving appearance never publishes it");
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Advanced editor overflows at "+width);
  await design.screenshot({path:`test-results/operational-pro-draft-recovered-${width}.png`});
  console.log(`PASS advanced draft ${width}px: owner retry, failed/missing draft, overwrite guard, stored choices, tab preservation, rejected save/retry and no publication`);
  const media=advanced.getByRole("region",{name:"Galeria do seu Perfil Artístico",exact:true});
  const mediaRefresh=media.getByRole("button",{name:"Atualizar galeria",exact:true});
  const mediaReady=()=>page.waitForFunction(()=>{const field=document.querySelector("#premium-photo-title");return field&&!field.matches(":disabled");});
  const videoTitle=media.getByLabel("Título do vídeo",{exact:true}),videoLink=media.getByLabel("Link do vídeo",{exact:true});
  const addMediaVideo=media.getByRole("button",{name:"Adicionar vídeo",exact:true});
  await media.getByRole("alert").filter({hasText:"Não foi possível atualizar sua galeria."}).waitFor();
  assert.equal(await media.getByText(/Sua galeria está vazia/).count(),0,"Failed read is not an empty gallery");
  assert.equal(await addMediaVideo.isDisabled(),true);assert.equal(await publishPro.isDisabled(),true);
  assert.doesNotMatch(await media.innerText(),/private_backend_detail|migration|Supabase/);
  await media.screenshot({path:`test-results/operational-gallery-read-failure-${width}.png`});
  mediaReadMode="missing";await activate(mediaRefresh);
  await media.getByRole("alert").filter({hasText:"Não foi possível atualizar sua galeria."}).waitFor();
  assert.equal(await addMediaVideo.isDisabled(),true);
  mediaReadMode="ok";await activate(mediaRefresh);
  const photoRow=media.getByRole("article",{name:"Foto privada inicial",exact:true});
  await photoRow.waitFor();
  await media.getByRole("status").filter({hasText:"Algumas miniaturas não carregaram."}).waitFor();
  assert.equal(await photoRow.getByText("Foto indisponível",{exact:true}).count(),1);
  signFail=false;await activate(mediaRefresh);
  await photoRow.getByRole("img",{name:"Foto privada inicial",exact:true}).waitFor();
  await videoTitle.fill("Meu vídeo preservado");await videoLink.fill("https://youtu.be/dQw4w9WgXcQ");
  mediaReadMode="failed";await activate(mediaRefresh);
  await media.getByRole("alert").filter({hasText:"Não foi possível atualizar sua galeria."}).waitFor();
  assert.equal(await media.getByText("Foto privada inicial",{exact:true}).count(),1,"Previously loaded items survive a failed refresh");
  assert.equal(await videoTitle.inputValue(),"Meu vídeo preservado");assert.equal(await addMediaVideo.isDisabled(),true);
  let releaseMediaRead;mediaReadMode="ok";mediaReadGate=new Promise(resolve=>releaseMediaRead=resolve);
  const mediaReadStart=mediaReads;await activate(mediaRefresh);
  await media.getByRole("button",{name:"Atualizando galeria...",exact:true}).waitFor();
  assert.equal(await media.getByRole("button",{name:"Atualizando galeria...",exact:true}).isDisabled(),true);
  releaseMediaRead();mediaReadGate=undefined;await photoRow.waitFor();
  assert.equal(mediaReads,mediaReadStart+1);assert.equal(await videoTitle.inputValue(),"Meu vídeo preservado");
  await videoLink.fill("https://example.test/video");await activate(addMediaVideo);
  await media.getByRole("alert").filter({hasText:"Cole um link HTTPS válido"}).waitFor();assert.equal(mediaWrites.length,0);
  await videoLink.fill("https://youtu.be/dQw4w9WgXcQ");mediaWriteMode="transport";
  await activate(addMediaVideo);await media.getByRole("alert").filter({hasText:"Não foi possível confirmar a operação."}).waitFor();
  assert.equal(await videoTitle.inputValue(),"Meu vídeo preservado");assert.equal(await addMediaVideo.isDisabled(),true);
  await activate(mediaRefresh);await mediaReady();await photoRow.waitFor();
  mediaWriteMode="saved";mediaReadMode="failed";
  await activate(addMediaVideo);
  await media.getByRole("status").filter({hasText:"Vídeo adicionado ao rascunho."}).waitFor();
  await media.getByRole("alert").filter({hasText:"Não foi possível atualizar sua galeria."}).waitFor();
  assert.equal(await videoTitle.inputValue(),"","Confirmed insert clears its fields even if refresh fails, preventing duplicates");
  assert.equal(await media.getByText("Vídeo inicial",{exact:true}).count(),1);
  mediaReadMode="ok";await activate(mediaRefresh);
  await media.getByText("Meu vídeo preservado",{exact:true}).waitFor();assert.equal(mediaWrites.length,2);
  assert.deepEqual(mediaWrites[0],mediaWrites[1]);
  await activate(photoRow.getByRole("button",{name:"Título",exact:true}));
  const renamePhoto=photoRow.getByLabel("Novo título de Foto privada inicial",{exact:true});
  await renamePhoto.fill("Foto renomeada");mediaWriteMode="invalid_title";
  let releaseMediaAction;mediaActionGate=new Promise(resolve=>releaseMediaAction=resolve);
  await activate(photoRow.getByRole("button",{name:"Salvar título",exact:true}));
  for(let i=0;i<100&&mediaWrites.length<3;i++)await delay(25);
  await photoRow.locator("form").evaluate(form=>form.requestSubmit());
  assert.equal(await renamePhoto.isDisabled(),true);assert.equal(mediaWrites.length,3,"Pending operation cannot be submitted twice");
  releaseMediaAction();mediaActionGate=undefined;
  await media.getByRole("alert").filter({hasText:"O título deve ter de 1 a 90 caracteres."}).waitFor();
  assert.equal(await renamePhoto.inputValue(),"Foto renomeada");
  mediaWriteMode="saved";await activate(photoRow.getByRole("button",{name:"Salvar título",exact:true}));
  const renamedPhoto=media.getByRole("article",{name:"Foto renomeada",exact:true});await renamedPhoto.waitFor();
  await activate(renamedPhoto.getByRole("button",{name:"Remover",exact:true}));mediaWriteMode="published_media_in_use";
  await activate(renamedPhoto.getByRole("button",{name:"Confirmar remoção",exact:true}));
  await media.getByRole("alert").filter({hasText:"Esta foto está no Perfil Artístico publicado."}).waitFor();
  assert.equal(privateDeletes.length,0,"Rejected removal must never delete the private file");
  mediaWriteMode="saved";deleteFileFail=true;
  await activate(renamedPhoto.getByRole("button",{name:"Confirmar remoção",exact:true}));
  await media.getByRole("alert").filter({hasText:"seu arquivo privado não pôde ser excluído agora."}).waitFor();
  assert.equal(await renamedPhoto.count(),0);assert.equal(privateDeletes.length,1);
  assert.equal(await media.getByText("Vídeo inicial",{exact:true}).count(),1);
  const photoName=media.getByLabel("Nome da foto (opcional)",{exact:true}),photoFile=media.getByLabel("Foto de show",{exact:true});
  await photoName.fill("Nova foto preservada");const uploadsBefore=storageWrites.length;
  await photoFile.setInputFiles({name:"invalid.txt",mimeType:"text/plain",buffer:Buffer.from("fixture")});
  await media.getByRole("alert").filter({hasText:"Envie JPG, PNG ou WebP de até 5 MB."}).waitFor();
  assert.equal(await photoName.inputValue(),"Nova foto preservada");assert.equal(storageWrites.length,uploadsBefore);
  await photoFile.setInputFiles({name:"too-large.png",mimeType:"image/png",buffer:Buffer.alloc(5*1024*1024+1)});
  assert.equal(storageWrites.length,uploadsBefore);
  mediaWriteMode="commit_then_fail";
  let releasePrivateUpload;uploadGate=new Promise(resolve=>releasePrivateUpload=resolve);
  await photoFile.setInputFiles({name:"new-private.png",mimeType:"image/png",buffer:storageImage});
  for(let i=0;i<100&&storageWrites.length===uploadsBefore;i++)await delay(25);
  assert.equal(await photoFile.isDisabled(),true);assert.equal(await addMediaVideo.isDisabled(),true);
  releasePrivateUpload();uploadGate=undefined;
  await media.getByRole("alert").filter({hasText:"Não foi possível confirmar a operação."}).waitFor();
  assert.equal(await photoName.inputValue(),"Nova foto preservada");assert.equal(privateDeletes.length,1,"An ambiguous insert must not trigger cleanup of its uploaded file");
  const writesBeforeReconcile=mediaWrites.length;
  await activate(mediaRefresh);await media.getByText("Nova foto preservada",{exact:true}).waitFor();
  assert.equal(mediaWrites.length,writesBeforeReconcile);assert.equal(storageWrites.length,uploadsBefore+1);
  assert.equal(await photoName.inputValue(),"Nova foto preservada");assert.equal(proPublishWrites.length,0);
  assert.equal(await publishPro.isEnabled(),true,"Confirmed media reconciliation releases the existing publication guard");
  assert.equal(draftReads,3,"Media recovery never resets the design");
  assert.doesNotMatch(await media.innerText(),/private_backend_detail|migration|Supabase/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Gallery overflows at "+width);
  await media.screenshot({path:`test-results/operational-gallery-recovered-${width}.png`});
  console.log(`PASS gallery recovery ${width}px: failed/missing read, retained rows/fields, signed-preview retry, uncertain writes, serialized rename, guarded removal, private upload reconciliation and no publication`);
  assert.deepEqual(errors,[],"Browser exceptions at "+width);await context.close();
 }
 console.log("PASS: dashboard at 360/768/1280, navigation, receipt failure, legacy profile, group creation, availability and invitation.");
}finally{await browser?.close();server.kill("SIGTERM");await writeFile("test-results/operational-server.log",serverLog);}
