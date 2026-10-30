// All responses are synthetic fixtures. No live account, payment or Supabase access.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdir,readFile,writeFile} from "node:fs/promises";
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
  let publicationReadMode="ok",publicationReadGate,publicationReads=0,proPublished=false,proEntitled=true,proProfilePublic=true,publicationWriteMode="saved",publicationWriteGate;
  const secondShowId="abababab-abab-4bab-8bab-abababababab";
  const nextShowStart=new Date(Date.UTC(new Date().getFullYear(),new Date().getMonth()+1,10,15)).toISOString();
  let agendaRows=[{...event},{...event,id:secondShowId,title:"Show do próximo mês",starts_at:nextShowStart}];
  let flyerRows=[{id:eventId,flyer_path:null,flyer_settings:null},{id:secondShowId,flyer_path:actor+"/"+secondShowId+"/flyer.png",flyer_settings:null}];
  let agendaMode="failed",flyerMode="failed",agendaReads=0,flyerReads=0,agendaGate,flyerGate,flyerSignMode="failed",flyerImageFail=false,flyerSigns=0,flyerDownloadFail=true,flyerDownloadGate;
  const flyerSignPaths=[],flyerDownloads=[];
  const photoId="77777777-7777-4777-8777-777777777777",videoId="88888888-8888-4888-8888-888888888888";
  let mediaReadMode="failed",mediaReads=0,mediaReadGate,mediaActionGate,mediaWriteMode="saved",signFail=true,deleteFileFail=false;
  let mediaRows=[{id:photoId,media_kind:"photo",title:"Foto privada inicial",storage_path:actor+"/"+photoId+".jpg",youtube_id:null,featured:false,display_order:0},
   {id:videoId,media_kind:"youtube",title:"Vídeo inicial",storage_path:null,youtube_id:"dQw4w9WgXcQ",featured:false,display_order:1}];
  let catalogMode=false,catalogSearchMode="ok",catalogFeaturedReads=0,catalogSearchGate,catalogFeaturedGate,catalogFeaturedMode="ok";
  const catalogCalls=[];
  const catalogRows=Array.from({length:25},(_,index)=>({musician_id:"50505050-5050-4050-8050-"+String(index+1).padStart(12,"0"),name:"Músico sintético "+(index+1),slug:"musico-sintetico-"+(index+1),headline:"Apresentações ao vivo",city:"São Paulo",instruments:["Cavaquinho"],genres:["Pagode"],avatar_url:null,cover_url:null,price_mode:"from",reference_fee:800,experience_years:5,performance_types:[],availability_note:"Sob consulta",availability_mode:"accepting",date_blocked:false,rating_avg:0,rating_count:0,is_favorite:false}));
  let invitationFixture=false,invitationEventsMode="transport",invitationEventsReads=0,invitationEventsGate,invitationResult="sent",invitationGate;
  const invitationWrites=[],createdMarketplaceInvitations=new Map();
  let reviewFixture=false,publicReviewsMode="transport",eligibilityMode="transport",publicReviewsGate,eligibilityGate,reviewResult="not_eligible",reviewGate;
  const publicReviewReads=[],eligibilityReads=[],marketplaceReviewWrites=[];
  let fixtureReviews=[];
  const completedReviewIds=["73737373-7373-4373-8373-737373737373","74747474-7474-4474-8474-747474747474","75757575-7575-4575-8575-757575757575","76767676-7676-4676-8676-767676767676"];
  let fixtureReviewable=completedReviewIds.map((id,index)=>({event_id:id,event_title:"Apresentação concluída "+(index+1),starts_at:new Date(Date.now()-(index+1)*86400000).toISOString(),reviewed:false}));
  const videoEmbeds=[];
  await context.route("https://www.youtube-nocookie.com/embed/**",async route=>{
   videoEmbeds.push(route.request().url());
   await route.fulfill({contentType:"text/html",body:'<!doctype html><html lang="pt-BR"><body style="margin:0;background:#101827;color:white;font-family:Arial;display:grid;place-items:center;height:100vh"><p>Player sintético para teste de navegação</p></body></html>'});
  });
  let publicGalleryRows=[];
  let publicBookingResult="invalid_message",reportResult="invalid";
  const publicBookingWrites=[],reportWrites=[];
  let moderationAccess=false,moderationResult="target_not_found",moderationGate;
  const moderationReads=[],moderationWrites=[];
  const moderationRows=[0,1,2].map((index)=>({
    id:"81818181-8181-4181-8181-81818181818"+index,
    target_type:index===1?"review":"musician",musician_id:catalogRows[index].musician_id,
    musician_name:"Artista sob análise "+(index+1),review_id:index===1?"82828282-8282-4282-8282-828282828282":null,
    review_comment:index===1?"Comentário sintético original":null,review_rating:index===1?3:null,
    reporter_name:"Contato sintético",reason:"misleading",details:"Relato sintético sem dados pessoais, para revisar o comportamento e a apresentação da fila.",
    status:"open",last_action:null,moderator_note:"",created_at:"2026-10-20T12:00:00Z",reviewed_at:null,musician_hidden:false,review_hidden:index===1
  }));
  await context.route(api+"/**",async route=>{
   const req=route.request(),url=new URL(req.url()),rpc=url.pathname.split("/").at(-1);let data=[],status=200;
   if(req.method()==="OPTIONS"){await route.fulfill({status:204,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"*"}});return;}
   if(req.method()==="POST"&&url.pathname.startsWith("/storage/v1/object/sign/stage-show-flyers/")){
    assert.ok(url.pathname.includes(actor+"/"));assert.equal(req.postDataJSON().expiresIn,3600);
    flyerSigns++;flyerSignPaths.push(url.pathname);
    await route.fulfill({status:flyerSignMode==="failed"?503:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(flyerSignMode==="failed"?{message:"private_backend_detail.sql"}:{signedURL:url.pathname.replace("/storage/v1","")+"?token=fixture-"+flyerSigns})});return;
   }
   if(req.method()==="GET"&&url.pathname.startsWith("/storage/v1/object/sign/stage-show-flyers/")){
    if(flyerImageFail){await route.abort("failed");return;}
    await route.fulfill({status:200,contentType:"image/png",body:storageImage});return;
   }
   if(req.method()==="GET"&&url.pathname.startsWith("/storage/v1/object/stage-show-flyers/")){
    assert.ok(url.pathname.includes(actor+"/"));flyerDownloads.push(url.pathname);if(flyerDownloadGate)await flyerDownloadGate;
    await route.fulfill({status:flyerDownloadFail?503:200,contentType:flyerDownloadFail?"application/json":"image/png",headers:{"access-control-allow-origin":"*"},body:flyerDownloadFail?JSON.stringify({message:"private_backend_detail.sql"}):storageImage});return;
   }
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
   else if(rpc==="stage_public_pro_artist_site")data={artist:{name:"Artista de teste",username:"cantor-teste",bio:"Biografia pública",city:"São Paulo",headline:"No palco",instagram_url:null,youtube_url:null,spotify_url:null,avatar_path:null,cover_path:null,bookings_enabled:true},design:{theme:"midnight",accent:"violet",section_order:["about","photos","videos","agenda","contact"],visible_sections:["about","photos","videos","contact"]},media:publicGalleryRows,events:[]};
   else if(["stage_public_artistic_musician","stage_public_booking_contact"].includes(rpc))data=null;
   else if(rpc==="stage_submit_artist_booking"){publicBookingWrites.push(body);data=publicBookingResult;}
   else if(rpc==="stage_marketplace_report"){reportWrites.push(body);data=reportResult;}
   else if(rpc==="stage_marketplace_moderator_status")data=moderationAccess;
   else if(rpc==="stage_marketplace_moderation_reports"){
    moderationReads.push(body);
    if(!moderationAccess){data={status:"forbidden",items:[],total:0};}
    else {
     const rows=body.p_offset===30?[moderationRows[2]]:moderationRows.slice(0,2);
     data={status:"ok",items:body.p_filter==="resolved"?[]:rows,total:body.p_filter==="resolved"?0:31};
    }
   }
   else if(rpc==="stage_marketplace_moderate_report"){
    moderationWrites.push(body);if(moderationGate)await moderationGate;
    data=moderationAccess?moderationResult:"forbidden";
   }
   else if(rpc==="stage_public_verified")data=false;
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
   else if(rpc==="stage_my_pro_site_publication"){
    publicationReads++;const mode=publicationReadMode;
    const snapshot={entitled:proEntitled,published:proPublished,username:singerUsername,profile_public:proProfilePublic,url_path:"/"+singerUsername};
    if(publicationReadGate)await publicationReadGate;
    if(mode==="failed"){status=503;data={message:"private_backend_detail.sql"};}
    else data=mode==="missing"?null:mode==="malformed"?{...snapshot,entitled:"yes"}:snapshot;
   }
   else if(rpc==="stage_set_pro_site_published"){
    proPublishWrites.push(body);assert.equal(typeof body.p_publish,"boolean");if(publicationWriteGate)await publicationWriteGate;
    if(publicationWriteMode==="transport"){status=503;data={message:"private_backend_detail.sql"};}
    else if(publicationWriteMode!=="saved"&&publicationWriteMode!=="commit_then_fail")data=publicationWriteMode;
    else{proPublished=body.p_publish;
     if(publicationWriteMode==="commit_then_fail"){status=503;data={message:"private_backend_detail.sql"};}
     else data=body.p_publish?"published":"unpublished";
    }
   }
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
   else if(rpc==="events"){
    assert.equal(url.searchParams.get("producer_id"),"eq."+actor);
    if(!proMode)data=[event];
    else{
     assert.equal(url.searchParams.get("show_publicly"),"eq.true");assert.equal(url.searchParams.get("status"),"eq.published");assert.equal(url.searchParams.get("limit"),"40");
     if(url.searchParams.get("select")==="id,title,venue,city,starts_at"){
      agendaReads++;assert.equal(url.searchParams.get("order"),"starts_at.asc,id.asc");assert.match(url.searchParams.get("starts_at"),/^gte\./);
      const mode=agendaMode,rows=agendaRows.map(row=>({...row}));if(agendaGate)await agendaGate;
      if(mode==="failed"){status=503;data={message:"private_backend_detail.sql"};}else data=mode==="missing"?null:mode==="empty"?[]:rows;
     }else{
      assert.equal(url.searchParams.get("select"),"id,flyer_path,flyer_settings");
      const ids=url.searchParams.get("id").slice(4,-1).split(",").map(id=>id.replaceAll('"',''));
      assert.ok(ids.length<=40&&ids.length>0);assert.ok(ids.every(id=>agendaRows.some(row=>row.id===id)));
      flyerReads++;const mode=flyerMode,rows=flyerRows.filter(row=>ids.includes(row.id)).map(row=>({...row}));if(flyerGate)await flyerGate;
      if(mode==="failed"){status=503;data={message:"private_backend_detail.sql"};}else data=rows;
     }
    }
   }
   else if(rpc==="stage_discover_performance_profiles")data={status:"ok",items:[group]};
   else if(rpc==="stage_performance_availability")data="free";
   else if(rpc==="stage_invite_performance_profile"){assert.equal(body.p_profile_id,groupId);assert.equal(body.p_event_id,eventId);assert.equal(body.p_fee,1500);writes.push(body);data={status:"sent",invitation_id:inviteId};}
   else if(rpc==="stage_fee_details")data={status:"pending",is_owner:true,has_offer:true,last_amount:1500,last_by_me:true,agreed_amount:null,history:[]};
   else if(rpc==="stage_my_invitations")data=[];
   else if(rpc==="stage_musician_whatsapp_preferences")data=null;
   else if(rpc==="stage_marketplace_search"){
    if(catalogMode)catalogCalls.push(body);
    const mode=catalogSearchMode,rows=catalogRows.slice(body.p_offset,body.p_offset+body.p_limit);
    if(catalogSearchGate)await catalogSearchGate;
    if(mode==="transport"){status=503;data={message:"private_backend_detail.sql",code:"PGRST202"};}
    else if(mode==="missing")data=null;
    else if(mode==="malformed")data={status:"ok",items:null,total:0};
    else if(mode==="invalid_total")data={status:"ok",items:[],total:-1};
    else data=catalogMode&&mode==="failed"?{status:"not_released"}:{status:"ok",items:!catalogMode||mode==="empty"?[]:rows,total:!catalogMode||mode==="empty"?0:25,limit:body.p_limit,offset:body.p_offset};
   }
   else if(rpc==="stage_marketplace_featured"){
    if(catalogMode)catalogFeaturedReads++;const mode=catalogFeaturedMode;
    if(catalogFeaturedGate)await catalogFeaturedGate;
    if(mode==="transport"){status=503;data={message:"private_backend_detail.sql",code:"PGRST202"};}
    else if(mode==="malformed")data={status:"ok",items:null};
    else data={status:"ok",items:mode==="populated"?catalogRows.slice(0,6):[]};
   }
   else if(rpc==="stage_marketplace_my_events"){
    if(!invitationFixture)data=[];
    else{
     invitationEventsReads++;const mode=invitationEventsMode;if(invitationEventsGate)await invitationEventsGate;
     if(mode==="transport"){status=503;data={message:"private_backend_detail.sql"};}
     else if(mode==="missing")data=null;
     else if(mode==="malformed")data=[{id:eventId,title:"Inválido",starts_at:"invalid"}];
     else data=mode==="empty"?[]:[{id:eventId,title:event.title,starts_at:event.starts_at,city:event.city},{id:secondShowId,title:"Segundo show para convite",starts_at:nextShowStart,city:"São Paulo"}];
    }
   }
   else if(["stage_marketplace_reviews_for_musician","stage_marketplace_my_reviewable"].includes(rpc)){
    if(!reviewFixture)data=[];
    else{
     const isPublic=rpc==="stage_marketplace_reviews_for_musician",mode=isPublic?publicReviewsMode:eligibilityMode;
     (isPublic?publicReviewReads:eligibilityReads).push(body);
     const rows=body.p_musician_id===catalogRows[0].musician_id?(isPublic?fixtureReviews:fixtureReviewable).map(row=>({...row})):[];
     const gate=isPublic?publicReviewsGate:eligibilityGate;if(gate)await gate;
     if(mode==="transport"){status=503;data={message:"private_review_detail.sql"};}
     else if(mode==="missing")data=null;
     else if(mode==="malformed")data=isPublic?[{id:"bad",organizer_name:"Fixture",rating:99,comment:null,created_at:"invalid"}]:[{event_id:eventId,event_title:"Inválido",starts_at:"invalid",reviewed:false}];
     else data=rows;
    }
   }
   else if(rpc==="stage_marketplace_submit_review"){
    marketplaceReviewWrites.push(body);const mode=reviewResult;if(reviewGate)await reviewGate;
    if(["saved","commit_then_fail","already_reviewed"].includes(mode)){
     const index=completedReviewIds.indexOf(body.p_event_id),exists=fixtureReviewable[index]?.reviewed;
     if(index>=0){fixtureReviewable=fixtureReviewable.map(row=>row.event_id===body.p_event_id?{...row,reviewed:true}:row);}
     if(!exists)fixtureReviews.push({id:"78787878-7878-4878-8878-"+String(index+1).padStart(12,"0"),organizer_name:"Organizador sintético",rating:body.p_rating,comment:body.p_comment,created_at:new Date().toISOString()});
     data=exists||mode==="already_reviewed"?"already_reviewed":"saved";
     if(mode==="commit_then_fail"){status=503;data={message:"private_review_detail.sql"};}
    }else if(mode==="transport"){status=503;data={message:"private_review_detail.sql"};}
    else data=mode;
   }
   else if(rpc==="stage_marketplace_invite_musician"){
    invitationWrites.push(body);const mode=invitationResult;if(invitationGate)await invitationGate;
    if(mode==="transport"){status=503;data={message:"private_backend_detail.sql"};}
    else if(mode==="sent"||mode==="commit_then_fail"){
     const key=body.p_event_id+":"+body.p_musician_id,exists=createdMarketplaceInvitations.has(key);
     if(!exists)createdMarketplaceInvitations.set(key,{...body});
     data={status:exists?"already_exists":"sent",invitation_id:"51515151-5151-4151-8151-515151515151"};
     if(mode==="commit_then_fail"){status=503;data={message:"private_backend_detail.sql"};}
    }else data={status:mode};
   }
   else if(rpc==="stage_public_marketplace_identity")data={};
   else if(rpc==="stage_track_marketplace_metrics")data={status:"recorded"};
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
  await page.locator("#mp-aparencia .sf-editor-extra > summary").click();
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
  await page.locator("#mp-instrumentos .sf-editor-extra > summary").nth(0).click();
  await page.locator("#mp-instrumentos .sf-editor-extra > summary").nth(1).click();
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
  await singer.locator(".artist-wizard-group[data-editor-step=\"0\"] .sf-editor-extra > summary").click();
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
  const mediaReady=()=>page.waitForFunction(()=>{const field=document.querySelector("#premium-photo-name");return field&&!field.matches(":disabled");});
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
  assert.equal(await renamePhoto.isDisabled(),true);assert.equal(await photoRow.getByRole("button",{name:"Cancelar edição",exact:true}).isDisabled(),true);assert.equal(mediaWrites.length,3,"Pending operation cannot be submitted twice");
  releaseMediaAction();mediaActionGate=undefined;
  await media.getByRole("alert").filter({hasText:"O título deve ter de 1 a 90 caracteres."}).waitFor();
  assert.equal(await media.locator(".sf-ui-notice-danger").count(),1);
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
  const proControl=advanced.getByRole("region",{name:"Publicar recursos Pro no perfil do cantor",exact:true});
  const checkPublication=proControl.getByRole("button",{name:"Verificar novamente",exact:true});
  const refreshPublication=proControl.getByRole("button",{name:"Atualizar publicação",exact:true});
  const publicationReady=()=>refreshPublication.waitFor();
  const confirmPublication=async(button,accept)=>{
   const dialogPromise=page.waitForEvent("dialog");const action=activate(button);
   const dialog=await dialogPromise;assert.equal(dialog.type(),"confirm");assert.match(dialog.message(),/recursos Pro|Pro publicados/);
   if(accept)await dialog.accept();else await dialog.dismiss();await action;
  };
  for(const mode of ["failed","missing","malformed"]){
   publicationReadMode=mode;
   if(mode==="failed")await activate(refreshPublication);else await activate(checkPublication);
   await proControl.getByRole("alert").filter({hasText:"Não foi possível verificar a publicação."}).waitFor();
   assert.equal(await proControl.getByText("STATUS INDISPONÍVEL",{exact:true}).count(),1);
   assert.equal(await proControl.locator(".sf-ui-notice-danger").count(),1,"Read failure uses the shared alert");
   assert.equal(await proControl.getByText("PRO NÃO LIBERADO",{exact:true}).count(),0,"Unknown status is not a denial of access");
   assert.equal(await proControl.getByRole("button",{name:/Ativar recursos Pro/}).count(),0);
   assert.doesNotMatch(await proControl.innerText(),/private_backend_detail|Supabase|migration|SQL/);
  }
  await proControl.screenshot({path:`test-results/operational-publication-unavailable-${width}.png`});
  publicationReadMode="ok";proEntitled=false;
  let releasePublicationRead;publicationReadGate=new Promise(resolve=>releasePublicationRead=resolve);
  const readStart=publicationReads;await activate(checkPublication);
  await proControl.getByRole("status").filter({hasText:"Verificando disponibilidade da publicação..."}).waitFor();
  assert.equal(await checkPublication.count(),0,"No duplicate retry while the status is pending");
  releasePublicationRead();publicationReadGate=undefined;await publicationReady();
  assert.equal(publicationReads,readStart+1);assert.equal(await publishPro.isDisabled(),true);
  assert.equal(await proControl.getByText("PRO NÃO LIBERADO",{exact:true}).count(),1);
  assert.equal(proPublishWrites.length,0);
  proEntitled=true;proProfilePublic=false;await activate(refreshPublication);await publicationReady();
  assert.equal(await publishPro.isDisabled(),true,"Private free profile cannot activate Pro");
  proProfilePublic=true;await activate(refreshPublication);await publicationReady();
  assert.equal(await publishPro.isEnabled(),true);
  await confirmPublication(publishPro,false);assert.equal(proPublishWrites.length,0,"Dismissed activation never writes");
  proEntitled=false;publicationWriteMode="pro_access_required";
  await confirmPublication(publishPro,true);
  await proControl.getByRole("alert").filter({hasText:"O acesso Pro ainda não foi habilitado"}).waitFor();
  assert.equal(proPublishWrites.length,1);assert.equal(proPublished,false);
  await activate(checkPublication);await publicationReady();assert.equal(await publishPro.isDisabled(),true);
  proEntitled=true;await activate(refreshPublication);await publicationReady();
  publicationWriteMode="commit_then_fail";
  let releasePublicationWrite;publicationWriteGate=new Promise(resolve=>releasePublicationWrite=resolve);
  await confirmPublication(publishPro,true);
  await proControl.getByRole("status").filter({hasText:"Atualizando publicação..."}).waitFor();
  assert.equal(await proControl.getByRole("button").count(),0,"Pending mutation hides repeat and refresh actions");
  releasePublicationWrite();publicationWriteGate=undefined;
  await proControl.getByRole("alert").filter({hasText:"Não foi possível confirmar a alteração."}).waitFor();
  assert.equal(proPublished,true);assert.equal(proPublishWrites.length,2);
  assert.equal(await proControl.getByText("PRO PUBLICADO",{exact:true}).count(),0,"An uncertain response must not become optimistic success");
  await activate(checkPublication);await publicationReady();
  assert.equal(await proControl.getByText("PRO PUBLICADO",{exact:true}).count(),1);
  assert.equal(proPublishWrites.length,2,"Reconciliation reads the committed state without republishing");
  assert.equal(await proControl.getByRole("link",{name:"Abrir meu perfil",exact:true}).getAttribute("href"),"/cantor-teste");
  proEntitled=false;await activate(refreshPublication);await publicationReady();
  const unpublish=proControl.getByRole("button",{name:"Desativar versão Pro",exact:true});
  assert.equal(await unpublish.isEnabled(),true,"Owner may deactivate a published version after access is revoked");
  assert.equal(await proControl.getByRole("button",{name:"Republicar alterações",exact:true}).isDisabled(),true);
  assert.ok(await unpublish.evaluate(el=>el.getBoundingClientRect().height)>=44);
  await confirmPublication(unpublish,false);assert.equal(proPublishWrites.length,2);
  publicationWriteMode="transport";await confirmPublication(unpublish,true);
  await proControl.getByRole("alert").filter({hasText:"Não foi possível confirmar a alteração."}).waitFor();
  assert.equal(proPublished,true);await activate(checkPublication);await publicationReady();
  assert.equal(await unpublish.isEnabled(),true);assert.equal(proPublishWrites.length,3);
  publicationWriteMode="saved";publicationReadMode="failed";await confirmPublication(unpublish,true);
  await proControl.getByRole("status").filter({hasText:"A versão Pro foi retirada do ar."}).waitFor();
  await proControl.getByRole("alert").filter({hasText:"Não foi possível verificar a publicação."}).waitFor();
  assert.equal(proPublished,false);assert.equal(proProfilePublic,true);assert.equal(proPublishWrites.length,4);
  publicationReadMode="ok";proEntitled=true;await activate(checkPublication);await publicationReady();
  assert.equal(await proControl.getByText("PRO LIBERADO · PUBLICAÇÃO PENDENTE",{exact:true}).count(),1);
  await confirmPublication(publishPro,true);
  await proControl.getByRole("status").filter({hasText:"Recursos Pro ativados no seu perfil!"}).waitFor();
  assert.equal(await proControl.locator(".sf-ui-notice-success").count(),1);
  await publicationReady();
  await confirmPublication(proControl.getByRole("button",{name:"Republicar alterações",exact:true}),true);
  await proControl.getByRole("status").filter({hasText:"Recursos Pro atualizados no seu perfil!"}).waitFor();
  await publicationReady();assert.deepEqual(proPublishWrites,[{p_publish:true},{p_publish:true},{p_publish:false},{p_publish:false},{p_publish:true},{p_publish:true}]);
  // A late status response from the hidden tab must not overwrite the new read.
  publicationReadGate=new Promise(resolve=>releasePublicationRead=resolve);
  const heldRequestPromise=page.waitForRequest(req=>req.url().endsWith("/stage_my_pro_site_publication"));
  await activate(refreshPublication);const heldRequest=await heldRequestPromise;
  const heldResponse=page.waitForResponse(response=>response.request()===heldRequest);
  await proControl.getByRole("status").filter({hasText:"Verificando disponibilidade"}).waitFor();
  await activate(singer.getByRole("button",{name:/^Dados e publicação/}));
  proPublished=false;publicationReadGate=undefined;await activate(appearanceTab);await publicationReady();
  assert.equal(await proControl.getByText("PRO LIBERADO · PUBLICAÇÃO PENDENTE",{exact:true}).count(),1);
  releasePublicationRead();await heldResponse;await delay(50);
  assert.equal(await proControl.getByText("PRO PUBLICADO",{exact:true}).count(),0,"Late old read must not restore stale publication");
  assert.equal(await proControl.getByText("PRO LIBERADO · PUBLICAÇÃO PENDENTE",{exact:true}).count(),1);
  assert.equal(draftReads,3);assert.equal(await design.getByRole("button",{name:/^Concert/}).getAttribute("aria-pressed"),"true");
  assert.equal(await photoName.inputValue(),"Nova foto preservada");assert.equal(proPublishWrites.length,6);
  assert.doesNotMatch(await proControl.innerText(),/private_backend_detail|migration|Supabase|SQL/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Publication controls overflow at "+width);
  await proControl.screenshot({path:`test-results/operational-publication-recovered-${width}.png`});
  console.log(`PASS publication recovery ${width}px: invalid/failed status, retry, permission gates, cancelled confirmations, uncertain commit, explicit unpublish/republish, stale-read isolation and preserved drafts`);
  const previewAgenda=advanced.getByRole("region",{name:"Agenda na prévia do perfil",exact:true});
  const refreshAgenda=previewAgenda.getByRole("button",{name:"Atualizar agenda",exact:true});
  const refreshFlyers=previewAgenda.getByRole("button",{name:"Atualizar cartazes",exact:true});
  const independentReads={artistReads,draftReads,mediaReads,publicationReads};
  const waitEnabled=async button=>{await button.waitFor();for(let i=0;i<100&&await button.isDisabled();i++)await delay(25);assert.equal(await button.isEnabled(),true);};
  await previewAgenda.getByRole("alert").filter({hasText:"Não foi possível atualizar a agenda"}).waitFor();
  assert.equal(flyerReads,0,"Failed agenda must not query flyer metadata");
  assert.equal(await previewAgenda.getByText("Nenhum show público futuro.",{exact:true}).count(),0);
  await previewAgenda.screenshot({path:`test-results/operational-preview-agenda-failure-${width}.png`});
  agendaMode="missing";await activate(refreshAgenda);
  await previewAgenda.getByRole("alert").filter({hasText:"Não foi possível atualizar a agenda"}).waitFor();
  assert.equal(flyerReads,0);
  agendaMode="ok";await activate(refreshAgenda);
  await previewAgenda.getByRole("article",{name:"Show Show do próximo mês",exact:true}).waitFor();
  await previewAgenda.getByRole("status").filter({hasText:"Não foi possível atualizar os cartazes."}).waitFor();
  assert.equal(await previewAgenda.getByRole("article").count(),2);
  await activate(previewAgenda.getByRole("button",{name:"Próximo mês",exact:true}));
  const chosenDate=new Date(nextShowStart).toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"});
  const chosenDay=previewAgenda.getByRole("button",{name:chosenDate+", show agendado",exact:true});
  await activate(chosenDay);assert.equal(await chosenDay.getAttribute("aria-pressed"),"true");
  const chosenCard=previewAgenda.getByRole("article",{name:"Show Show do próximo mês",exact:true});
  assert.equal(await previewAgenda.getByRole("article").count(),1);
  const agendaReadsBeforeFlyers=agendaReads;flyerMode="ok";await activate(refreshFlyers);
  const retryCartaz=chosenCard.getByRole("button",{name:"Recarregar cartaz de Show do próximo mês",exact:true});
  await retryCartaz.waitFor();assert.equal(agendaReads,agendaReadsBeforeFlyers);
  const brokenFlyerRequest=page.waitForEvent("requestfailed",{predicate:req=>req.url().startsWith(api+"/storage/v1/object/sign/stage-show-flyers/")});
  flyerSignMode="ok";flyerImageFail=true;await chosenCard.scrollIntoViewIfNeeded();await activate(retryCartaz);
  await brokenFlyerRequest;await retryCartaz.waitFor();
  assert.equal(flyerSigns,2,"Failed image also offers an explicit signed-preview retry");
  flyerImageFail=false;await activate(retryCartaz);
  const waitForFlyer=async card=>{
   const img=card.getByRole("img",{name:/^Cartaz do show /});await img.scrollIntoViewIfNeeded();
   for(let i=0;i<100&&!await img.evaluate(el=>el.complete&&el.naturalWidth>0);i++)await delay(25);
   assert.ok(await img.evaluate(el=>el.complete&&el.naturalWidth>0));
  };
  await waitForFlyer(chosenCard);
  flyerMode="failed";await activate(refreshFlyers);
  await previewAgenda.getByRole("status").filter({hasText:"Não foi possível atualizar os cartazes."}).waitFor();
  assert.equal(await chosenCard.getByRole("img",{name:/^Cartaz do show /}).count(),1,"Metadata failure keeps the last known cartaz and its show");
  assert.equal(await chosenDay.getAttribute("aria-pressed"),"true");
  await previewAgenda.screenshot({path:`test-results/operational-preview-flyer-failure-${width}.png`});
  flyerMode="ok";await activate(refreshFlyers);await waitEnabled(refreshFlyers);await waitForFlyer(chosenCard);
  const feed=chosenCard.getByRole("button",{name:"Baixar Feed",exact:true});
  const story=chosenCard.getByRole("button",{name:"Baixar Story",exact:true});
  let releaseFlyerDownload;flyerDownloadGate=new Promise(resolve=>releaseFlyerDownload=resolve);
  await activate(feed);await chosenCard.getByRole("button",{name:"Gerando...",exact:true}).waitFor();
  assert.equal(await story.isDisabled(),true);
  releaseFlyerDownload();flyerDownloadGate=undefined;
  await previewAgenda.getByRole("alert").filter({hasText:"Não foi possível baixar o cartaz agora."}).waitFor();
  assert.equal(await feed.isEnabled(),true);assert.equal(await story.isEnabled(),true);
  flyerDownloadFail=false;
  for(const [format,button,height] of [["feed",feed,1350],["story",story,1920]]){
   const downloadPromise=page.waitForEvent("download");await activate(button);const file=await downloadPromise;
   assert.match(file.suggestedFilename(),new RegExp("-"+format+"-stage-flow\\.jpg$"));
   const path=`test-results/operational-preview-flyer-${format}-${width}.jpg`;await file.saveAs(path);
   const bytes=await readFile(path);
   const dimensions=await page.evaluate(async bytes=>{const image=await createImageBitmap(new Blob([Uint8Array.from(bytes)],{type:"image/jpeg"}));const size=[image.width,image.height];image.close();return size;},[...bytes]);
   assert.deepEqual(dimensions,[1080,height]);
  }
  // Hold old flyer metadata, then load a newer agenda and metadata snapshot.
  let releaseOldFlyers;flyerRows[1]={...flyerRows[1],flyer_path:actor+"/"+secondShowId+"/old.png"};
  flyerGate=new Promise(resolve=>releaseOldFlyers=resolve);
  const oldFlyerRequestPromise=page.waitForRequest(req=>req.url().includes("/rest/v1/events?")&&new URL(req.url()).searchParams.get("select")==="id,flyer_path,flyer_settings");
  await activate(refreshFlyers);const oldFlyerRequest=await oldFlyerRequestPromise;
  const oldFlyerResponse=page.waitForResponse(response=>response.request()===oldFlyerRequest);
  await previewAgenda.getByRole("status").filter({hasText:"Carregando cartazes da agenda..."}).waitFor();
  agendaRows=agendaRows.map(row=>row.id===secondShowId?{...row,title:"Show atualizado do próximo mês"}:row);
  flyerRows[1]={...flyerRows[1],flyer_path:actor+"/"+secondShowId+"/fresh.png"};flyerGate=undefined;
  await activate(refreshAgenda);
  const updatedCard=previewAgenda.getByRole("article",{name:"Show Show atualizado do próximo mês",exact:true});
  await waitEnabled(refreshAgenda);await waitEnabled(refreshFlyers);await waitForFlyer(updatedCard);releaseOldFlyers();await oldFlyerResponse;await delay(50);
  assert.equal(flyerSignPaths.some(path=>path.endsWith("/old.png")),false,"Old metadata must never replace the newer set of cartazes");
  assert.ok(flyerSignPaths.at(-1).endsWith("/fresh.png"));
  assert.equal(await chosenDay.getAttribute("aria-pressed"),"true","Agenda retry preserves selected month and day");
  await previewAgenda.screenshot({path:`test-results/operational-preview-agenda-recovered-${width}.png`});
  const metadataBeforeAgendaError=flyerReads;agendaMode="failed";await activate(refreshAgenda);
  await previewAgenda.getByRole("alert").filter({hasText:"Não foi possível atualizar a agenda"}).waitFor();
  assert.equal(await updatedCard.count(),1);assert.equal(flyerReads,metadataBeforeAgendaError);
  let releaseAgenda;agendaMode="ok";agendaGate=new Promise(resolve=>releaseAgenda=resolve);
  const agendaReadsBefore=agendaReads;await activate(refreshAgenda);
  await previewAgenda.getByRole("status").filter({hasText:"Carregando agenda da prévia..."}).waitFor();
  assert.equal(await refreshAgenda.isDisabled(),true);releaseAgenda();agendaGate=undefined;
  await waitEnabled(refreshAgenda);await waitEnabled(refreshFlyers);await updatedCard.waitFor();assert.equal(agendaReads,agendaReadsBefore+1);
  agendaMode="empty";await activate(refreshAgenda);
  await previewAgenda.getByText("Nenhum show público nesse dia.",{exact:true}).waitFor();
  const metadataBeforeEmpty=flyerReads;
  await activate(previewAgenda.getByRole("button",{name:"Ver todos",exact:true}));
  await previewAgenda.getByText("Nenhum show público futuro.",{exact:true}).waitFor();
  assert.equal(flyerReads,metadataBeforeEmpty,"Empty agenda must not issue an unbounded flyer query");
  agendaMode="ok";agendaRows=Array.from({length:40},(_,index)=>({...event,id:"15151515-1515-4515-8515-"+String(index+1).padStart(12,"0"),title:"Série pública "+(index+1),starts_at:new Date(Date.parse(nextShowStart)+index*86400000).toISOString()}));
  flyerRows=[];await activate(refreshAgenda);
  await previewAgenda.getByText(/Mostrando os 40 próximos shows públicos/).waitFor();
  assert.equal(await previewAgenda.getByRole("article").count(),6);
  const boundedReads=agendaReads;await activate(previewAgenda.getByRole("button",{name:"Ver todos os 40 shows",exact:true}));
  assert.equal(await previewAgenda.getByRole("article").count(),40);assert.equal(agendaReads,boundedReads);
  assert.deepEqual({artistReads,draftReads,mediaReads,publicationReads},independentReads,"Agenda/flyer recovery must not reload the identity, design, gallery or publication");
  assert.equal(proPublishWrites.length,6);assert.equal(await photoName.inputValue(),"Nova foto preservada");
  assert.equal(await design.getByRole("button",{name:/^Concert/}).getAttribute("aria-pressed"),"true");
  assert.doesNotMatch(await previewAgenda.innerText(),/private_backend_detail|migration|Supabase|SQL/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Preview agenda overflows at "+width);
  console.log(`PASS preview agenda ${width}px: independent read retries, cached shows, bounded flyer IDs, thumbnail recovery, feed/story downloads, late metadata discarded, calendar selection preserved and 40-show limit`);
  const appearanceReads={artistReads,draftReads,mediaReads,publicationReads,agendaReads,flyerReads};
  const appearanceWrites=designWrites.length;
  const themeGroup=design.getByRole("group",{name:"Tema do perfil",exact:true});
  const colorGroup=design.getByRole("group",{name:"Cor de destaque",exact:true});
  const sectionsGroup=design.getByRole("group",{name:"Organizar seções",exact:true});
  const profilePreview=advanced.locator(".premium-site");
  for(const [label,id] of [["Midnight","midnight"],["Concert","concert"],["Ivory","ivory"]]){
   const option=themeGroup.getByRole("button",{name:new RegExp("^"+label)});
   await activate(option);
   assert.equal(await option.getAttribute("aria-pressed"),"true");
   assert.equal(await themeGroup.locator('button[aria-pressed="true"]').count(),1);
   assert.ok((await profilePreview.getAttribute("class")).split(" ").includes("premium-theme-"+id));
   assert.equal(designWrites.length,appearanceWrites,"Selecting a theme must not save it");
  }
  for(const [label,id] of [["Roxo","violet"],["Rosa","lime"],["Ciano","cyan"],["Dourado","gold"],["Coral","coral"]]){
   const option=colorGroup.getByRole("button",{name:"Cor "+label,exact:true});
   await option.focus();await option.press("Space");
   assert.equal(await option.getAttribute("aria-pressed"),"true");
   assert.equal(await colorGroup.locator('button[aria-pressed="true"]').count(),1);
   assert.ok((await profilePreview.getAttribute("class")).split(" ").includes("premium-site-"+id));
  }
  const controlSizes=await design.locator("button").evaluateAll(buttons=>buttons.map(button=>{
   const rect=button.getBoundingClientRect();return {name:button.getAttribute("aria-label")||button.textContent,width:rect.width,height:rect.height,shared:button.classList.contains("sf-ui-button"),type:button.type};
  }));
  assert.ok(controlSizes.every(button=>button.shared&&button.type==="button"&&button.width>=43.5&&button.height>=43.5),"Shared controls need 44px touch targets: "+JSON.stringify(controlSizes));
  assert.ok(await sectionsGroup.locator("label").evaluateAll(labels=>labels.every(label=>label.getBoundingClientRect().height>=44)),"Section labels need 44px touch areas");
  const contactSection=sectionsGroup.getByRole("checkbox",{name:"Exibir seção Contato",exact:true});
  for(const label of ["Sobre","Galeria de fotos","Vídeos","Agenda"]){
   const option=sectionsGroup.getByRole("checkbox",{name:"Exibir seção "+label,exact:true});
   if(await option.isChecked()){await option.focus();assert.ok(await option.evaluate(el=>parseFloat(getComputedStyle(el).outlineWidth)>=2));await option.press("Space");}
  }
  assert.equal(await sectionsGroup.locator('input:checked').count(),1);
  assert.equal(await contactSection.isDisabled(),true,"The last visible section must remain visible");
  assert.deepEqual(await profilePreview.getByRole("navigation",{name:"Seções do perfil de cantor",exact:true}).getByRole("link").allTextContents(),["Contato"]);
  const resetAppearance=design.getByRole("button",{name:"Restaurar padrão",exact:true});
  await activate(resetAppearance);
  await design.getByRole("status").filter({hasText:"Padrão restaurado na prévia."}).waitFor();
  assert.equal(await sectionsGroup.locator('input:checked').count(),5);assert.equal(designWrites.length,appearanceWrites);
  assert.equal(await sectionsGroup.getByRole("button",{name:"Subir Sobre",exact:true}).isDisabled(),true);
  assert.equal(await sectionsGroup.getByRole("button",{name:"Descer Contato",exact:true}).isDisabled(),true);
  const moveContact=sectionsGroup.getByRole("button",{name:"Subir Contato",exact:true});
  await moveContact.focus();
  assert.ok(await moveContact.evaluate(el=>el===document.activeElement&&el.matches(":focus-visible")&&parseFloat(getComputedStyle(el).outlineWidth)>=2),"Keyboard focus must be visible on reordering controls");
  await moveContact.press("Enter");
  assert.deepEqual(await sectionsGroup.locator("label strong").allTextContents(),["Sobre","Galeria de fotos","Vídeos","Contato","Agenda"]);
  await design.screenshot({path:`test-results/operational-appearance-keyboard-${width}.png`});
  await activate(themeGroup.getByRole("button",{name:/^Concert/}));
  await activate(colorGroup.getByRole("button",{name:"Cor Coral",exact:true}));
  const collapseAppearance=design.getByRole("button",{name:"Ocultar opções",exact:true});
  assert.equal(await collapseAppearance.getAttribute("aria-controls"),"premium-appearance-options");
  await activate(collapseAppearance);
  const expandAppearance=design.getByRole("button",{name:"Personalizar",exact:true});
  assert.equal(await expandAppearance.getAttribute("aria-expanded"),"false");
  assert.equal(await design.locator("#premium-appearance-options").getAttribute("hidden"),"");
  assert.equal(await design.getByRole("group",{name:"Opções de aparência",exact:true}).count(),0);
  await activate(expandAppearance);
  assert.equal(await themeGroup.getByRole("button",{name:/^Concert/}).getAttribute("aria-pressed"),"true");
  assert.equal(await colorGroup.getByRole("button",{name:"Cor Coral",exact:true}).getAttribute("aria-pressed"),"true");
  assert.deepEqual(await sectionsGroup.locator("label strong").allTextContents(),["Sobre","Galeria de fotos","Vídeos","Contato","Agenda"]);
  assert.equal(designWrites.length,appearanceWrites);assert.equal(proPublishWrites.length,6);
  await activate(resetAppearance);
  assert.equal(await publishPro.isDisabled(),true,"Resetting the local preview is not a saved draft");
  let releaseAppearanceSave;draftSaveGate=new Promise(resolve=>releaseAppearanceSave=resolve);
  await activate(designSave);
  await design.getByRole("button",{name:"Salvando...",exact:true}).waitFor();
  await activate(collapseAppearance);await activate(expandAppearance);
  assert.equal(await themeGroup.getByRole("button",{name:/^Midnight/}).isDisabled(),true);
  assert.equal(await contactSection.isDisabled(),true,"Collapse/expand must not bypass a pending save");
  releaseAppearanceSave();draftSaveGate=undefined;
  await design.getByRole("status").filter({hasText:"Rascunho salvo!"}).waitFor();
  assert.equal(designWrites.length,appearanceWrites+1);
  assert.deepEqual(designWrites.at(-1),{p_theme:"midnight",p_accent:"violet",p_section_order:["about","photos","videos","agenda","contact"],p_visible_sections:["about","photos","videos","agenda","contact"]});
  assert.equal(await designSave.isDisabled(),true);assert.equal(await publishPro.isEnabled(),true);
  assert.equal(proPublishWrites.length,6,"Explicit design save still never publishes");
  assert.deepEqual({artistReads,draftReads,mediaReads,publicationReads,agendaReads,flyerReads},appearanceReads,"Presentation controls must not introduce additional reads");
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Appearance controls overflow at "+width);
  await design.screenshot({path:`test-results/operational-appearance-controls-${width}.png`});
  console.log(`PASS appearance controls ${width}px: shared 44px buttons, three themes/five colors, keyboard focus/reorder, last-section guard, collapse preservation, explicit reset/save and no publication`);
  // Part 36: native forms retain their validation and gallery actions share accessible touch targets.
  const galleryUiWrites=mediaWrites.length,galleryUiReads=mediaReads;
  await videoTitle.fill("");await videoLink.fill("https://youtu.be/dQw4w9WgXcQ");
  await activate(addMediaVideo);
  assert.equal(await videoTitle.evaluate(el=>el.validity.valueMissing),true);
  assert.equal(mediaWrites.length,galleryUiWrites,"Native required validation must prevent an empty insertion");
  const galleryPhoto=media.getByRole("article",{name:"Nova foto preservada",exact:true});
  await activate(galleryPhoto.getByRole("button",{name:"Título",exact:true}));
  const galleryRename=galleryPhoto.getByLabel("Novo título de Nova foto preservada",{exact:true});
  await galleryRename.fill("Rascunho cancelado");await galleryRename.focus();
  assert.ok(await galleryRename.evaluate(el=>el===document.activeElement&&parseFloat(getComputedStyle(el).outlineWidth)>=2));
  assert.equal(await galleryRename.evaluate(el=>getComputedStyle(el).fontSize),"16px");
  const gallerySizes=await media.locator("button").evaluateAll(buttons=>buttons.map(el=>{
   const r=el.getBoundingClientRect();return {name:el.getAttribute("aria-label")||el.textContent,shared:el.classList.contains("sf-ui-button"),width:r.width,height:r.height};
  }));
  assert.ok(gallerySizes.every(el=>el.shared&&el.width>=43.5&&el.height>=43.5),JSON.stringify(gallerySizes));
  assert.ok(await media.locator("input").evaluateAll(inputs=>inputs.every(el=>el.classList.contains("sf-ui-input"))));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Gallery rename overflows at "+width);
  await galleryPhoto.screenshot({path:`test-results/operational-gallery-rename-controls-${width}.png`});
  await activate(galleryPhoto.getByRole("button",{name:"Cancelar edição",exact:true}));
  assert.equal(await galleryPhoto.getByText("Nova foto preservada",{exact:true}).count(),1);
  await activate(galleryPhoto.getByRole("button",{name:"Remover",exact:true}));
  const confirmGalleryRemoval=galleryPhoto.getByRole("button",{name:"Confirmar remoção",exact:true});
  assert.ok((await confirmGalleryRemoval.getAttribute("class")).includes("sf-ui-button-danger"));
  await confirmGalleryRemoval.focus();
  assert.ok(await confirmGalleryRemoval.evaluate(el=>el.matches(":focus-visible")&&parseFloat(getComputedStyle(el).outlineWidth)>=2));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Gallery confirmation overflows at "+width);
  await galleryPhoto.screenshot({path:`test-results/operational-gallery-removal-controls-${width}.png`});
  await activate(galleryPhoto.getByRole("button",{name:"Cancelar",exact:true}));
  assert.equal(await confirmGalleryRemoval.count(),0);assert.equal(mediaWrites.length,galleryUiWrites);
  assert.equal(mediaReads,galleryUiReads);assert.equal(privateDeletes.length,1);assert.equal(proPublishWrites.length,6);
  assert.equal(await photoName.inputValue(),"Nova foto preservada","Local title must survive presentation-only interactions");
  assert.equal(await page.locator('[id="premium-photo-name"]').count(),1,"Photo field must have its own ID");
  assert.equal(await page.locator('[id="premium-video-name"]').count(),1);
  console.log(`PASS gallery controls ${width}px: shared fields/buttons, 44px touch targets, native validation, visible rename/focus, canceled rename/removal, unique labels and no extra reads/writes/publication`);
  // Part 37: publication presentation preserves explicit choices and canonical sharing.
  const publicationUiWrites=proPublishWrites.length;
  const publicationUiIndependent={artistReads,draftReads,mediaReads,agendaReads,flyerReads};
  const publicationUiReadStart=publicationReads;
  assert.equal(await proControl.getByRole("status").filter({hasText:"Seu acesso Pro já está ativo!"}).evaluate(el=>el.classList.contains("sf-ui-notice")),true);
  await confirmPublication(publishPro,false);assert.equal(proPublishWrites.length,publicationUiWrites);
  proPublished=true;await activate(refreshPublication);await publicationReady();
  const republishControl=proControl.getByRole("button",{name:"Republicar alterações",exact:true});
  const deactivateControl=proControl.getByRole("button",{name:"Desativar versão Pro",exact:true});
  const copyProfileLink=proControl.getByRole("button",{name:"Copiar endereço",exact:true});
  const openProfileLink=proControl.getByRole("link",{name:"Abrir meu perfil",exact:true});
  assert.equal(await openProfileLink.getAttribute("href"),"/cantor-teste");
  assert.equal(await openProfileLink.getAttribute("target"),"_blank");
  assert.match(await openProfileLink.getAttribute("rel"),/noopener/);
  const publicationUiSizes=await proControl.locator("button,a.sf-ui-button").evaluateAll(nodes=>nodes.map(el=>{
   const r=el.getBoundingClientRect();return {name:el.textContent,shared:el.classList.contains("sf-ui-button"),width:r.width,height:r.height};
  }));
  assert.ok(publicationUiSizes.every(el=>el.shared&&el.width>=43.5&&el.height>=43.5),JSON.stringify(publicationUiSizes));
  assert.ok((await deactivateControl.getAttribute("class")).includes("sf-ui-button-danger"));
  for(const control of [openProfileLink,copyProfileLink,republishControl,deactivateControl]){
   await control.focus();
   assert.ok(await control.evaluate(el=>el===document.activeElement&&el.matches(":focus-visible")&&parseFloat(getComputedStyle(el).outlineWidth)>=2));
  }
  await confirmPublication(republishControl,false);await confirmPublication(deactivateControl,false);
  assert.equal(proPublishWrites.length,publicationUiWrites,"Canceling shared publication controls must not write");
  await page.evaluate(()=>Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async value=>{window.__stageCopiedLink=value;}}}));
  await activate(copyProfileLink);await proControl.getByRole("button",{name:"Link copiado!",exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__stageCopiedLink),origin+"/cantor-teste");
  await activate(refreshPublication);await publicationReady();
  await page.evaluate(()=>Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async()=>{throw new Error("synthetic clipboard failure");}}}));
  await activate(copyProfileLink);
  await proControl.getByRole("alert").filter({hasText:"Não foi possível copiar automaticamente."}).waitFor();
  assert.equal(await proControl.locator(".sf-ui-notice-danger").count(),1);
  assert.equal(await republishControl.isEnabled(),true,"Clipboard failure must not change publication eligibility");
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Publication UI overflows at "+width);
  await proControl.screenshot({path:`test-results/operational-publication-shared-controls-${width}.png`});
  await activate(refreshPublication);await publicationReady();
  assert.equal(await proControl.getByRole("alert").count(),0);
  assert.equal(publicationReads,publicationUiReadStart+3);
  assert.deepEqual({artistReads,draftReads,mediaReads,agendaReads,flyerReads},publicationUiIndependent);
  assert.equal(proPublishWrites.length,publicationUiWrites);assert.equal(privateDeletes.length,1);
  console.log(`PASS publication controls ${width}px: shared notices/buttons, 44px links/actions, keyboard focus, canceled activation/republish/deactivation, canonical clipboard success/failure and no extra writes`);
  // Part 38: the same gallery runs inside the editor preview and the real public route.
  const photoDialog=page.getByRole("dialog",{name:/^Foto ampliada:/});
  const photoWritesBefore={media:mediaWrites.length,publish:proPublishWrites.length,storage:storageWrites.length,deletes:privateDeletes.length};
  const photoReadsBefore={artistReads,draftReads,publicationReads,agendaReads,flyerReads};
  const originalPhoto={...mediaRows.find(row=>row.media_kind==="photo"),display_order:0,featured:false};
  const firstPhotoOpener=advanced.getByRole("button",{name:"Abrir foto 1 de 1: "+originalPhoto.title,exact:true});
  const previousBodyOverflow=await page.evaluate(()=>document.body.style.overflow);
  await activate(firstPhotoOpener);await photoDialog.waitFor();
  const closePhoto=photoDialog.getByRole("button",{name:"Fechar galeria",exact:true});
  assert.equal(await photoDialog.evaluate(el=>el instanceof HTMLDialogElement&&el.open&&el.matches(":modal")),true);
  assert.equal(await closePhoto.evaluate(el=>el===document.activeElement),true);
  assert.equal(await page.evaluate(()=>document.body.style.overflow),"hidden");
  await closePhoto.press("Tab");assert.equal(await closePhoto.evaluate(el=>el===document.activeElement),true);
  await closePhoto.press("Shift+Tab");assert.equal(await closePhoto.evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press("ArrowRight");await page.keyboard.press("ArrowLeft");
  assert.equal(await photoDialog.getByRole("status").innerText(),"1 / 1 · "+originalPhoto.title);
  await page.keyboard.press("Escape");await photoDialog.waitFor({state:"detached"});
  assert.equal(await firstPhotoOpener.evaluate(el=>el===document.activeElement),true);
  assert.equal(await page.evaluate(()=>document.body.style.overflow),previousBodyOverflow);
  const secondPhoto={...originalPhoto,id:"61616161-6161-4161-8161-616161616161",title:"Segunda foto disponível",display_order:2,storage_path:actor+"/61616161-6161-4161-8161-616161616161.png",featured:false};
  const missingPhoto={...secondPhoto,id:"62626262-6262-4262-8262-626262626262",title:"Foto sem prévia",display_order:1,storage_path:null};
  mediaRows=[originalPhoto,missingPhoto,secondPhoto,...mediaRows.filter(row=>row.media_kind!=="photo")];
  await activate(mediaRefresh);await mediaReady();
  const multiPhotoOpener=advanced.getByRole("button",{name:"Abrir foto 1 de 3: "+originalPhoto.title,exact:true});
  assert.equal(await advanced.getByRole("button",{name:"Abrir foto 2 de 3: Foto sem prévia",exact:true}).isDisabled(),true);
  await activate(multiPhotoOpener);await photoDialog.waitFor();
  const nextPhoto=photoDialog.getByRole("button",{name:"Próxima foto",exact:true});
  const previousPhoto=photoDialog.getByRole("button",{name:"Foto anterior",exact:true});
  await closePhoto.press("Shift+Tab");assert.equal(await nextPhoto.evaluate(el=>el===document.activeElement),true);
  await nextPhoto.press("Tab");assert.equal(await closePhoto.evaluate(el=>el===document.activeElement),true);
  await closePhoto.press("Tab");assert.equal(await previousPhoto.evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press("ArrowRight");
  await photoDialog.getByRole("img",{name:secondPhoto.title,exact:true}).waitFor();
  assert.equal(await previousPhoto.evaluate(el=>el===document.activeElement),true,"Photo navigation must not reset focus");
  assert.equal(await photoDialog.getByRole("status").innerText(),"2 / 2 · "+secondPhoto.title);
  await page.keyboard.press("ArrowRight");await photoDialog.getByRole("img",{name:originalPhoto.title,exact:true}).waitFor();
  await page.keyboard.press("ArrowLeft");await photoDialog.getByRole("img",{name:secondPhoto.title,exact:true}).waitFor();
  const photoControlSizes=await photoDialog.getByRole("button").evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height,shared:el.classList.contains("sf-ui-button")};}));
  assert.ok(photoControlSizes.every(el=>el.shared&&el.width>=43.5&&el.height>=43.5));
  assert.ok(await previousPhoto.evaluate(el=>el.matches(":focus-visible")&&parseFloat(getComputedStyle(el).outlineWidth)>=2));
  await photoDialog.getByRole("img").evaluate(image=>image.decode());
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.ok(await photoDialog.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}),"Preview photo dialog must fit the viewport");
  await page.screenshot({path:`test-results/operational-photo-dialog-preview-${width}.png`});
  const photoCapturePosition=await photoDialog.evaluate(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,viewport:innerHeight,scroll:scrollY,visualOffset:visualViewport?.offsetTop};});
  console.log("Photo preview capture "+width+"px: "+JSON.stringify(photoCapturePosition));
  assert.ok(photoCapturePosition.top>=0&&photoCapturePosition.bottom<=photoCapturePosition.viewport,"Preview must remain inside the viewport after screenshot");
  await activate(closePhoto);await photoDialog.waitFor({state:"detached"});
  assert.equal(await multiPhotoOpener.evaluate(el=>el===document.activeElement),true);
  await activate(multiPhotoOpener);await photoDialog.waitFor();
  await page.mouse.click(2,2);await photoDialog.waitFor({state:"detached"});
  assert.equal(await multiPhotoOpener.evaluate(el=>el===document.activeElement),true);
  // A read finishing while the modal is open must retain photo identity across reordering.
  let releasePhotoRead;mediaReadGate=new Promise(resolve=>releasePhotoRead=resolve);
  await activate(mediaRefresh);await media.getByRole("button",{name:"Atualizando galeria...",exact:true}).waitFor();
  await activate(multiPhotoOpener);await photoDialog.waitFor();
  mediaRows=[secondPhoto,missingPhoto,originalPhoto,...mediaRows.filter(row=>row.media_kind!=="photo")];
  releasePhotoRead();mediaReadGate=undefined;await mediaReady();
  await photoDialog.getByRole("status").filter({hasText:"2 / 2 · "+originalPhoto.title}).waitFor();
  await page.keyboard.press("Escape");await photoDialog.waitFor({state:"detached"});
  assert.equal(await advanced.getByRole("button",{name:"Abrir foto 3 de 3: "+originalPhoto.title,exact:true}).evaluate(el=>el===document.activeElement),true);
  mediaReadGate=new Promise(resolve=>releasePhotoRead=resolve);
  await activate(mediaRefresh);await media.getByRole("button",{name:"Atualizando galeria...",exact:true}).waitFor();
  await activate(advanced.getByRole("button",{name:"Abrir foto 3 de 3: "+originalPhoto.title,exact:true}));await photoDialog.waitFor();
  mediaRows=mediaRows.filter(row=>row.id!==originalPhoto.id);
  releasePhotoRead();mediaReadGate=undefined;await mediaReady();await photoDialog.waitFor({state:"detached"});
  assert.equal(await page.evaluate(()=>document.body.style.overflow),previousBodyOverflow,"Removing the active photo must close and unlock the viewer");
  mediaRows=[originalPhoto,missingPhoto,secondPhoto,...mediaRows.filter(row=>row.media_kind!=="photo")];
  await activate(mediaRefresh);await mediaReady();assert.equal(await photoDialog.count(),0,"A returning photo must not reopen a dismissed selection");
  // Part 39: keep embeds opt-in and preserve keyboard focus in the shared video gallery.
  const videoUiWrites={media:mediaWrites.length,publish:proPublishWrites.length,storage:storageWrites.length,deletes:privateDeletes.length};
  const videoFixtureRows=mediaRows.filter(row=>row.media_kind==="youtube").map((row,index)=>({...row,youtube_id:index===0?"dQw4w9WgXcQ":"M7lc1UVf-VE"}));
  mediaRows=[...mediaRows.filter(row=>row.media_kind!=="youtube"),...videoFixtureRows];
  await activate(mediaRefresh);await mediaReady();
  const exerciseVideoGallery=async(scope,label)=>{
   await page.emulateMedia({reducedMotion:"reduce"});
   const videoGallery=scope.locator(".premium-video-gallery");
   const videoFrame=videoGallery.locator("iframe"),closePlayer=videoGallery.getByRole("button",{name:"Fechar player",exact:true});
   const choices=videoGallery.getByRole("group",{name:"Escolha um vídeo para assistir",exact:true});
   const secondChoice=choices.getByRole("button",{name:"Assistir na página: "+videoFixtureRows[1].title,exact:true});
   const embedStart=videoEmbeds.length;
   assert.equal(await videoFrame.count(),0,"An unplayed gallery must not mount an iframe");
   const poster=videoGallery.getByRole("button",{name:/^Reproduzir na página:/});
   const firstPosterLabel=await poster.getAttribute("aria-label");
   await activate(poster);await closePlayer.waitFor();
   assert.equal(await closePlayer.evaluate(el=>el===document.activeElement),true,"Starting a video must move focus to the close control");
   assert.equal(await videoFrame.getAttribute("loading"),"eager","An explicit play action must start its mounted iframe promptly");
   const firstSource=await videoFrame.getAttribute("src");
   assert.match(firstSource,/^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}\?autoplay=1/);
   for(let i=0;i<100&&videoEmbeds.length<embedStart+1;i++)await delay(25);
   assert.equal(videoEmbeds.length,embedStart+1);
   await activate(closePlayer);await videoFrame.waitFor({state:"detached"});
   assert.equal(await videoGallery.getByRole("button",{name:firstPosterLabel,exact:true}).evaluate(el=>el===document.activeElement),true,"A removed poster opener falls back to the recreated poster");
   await secondChoice.focus();await secondChoice.press("Space");await closePlayer.waitFor();
   assert.equal(await videoFrame.getAttribute("title"),"Reproduzindo: "+videoFixtureRows[1].title);
   assert.match(await videoFrame.getAttribute("src"),/embed\/M7lc1UVf-VE\?/);
   assert.equal(await secondChoice.getAttribute("aria-pressed"),"true");
   assert.equal(await choices.locator('button[aria-pressed="true"]').count(),1);
   assert.equal(await closePlayer.evaluate(el=>el===document.activeElement),true);
   const externalVideo=videoGallery.getByRole("link",{name:"Abrir "+videoFixtureRows[1].title+" no YouTube",exact:true});
   assert.equal(await externalVideo.getAttribute("href"),"https://www.youtube.com/watch?v=M7lc1UVf-VE");
   assert.equal(await externalVideo.getAttribute("target"),"_blank");assert.match(await externalVideo.getAttribute("rel"),/noopener/);
   for(const action of [closePlayer,externalVideo]){
    const size=await action.boundingBox();assert.ok(size.width>=43.5&&size.height>=43.5);
    assert.ok((await action.getAttribute("class")).includes("sf-ui-button"));
    await action.focus();assert.ok(await action.evaluate(el=>el.matches(":focus-visible")&&parseFloat(getComputedStyle(el).outlineWidth)>=2));
   }
   for(let i=0;i<100&&videoEmbeds.length<embedStart+2;i++)await delay(25);
   assert.equal(videoEmbeds.length,embedStart+2);
   await videoGallery.scrollIntoViewIfNeeded();
   await videoGallery.screenshot({path:`test-results/operational-video-controls-${label}-${width}.png`});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Video controls overflow at "+width);
   await activate(closePlayer);await videoFrame.waitFor({state:"detached"});
   assert.equal(await secondChoice.evaluate(el=>el===document.activeElement),true,"Closing must return to the originating thumbnail");
   assert.equal(videoEmbeds.length,embedStart+2,"Closing must not start another embed");
   await page.emulateMedia({reducedMotion:"no-preference"});
  };
  await exerciseVideoGallery(advanced,"preview");
  await page.emulateMedia({reducedMotion:"reduce"});
  const previewVideos=advanced.locator(".premium-video-gallery");
  const embedBeforeRemovalPlay=videoEmbeds.length;
  await activate(previewVideos.getByRole("button",{name:"Assistir na página: "+videoFixtureRows[0].title,exact:true}));
  await previewVideos.getByRole("button",{name:"Fechar player",exact:true}).waitFor();
  for(let i=0;i<100&&videoEmbeds.length<embedBeforeRemovalPlay+1;i++)await delay(25);
  assert.equal(videoEmbeds.length,embedBeforeRemovalPlay+1);
  const embedCountBeforeRemoval=videoEmbeds.length;
  mediaReadGate=new Promise(resolve=>releasePhotoRead=resolve);
  await activate(mediaRefresh);await media.getByRole("button",{name:"Atualizando galeria...",exact:true}).waitFor();
  mediaRows=mediaRows.filter(row=>row.id!==videoFixtureRows[0].id);
  releasePhotoRead();mediaReadGate=undefined;await mediaReady();
  await previewVideos.locator("iframe").waitFor({state:"detached"});
  assert.equal(await previewVideos.getByRole("button",{name:"Reproduzir na página: "+videoFixtureRows[1].title,exact:true}).count(),1);
  assert.equal(videoEmbeds.length,embedCountBeforeRemoval,"Removing the active video must not autoplay its fallback");
  mediaRows=[...mediaRows.filter(row=>row.media_kind!=="youtube"),...videoFixtureRows];
  await activate(mediaRefresh);await mediaReady();assert.equal(await previewVideos.locator("iframe").count(),0,"A returning video must remain stopped");
  await activate(previewVideos.getByRole("button",{name:/^Reproduzir na página:/}));
  await previewVideos.getByRole("button",{name:"Fechar player",exact:true}).waitFor();
  mediaRows=mediaRows.map(row=>row.id===videoFixtureRows[0].id?{...row,youtube_id:"aqz-KE-bpKQ"}:row);
  await activate(mediaRefresh);await mediaReady();await previewVideos.locator("iframe").waitFor({state:"detached"});
  assert.equal(await previewVideos.getByRole("button",{name:/^Reproduzir na página:/}).count(),1,"A changed source must require another explicit play action");
  mediaRows=[...mediaRows.filter(row=>row.media_kind!=="youtube"),...videoFixtureRows];
  await activate(mediaRefresh);await mediaReady();assert.equal(await previewVideos.locator("iframe").count(),0);
  await page.emulateMedia({reducedMotion:"no-preference"});
  publicGalleryRows=[originalPhoto,missingPhoto,secondPhoto,...videoFixtureRows];
  const modalReadsBeforePublic={artistReads,draftReads,mediaReads,publicationReads,agendaReads,flyerReads};
  await page.goto(origin+"/cantor-teste");
  const publicPhotoOpener=page.getByRole("button",{name:"Abrir foto 1 de 3: "+originalPhoto.title,exact:true});
  await publicPhotoOpener.waitFor();await activate(publicPhotoOpener);await photoDialog.waitFor();
  assert.equal(await photoDialog.evaluate(el=>el.matches(":modal")),true);
  await page.keyboard.press("ArrowRight");await photoDialog.getByRole("img",{name:secondPhoto.title,exact:true}).waitFor();
  await page.screenshot({path:`test-results/operational-photo-dialog-public-${width}.png`});
  assert.ok(await photoDialog.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}),"Native photo dialog must fit the viewport");
  await page.keyboard.press("Escape");await photoDialog.waitFor({state:"detached"});
  assert.equal(await publicPhotoOpener.evaluate(el=>el===document.activeElement),true);
  assert.equal(await page.evaluate(()=>document.body.style.overflow),previousBodyOverflow);
  assert.deepEqual({artistReads,draftReads,mediaReads,publicationReads,agendaReads,flyerReads},modalReadsBeforePublic,"Public viewer must not request editor data");
  assert.deepEqual({artistReads,draftReads,publicationReads,agendaReads,flyerReads},photoReadsBefore);
  assert.deepEqual({media:mediaWrites.length,publish:proPublishWrites.length,storage:storageWrites.length,deletes:privateDeletes.length},photoWritesBefore);
  console.log(`PASS photo dialog ${width}px: native modal, single/multiple photos, focus loop/return, arrows/wrap, missing preview skip, backdrop/Escape/close, identity during refresh, public route and no mutations`);
  const videoPublicReads={artistReads,draftReads,mediaReads,publicationReads,agendaReads,flyerReads};
  await exerciseVideoGallery(page,"public");
  assert.deepEqual({artistReads,draftReads,mediaReads,publicationReads,agendaReads,flyerReads},videoPublicReads,"Playback controls must not query editor data");
  assert.deepEqual({media:mediaWrites.length,publish:proPublishWrites.length,storage:storageWrites.length,deletes:privateDeletes.length},videoUiWrites);
  console.log(`PASS video controls ${width}px: opt-in embeds, synthetic iframe, shared 44px actions, keyboard focus/return, thumbnail selection, reduced motion, safe external link, removed-video guard, public route and no mutations`);
  // Part 45: shared controls preserve the public booking contract and accessible mobile layout.
  const publicBooking=page.locator(".artist-booking-form");
  await publicBooking.waitFor();
  const bookingSend=publicBooking.getByRole("button",{name:"Enviar solicitação",exact:true});
  assert.equal(await bookingSend.isDisabled(),true);
  await publicBooking.getByLabel("Seu nome *",{exact:true}).fill("Contato sintético");
  await publicBooking.getByLabel("E-mail para retorno *",{exact:true}).fill("contato@example.test");
  await publicBooking.getByLabel("Cidade do evento *",{exact:true}).fill("São Paulo");
  const bookingMessage=publicBooking.getByLabel("Conte sobre o evento *",{exact:true});
  await bookingMessage.fill("Evento de teste com informações suficientes.");
  assert.match(await publicBooking.locator("#artist-booking-message-help").innerText(),/mínimo de 20/);
  await publicBooking.getByRole("checkbox").check();
  const publicBookingSizes=await publicBooking.locator(".sf-ui-input,.sf-ui-button").evaluateAll(nodes=>nodes.map(el=>({height:el.getBoundingClientRect().height,font:getComputedStyle(el).fontSize})));
  assert.ok(publicBookingSizes.every(x=>x.height>=44));
  assert.ok(publicBookingSizes.slice(0,6).every(x=>parseFloat(x.font)>=16));
  await bookingMessage.focus();assert.ok(await bookingMessage.evaluate(el=>el.matches(":focus-visible")&&parseFloat(getComputedStyle(el).outlineWidth)>=2));
  await activate(bookingSend);
  await publicBooking.getByRole("alert").filter({hasText:"Descreva o evento"}).waitFor();
  assert.equal(publicBookingWrites.length,1);
  assert.equal(await bookingMessage.inputValue(),"Evento de teste com informações suficientes.");
  assert.deepEqual(publicBookingWrites[0],{p_username:"cantor-teste",p_contact_name:"Contato sintético",p_contact_email:"contato@example.test",p_contact_phone:null,p_event_city:"São Paulo",p_event_date:null,p_message:"Evento de teste com informações suficientes.",p_consent:true,p_website:""});
  await publicBooking.screenshot({path:`test-results/operational-public-booking-shared-${width}.png`});
  assert.ok(await publicBooking.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  publicBookingResult="received";await activate(bookingSend);
  await publicBooking.getByRole("heading",{name:"Solicitação enviada!",exact:true}).waitFor();
  assert.equal(publicBookingWrites.length,2);
  await activate(publicBooking.getByRole("button",{name:"Enviar outra solicitação",exact:true}));
  assert.equal(await bookingMessage.inputValue(),"");assert.equal(await bookingSend.isDisabled(),true);
  assert.equal(await publicBooking.getByLabel("Seu nome *",{exact:true}).inputValue(),"Contato sintético");
  console.log(`PASS public booking shared UI ${width}px: native labels/validation, consent, exact payload, retained draft after rejection, confirmed result/reset, 16px fields, 44px controls and keyboard focus`);
  // Part 40: catalog presentation preserves explicit search payloads and pagination.
  catalogMode=true;await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto(origin+"/marketplace");
  const catalog=page.locator(".market-shell");
  const catalogSearch=page.getByLabel("Buscar músicos",{exact:true});
  const catalogSort=page.getByLabel("Ordenar por",{exact:true});
  const catalogFilters=page.getByRole("complementary",{name:"Filtros de músicos",exact:true});
  const filterToggle=page.getByRole("button",{name:"Filtros",exact:true});
  const catalogReady=()=>page.waitForFunction(()=>{const label=document.querySelector(".market-results-toolbar strong");return label&&!label.textContent.includes("Procurando");});
  await page.getByText("25 músico(s) encontrado(s)",{exact:true}).waitFor();await catalogReady();
  const catalogResponse=async action=>{
   const response=page.waitForResponse(r=>r.url().endsWith("/stage_marketplace_search"));
   await action();await response;await catalogReady();
  };
  const openCatalogFilters=async()=>{if(width<=840){await activate(filterToggle);await catalogFilters.waitFor();}};
  await openCatalogFilters();
  const catalogCity=page.getByLabel("Cidade ou região",{exact:true});
  if(width<=840){
   assert.equal(await filterToggle.getAttribute("aria-expanded"),"true");
   assert.equal(await catalogCity.evaluate(el=>el===document.activeElement),true);
   const beforeClose=catalogCalls.length;
   await catalogCity.fill("São Paulo");
   await activate(catalogFilters.getByRole("button",{name:"Fechar filtros",exact:true}));
   await catalogFilters.waitFor({state:"hidden"});
   assert.equal(await filterToggle.getAttribute("aria-expanded"),"false");
   assert.equal(await filterToggle.evaluate(el=>el===document.activeElement),true);
   assert.equal(catalogCalls.length,beforeClose,"Closing filters must not search");
   await openCatalogFilters();assert.equal(await catalogCity.inputValue(),"São Paulo");
  }
  await catalogSearch.fill("  Sintético  ");await catalogCity.fill("  São Paulo  ");
  await page.getByLabel("Instrumento",{exact:true}).selectOption("Cavaquinho");
  await page.getByLabel("Estilo musical",{exact:true}).selectOption("Pagode");
  await page.getByLabel("Cachê máximo divulgado (R$)",{exact:true}).fill("850,50");
  const catalogDate=page.getByLabel("Data desejada (opcional)",{exact:true});
  const validCatalogDay=await catalogDate.getAttribute("min");await catalogDate.fill(validCatalogDay);
  await catalogFilters.getByRole("checkbox",{name:"Apenas recebendo propostas",exact:true}).check();
  await catalogFilters.getByRole("checkbox",{name:"Somente meus favoritos",exact:true}).check();
  const catalogBeforeApply=catalogCalls.length;
  assert.ok(await catalogFilters.locator('input:not([type="checkbox"]),select').evaluateAll(nodes=>nodes.every(el=>el.classList.contains("sf-ui-input")&&getComputedStyle(el).fontSize==="16px")));
  assert.ok(await catalogFilters.locator(".market-check").evaluateAll(nodes=>nodes.every(el=>el.getBoundingClientRect().height>=44)));
  const catalogControlSizes=await catalogFilters.getByRole("button").evaluateAll(nodes=>nodes.filter(el=>el.getClientRects().length).map(el=>{const r=el.getBoundingClientRect();return {shared:el.classList.contains("sf-ui-button"),w:r.width,h:r.height};}));
  assert.ok(catalogControlSizes.every(el=>el.shared&&el.w>=43.5&&el.h>=43.5));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Open marketplace filters overflow at "+width);
  await catalogFilters.screenshot({path:`test-results/operational-marketplace-filter-controls-${width}.png`});
  assert.equal(catalogCalls.length,catalogBeforeApply,"Editing controls must not search until submitted");
  await catalogResponse(()=>activate(catalogFilters.getByRole("button",{name:"Aplicar filtros",exact:true})));
  assert.deepEqual(catalogCalls.at(-1),{p_query:"Sintético",p_city:"São Paulo",p_instrument:"Cavaquinho",p_genre:"Pagode",p_max_fee:850.5,p_date:validCatalogDay,p_only_available:true,p_only_favorites:true,p_sort:"recent",p_limit:12,p_offset:0});
  if(width<=840){assert.equal(await filterToggle.evaluate(el=>el===document.activeElement),true);assert.equal(await filterToggle.getAttribute("aria-expanded"),"false");}
  const catalogPagination=page.getByRole("navigation",{name:"Páginas do marketplace",exact:true});
  assert.equal(await catalogPagination.getByRole("button",{name:"Anterior",exact:true}).isDisabled(),true);
  await catalogResponse(()=>activate(catalogPagination.getByRole("button",{name:"Próxima",exact:true})));
  await catalogPagination.getByText("Página 2 de 3",{exact:true}).waitFor();assert.equal(catalogCalls.at(-1).p_offset,12);
  await catalogResponse(()=>catalogSort.selectOption("name"));
  await catalogPagination.getByText("Página 1 de 3",{exact:true}).waitFor();assert.equal(catalogCalls.at(-1).p_offset,0);assert.equal(catalogCalls.at(-1).p_sort,"name");
  await openCatalogFilters();await page.getByLabel("Cachê máximo divulgado (R$)",{exact:true}).fill("-1");
  const catalogBeforeInvalid=catalogCalls.length;
  await activate(catalogFilters.getByRole("button",{name:"Aplicar filtros",exact:true}));
  await catalog.getByRole("alert").filter({hasText:"Informe um cachê máximo válido."}).waitFor();assert.equal(catalogCalls.length,catalogBeforeInvalid);
  await openCatalogFilters();await page.getByLabel("Cachê máximo divulgado (R$)",{exact:true}).fill("850,50");
  catalogSearchMode="failed";await catalogResponse(()=>activate(catalogFilters.getByRole("button",{name:"Aplicar filtros",exact:true})));
  await catalog.getByRole("alert").filter({hasText:"O catálogo ainda está sendo habilitado."}).waitFor();
  assert.equal(await catalogSearch.inputValue(),"  Sintético  ");
  catalogSearchMode="ok";await catalogResponse(()=>catalogSearch.press("Enter"));
  assert.equal(await catalog.getByRole("alert").count(),0);
  catalogSearchMode="empty";await catalogResponse(()=>catalogSearch.press("Enter"));
  await page.getByRole("heading",{name:"Nenhum músico encontrado",exact:true}).waitFor();
  catalogSearchMode="ok";await catalogResponse(()=>activate(page.getByRole("button",{name:"Ver todos os músicos",exact:true})));
  assert.deepEqual(catalogCalls.at(-1),{p_query:"",p_city:"",p_instrument:"",p_genre:"",p_max_fee:null,p_date:null,p_only_available:false,p_only_favorites:false,p_sort:"recent",p_limit:12,p_offset:0});
  await openCatalogFilters();await catalogCity.fill("Santos");await catalogResponse(()=>activate(catalogFilters.getByRole("button",{name:"Limpar filtros",exact:true})));
  assert.equal(await catalogSearch.inputValue(),"");assert.equal(catalogCalls.at(-1).p_city,"");
  await catalogSearch.focus();assert.ok(await catalogSearch.evaluate(el=>el.matches(":focus-visible")&&parseFloat(getComputedStyle(el).outlineWidth)>=2));
  assert.equal(await catalogSearch.evaluate(el=>getComputedStyle(el).fontSize),"16px");
  assert.ok((await catalogSort.getAttribute("class")).includes("sf-ui-input"));
  const catalogSearchButton=page.getByRole("button",{name:"Pesquisar músicos",exact:true});
  const catalogSearchSize=await catalogSearchButton.boundingBox();assert.ok(catalogSearchSize.width>=44&&catalogSearchSize.height>=44);
  assert.notEqual(await catalogSearchButton.evaluate(el=>getComputedStyle(el).fontSize),"0px","Search text remains visible on mobile");
  assert.equal(catalogFeaturedReads,1,"Search/filter/sort/page must not reload global highlights");
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Marketplace search/ordering overflows at "+width);
  await page.locator(".market-results-toolbar").screenshot({path:`test-results/operational-marketplace-sort-controls-${width}.png`});
  assert.equal(proPublishWrites.length,6);assert.equal(privateDeletes.length,1);
  console.log(`PASS marketplace controls ${width}px: shared fields/actions, labeled visible search/sort, 44px targets, mobile focus/retained drafts, explicit filter payload, pagination/reset, invalid fee guard, retry and empty recovery`);
  // Part 41: failure is distinct from empty, and each read has its own explicit retry.
  const searchResults=page.getByRole("region",{name:"Resultados do Marketplace",exact:true});
  const retryCatalog=searchResults.getByRole("button",{name:"Tentar novamente a busca",exact:true});
  const retryHighlights=page.getByRole("button",{name:"Tentar novamente os destaques",exact:true});
  catalogSearchMode="transport";await catalogResponse(()=>activate(catalogPagination.getByRole("button",{name:"Próxima",exact:true})));
  await searchResults.getByRole("alert").filter({hasText:"Não foi possível consultar os músicos."}).waitFor();
  assert.equal(await searchResults.getByRole("heading",{name:"Nenhum músico encontrado",exact:true}).count(),0,"A failed search is not an empty result");
  assert.equal(await page.getByText("Busca não concluída",{exact:true}).count(),1);
  assert.doesNotMatch(await catalog.innerText(),/private_backend_detail|PGRST202|migration|Supabase|\.sql/);
  const failedSearchPayload={...catalogCalls.at(-1)},highlightsBeforeRetry=catalogFeaturedReads;
  assert.equal(failedSearchPayload.p_offset,12,"The recovery fixture fails on the second page");
  await catalogSearch.fill("Texto ainda não aplicado");
  let releaseCatalogRead;catalogSearchGate=new Promise(resolve=>releaseCatalogRead=resolve);catalogSearchMode="ok";
  const pendingRetryResponse=page.waitForResponse(r=>r.url().endsWith("/stage_marketplace_search"));
  const retryCount=catalogCalls.length;await activate(retryCatalog);
  await searchResults.getByRole("status").filter({hasText:"Buscando talentos..."}).waitFor();
  for(let i=0;i<100&&catalogCalls.length===retryCount;i++)await delay(25);
  assert.equal(await retryCatalog.count(),0,"Pending reads must not expose a repeat retry control");
  assert.equal(catalogCalls.length,retryCount+1);
  releaseCatalogRead();catalogSearchGate=undefined;await pendingRetryResponse;await catalogReady();
  await page.getByText("25 músico(s) encontrado(s)",{exact:true}).waitFor();
  assert.deepEqual(catalogCalls.at(-1),failedSearchPayload,"Retry must use the last applied query, not unsubmitted edits");
  assert.equal(await catalogSearch.inputValue(),"Texto ainda não aplicado");
  assert.equal(catalogFeaturedReads,highlightsBeforeRetry);
  await page.waitForFunction(()=>document.activeElement===document.querySelector(".market-results-toolbar [tabindex]"));
  assert.equal(await page.locator(".market-results-toolbar [tabindex]").evaluate(el=>el===document.activeElement),true);
  for(const mode of ["missing","malformed","invalid_total"]){
   catalogSearchMode=mode;await catalogResponse(()=>catalogSearch.press("Enter"));
   await retryCatalog.waitFor();assert.equal(await searchResults.getByRole("heading",{name:"Nenhum músico encontrado",exact:true}).count(),0);
   catalogSearchMode="ok";await catalogResponse(()=>activate(retryCatalog));
   await page.getByText("25 músico(s) encontrado(s)",{exact:true}).waitFor();
  }
  catalogSearchMode="transport";catalogFeaturedMode="transport";await page.reload();
  await retryCatalog.waitFor();await retryHighlights.waitFor();
  assert.doesNotMatch(await page.locator(".market-shell").innerText(),/private_backend_detail|PGRST202|migration|Supabase|\.sql/);
  const featuredBeforeIndependent=catalogFeaturedReads;catalogSearchMode="ok";
  await catalogResponse(()=>activate(retryCatalog));await page.getByText("25 músico(s) encontrado(s)",{exact:true}).waitFor();
  assert.equal(catalogFeaturedReads,featuredBeforeIndependent,"Search retry must not reload highlights");assert.equal(await retryHighlights.count(),1);
  const searchesBeforeHighlights=catalogCalls.length;
  let releaseHighlights;catalogFeaturedGate=new Promise(resolve=>releaseHighlights=resolve);catalogFeaturedMode="populated";
  const pendingHighlightsResponse=page.waitForResponse(r=>r.url().endsWith("/stage_marketplace_featured"));
  await activate(retryHighlights);await page.getByRole("status").filter({hasText:"Carregando músicos em destaque..."}).waitFor();
  assert.equal(await retryHighlights.count(),0);assert.equal(catalogCalls.length,searchesBeforeHighlights);
  releaseHighlights();catalogFeaturedGate=undefined;await pendingHighlightsResponse;
  await page.getByRole("region",{name:"Carrossel dos músicos mais avaliados",exact:true}).waitFor();
  await page.waitForFunction(()=>document.activeElement?.id==="market-featured-title");
  assert.equal(await page.locator("#market-featured-title").evaluate(el=>el===document.activeElement),true);
  assert.equal(catalogCalls.length,searchesBeforeHighlights);assert.equal(catalogFeaturedReads,featuredBeforeIndependent+1);
  const highlightsBeforeStale=catalogFeaturedReads;
  catalogSearchMode="ok";catalogSearchGate=new Promise(resolve=>releaseCatalogRead=resolve);
  const oldCatalogRequest=page.waitForRequest(r=>r.url().endsWith("/stage_marketplace_search"));
  await catalogSearch.fill("Busca antiga");await catalogSearch.press("Enter");const heldCatalogRequest=await oldCatalogRequest;
  const oldCatalogResponse=page.waitForResponse(r=>r.request()===heldCatalogRequest);
  catalogSearchGate=undefined;catalogSearchMode="empty";await catalogSearch.fill("Busca nova");await catalogResponse(()=>catalogSearch.press("Enter"));
  await searchResults.getByRole("heading",{name:"Nenhum músico encontrado",exact:true}).waitFor();
  releaseCatalogRead();await oldCatalogResponse;await delay(50);
  assert.equal(await searchResults.getByRole("heading",{name:"Nenhum músico encontrado",exact:true}).count(),1,"A late old response must not restore stale cards");
  assert.equal(await searchResults.locator(".market-artist-card").count(),0);assert.equal(await catalogSearch.inputValue(),"Busca nova");
  assert.equal(catalogFeaturedReads,highlightsBeforeStale);
  catalogSearchMode="transport";await catalogResponse(()=>catalogSearch.press("Enter"));await retryCatalog.waitFor();
  await retryCatalog.focus();
  assert.ok(await retryCatalog.evaluate(el=>el.matches(":focus-visible")&&parseFloat(getComputedStyle(el).outlineWidth)>=2));
  const retrySize=await retryCatalog.boundingBox();assert.ok(retrySize.width>=44&&retrySize.height>=44);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  await searchResults.screenshot({path:`test-results/operational-marketplace-search-recovery-${width}.png`});
  await page.locator(".market-featured").screenshot({path:`test-results/operational-marketplace-featured-recovered-${width}.png`});
  console.log(`PASS marketplace recovery ${width}px: sanitized transport/malformed failures, no false empty state, independent serialized retries, retained applied filters/draft, focus recovery, stale-response isolation and valid empty results`);
  // Part 42: native invitation dialog and serialized, explicitly confirmed sends.
  invitationFixture=true;catalogSearchMode="ok";catalogFeaturedMode="ok";await page.reload();
  await page.getByText("25 músico(s) encontrado(s)",{exact:true}).waitFor();
  const inviteOrigin=page.locator(".market-card-grid .market-artist-card").first().getByRole("button",{name:"Convidar",exact:true});
  const invitePanel=page.getByRole("dialog",{name:"Convidar e avaliar Músico sintético 1",exact:true});
  const closeInvite=invitePanel.getByRole("button",{name:"Fechar painel",exact:true});
  const invitationOverflow=await page.evaluate(()=>document.body.style.overflow);
  await activate(inviteOrigin);await invitePanel.waitFor();
  assert.equal(await invitePanel.evaluate(el=>el.matches(":modal")),true);
  assert.equal(await closeInvite.evaluate(el=>el===document.activeElement),true);
  assert.equal(await page.evaluate(()=>document.body.style.overflow),"hidden");
  await invitePanel.getByRole("alert").filter({hasText:"Não foi possível carregar seus shows."}).waitFor();
  assert.equal(await invitePanel.getByText("Você precisa ter um show futuro cadastrado na agenda.",{exact:true}).count(),0);
  const retryInviteEvents=invitePanel.getByRole("button",{name:"Tentar novamente os shows",exact:true});
  const lastInviteTabControl=invitePanel.getByRole("button",{name:"Atualizar apresentações",exact:true});await lastInviteTabControl.waitFor();
  await closeInvite.press("Shift+Tab");assert.equal(await lastInviteTabControl.evaluate(el=>el===document.activeElement),true);
  await lastInviteTabControl.press("Tab");assert.equal(await closeInvite.evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press("Escape");await invitePanel.waitFor({state:"detached"});
  assert.equal(await inviteOrigin.evaluate(el=>el===document.activeElement),true);
  assert.equal(await page.evaluate(()=>document.body.style.overflow),invitationOverflow);
  await activate(inviteOrigin);await invitePanel.waitFor();await page.mouse.click(2,2);await invitePanel.waitFor({state:"detached"});
  assert.equal(await inviteOrigin.evaluate(el=>el===document.activeElement),true);
  await activate(inviteOrigin);await invitePanel.waitFor();
  for(const mode of ["missing","malformed"]){
   invitationEventsMode=mode;const response=page.waitForResponse(r=>r.url().endsWith("/stage_marketplace_my_events"));
   await activate(retryInviteEvents);await response;await retryInviteEvents.waitFor();
   assert.equal(await invitePanel.getByText("Você precisa ter um show futuro cadastrado na agenda.",{exact:true}).count(),0);
  }
  const inviteSearchesBefore=catalogCalls.length,inviteFeaturedBefore=catalogFeaturedReads;
  invitationEventsMode="ok";let releaseInviteEvents;invitationEventsGate=new Promise(resolve=>releaseInviteEvents=resolve);
  const pendingInviteEvents=page.waitForResponse(r=>r.url().endsWith("/stage_marketplace_my_events"));
  await activate(retryInviteEvents);await invitePanel.getByRole("status").filter({hasText:"Carregando seus shows..."}).waitFor();
  assert.equal(await invitePanel.locator(".market-invite-form").count(),0);
  releaseInviteEvents();invitationEventsGate=undefined;await pendingInviteEvents;
  const inviteEvent=invitePanel.getByLabel("Escolha o show *",{exact:true});
  const inviteText=invitePanel.getByLabel("Mensagem ao músico (opcional)",{exact:true});
  const sendMarketplaceInvite=invitePanel.getByRole("button",{name:"Confirmar convite individual",exact:true});
  await inviteEvent.waitFor();assert.equal(await sendMarketplaceInvite.isDisabled(),true);
  await inviteEvent.selectOption(eventId);await inviteText.fill("Mensagem preservada após falha");
  const confirmMarketplaceInvite=async(button,accept)=>{
   const dialogPromise=page.waitForEvent("dialog"),action=activate(button);const confirmation=await dialogPromise;
   assert.equal(confirmation.type(),"confirm");assert.match(confirmation.message(),/Registrar convite individual para Músico sintético 1/);
   if(accept)await confirmation.accept();else await confirmation.dismiss();await action;
  };
  await confirmMarketplaceInvite(sendMarketplaceInvite,false);assert.equal(invitationWrites.length,0);
  assert.equal(await inviteText.inputValue(),"Mensagem preservada após falha");
  invitationResult="date_unavailable";let releaseInvitation;invitationGate=new Promise(resolve=>releaseInvitation=resolve);
  await confirmMarketplaceInvite(sendMarketplaceInvite,true);
  await invitePanel.getByRole("button",{name:"Registrando convite...",exact:true}).waitFor();
  const unexpectedInviteDialogs=[];const rejectUnexpectedInvite=dialog=>{unexpectedInviteDialogs.push(dialog.message());void dialog.dismiss();};
  page.on("dialog",rejectUnexpectedInvite);
  await invitePanel.locator(".market-invite-form").evaluate(form=>{form.requestSubmit();form.requestSubmit();});
  assert.equal(invitationWrites.length,1);assert.equal(await inviteEvent.isDisabled(),true);assert.equal(await inviteText.isDisabled(),true);assert.equal(await closeInvite.isDisabled(),true);
  await page.keyboard.press("Escape");assert.equal(await invitePanel.count(),1);await page.mouse.click(2,2);assert.equal(await invitePanel.count(),1);
  assert.equal(await invitePanel.getByRole("link",{name:/Iniciar chat privado/}).getAttribute("aria-disabled"),"true");
  releaseInvitation();invitationGate=undefined;
  await invitePanel.getByRole("alert").filter({hasText:"O músico marcou a data do show como indisponível"}).waitFor();
  page.off("dialog",rejectUnexpectedInvite);assert.deepEqual(unexpectedInviteDialogs,[]);
  assert.equal(await inviteEvent.inputValue(),eventId);assert.equal(await inviteText.inputValue(),"Mensagem preservada após falha");assert.equal(await inviteEvent.isEnabled(),true);
  invitationResult="sent";await confirmMarketplaceInvite(sendMarketplaceInvite,true);
  await invitePanel.getByRole("status").filter({hasText:"Convite registrado!"}).waitFor();
  assert.equal(invitationWrites.length,2);assert.equal(createdMarketplaceInvitations.size,1);assert.equal(await inviteText.inputValue(),"");assert.equal(await sendMarketplaceInvite.isDisabled(),true);
  await inviteEvent.selectOption(secondShowId);await inviteText.fill("Resposta incerta preservada");
  invitationResult="commit_then_fail";await confirmMarketplaceInvite(sendMarketplaceInvite,true);
  await invitePanel.getByRole("alert").filter({hasText:"Ele pode ter sido registrado."}).waitFor();
  const retrySameInvite=invitePanel.getByRole("button",{name:"Confirmar novamente o mesmo convite",exact:true});
  await page.waitForFunction(()=>document.activeElement?.classList.contains("market-invite-feedback"));
  assert.equal(await invitePanel.locator(".market-invite-feedback").evaluate(el=>{const r=el.getBoundingClientRect(),d=el.closest("dialog").getBoundingClientRect();return r.top>=d.top&&r.bottom<=d.bottom;}),true,"Invitation outcome must be visible before retrying");
  assert.equal(invitationWrites.length,3);assert.equal(createdMarketplaceInvitations.size,2);
  assert.equal(await inviteEvent.isDisabled(),true);assert.equal(await inviteText.isDisabled(),true);assert.equal(await inviteText.inputValue(),"Resposta incerta preservada");
  assert.equal(await invitePanel.getByRole("status").filter({hasText:"Convite registrado!"}).count(),0);
  invitationResult="sent";await confirmMarketplaceInvite(retrySameInvite,false);assert.equal(invitationWrites.length,3);
  await retrySameInvite.focus();assert.ok(await retrySameInvite.evaluate(el=>el.matches(":focus-visible")&&parseFloat(getComputedStyle(el).outlineWidth)>=2));
  await invitePanel.screenshot({path:`test-results/operational-marketplace-invite-uncertain-${width}.png`});
  await confirmMarketplaceInvite(retrySameInvite,true);
  await invitePanel.getByRole("status").filter({hasText:"Esse convite já existe."}).waitFor();
  assert.equal(invitationWrites.length,4);assert.deepEqual(invitationWrites[2],invitationWrites[3]);assert.equal(createdMarketplaceInvitations.size,2);
  assert.equal(await inviteText.inputValue(),"Resposta incerta preservada","Already-existing invitations must not silently discard unsent text");
  assert.equal(await sendMarketplaceInvite.isDisabled(),true);
  await invitePanel.locator(".market-invite-form").evaluate(form=>form.requestSubmit());assert.equal(invitationWrites.length,4);
  assert.doesNotMatch(await invitePanel.innerText(),/private_backend_detail|Supabase|\.sql/);
  const inviteControlSizes=await invitePanel.locator(".market-invite-form .sf-ui-button").evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {w:r.width,h:r.height};}));assert.ok(inviteControlSizes.every(size=>size.w>=44&&size.h>=44));
  assert.equal(await inviteText.evaluate(el=>getComputedStyle(el).fontSize),"16px");
  assert.ok(await invitePanel.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}));
  await invitePanel.screenshot({path:`test-results/operational-marketplace-invite-confirmed-${width}.png`});
  await invitePanel.evaluate(el=>el.scrollTop=el.scrollHeight);
  assert.ok(await closeInvite.evaluate(el=>{const r=el.getBoundingClientRect(),d=el.closest("dialog").getBoundingClientRect();return r.top>=d.top&&r.bottom<=d.bottom;}),"Close control must stay visible while scrolling the panel");
  await inviteEvent.selectOption(eventId);assert.equal(await sendMarketplaceInvite.isDisabled(),true,"Earlier confirmed pairs stay blocked in the same panel");
  invitationEventsMode="empty";await activate(invitePanel.getByRole("button",{name:"Atualizar meus shows",exact:true}));
  await invitePanel.getByText("Você precisa ter um show futuro cadastrado na agenda.",{exact:true}).waitFor();
  assert.equal(await invitePanel.getByRole("link",{name:"Criar show",exact:true}).getAttribute("href"),"/eventos");
  assert.equal(catalogCalls.length,inviteSearchesBefore);assert.equal(catalogFeaturedReads,inviteFeaturedBefore);
  await activate(closeInvite);await invitePanel.waitFor({state:"detached"});assert.equal(await inviteOrigin.evaluate(el=>el===document.activeElement),true);
  await activate(inviteOrigin);await invitePanel.waitFor();await activate(invitePanel.getByRole("button",{name:"Denunciar este perfil",exact:true}));
  await page.locator(".market-report-dialog").waitFor();assert.equal(await invitePanel.count(),0,"Reporting must not open an inert dialog behind a native modal");
  const reportDialog=page.locator(".market-report-dialog");
  const reportReason=reportDialog.getByLabel("Qual é o problema?",{exact:true});
  const reportDetails=reportDialog.getByLabel("Descreva o ocorrido (opcional)",{exact:true});
  await reportReason.selectOption("spam");await reportDetails.fill("Relato sintético para verificar o formulário.");
  const reportSizes=await reportDialog.locator(".sf-ui-input,.sf-ui-button").evaluateAll(nodes=>nodes.map(el=>({h:el.getBoundingClientRect().height,w:el.getBoundingClientRect().width})));
  assert.ok(reportSizes.every(x=>x.h>=44&&x.w>=44));
  assert.equal(await reportDetails.evaluate(el=>getComputedStyle(el).fontSize),"16px");
  await reportDetails.focus();assert.ok(await reportDetails.evaluate(el=>el.matches(":focus-visible")&&parseFloat(getComputedStyle(el).outlineWidth)>=2));
  assert.equal(await reportDetails.getAttribute("aria-describedby"),"market-report-details-help");
  await activate(reportDialog.getByRole("button",{name:"Enviar denúncia",exact:true}));
  await reportDialog.getByRole("alert").filter({hasText:"Confira o motivo"}).waitFor();
  assert.equal(await reportDetails.inputValue(),"Relato sintético para verificar o formulário.");
  assert.equal(reportWrites.length,1);assert.equal(reportWrites[0].p_reason,"spam");
  assert.equal(reportWrites[0].p_type,"musician");assert.equal(reportWrites[0].p_target_id,catalogRows[0].musician_id);
  assert.equal(reportWrites[0].p_details,"Relato sintético para verificar o formulário.");
  await reportDialog.screenshot({path:`test-results/operational-marketplace-report-shared-${width}.png`});
  assert.ok(await reportDialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  reportResult="submitted";await activate(reportDialog.getByRole("button",{name:"Enviar denúncia",exact:true}));
  await reportDialog.getByRole("status").filter({hasText:"Denúncia registrada para revisão humana"}).waitFor();
  assert.equal(reportWrites.length,2);assert.deepEqual(reportWrites[0],reportWrites[1]);
  console.log(`PASS marketplace report shared UI ${width}px: labeled shared fields, count hint, exact synthetic payload, retained rejected draft, confirmed notice, 16px fields and 44px actions`);
  await activate(page.getByRole("button",{name:"Fechar denúncia",exact:true}));
  assert.equal(await page.evaluate(()=>document.body.style.overflow),invitationOverflow);
  console.log(`PASS marketplace invitation ${width}px: native modal/focus loop/return, events read recovery, explicit/cancelled confirmation, pending close and duplicate guard, retained fields, uncertain same-payload reconciliation, existing invite guard and report handoff`);
  // Part 43: independently verified review reads and explicitly protected publication.
  reviewFixture=true;invitationEventsMode="ok";
  await activate(inviteOrigin);await invitePanel.waitFor();
  const reviewSection=invitePanel.getByRole("region",{name:"Avaliações verificadas",exact:true});
  const retryPublicReviews=reviewSection.getByRole("button",{name:"Tentar novamente as avaliações",exact:true});
  const retryEligibility=reviewSection.getByRole("button",{name:"Tentar novamente as apresentações",exact:true});
  await retryPublicReviews.waitFor();await retryEligibility.waitFor();
  assert.equal(await reviewSection.getByText("Este profissional ainda não possui avaliações de shows concluídos.",{exact:true}).count(),0);
  assert.equal(await reviewSection.getByText("Nenhuma apresentação disponível para uma nova avaliação.",{exact:true}).count(),0);
  assert.doesNotMatch(await reviewSection.innerText(),/private_review_detail|Supabase|\.sql/);
  await reviewSection.screenshot({path:`test-results/operational-marketplace-reviews-read-failure-${width}.png`});
  const awaitReviewRpc=async(rpc,action)=>{const response=page.waitForResponse(r=>r.url().endsWith("/"+rpc));await action();await response;};
  for(const mode of ["missing","malformed"]){
   publicReviewsMode=mode;await awaitReviewRpc("stage_marketplace_reviews_for_musician",()=>activate(retryPublicReviews));await retryPublicReviews.waitFor();
   eligibilityMode=mode;await awaitReviewRpc("stage_marketplace_my_reviewable",()=>activate(retryEligibility));await retryEligibility.waitFor();
  }
  const publicBeforeEligibility=publicReviewReads.length;eligibilityMode="ok";
  await awaitReviewRpc("stage_marketplace_my_reviewable",()=>activate(retryEligibility));
  const marketReviewEvent=reviewSection.getByLabel("Apresentação concluída",{exact:true});
  const marketReviewRating=reviewSection.getByLabel("Nota",{exact:true});
  const marketReviewComment=reviewSection.getByLabel("Comentário (opcional)",{exact:true});
  const publishReview=reviewSection.getByRole("button",{name:"Publicar avaliação verificada",exact:true});
  await marketReviewEvent.waitFor();assert.equal(publicReviewReads.length,publicBeforeEligibility);
  assert.equal(await publishReview.isDisabled(),true);
  await marketReviewEvent.selectOption(completedReviewIds[0]);await marketReviewRating.selectOption("4");await marketReviewComment.fill("Comentário preservado após falha");
  const eligibilityBeforePublic=eligibilityReads.length;publicReviewsMode="ok";
  let releasePublicReviews;publicReviewsGate=new Promise(resolve=>releasePublicReviews=resolve);
  const pendingPublicReviews=page.waitForResponse(r=>r.url().endsWith("/stage_marketplace_reviews_for_musician"));
  await activate(retryPublicReviews);await reviewSection.getByRole("status").filter({hasText:"Carregando avaliações..."}).waitFor();
  assert.equal(await retryPublicReviews.count(),0);assert.equal(eligibilityReads.length,eligibilityBeforePublic);
  releasePublicReviews();publicReviewsGate=undefined;await pendingPublicReviews;
  await reviewSection.getByText("Este profissional ainda não possui avaliações de shows concluídos.",{exact:true}).waitFor();
  assert.equal(await marketReviewRating.inputValue(),"4");assert.equal(await marketReviewComment.inputValue(),"Comentário preservado após falha");
  assert.equal(marketplaceReviewWrites.length,0);
  reviewResult="not_eligible";let releaseReview;reviewGate=new Promise(resolve=>releaseReview=resolve);
  await activate(publishReview);await reviewSection.getByRole("button",{name:"Salvando...",exact:true}).waitFor();
  await reviewSection.locator("form").evaluate(form=>{form.requestSubmit();form.requestSubmit();});
  assert.equal(marketplaceReviewWrites.length,1);assert.equal(await marketReviewEvent.isDisabled(),true);assert.equal(await marketReviewComment.isDisabled(),true);assert.equal(await closeInvite.isDisabled(),true);
  await page.keyboard.press("Escape");assert.equal(await invitePanel.count(),1);
  releaseReview();reviewGate=undefined;
  await reviewSection.getByRole("alert").filter({hasText:"Não foi possível registrar a avaliação."}).waitFor();
  assert.equal(await marketReviewComment.inputValue(),"Comentário preservado após falha");assert.equal(await marketReviewRating.inputValue(),"4");
  reviewResult="commit_then_fail";await activate(publishReview);
  await reviewSection.getByRole("alert").filter({hasText:"Ela pode ter sido registrada."}).waitFor();
  const verifyMarketReview=reviewSection.getByRole("button",{name:"Verificar avaliação",exact:true});
  assert.equal(marketplaceReviewWrites.length,2);assert.equal(await marketReviewComment.isDisabled(),true);assert.equal(await publishReview.isDisabled(),true);
  assert.equal(await reviewSection.getByRole("status").filter({hasText:"Avaliação registrada com base"}).count(),0);
  assert.deepEqual(marketplaceReviewWrites[0],marketplaceReviewWrites[1]);
  eligibilityMode="transport";await awaitReviewRpc("stage_marketplace_my_reviewable",()=>activate(verifyMarketReview));
  await reviewSection.getByRole("alert").filter({hasText:"Não foi possível confirmar a situação"}).waitFor();
  assert.equal(marketplaceReviewWrites.length,2);
  eligibilityMode="ok";await awaitReviewRpc("stage_marketplace_my_reviewable",()=>activate(verifyMarketReview));
  await reviewSection.getByRole("status").filter({hasText:"Já existe uma avaliação para esta apresentação."}).waitFor();
  await marketReviewComment.waitFor();assert.equal(await marketReviewComment.inputValue(),"Comentário preservado após falha");assert.equal(await marketReviewRating.inputValue(),"4");
  await reviewSection.locator(".market-review-list").getByText("Comentário preservado após falha",{exact:true}).waitFor();
  assert.equal(marketplaceReviewWrites.length,2,"Reconciliation must only read");assert.equal(await publishReview.isDisabled(),true);
  await reviewSection.locator("form").evaluate(form=>form.requestSubmit());assert.equal(marketplaceReviewWrites.length,2);
  await marketReviewEvent.selectOption(completedReviewIds[1]);await marketReviewRating.selectOption("5");await marketReviewComment.fill("Comentário confirmado");
  publicReviewsMode="transport";eligibilityMode="transport";reviewResult="saved";await activate(publishReview);
  await reviewSection.getByRole("status").filter({hasText:"Avaliação registrada com base no trabalho concluído."}).waitFor();
  await retryPublicReviews.waitFor();await retryEligibility.waitFor();assert.equal(marketplaceReviewWrites.length,3);
  assert.equal(await reviewSection.getByText("Este profissional ainda não possui avaliações de shows concluídos.",{exact:true}).count(),0);
  publicReviewsMode="ok";eligibilityMode="ok";
  await awaitReviewRpc("stage_marketplace_reviews_for_musician",()=>activate(retryPublicReviews));
  await awaitReviewRpc("stage_marketplace_my_reviewable",()=>activate(retryEligibility));await marketReviewComment.waitFor();
  assert.equal(await marketReviewComment.inputValue(),"");assert.equal(await publishReview.isDisabled(),true);assert.equal(marketplaceReviewWrites.length,3);
  await marketReviewEvent.selectOption(completedReviewIds[2]);await marketReviewRating.selectOption("3");await marketReviewComment.fill("Texto preservado de avaliação existente");
  reviewResult="already_reviewed";await activate(publishReview);
  await reviewSection.getByRole("status").filter({hasText:"Já existe uma avaliação para esta apresentação."}).waitFor();
  await marketReviewComment.waitFor();assert.equal(await marketReviewComment.inputValue(),"Texto preservado de avaliação existente");assert.equal(await publishReview.isDisabled(),true);assert.equal(marketplaceReviewWrites.length,4);
  await marketReviewEvent.selectOption(completedReviewIds[3]);await marketReviewRating.selectOption("2");await marketReviewComment.fill("Texto ainda não confirmado");
  reviewResult="transport";await activate(publishReview);
  await reviewSection.getByRole("alert").filter({hasText:"Ela pode ter sido registrada."}).waitFor();
  await page.waitForFunction(()=>document.activeElement?.classList.contains("market-review-feedback"));
  await invitePanel.screenshot({path:`test-results/operational-marketplace-review-uncertain-${width}.png`});
  await awaitReviewRpc("stage_marketplace_my_reviewable",()=>activate(verifyMarketReview));
  await reviewSection.getByRole("status").filter({hasText:"A apresentação continua disponível para avaliação."}).waitFor();
  assert.equal(marketplaceReviewWrites.length,5,"Verification must not publish an unconfirmed review");
  assert.equal(await marketReviewComment.inputValue(),"Texto ainda não confirmado");assert.equal(await marketReviewRating.inputValue(),"2");assert.equal(await publishReview.isEnabled(),true);
  reviewResult="saved";await activate(publishReview);
  await reviewSection.getByRole("status").filter({hasText:"Avaliação registrada com base no trabalho concluído."}).waitFor();
  await marketReviewComment.waitFor();assert.equal(await marketReviewComment.inputValue(),"");assert.equal(marketplaceReviewWrites.length,6);
  assert.ok(await reviewSection.locator(".market-review-form .sf-ui-input").evaluateAll(nodes=>nodes.every(el=>getComputedStyle(el).fontSize==="16px")));
  const reviewButtonSize=await publishReview.boundingBox();assert.ok(reviewButtonSize.width>=44&&reviewButtonSize.height>=44);
  assert.ok(await invitePanel.evaluate(el=>el.scrollWidth<=el.clientWidth+2),"Review form overflows the dialog");
  await page.waitForFunction(()=>document.activeElement?.classList.contains("market-review-feedback"));
  await invitePanel.screenshot({path:`test-results/operational-marketplace-review-confirmed-${width}.png`});
  // A result for a closed musician must never populate the next musician's dialog.
  publicReviewsGate=new Promise(resolve=>releasePublicReviews=resolve);
  const heldReviewRequestPromise=page.waitForRequest(r=>r.url().endsWith("/stage_marketplace_reviews_for_musician"));
  await activate(reviewSection.getByRole("button",{name:"Atualizar avaliações",exact:true}));const heldReviewRequest=await heldReviewRequestPromise;
  const oldReviewResponse=page.waitForResponse(r=>r.request()===heldReviewRequest);
  await activate(closeInvite);await invitePanel.waitFor({state:"detached"});publicReviewsGate=undefined;
  const secondInviteOrigin=page.locator(".market-card-grid .market-artist-card").nth(1).getByRole("button",{name:"Convidar",exact:true});
  await activate(secondInviteOrigin);const otherReviewPanel=page.getByRole("dialog",{name:"Convidar e avaliar Músico sintético 2",exact:true});await otherReviewPanel.waitFor();
  const otherReviews=otherReviewPanel.getByRole("region",{name:"Avaliações verificadas",exact:true});
  await otherReviews.getByText("Este profissional ainda não possui avaliações de shows concluídos.",{exact:true}).waitFor();
  releasePublicReviews();await oldReviewResponse;await delay(50);
  assert.equal(await otherReviews.locator(".market-review-list article").count(),0);
  assert.equal(await otherReviews.getByText("Nenhuma apresentação disponível para uma nova avaliação.",{exact:true}).count(),1);
  assert.equal(await otherReviews.locator("form").count(),0);
  await activate(otherReviewPanel.getByRole("button",{name:"Fechar painel",exact:true}));
  assert.equal(invitationWrites.length,4,"Review flows must not send invitations");
  console.log(`PASS marketplace reviews ${width}px: independent validated reads/retries, retained rating/comment, synchronous publish guard, uncertain read reconciliation, no automatic republish, confirmed save with refresh failure, existing review protection and stale-musician isolation`);
  // Part 46: private moderation queue uses shared controls without changing RPC contracts.
  const moderationBeforeDenied=moderationReads.length;
  await page.goto(origin+"/marketplace/moderacao");
  await page.getByRole("heading",{name:"Área restrita",exact:true}).waitFor();
  assert.equal(moderationReads.length,moderationBeforeDenied,"Denied clients must not load the private queue");
  assert.equal(moderationWrites.length,0);
  assert.equal(await page.getByRole("link",{name:"Voltar ao marketplace",exact:true}).getAttribute("href"),"/marketplace");
  moderationAccess=true;await page.reload();
  const moderation=page.locator(".market-mod-page");
  const moderationFirst=moderation.getByRole("article",{name:"Artista sob análise 1",exact:true});
  const moderationSecond=moderation.getByRole("article",{name:"Artista sob análise 2",exact:true});
  await moderationFirst.waitFor();await moderationSecond.waitFor();
  assert.deepEqual(moderationReads.at(-1),{p_filter:"open",p_limit:30,p_offset:0});
  const moderationFilters=moderation.getByRole("group",{name:"Filtrar denúncias",exact:true});
  assert.equal(await moderationFilters.getByRole("button",{name:"Pendentes",exact:true}).getAttribute("aria-pressed"),"true");
  const moderationFilter=async name=>{
   const response=page.waitForResponse(r=>r.url().endsWith("/stage_marketplace_moderation_reports"));
   await activate(moderationFilters.getByRole("button",{name,exact:true}));await response;
   await moderation.getByRole("button",{name:"Atualizar fila",exact:true}).waitFor();
   await page.waitForFunction(()=>!document.querySelector(".market-mod-header button")?.disabled);
  };
  await moderationFilter("Resolvidas");
  await moderation.getByRole("heading",{name:"Nenhuma denúncia nessa categoria.",exact:true}).waitFor();
  assert.deepEqual(moderationReads.at(-1),{p_filter:"resolved",p_limit:30,p_offset:0});
  await moderationFilter("Todas");await moderationFirst.waitFor();
  assert.deepEqual(moderationReads.at(-1),{p_filter:"all",p_limit:30,p_offset:0});
  const moderationNext=moderation.getByRole("button",{name:"Próxima",exact:true});
  const nextModerationResponse=page.waitForResponse(r=>r.url().endsWith("/stage_marketplace_moderation_reports"));
  await activate(moderationNext);await nextModerationResponse;
  await moderation.getByRole("article",{name:"Artista sob análise 3",exact:true}).waitFor();
  assert.deepEqual(moderationReads.at(-1),{p_filter:"all",p_limit:30,p_offset:30});
  assert.equal(await moderationNext.isDisabled(),true);
  await moderationFilter("Pendentes");await moderationFirst.waitFor();
  assert.deepEqual(moderationReads.at(-1),{p_filter:"open",p_limit:30,p_offset:0});
  const moderationAction=moderationFirst.getByLabel("Decisão do moderador",{exact:true});
  const moderationNote=moderationFirst.getByLabel("Justificativa interna obrigatória",{exact:true});
  const moderationSubmit=moderationFirst.getByRole("button",{name:"Confirmar decisão",exact:true});
  assert.equal(await moderationAction.inputValue(),"hide");
  assert.equal(await moderationSecond.getByLabel("Decisão do moderador",{exact:true}).inputValue(),"restore");
  assert.equal(await moderationSubmit.isDisabled(),true);
  await moderationNote.fill("  Revisão sintética justificada.  ");
  await moderationAction.selectOption("dismiss");
  await moderationNote.focus();assert.ok(await moderationNote.evaluate(el=>el.matches(":focus-visible")&&parseFloat(getComputedStyle(el).outlineWidth)>=2));
  assert.equal(await moderationNote.evaluate(el=>getComputedStyle(el).fontSize),"16px");
  assert.equal(await moderationNote.getAttribute("aria-describedby"),"market-mod-note-"+moderationRows[0].id+"-help");
  const confirmModeration=async accept=>{
   const shown=new Promise(resolve=>page.once("dialog",async dialog=>{assert.equal(dialog.type(),"confirm");accept?await dialog.accept():await dialog.dismiss();resolve();}));
   await activate(moderationSubmit);await shown;
  };
  await confirmModeration(false);assert.equal(moderationWrites.length,0);
  await confirmModeration(true);
  await moderation.getByRole("alert").filter({hasText:"O conteúdo já não existe"}).waitFor();
  assert.equal(moderationWrites.length,1);
  assert.deepEqual(moderationWrites[0],{p_report_id:moderationRows[0].id,p_action:"dismiss",p_note:"Revisão sintética justificada."});
  assert.equal(await moderationNote.inputValue(),"  Revisão sintética justificada.  ");
  const moderationSizes=await moderation.locator(".sf-ui-button,.sf-ui-input").evaluateAll(nodes=>nodes.map(el=>({w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height})));
  assert.ok(moderationSizes.every(x=>x.w>=44&&x.h>=44));
  assert.ok(await moderation.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await moderationFirst.evaluate(el=>el.scrollIntoView({block:"center",behavior:"instant"}));
  assert.ok(await moderationSubmit.evaluate(el=>{
   const r=el.getBoundingClientRect();
   const nav=document.querySelector(".sf-workspace-bottom-nav");
   const limit=nav&&getComputedStyle(nav).display!=="none"?nav.getBoundingClientRect().top:innerHeight;
   return r.top>=0&&r.bottom<=limit;
  }),"The moderation action must be visible above the mobile navigation after scrolling the card into view");
  await moderationFirst.screenshot({path:`test-results/operational-moderation-shared-${width}.png`});
  let releaseModeration;moderationGate=new Promise(resolve=>releaseModeration=resolve);moderationResult="saved";
  const moderationSent=page.waitForRequest(r=>r.url().endsWith("/stage_marketplace_moderate_report"));
  await confirmModeration(true);await moderationSent;
  assert.equal(await moderationAction.isDisabled(),true);assert.equal(await moderationNote.isDisabled(),true);
  assert.equal(await moderationSecond.getByRole("button",{name:"Confirmar decisão",exact:true}).isDisabled(),true);
  assert.equal(await moderation.getByRole("button",{name:"Atualizar fila",exact:true}).isDisabled(),true);
  releaseModeration();moderationGate=undefined;
  await moderation.getByRole("status").filter({hasText:"Decisão salva com histórico de auditoria"}).waitFor();
  await page.waitForFunction(()=>!document.querySelector(".market-mod-header button")?.disabled);
  assert.equal(moderationWrites.length,2);assert.deepEqual(moderationWrites[0],moderationWrites[1]);
  assert.equal(await moderationNote.inputValue(),"");
  assert.ok(moderationReads.length>moderationBeforeDenied+4);
  console.log(`PASS moderation shared UI ${width}px: permission gate, filters/reset/pagination, scoped labels, 44px actions, 16px fields, explicit/cancelled decision, retained rejected draft, pending disabled controls, success and refresh; synthetic decisions only`);
  assert.deepEqual(errors,[],"Browser exceptions at "+width);await context.close();
 }
 console.log("PASS: dashboard at 360/768/1280, navigation, receipt failure, legacy profile, group creation, availability and invitation.");
}finally{await browser?.close();server.kill("SIGTERM");await writeFile("test-results/operational-server.log",serverLog);}
