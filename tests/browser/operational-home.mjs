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
  const writes=[],portfolioWrites=[],storageWrites=[],contactWrites=[],marketWrites=[],errors=[],unhandled=[];let savedProfiles=[],failFinance=false,producer=width!==360,portfolioResult="invalid_price",storageImage,uploadGate,
   contactReadFail=true,marketReadFail=true,contactResult="invalid_phone",marketResult="publish_portfolio_first",contactGate;
  await context.route(api+"/**",async route=>{
   const req=route.request(),url=new URL(req.url()),rpc=url.pathname.split("/").at(-1);let data=[],status=200;
   if(req.method()==="OPTIONS"){await route.fulfill({status:204,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"*"}});return;}
   if(url.pathname.startsWith("/storage/v1/object/")){
    if(req.method()==="POST"){
     assert.match(url.pathname,new RegExp("^/storage/v1/object/stage-musician-media/"+actor+"/[0-9a-f-]{36}\\.(jpg|png|webp)$"));
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
   else if(rpc==="profiles"){assert.equal(url.searchParams.get("id"),"eq."+actor);data={...profile,is_producer:producer};}
   else if(rpc==="stage_owner_admin_status")data=false;
   else if(rpc==="stage_venue_partner_access")data={status:"ok",items:[]};
   else if(rpc==="stage_my_musician_portfolio")data={name:"Henrique",bio:"Músico de teste",city:"São Paulo",slug:"henrique",avatar_url:null,instagram_url:null,is_published:false};
   else if(rpc==="stage_save_musician_portfolio_v4"){portfolioWrites.push(body);data=portfolioResult;}
   else if(rpc==="stage_my_booking_contact"){
    if(contactReadFail){status=503;data={message:"Fixture read failure"};}
    else data={status:"ok",mode:"whatsapp",phone:"11987654321",greeting:"Olá {artista}"};
   }
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
  await contact.getByRole("status").filter({hasText:"Contato para contratação atualizado!"}).waitFor();
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
  assert.deepEqual(errors,[],"Browser exceptions at "+width);await context.close();
 }
 console.log("PASS: dashboard at 360/768/1280, navigation, receipt failure, legacy profile, group creation, availability and invitation.");
}finally{await browser?.close();server.kill("SIGTERM");await writeFile("test-results/operational-server.log",serverLog);}
