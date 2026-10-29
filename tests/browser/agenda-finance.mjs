// Local browser regression. Every Supabase response is a synthetic fixture.
// Does not authenticate real users, send notifications or access a remote database.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3100";
const api = "https://example.supabase.co";
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL !== api)
  throw Error("This regression runs only with example.supabase.co, never a real project.");
await mkdir("test-results", { recursive: true });
let serverLog = "";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3100"], {
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: api, NEXT_PUBLIC_SUPABASE_ANON_KEY: "build-time-placeholder-not-a-real-secret" },
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.on("data", data => { serverLog += data; });
server.stderr.on("data", data => { serverLog += data; });
let browser;
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherUserId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const otherEventId = "88888888-8888-4888-8888-888888888888";
const firstId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
const guestId = "33333333-3333-4333-8333-333333333333";
const invitationId = "44444444-4444-4444-8444-444444444444";
const threadA = "99999999-9999-4999-8999-999999999999";
const threadB = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const proposalId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const bulkIds=Array.from({length:78},(_,i)=>"70000000-0000-4000-8000-"+String(i+1).padStart(12,"0"));
const user = { id: userId, aud: "authenticated", role: "authenticated", email: "musician@example.test", created_at: "2026-01-01T00:00:00Z", app_metadata: {}, user_metadata: {} };
const encoded = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const sessionFor = id => ({ access_token: encoded({ alg: "HS256", typ: "JWT" }) + "." + encoded({ sub: id, role: "authenticated", exp: 4102444800 }) + ".fixture",
  refresh_token: "fixture-refresh", token_type: "bearer", expires_in: 3600, expires_at: 4102444800,
  user: { ...user, id, email: id === userId ? user.email : "producer@example.test" } });
const session = sessionFor(userId);
const initialEvents = () => [firstId, secondId].map((id, index) => ({ id, title: index ? "Segundo show" : "ShowComNomeMuitoLongoSemEspaços".repeat(4), description: "Detalhes do show de teste", venue: "Local de teste", city: "São Paulo", starts_at: "2026-11-01T23:00:00Z", ends_at: null, status: "draft", show_publicly: false }));
const moreEvents = () => Array.from({ length: 20 }, (_, index) => ({ ...initialEvents()[1], id: `60000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, title: "Show adicional " + (index + 1), starts_at: index >= 18 ? "2026-11-25T23:00:00Z" : "2026-11-01T23:00:00Z" }));
function filtered(rows, url) {
  const idKey = url.pathname.endsWith("/events") ? "id" : "event_id";
  let result = rows.filter(row => url.searchParams.getAll("starts_at").every(filter => {
    const value = Date.parse(filter.slice(filter.indexOf(".") + 1));
    return filter.startsWith("gte.") ? Date.parse(row.starts_at) >= value : Date.parse(row.starts_at) < value;
  }));
  const cursor = url.searchParams.get("or")?.match(/starts_at.gt.([^,]+),and\(starts_at.eq.([^,]+),(?:id|event_id).gt.([0-9a-f-]+)\)/);
  if (cursor) result = result.filter(row => Date.parse(row.starts_at) > Date.parse(cursor[1]) || (Date.parse(row.starts_at) === Date.parse(cursor[2]) && row[idKey] > cursor[3]));
  result.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at) || a[idKey].localeCompare(b[idKey]));
  const targetId = url.searchParams.get(idKey);
  if(targetId) result=result.filter(row=>row[idKey]===targetId.slice(3));
  const limit = Number(url.searchParams.get("limit") ?? result.length);
  return result.slice(0, limit);
}
const guest = { event_id: guestId, title: "Participação aceita de teste", venue: "Palco de teste", city: "São Paulo", starts_at: "2026-11-02T23:00:00Z", ends_at: null, event_status: "published", organizer_name: "Organizador de teste" };

async function setup(width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: "America/Sao_Paulo" });
  await context.addCookies([{ name: "sb-example-auth-token", value: "base64-" + encoded(session), url: origin, sameSite: "Lax" }]);
  const state = { events: [...initialEvents(), ...moreEvents(), { ...initialEvents()[1], id: "77777777-7777-4777-8777-777777777777", title: "Show de dezembro", starts_at: "2026-12-02T23:00:00Z" }], accepted: false, failAgenda: false, failFinance: false, invalidFinance: false, writes: [],
    accountReadFail:false, accountWrites:[], authWrites:[], proReadFail:false, proEntitled:false, billingCalls:[], accountIdentity:{display_name:"Conta de teste",username:"conta-teste",is_singer:true,is_musician:false,is_producer:true,artist_kind:"lead",is_public:false,name_changed_at:"2026-10-15T12:00:00Z",username_changed_at:null,musician_slug:"conta-teste",musician_published:false}, savedTeamsEnabled:false, savedTeams:[{id:threadA,name:"Banda de teste",notes:"Formação privada",created_at:"2026-11-01T12:00:00Z"}], savedMembers:{[threadA]:[{member_id:invitationId,musician_id:otherUserId,musician_name:"Contato profissional",instrument:"Violão"}]}, savedWrites:[], recurringSeries:[], recurringWrites:[], recurringFail:false, recurringInvalid:false, detailedSummary:false, detailedInvites:false, failSentDetails:false, lineupClosed:false, lineupWrites:[], lineupSlots:[{id:threadA,label:"Bateria",invitation_id:invitationId,musician_id:otherUserId,musician_name:"Músico confirmado",invitation_status:"accepted",history:[]},{id:threadB,label:"Baixo",invitation_id:null,musician_id:null,musician_name:null,invitation_status:null,history:[]}], editorWrites:[], editorExpenses:[], teamWrites:[], bulkHistory:false, reads: new Map(), adminA: false, financeDelay: null, delayedFinanceStarted: 0, delayedFinanceCompleted: 0,
    messageDelay: null, delayedMessagesStarted: 0, delayedMessagesCompleted: 0, failMessageId: null, failInvites: false, feeEnabled:false, feeAgreed:null, feeAmount:400, feeByMe:false, feeReadFail:false, feeOffers:[],
    failChatPreferences: false, showProposal: false, proposalReadFail:false, proposalDelay:null, proposalStarted:0, proposalCompleted:0, asRequester:false, prefillDelay:null, prefillStarted:0, prefillCompleted:0, scheduleDelay:null, scheduleCalls:[], sendResult:"schedule_conflict", proposalWrites:[], submittedProposal:null, proposalWithdrawn:false, proposalAccepted: false, guestStartsAt: guest.starts_at, sent: [],
    messages: Object.fromEntries([[threadA,"Mensagem privada A"],[threadB,"Mensagem privada B"]].map(([id,text])=>[id,[{id,body:text,is_mine:false,created_at:"2026-11-01T15:00:00Z"}]])) };
  await context.route(api + "/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.postDataJSON();
    const jwt = request.headers().authorization?.split(" ")[1]?.split(".")[1];
    const actor = jwt ? JSON.parse(Buffer.from(jwt, "base64url").toString()).sub : null;
    let result = [], status = 200;
    const rpc = url.pathname.split("/").at(-1);
    const readKey = actor + ":" + rpc;
    state.reads.set(readKey, (state.reads.get(readKey) ?? 0) + 1);
    if (url.pathname === "/auth/v1/user") {
      assert.ok(actor === userId || actor === otherUserId, "Auth must carry a synthetic user token");
      if(request.method()==="PUT")state.authWrites.push(body);
      result = sessionFor(actor).user;
    } else if (url.pathname.endsWith("/profiles")) {
      assert.equal(url.searchParams.get("id"), "eq." + actor, "profile read must match the authenticated account");
      result = { id: actor, role: actor === userId ? "musician" : "producer", display_name: actor === userId ? "Teste" : "Outra conta",
        is_singer: false, is_musician: actor === userId, is_producer: true, is_artist: actor === userId,
        artist_kind: actor === userId ? "support" : null, username: null, city: null, is_public: false, artist_avatar_path: null };
    }
    else if (url.pathname.endsWith("/events")) {
      if (request.method() === "POST") {
        assert.equal(body.producer_id, userId);
        state.writes.push(body);
        const created={ ...body, id: "55555555-5555-4555-8555-555555555555" };
        state.events.push(created);
        result = created;
      } else if (request.method() === "DELETE") {
        assert.equal(url.searchParams.get("producer_id"), "eq." + userId);
        const id = url.searchParams.get("id").slice(3);
        state.events = state.events.filter(event => event.id !== id);
        result = { id };
      } else if (state.failAgenda) { status = 503; result = { code: "unavailable", message: "Fixture unavailable" }; }
      else if(url.searchParams.has("id")) result = state.events.find(event=>event.id===url.searchParams.get("id").slice(3)) ?? null;
      else result = filtered(state.events,url);
    } else if (rpc === "stage_venue_partner_access") result = { status: "ok", items: [] };
    else if (rpc === "stage_owner_admin_status") result = actor === userId && state.adminA;
    else if (rpc === "stage_workspace_overview") result = { status: "ok", metrics: { shows_week: 0, pending_invites: 0, unread_conversations: 0, pending_contacts: 0, received_month: 0 }, upcoming: [], activity: [], updated_at: "2026-11-01T15:00:00Z" };
    else if (rpc === "stage_accepted_shows") result = filtered(state.accepted ? [{...guest,starts_at:state.guestStartsAt}] : [],url);
    else if (rpc === "stage_hiring_list") result = (state.bulkHistory?[threadA,threadB,...bulkIds]:[threadA,threadB]).map((id,index)=>({id,requested_date:"2026-12-02",event_id:state.asRequester?firstId:null,availability:"awaiting",last_message_at:"2026-11-01T15:00:00Z",other_id:otherUserId,other_name:index>1?"Histórico "+(index-1):index?"Contratante B":"Contratante A",acting_as:state.asRequester?"requester":"musician",unread:0,last_message:index?"Mensagem privada B":"Mensagem privada A"}));
    else if (rpc === "stage_hiring_messages") {
      assert.ok([threadA,threadB,...(state.bulkHistory?bulkIds:[])].includes(body.p_thread_id));
      const pending=body.p_thread_id===threadA?state.messageDelay:null;
      if(pending){state.delayedMessagesStarted++;await pending;state.delayedMessagesCompleted++;}
      if(state.failMessageId===body.p_thread_id){status=503;result={message:"Fixture unavailable"};}
      else result={status:"ok",messages:state.bulkHistory?Array.from({length:200},(_,i)=>({id:"90000000-0000-4000-8000-"+String(i).padStart(12,"0"),body:"Mensagem histórica "+i,is_mine:false,created_at:"2026-11-01T15:00:00Z"})):state.messages[body.p_thread_id]};
    } else if (rpc === "stage_hiring_send") {
      assert.equal(actor,userId);assert.ok([threadA,threadB].includes(body.p_thread_id));
      state.sent.push(body);
      state.messages[body.p_thread_id].push({id:"fixture-message-"+state.sent.length,body:body.p_body,is_mine:true,created_at:"2026-11-01T15:00:00Z"});
      result={status:"ok"};
    } else if (rpc === "stage_hiring_availability") result="saved";
    else if (rpc === "stage_hiring_whatsapp_settings") {
      if(state.failChatPreferences){status=503;result={message:"Fixture unavailable"};}
      else result={status:"ok",opted_in:false,phone:null};
    } else if (rpc === "stage_hiring_proposal_prefill") {
      const pending=state.prefillDelay;if(pending){state.prefillStarted++;await pending;state.prefillCompleted++;}
      result={status:"ok",event:{title:"Título sugerido antigo",venue:"Local sugerido",city:"São Paulo",starts_at:"2026-12-02T21:00:00Z"}};
    } else if(rpc === "stage_musician_schedule_check"){
      state.scheduleCalls.push(body);const pending=state.scheduleDelay;if(pending)await pending;result="free";
    } else if(rpc === "stage_hiring_proposal_send"){
      state.proposalWrites.push(body);result={status:state.sendResult};if(state.sendResult==="ok")state.submittedProposal=body;
    } else if(rpc === "stage_hiring_proposal_withdraw"){
      assert.equal(body.p_proposal_id,proposalId);state.proposalWithdrawn=true;result="saved";
    } else if (rpc === "stage_hiring_proposals") {
      const pending=body.p_thread_id===threadA?state.proposalDelay:null;
      if(pending){state.proposalStarted++;await pending;state.proposalCompleted++;}
      if(state.proposalReadFail){status=503;result={message:"Fixture unavailable"};}
      else if(state.submittedProposal)result={status:"ok",items:[{id:proposalId,title:state.submittedProposal.p_title,venue:null,city:null,starts_at:state.submittedProposal.p_starts_at,fee_amount:state.submittedProposal.p_fee,details:null,status:state.proposalWithdrawn?"withdrawn":"pending",created_at:"2026-11-01T15:00:00Z",responded_at:null,linked_event_id:null,linked_invitation_id:null}]};
      else result={status:"ok",items:state.showProposal&&body.p_thread_id===threadA?[{
      id:proposalId,title:"Proposta de show de teste",venue:guest.venue,city:guest.city,starts_at:state.guestStartsAt,fee_amount:400,details:null,
      status:state.proposalAccepted?"accepted":"pending",created_at:"2026-11-01T15:00:00Z",responded_at:null,
      linked_event_id:state.proposalAccepted?guestId:null,linked_invitation_id:state.proposalAccepted?invitationId:null
    }]:[]};
    }
    else if (rpc === "stage_hiring_proposal_decide") {
      assert.equal(body.p_proposal_id,proposalId);assert.equal(body.p_accept,true);
      state.proposalAccepted=true;state.accepted=true;result={status:"ok"};
    }
    else if (rpc === "stage_finance_organizer_overview") {
      const pending = actor === userId ? state.financeDelay : null;
      if (pending) { state.delayedFinanceStarted++;await pending;state.delayedFinanceCompleted++; }
      if (state.failFinance) { status = 503; result = { message: "Fixture unavailable" }; }
      else result = (actor === otherUserId ? [{ ...initialEvents()[1], id: otherEventId, title: "Show exclusivo da conta B" }] : initialEvents()).map(event => ({ event_id: event.id, title: event.title, starts_at: event.starts_at, event_status: event.status, gross_revenue: state.invalidFinance ? "invalid" : 3000, received: 1500, expense_total: 100, expense_paid: 50, musician_agreed: 800, musician_paid: 400, musician_unpriced: 0, transport_total: 100 }));
    } else if (rpc === "stage_finance_event_team") {
      await delay(body.p_event_id === firstId ? 350 : 20);
      result = { status: "ok", items: [{ invitation_id: invitationId, musician_name: body.p_event_id === firstId ? "Equipe A" : "Equipe B", fee: 400, paid_amount: 0 }] };
    } else if (rpc === "stage_my_event_budget") result = { event_id: body.p_event_id, client_fee: 3000, received_amount: 1500, to_receive: 1500, expenses_total: 100, expenses_paid_total: 50, expenses_unpaid_total: 50, expenses: state.editorExpenses, musician_agreed_total: 800, musician_unpriced_count: 0, projected_partial_result: 2100 };
    else if(rpc === "stage_my_account_identity") {if(state.accountReadFail){status=503;result={message:"Synthetic account read failure"};}else result=state.accountIdentity;}
    else if(rpc === "stage_update_account_identity") {state.accountWrites.push(body);assert.equal(body.p_display_name,"Conta de teste");state.accountIdentity.username=body.p_username;state.accountIdentity.username_changed_at="2026-11-01T15:00:00Z";result="saved";}
    else if(rpc === "stage_account_enable_role") {state.accountWrites.push(body);assert.equal(body.p_role,"musician");state.accountIdentity.is_musician=true;result="enabled";}
    else if(rpc === "stage_my_pro_site_publication") {if(state.proReadFail){status=503;result={message:"Synthetic access read failure"};}else result={entitled:state.proEntitled,published:false};}
    else if (rpc === "stage_my_teams") result=state.savedTeamsEnabled?state.savedTeams.map(t=>({...t,member_count:(state.savedMembers[t.id]??[]).length})):[{id:threadA,name:"Banda de teste",member_count:1}];
    else if (rpc === "stage_team_members_for_owner") result=state.savedTeamsEnabled?(state.savedMembers[body.p_team_id]??[]):[{member_id:threadB,musician_id:otherUserId,musician_name:"Músico da formação",instrument:"Violão"}];
    else if(rpc === "stage_create_team") {
      if(state.savedTeams.some(t=>t.name===body.p_name))result={status:"duplicate"};
      else {state.savedWrites.push({kind:"create",...body});state.savedTeams.push({id:threadB,name:body.p_name,notes:body.p_notes});state.savedMembers[threadB]=[];result={status:"created",id:threadB};}
    }
    else if(rpc === "stage_update_team") {state.savedWrites.push({kind:"update",...body});Object.assign(state.savedTeams.find(t=>t.id===body.p_team_id),{name:body.p_name,notes:body.p_notes});result="updated";}
    else if(rpc === "stage_add_team_member") {assert.equal(body.p_musician_id,otherUserId);state.savedWrites.push({kind:"add",...body});state.savedMembers[body.p_team_id].push({member_id:proposalId,musician_id:body.p_musician_id,musician_name:"Contato profissional",instrument:body.p_instrument});result="added";}
    else if(rpc === "stage_remove_team_member") {state.savedWrites.push({kind:"remove",...body});for(const id of Object.keys(state.savedMembers))state.savedMembers[id]=state.savedMembers[id].filter(m=>m.member_id!==body.p_member_id);result="removed";}
    else if(rpc === "stage_delete_team") {state.savedWrites.push({kind:"delete",...body});state.savedTeams=state.savedTeams.filter(t=>t.id!==body.p_team_id);result="deleted";}
    else if(rpc === "stage_recurring_show_list") {if(state.recurringFail){status=503;result={message:"Synthetic recurring read failure"};}else result=state.recurringSeries;}
    else if(rpc === "stage_recurring_show_create") {
      if(state.recurringInvalid)result={status:"invalid"};else{
        state.recurringWrites.push({kind:"create",...body});
        const occurrences=Array.from({length:8},(_,i)=>{const date=new Date("2026-11-06T23:00:00Z");date.setUTCDate(date.getUTCDate()+7*i);return {event_id:"81000000-0000-4000-8000-"+String(i+1).padStart(12,"0"),day:date.toISOString().slice(0,10),starts_at:date.toISOString(),status:"draft",invites_sent:0};});
        state.recurringSeries=[{id:proposalId,title:body.p_title,description:body.p_description,venue:body.p_venue,city:body.p_city,weekday:body.p_weekday,starts_on:body.p_starts_on,ends_on:body.p_ends_on,local_start:body.p_start_time,duration_minutes:body.p_duration,team_id:body.p_team_id,team_name:"Banda de teste",team_members:1,active:true,occurrences}];
        result={status:"created",series_id:proposalId,created:8,skipped_conflicts:0};
      }
    }
    else if(rpc === "stage_recurring_show_pause") {state.recurringWrites.push({kind:"pause",...body});state.recurringSeries.find(s=>s.id===body.p_id).active=body.p_active;result="saved";}
    else if(rpc === "stage_recurring_show_generate") {state.recurringWrites.push({kind:"generate",...body});result={status:"ok",created:0,skipped_conflicts:0};}
    else if (rpc === "stage_sent_invitations_with_whatsapp") {
      if(state.failSentDetails){status=503;result={message:"Synthetic sent-invites read failure"};}
      else result=state.detailedInvites?[
        {id:invitationId,status:"accepted",musician_name:"Músico autorizado",musician_phone:"5511999999999",invite_code:threadA},
        {id:threadA,status:"pending",musician_name:"Músico sem autorização",musician_phone:null,invite_code:threadB},
        {id:threadB,status:"pending",musician_name:null,musician_phone:null,invite_code:proposalId}
      ].map(x=>({...x,event_id:secondId,event_title:"Segundo show",event_starts_at:"2035-11-02T20:00:00Z",created_at:"2026-11-01T12:00:00Z"})):[];
    }
    else if(rpc === "stage_show_lineup_overview") result={status:"ok",event_title:"Escala de teste",event_starts_at:"2035-11-02T20:00:00Z",event_status:state.lineupClosed?"completed":"draft",slots:state.lineupSlots,unassigned:[]};
    else if(rpc === "stage_team_candidates") result=[{musician_id:otherUserId,musician_name:"Contato profissional"}];
    else if(rpc === "stage_show_lineup_add_slot") {assert.equal(body.p_event_id,secondId);state.lineupWrites.push({kind:"add",...body});state.lineupSlots.push({id:proposalId,label:body.p_label,invitation_id:null,invitation_status:null,history:[]});result={status:"ok"};}
    else if(rpc === "stage_show_lineup_invite") {assert.equal(body.p_slot_id,threadB);assert.equal(body.p_musician_id,otherUserId);state.lineupWrites.push({kind:"invite",...body});Object.assign(state.lineupSlots[1],{invitation_id:threadB,musician_id:otherUserId,musician_name:"Contato profissional",invitation_status:"pending"});result={status:"ok",new_invitation:true};}
    else if(rpc === "stage_show_lineup_release") {assert.equal(body.p_slot_id,threadA);state.lineupWrites.push({kind:"release",...body});Object.assign(state.lineupSlots[0],{invitation_id:null,musician_id:null,musician_name:null,invitation_status:null,history:[{musician_name:"Músico confirmado",status:"cancelled",assigned_at:"2026-11-01T12:00:00Z",released_at:"2026-11-01T13:00:00Z",reason:body.p_reason}]});result="released";}
    else if (rpc === "stage_event_financial_summary") result=state.detailedSummary?{event_id:body.p_event_id,invitation_count:4,active_count:3,accepted_count:1,confirmed_fee_count:1,agreed_waiting_count:0,pending_fee_count:2,open_offer_count:1,unquoted_count:1,inactive_count:1,confirmed_total:500,agreed_waiting_total:0,agreed_total:500,open_offer_total:200,items:[
      {invitation_id:invitationId,musician_name:"Cachê confirmado",invitation_status:"accepted",agreed_amount:500,last_offer_amount:500},
      {invitation_id:threadA,musician_name:"Proposta pendente",invitation_status:"pending",agreed_amount:null,last_offer_amount:200},
      {invitation_id:threadB,musician_name:"Valor indefinido",invitation_status:"pending",agreed_amount:null,last_offer_amount:null},
      {invitation_id:proposalId,musician_name:"Convite inativo",invitation_status:"cancelled",agreed_amount:9000,last_offer_amount:9000}
    ]}:{event_id:body.p_event_id,invitation_count:0,active_count:0,accepted_count:0,confirmed_fee_count:0,agreed_waiting_count:0,pending_fee_count:0,open_offer_count:0,unquoted_count:0,inactive_count:0,confirmed_total:0,agreed_waiting_total:0,agreed_total:0,open_offer_total:0,items:[]};
    else if (rpc === "stage_invite_team_to_event") {state.teamWrites.push(body);for(const series of state.recurringSeries){const event=series.occurrences.find(e=>e.event_id===body.p_event_id);if(event)event.invites_sent=1;}result={status:"sent",created:1,existing:0,total:1};}
    else if (rpc === "stage_save_event_expense") {
      assert.equal(actor,userId);assert.equal(body.p_paid_amount,50);assert.equal(body.p_amount,100);
      state.editorWrites.push(body);state.editorExpenses=[{id:proposalId,description:body.p_description,category:body.p_category,amount:body.p_amount,paid_amount:body.p_paid_amount}];result={status:"created"};
    }
    else if (rpc === "stage_my_invitations") {
      if(state.failInvites){status=503;result={message:"Fixture unavailable"};}
      else result = [{ id: invitationId, status: state.accepted ? "accepted" : "pending", message: null, created_at: "2026-10-27T12:00:00Z", responded_at: null, event_id: guestId, event_title: guest.title, event_starts_at: state.guestStartsAt, event_venue: guest.venue, event_city: guest.city, organizer_name: guest.organizer_name }];
    }
    else if (rpc === "stage_respond_invite") { assert.equal(body.p_invitation_id, invitationId); if(state.feeEnabled&&body.p_accept&&state.feeAgreed===null)result="fee_pending";else {state.accepted = body.p_accept; result = state.accepted ? "accepted" : "declined";} }
    else if (rpc === "stage_fee_details") {
      if(state.feeReadFail){status=503;result={message:"Synthetic private error"};}
      else result=state.feeEnabled?{status:state.accepted?"accepted":"pending",is_owner:false,has_offer:true,last_amount:state.feeAmount,last_by_me:state.feeByMe,last_note:null,agreed_amount:state.feeAgreed,history:[]}:null;
    } else if(rpc === "stage_offer_fee") {
      assert.equal(body.p_invitation_id,invitationId);state.feeOffers.push(body);
      state.feeAmount=body.p_amount;state.feeByMe=true;result="offered";
    } else if(rpc === "stage_accept_fee") {
      assert.equal(body.p_invitation_id,invitationId);state.feeAgreed=state.feeAmount;result="accepted";
    }
    try { await route.fulfill({ status, json: result, headers: { "Access-Control-Allow-Origin": "*" } }); }
    catch (error) { if (!/closed|disposed|intercept|invalid/i.test(String(error))) throw error; }
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date("2026-11-01T12:00:00-03:00"));
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  return { context, page, state, errors };
}
async function noHorizontalOverflow(page, label) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), label + " overflows horizontally");
}
async function readable(locator,label){
  const ratio=await locator.evaluate(node=>{
    const style=getComputedStyle(node);
    const luminance=color=>{
      const channels=color.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{const c=n/255;return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);});
      return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
    };
    const fg=luminance(style.color),bg=luminance(style.backgroundColor);
    return (Math.max(fg,bg)+0.05)/(Math.min(fg,bg)+0.05);
  });
  assert.ok(ratio>=4.5,label+" contrast is "+ratio);
}
async function until(predicate) {
  for (let attempt = 0; attempt < 100; attempt++) { if (predicate()) return;await delay(25); }
  throw Error("Timed out waiting for synthetic account request");
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try { ready = (await fetch(origin + "/login")).ok; } catch {}
    if (ready) break;
    await delay(250);
  }
  assert.ok(ready, "Next server did not start: " + serverLog);
  browser = await chromium.launch({ headless: true });
  // Global CSS cleanup: exercise the current public home and signup controls.
  // A fresh anonymous context keeps this independent from workspace fixtures.
  for (const width of [360, 768, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    let signupErrorMode = "existing", signupAttempts = 0;
    await context.route(api + "/**", route => {
      if (route.request().method() === "OPTIONS") {
        return route.fulfill({ status: 204, headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
        } });
      }
      if (new URL(route.request().url()).pathname === "/auth/v1/signup") {
        signupAttempts++;
        const duplicate = signupErrorMode === "existing";
        return route.fulfill({
          status: duplicate ? 422 : 500,
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({
            code: duplicate ? "user_already_exists" : "unexpected_failure",
            message: duplicate ? "User already registered" : "Database error saving new user"
          })
        });
      }
      return route.fulfill({ status: 401, contentType: "application/json",
        body: JSON.stringify({ message: "Anonymous test" }) });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    try {
      await page.goto(origin + "/");
      await page.getByRole("heading", { level: 1, name: /Mais música/ }).waitFor();
      const start = page.getByRole("link", { name: "Começar gratuitamente", exact: true });
      await start.waitFor();
      await noHorizontalOverflow(page, "public home " + width);
      await page.screenshot({ path: `test-results/public-home-${width}.png`, fullPage: true });
      await start.focus();
      await start.press("Enter");
      await page.getByRole("heading", { name: "Crie sua conta", exact: true }).waitFor();
      const roles = page.getByRole("group", { name: "Sua atividade principal" });
      for (const name of [/^Músico de apoio/, /^Produtor \/ contratante/, /^Cantor \/ artista principal/]) {
        const choice = roles.getByRole("button", { name });
        await choice.focus();
        await choice.press("Enter");
        assert.equal(await choice.getAttribute("aria-pressed"), "true");
        assert.equal(await roles.locator('[aria-pressed="true"]').count(), 1);
        await noHorizontalOverflow(page, "signup role " + name + " " + width);
      }
      await page.screenshot({ path: `test-results/public-signup-${width}.png`, fullPage: true });
      // Synthetic Auth signup rejects duplicates and trigger collisions without exposing raw errors.
      await page.locator("#name").fill("Artista de Teste");
      await page.locator("#slug").fill("artista-de-teste");
      await page.locator("#email").fill("artista@example.test");
      await page.locator("#password").fill("senha-ficticia-123");
      const submitSignup = page.getByRole("button", { name: "Criar minha conta gratuita", exact: true });
      const duplicateResponse = page.waitForResponse(r => new URL(r.url()).pathname === "/auth/v1/signup");
      await submitSignup.click();
      await duplicateResponse;
      await page.getByRole("status").filter({ hasText: "Este usuário já existe. Use Entrar" }).waitFor();
      assert.equal(signupAttempts, 1, "Duplicate signup must send just one synthetic request");
      signupErrorMode = "database";
      const collisionResponse = page.waitForResponse(r => new URL(r.url()).pathname === "/auth/v1/signup");
      await submitSignup.click();
      await collisionResponse;
      await page.getByRole("status").filter({ hasText: "Este usuário já existe ou o @ artístico informado está em uso" }).waitFor();
      assert.equal(signupAttempts, 2, "A retry should send only one synthetic request");
      assert.ok(!(await page.getByRole("status").innerText()).includes("Database error saving new user"));
      await noHorizontalOverflow(page, "signup duplicate error " + width);
      await page.screenshot({ path: "test-results/public-signup-duplicate-" + width + ".png", fullPage: true });
      assert.deepEqual(errors, []);
      console.log(`PASS public home/signup ${width}px: anonymous navigation, keyboard roles, duplicate messages and overflow`);
    } finally { await context.close(); }
  }
  for (const width of [360, 768, 1280]) {
    const { context, page, state, errors } = await setup(width);
    try {
      await page.goto(origin + "/eventos");
      await page.locator(".sf-workspace-route-ready").waitFor();
      await page.locator(".agenda-event-list").first().waitFor();
      assert.equal(await page.locator("#agenda-create-form").isVisible(), false);
      assert.equal(await page.locator(".agenda-event-list").first().locator("article").count(),20);
      await page.getByRole("button",{name:/^25 de novembro.*show próprio/}).waitFor();
      await page.getByRole("button",{name:"Carregar mais shows próprios",exact:true}).click();
      await page.getByText("22 shows próprios carregados neste período",{exact:true}).waitFor();
      assert.equal(await page.getByRole("button",{name:"Carregar mais shows próprios",exact:true}).count(),0);
      await page.getByRole("button",{name:"Próximo mês",exact:true}).click();
      await page.getByText("Show de dezembro",{exact:true}).waitFor();
      assert.equal(await page.locator(".agenda-event-list").first().locator("article").count(),1);
      await page.getByRole("button",{name:"Mês anterior",exact:true}).click();
      await page.getByText("20 shows próprios carregados neste período",{exact:true}).waitFor();
      await noHorizontalOverflow(page, "agenda " + width);
      await page.getByRole("button", { name: "Novo show", exact: true }).first().click();
      assert.equal(await page.locator("#event-title").evaluate(node => node === document.activeElement), true);
      await page.getByLabel("Nome do show / evento *", { exact: true }).fill("Novo show de teste");
      await page.locator("#event-start").fill("2026-11-04T20:00");
      await page.locator("#event-end").fill("2026-11-04T19:00");
      await page.getByRole("button", { name: "Salvar evento", exact: true }).click();
      await page.getByRole("alert").filter({ hasText: "O término precisa ser depois do início" }).waitFor();
      assert.equal(state.writes.length, 0);
      await readable(page.getByRole("alert").filter({hasText:"O término precisa ser depois do início"}),"agenda validation error");
      await readable(page.getByRole("button",{name:"Salvar evento",exact:true}),"agenda primary action");
      await noHorizontalOverflow(page,"open agenda form "+width);
      await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:`test-results/agenda-form-${width}.png`,fullPage:true});
      await page.locator("#event-end").fill("2026-11-04T23:00");
      await page.getByRole("button", { name: "Salvar evento", exact: true }).click();
      await page.getByText("Evento salvo com sucesso!", { exact: true }).waitFor();
      assert.equal(state.writes.length, 1);
      assert.equal(await page.locator("#agenda-create-form").isVisible(), false);
      await page.getByRole("button", { name: "Excluir Novo show de teste", exact: true }).click();
      await page.getByRole("dialog").waitFor();
      await page.getByRole("dialog").getByRole("button", { name: "Cancelar", exact: true }).click();
      assert.equal(state.events.length, 24);
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `test-results/agenda-${width}.png`, fullPage: true });
      // Part 16: flyer selection/export and explicit team confirmation use synthetic data only.
      const ownCard=page.locator("#stage-event-"+firstId);
      await ownCard.getByRole("button",{name:"Flyer para Instagram/WhatsApp",exact:true}).click();
      const flyer=ownCard.getByRole("region",{name:/^Flyer do show/});
      const fileInput=flyer.locator('input[type="file"]');
      await fileInput.waitFor({state:"visible"});
      await fileInput.setInputFiles({name:"invalid.txt",mimeType:"text/plain",buffer:Buffer.from("invalid")});
      await flyer.getByRole("alert").filter({hasText:"Use JPG, PNG ou WebP"}).waitFor();
      const fixturePng=await page.evaluate(()=>{const c=document.createElement("canvas");c.width=40;c.height=60;const x=c.getContext("2d");x.fillStyle="#7650b0";x.fillRect(0,0,40,60);return c.toDataURL("image/png").split(",")[1];});
      await fileInput.setInputFiles({name:"fixture.png",mimeType:"image/png",buffer:Buffer.from(fixturePng,"base64")});
      await flyer.locator("canvas").waitFor();
      await flyer.getByRole("button",{name:"Story / Status 9:16",exact:true}).click();
      assert.equal(await flyer.getByRole("button",{name:"Story / Status 9:16",exact:true}).getAttribute("aria-pressed"),"true");
      assert.equal(await flyer.locator("canvas").getAttribute("data-format"),"story");
      const zoom=flyer.getByRole("slider",{name:/^Zoom/});await zoom.focus();await page.keyboard.press("ArrowRight");
      assert.equal(await zoom.inputValue(),"1.1");
      assert.ok(await zoom.evaluate(n=>n.getBoundingClientRect().height)>=44);
      const feedDownloadButton=flyer.getByRole("button",{name:"Baixar Feed 1080×1350",exact:true});
      await feedDownloadButton.focus();
      assert.equal(await feedDownloadButton.evaluate(n=>n===document.activeElement),true);
      const [flyerFile]=await Promise.all([
        page.waitForEvent("download"),
        feedDownloadButton.press("Enter")
      ]);
      const jpeg=await readFile(await flyerFile.path());
      const dimensions=await page.evaluate(async b=>{const bytes=Uint8Array.from(atob(b),c=>c.charCodeAt(0));const bitmap=await createImageBitmap(new Blob([bytes],{type:"image/jpeg"}));const d=[bitmap.width,bitmap.height];bitmap.close();return d;},jpeg.toString("base64"));
      assert.deepEqual(dimensions,[1080,1350]);
      assert.equal(state.reads.get(userId+":stage_set_show_flyer")??0,0,"preview/export must not publish a flyer");
      await noHorizontalOverflow(page,"flyer editor "+width);
      await flyer.screenshot({path:`test-results/flyer-editor-${width}.png`});
      await ownCard.getByRole("button",{name:"Fechar flyer",exact:true}).click();
      await ownCard.getByRole("button",{name:"Equipe, convites e financeiro",exact:true}).click();
      const teamPanel=ownCard.getByRole("region",{name:/^Equipe de músicos/});
      await teamPanel.getByText("Músico da formação",{exact:true}).waitFor();
      assert.equal(await teamPanel.getByLabel("Equipe salva",{exact:true}).inputValue(),threadA);
      await teamPanel.getByLabel("Mensagem aos convidados (opcional)",{exact:true}).fill("Ensaio de teste");
      const inviteTeamButton=teamPanel.getByRole("button",{name:"Convidar esta equipe",exact:true});
      async function confirmTeam(accept){
        await inviteTeamButton.focus();
        const dialogReady=page.waitForEvent("dialog");
        const activation=inviteTeamButton.press("Enter");
        const dialog=await dialogReady;
        assert.equal(dialog.type(),"confirm");
        assert.ok(dialog.message().includes("Banda de teste"));
        if(accept)await dialog.accept();else await dialog.dismiss();
        await activation;
      }
      await confirmTeam(false);
      assert.equal(state.teamWrites.length,0,"dismissed confirmation must not invite anyone");
      await confirmTeam(true);
      await teamPanel.getByRole("status").filter({hasText:"1 novo(s) convite(s) registrado(s)"}).waitFor();
      assert.equal(state.teamWrites.length,1);assert.equal(state.teamWrites[0].p_event_id,firstId);assert.equal(state.teamWrites[0].p_message,"Ensaio de teste");
      await noHorizontalOverflow(page,"team editor "+width);
      await teamPanel.screenshot({path:`test-results/team-editor-${width}.png`});
      await page.goto(origin + "/financeiro");
      await page.getByRole("region", { name: "Resumo financeiro" }).waitFor();
      assert.equal(await page.locator('section[aria-label="Resumo financeiro"] .sf-ui-stat').count(), 4);
      await noHorizontalOverflow(page, "finance " + width);
      await page.locator(".finance-filter-panel>summary").click();
      await page.getByLabel("Atuação",{exact:true}).focus();
      await page.keyboard.press("Tab");
      assert.equal(await page.getByLabel("Ano",{exact:true}).evaluate(node=>node===document.activeElement),true,"year follows mode in filter keyboard order");
      await page.keyboard.press("Tab");
      assert.equal(await page.getByLabel("Mês",{exact:true}).evaluate(node=>node===document.activeElement),true,"month follows year in filter keyboard order");
      await page.getByLabel("Atuação").selectOption("musician");
      assert.equal(await page.locator(".finance-event").count(), 0);
      await page.getByLabel("Atuação").selectOption("all");
      const downloadReady=page.waitForEvent("download");
      await page.getByRole("button",{name:"Exportar CSV detalhado",exact:true}).click();
      const download=await downloadReady;
      assert.equal(download.suggestedFilename(),"stage-flow-financeiro-detalhado.csv");
      const exported=await readFile(await download.path(),"utf8");
      assert.equal(exported.charCodeAt(0),0xfeff);
      assert.equal(exported.split("\r\n").length,3);
      assert.ok(exported.includes('"3000,00";"1500,00"'));
      assert.ok(exported.includes('"2100,00";"1050,00"'));
      assert.ok(!/NaN|undefined/.test(exported));
      const receivedCard=page.locator('section[aria-label="Resumo financeiro"] .sf-ui-stat').filter({hasText:"Recebido registrado"});
      assert.match(await receivedCard.innerText(),/R\$\s*3\.000,00/);
      await page.getByRole("button", { name: "Editar financeiro e pagamentos", exact: true }).first().click();
      await page.getByRole("button", { name: "Editar financeiro e pagamentos", exact: true }).last().click();
      await page.getByText("Equipe B", { exact: true }).waitFor();
      await delay(450);
      assert.equal(await page.getByText("Equipe A", { exact: true }).count(), 0);
      const paidInput=page.getByLabel("Valor pago a Equipe B",{exact:true});
      await paidInput.fill("valor inválido");
      const writesBeforeInvalid=state.writes.length;
      await paidInput.press("Tab");
      assert.equal(await page.locator(".finance-team-row").getByRole("button",{name:"Salvar",exact:true}).evaluate(node=>node===document.activeElement),true,"payment save follows its labelled input");
      await page.keyboard.press("Enter");
      const paidError=page.getByRole("alert").filter({hasText:"Valor inválido: use reais"});
      await paidError.waitFor();
      assert.equal(state.writes.length,writesBeforeInvalid,"invalid manual payment must never write");
      await readable(paidError,"manual payment validation error");
      assert.ok(await page.locator(".finance-team-row").getByRole("button",{name:"Salvar",exact:true}).evaluate(node=>node.getBoundingClientRect().height)>=44);
      if(width===360)assert.ok(await paidInput.evaluate(node=>parseFloat(getComputedStyle(node).fontSize))>=16,"mobile payment field avoids focus zoom");
      await paidInput.fill("0,00");
      const budgetPanel=page.getByRole("region",{name:"Receita e despesas privadas do show",exact:true});
      await budgetPanel.getByRole("button",{name:"Adicionar",exact:true}).click();
      await budgetPanel.getByLabel("Descrição *",{exact:true}).fill("Transporte de teste");
      await budgetPanel.getByLabel("Categoria",{exact:true}).selectOption("transport");
      await budgetPanel.getByLabel("Valor total (R$) *",{exact:true}).fill("100,00");
      await budgetPanel.getByLabel("Pago até agora (R$) *",{exact:true}).fill("200,00");
      await budgetPanel.getByRole("button",{name:"Adicionar despesa",exact:true}).click();
      const expenseError=budgetPanel.getByRole("alert").filter({hasText:"Confira a despesa"});await expenseError.waitFor();
      assert.equal(state.editorWrites.length,0,"expense paid above total must not write");
      await readable(expenseError,"expense validation error");
      await noHorizontalOverflow(page,"open expense form "+width);
      if(width===360)assert.ok(await budgetPanel.getByLabel("Valor total (R$) *",{exact:true}).evaluate(n=>parseFloat(getComputedStyle(n).fontSize))>=16);
      await budgetPanel.screenshot({path:`test-results/expense-form-${width}.png`});
      await budgetPanel.getByLabel("Pago até agora (R$) *",{exact:true}).fill("50,00");
      await budgetPanel.getByRole("button",{name:"Adicionar despesa",exact:true}).click();
      await budgetPanel.getByText("Transporte de teste",{exact:true}).waitFor();
      assert.equal(state.editorWrites.length,1);assert.equal(state.editorWrites[0].p_event_id,secondId);
      const editExpense=budgetPanel.getByRole("button",{name:"Editar despesa Transporte de teste",exact:true});
      assert.ok(await editExpense.evaluate(n=>n.getBoundingClientRect().height)>=44);
      await editExpense.click();
      assert.equal(await budgetPanel.getByLabel("Pago até agora (R$) *",{exact:true}).inputValue(),"50,00");
      await budgetPanel.getByRole("button",{name:"Fechar formulário de despesa",exact:true}).click();
      await noHorizontalOverflow(page, "finance editor " + width);
      await page.screenshot({ path: `test-results/finance-${width}.png`, fullPage: true });
      if (width === 360) {
        const focusId=moreEvents().at(-1).id;
        await page.goto(origin+"/eventos?evento="+focusId);
        await page.locator("#stage-event-"+focusId).waitFor();
        assert.equal(await page.locator("#stage-event-"+focusId).count(),1);
        await page.goto(origin + "/meus-convites");
        await page.getByRole("button", { name: /Aceitar/ }).first().click();
        await page.getByText(/Presença confirmada!/).waitFor();
        await page.getByRole("link",{name:"Ver show na minha agenda",exact:true}).click();
        await page.waitForURL(origin+"/eventos?evento="+guestId);
        await page.locator("#stage-event-"+guestId).waitFor();
        await page.getByText(guest.title, { exact: true }).waitFor();
        state.failAgenda = true;
        await page.reload();
        await page.getByRole("alert").filter({ hasText: "Não foi possível carregar seus shows" }).waitFor();
        assert.equal(await page.getByText("Nenhum show próprio neste mês", { exact: true }).count(), 0);
        state.invalidFinance=true;
        await page.goto(origin+"/financeiro");
        await page.getByRole("alert").filter({hasText:"Os dados financeiros contêm um valor inválido"}).waitFor();
        assert.equal(await page.locator('section[aria-label="Resumo financeiro"]').count(),0);
        assert.equal(await page.getByRole("button",{name:"Exportar CSV detalhado",exact:true}).isDisabled(),true);
        state.invalidFinance=false;
        state.failFinance = true;
        await page.goto(origin + "/financeiro");
        await page.getByText("Financeiro indisponível", { exact: true }).waitFor();
        assert.equal(await page.locator('section[aria-label="Resumo financeiro"]').count(), 0);
      }
      state.accepted=false;state.feeEnabled=true;
      await page.goto(origin+"/meus-convites");
      await page.getByRole("button",{name:"Aceitar convite",exact:true}).click();
      await page.getByText(/Antes de confirmar sua presença/).waitFor();
      await page.getByRole("button",{name:"Contraproposta",exact:true}).click();
      await page.getByLabel("Sua contraproposta (R$)",{exact:true}).fill("350.25");
      await readable(page.getByRole("button",{name:"Enviar proposta",exact:true}),"booking primary action");
      await page.keyboard.press("Tab");
      assert.equal(await page.getByLabel("Mensagem (opcional)",{exact:true}).evaluate(node=>node===document.activeElement),true,"shared textarea must follow the fee input in keyboard order");
      await page.keyboard.press("Shift+Tab");
      await noHorizontalOverflow(page,"negotiation form "+width);
      assert.ok(await page.getByRole("button",{name:"Enviar proposta",exact:true}).evaluate(node=>node.getBoundingClientRect().height>=44));
      await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`test-results/negotiation-form-${width}.png`,fullPage:true});
      await page.getByRole("button",{name:"Enviar proposta",exact:true}).click();
      await page.getByText("Aguardando resposta do contratante.",{exact:true}).waitFor();
      assert.equal(state.feeOffers.length,1);assert.equal(state.feeOffers[0].p_amount,350.25);
      state.feeByMe=false;state.feeAmount=375;
      await page.getByRole("button",{name:"Atualizar negociação",exact:true}).click();
      await page.getByRole("button",{name:/^Aceitar R/}).click();
      await page.getByText(/Valor fechado:/).waitFor();
      assert.equal(state.accepted,false,"fee agreement cannot confirm participation");
      await readable(page.locator(".sf-ui-notice-success").filter({hasText:"Valor fechado:"}),"booking success notice");
      if(width===360){
        state.feeReadFail=true;
        await page.getByRole("button",{name:"Atualizar negociação",exact:true}).click();
        await page.getByRole("alert").filter({hasText:"Não foi possível consultar a negociação"}).waitFor();
        assert.equal(await page.getByText(/Valor fechado:/).count(),0);
        await readable(page.locator(".sf-ui-notice-danger").filter({hasText:"Não foi possível consultar a negociação"}),"booking error notice");
        await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:"test-results/negotiation-error-360.png",fullPage:true});
        state.feeReadFail=false;
        await page.getByRole("button",{name:"Atualizar negociação",exact:true}).click();
        await page.getByText(/Valor fechado:/).waitFor();
      }
      await page.getByRole("button",{name:"Confirmar presença no show",exact:true}).click();
      await page.getByText(/Presença confirmada!/).waitFor();
      assert.equal(state.accepted,true);
      await noHorizontalOverflow(page,"fee negotiation "+width);
      await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:`test-results/negotiation-${width}.png`,fullPage:true});
      console.log(`PASS negotiation ${width}px: counteroffer, agreement without attendance, explicit confirmation and read-error recovery`);
      assert.deepEqual(errors, [], "browser console errors");
      console.log(`PASS ${width}px: month/cursor pagination, deep links, agenda creation, financial totals/CSV download, data-error recovery and team response isolation`);
    } catch (error) {
      await page.screenshot({ path: `test-results/failure-${width}.png`, fullPage: true }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
  // Part 19: account controls and Pro access, with Auth and billing fully mocked.
  for(const width of [360,768,1280]){
    const {context,page,state,errors}=await setup(width);
    await context.route(origin+"/api/**",async route=>{state.billingCalls.push(route.request().url());await route.abort();});
    async function activate(button){await button.waitFor({state:"visible"});for(let i=0;i<200&&!(await button.isEnabled());i++)await delay(25);assert.equal(await button.isEnabled(),true);await button.focus();await button.press("Enter");}
    async function tab(label){await activate(page.getByRole("button",{name:new RegExp("^"+label)}));}
    try{
      state.accountReadFail=true;await page.goto(origin+"/minha-conta?aba=dados");
      await page.getByText("Conta indisponível",{exact:true}).waitFor();
      state.accountReadFail=false;await activate(page.getByRole("button",{name:"Tentar novamente",exact:true}));
      const publicName=page.getByLabel("Nome público",{exact:true});await publicName.waitFor();
      if(width===360)await page.waitForFunction(()=>{const nav=document.querySelector(".account-side"),selected=nav?.querySelector('[aria-current="page"]');if(!nav||!selected)return false;const n=nav.getBoundingClientRect(),s=selected.getBoundingClientRect();return s.left>=n.left-1&&s.right<=n.right+1;});
      assert.equal(await publicName.isDisabled(),true,"name cooldown must remain active");
      const username=page.getByLabel("@ do cantor",{exact:true});assert.equal(await username.isDisabled(),false,"username has an independent cooldown");
      await username.fill("novo-artista");await activate(page.getByRole("button",{name:"Salvar alterações",exact:true}));
      await page.getByRole("status").filter({hasText:"Alterações salvas!"}).waitFor();assert.equal(state.accountWrites.length,1);assert.equal(state.accountWrites[0].p_username,"novo-artista");assert.equal(await username.isDisabled(),true);
      await noHorizontalOverflow(page,"account identity "+width);await page.screenshot({path:`test-results/account-settings-${width}.png`,fullPage:true});
      await tab("E-mail e segurança");
      const password=page.getByLabel("Nova senha",{exact:true}),repeat=page.getByLabel("Confirmar nova senha",{exact:true});
      await password.fill("Fixture-only-pass-123");await repeat.fill("Different-fixture-123");
      assert.equal(await page.getByRole("button",{name:"Atualizar senha",exact:true}).isDisabled(),true);assert.equal(state.authWrites.length,0);
      await activate(page.getByRole("button",{name:"Mostrar senha",exact:true}));assert.equal(await password.getAttribute("type"),"text");assert.equal(await repeat.getAttribute("type"),"text");
      assert.ok(await page.getByRole("button",{name:"Ocultar senha",exact:true}).evaluate(n=>n.getBoundingClientRect().height)>=44);
      await repeat.fill("Fixture-only-pass-123");await activate(page.getByRole("button",{name:"Atualizar senha",exact:true}));
      await page.getByRole("status").filter({hasText:"Senha atualizada."}).waitFor();assert.equal(state.authWrites.length,1);assert.equal(await password.inputValue(),"");assert.equal(await repeat.inputValue(),"");
      await page.getByLabel("Novo e-mail de acesso",{exact:true}).fill("novo@example.test");await activate(page.getByRole("button",{name:"Solicitar mudança de e-mail",exact:true}));
      await page.getByRole("status").filter({hasText:"Solicitação enviada."}).waitFor();assert.equal(state.authWrites.length,2);assert.equal(state.authWrites[1].email,"novo@example.test");
      await noHorizontalOverflow(page,"account security "+width);await page.screenshot({path:`test-results/account-security-${width}.png`,fullPage:true});
      await tab("Atuação como músico");const enable=page.getByRole("button",{name:"Ativar função de músico",exact:false});await activate(enable);
      let dialog=page.getByRole("dialog");await dialog.waitFor();
      const confirm=dialog.getByRole("button",{name:"Confirmar ativação",exact:true});assert.equal(await confirm.isDisabled(),true);
      await dialog.locator("#account-confirm-role").fill("ATIVAR");assert.equal(await confirm.isDisabled(),true,"text alone must never activate a role");
      await page.keyboard.press("Escape");await dialog.waitFor({state:"hidden"});
      await page.waitForFunction(()=>document.activeElement?.textContent?.includes("Ativar função de músico"));assert.equal(state.accountWrites.length,1);
      await activate(enable);dialog=page.getByRole("dialog");await dialog.getByRole("checkbox").check();await dialog.locator("#account-confirm-role").fill("ATIVAR");
      const first=dialog.getByRole("button",{name:"Cancelar ativação",exact:true});await first.focus();await page.keyboard.press("Shift+Tab");assert.equal(await dialog.getByRole("button",{name:"Confirmar ativação",exact:true}).evaluate(n=>n===document.activeElement),true,"dialog must retain keyboard focus");
      await noHorizontalOverflow(page,"role confirmation "+width);await dialog.screenshot({path:`test-results/account-role-dialog-${width}.png`});
      await activate(dialog.getByRole("button",{name:"Confirmar ativação",exact:true}));await page.getByRole("status").filter({hasText:"Função de músico ativada"}).waitFor();assert.equal(state.accountWrites.length,2);assert.equal(state.accountWrites[1].p_role,"musician");
      assert.equal(await page.getByRole("link",{name:"Editar instrumentos e atuação",exact:true}).count(),1);
      state.proReadFail=true;await page.goto(origin+"/assinatura");const accessError=page.locator(".subscription-page").getByRole("alert");await accessError.waitFor();await readable(accessError,"Pro access read error");
      assert.equal(await page.getByText("Assinatura ainda indisponível.",{exact:false}).count(),0,"read failure must not be represented as unavailable entitlement");
      state.proReadFail=false;await activate(page.getByRole("button",{name:"Tentar novamente",exact:true}));await page.getByRole("status").filter({hasText:"Assinatura ainda indisponível"}).waitFor();
      assert.equal(await page.getByRole("link",{name:"Acessar meu Perfil Artístico",exact:true}).count(),0);assert.equal(state.billingCalls.length,0);
      await noHorizontalOverflow(page,"subscription unavailable "+width);await page.screenshot({path:`test-results/subscription-unavailable-${width}.png`,fullPage:true});
      state.proEntitled=true;await page.reload();await page.getByRole("status").filter({hasText:"Sua conta já possui acesso Pro autorizado"}).waitFor();
      assert.equal(await page.getByRole("link",{name:"Acessar meu Perfil Artístico",exact:true}).getAttribute("href"),"/perfil-artistico?aba=midia");
      const accessReads=state.reads.get(userId+":stage_my_pro_site_publication");await page.goto(origin+"/planos");
      await page.getByRole("link",{name:"Consultar acesso Pro",exact:true}).waitFor();assert.equal(state.reads.get(userId+":stage_my_pro_site_publication"),accessReads,"public plan comparison must not fetch private entitlement");
      assert.ok((await page.getByRole("main").innerText()).includes("Não há checkout, assinatura automática"));assert.equal(state.billingCalls.length,0);
      await noHorizontalOverflow(page,"public plans "+width);await page.screenshot({path:`test-results/plans-${width}.png`,fullPage:true});assert.deepEqual(errors,[]);
      console.log(`PASS account/subscription ${width}px: independent cooldowns, mocked Auth updates, role confirmation/focus, recoverable entitlement and no checkout`);
    }catch(error){await page.screenshot({path:`test-results/failure-account-subscription-${width}.png`,fullPage:true}).catch(()=>{});throw error;}
    finally{await context.close();}
  }
  // Part 18: saved formations and recurring drafts with explicit invitations.
  for(const width of [360,768,1280]){
    const {context,page,state,errors}=await setup(width);
    async function readyAction(button){
      await button.waitFor({state:"visible"});
      for(let i=0;i<200&&!(await button.isEnabled());i++)await delay(25);
      assert.equal(await button.isEnabled(),true,"action must be enabled after its pending request");await button.focus();
    }
    async function activate(button){await readyAction(button);await button.press("Enter");}
    async function confirm(button,accept){await readyAction(button);const ready=page.waitForEvent("dialog");const press=button.press("Enter");const dialog=await ready;assert.equal(dialog.type(),"confirm");if(accept)await dialog.accept();else await dialog.dismiss();await press;}
    try{
      state.savedTeamsEnabled=true;
      await page.goto(origin+"/equipes?evento="+secondId);
      const name=page.getByLabel("Nome da equipe *",{exact:true});await name.waitFor();
      await name.fill("Banda de teste");await activate(page.getByRole("button",{name:"Criar equipe",exact:true}));
      const duplicate=page.getByRole("alert").filter({hasText:"Você já possui uma equipe com esse nome"});await duplicate.waitFor();await readable(duplicate,"duplicate team notice");assert.equal(state.savedWrites.length,0);
      await name.fill("Formação acústica");await page.getByLabel("Observações (opcional)",{exact:true}).fill("Formação para eventos");
      await activate(page.getByRole("button",{name:"Criar equipe",exact:true}));
      await page.getByRole("heading",{name:"Formação acústica",exact:true}).waitFor();
      await page.getByText("Equipe vazia. Adicione músicos já convidados por sua conta.",{exact:true}).waitFor();
      assert.equal(await page.getByLabel("Equipe que deseja gerenciar",{exact:true}).inputValue(),threadB);
      await page.getByLabel("Músico já convidado *",{exact:true}).selectOption(otherUserId);
      await page.getByLabel("Instrumento na formação (opcional)",{exact:true}).fill("Cavaquinho");
      await activate(page.getByRole("button",{name:"Adicionar integrante",exact:true}));
      await page.getByText("Cavaquinho",{exact:true}).waitFor();assert.equal(state.teamWrites.length,0,"saving a formation must never invite anyone");
      await activate(page.getByRole("button",{name:"Editar",exact:true}));
      assert.equal(await page.getByRole("button",{name:"Editar",exact:true}).getAttribute("aria-expanded"),"true");
      await page.getByLabel("Nome",{exact:true}).fill("Formação de sábado");await page.getByLabel("Observações",{exact:true}).fill("Uso em eventos");
      await activate(page.getByRole("button",{name:"Salvar alteração",exact:true}));
      await page.getByRole("heading",{name:"Formação de sábado",exact:true}).waitFor();
      assert.equal(await page.getByLabel("Escolha um show seu *",{exact:true}).inputValue(),secondId);
      await page.getByLabel("Mensagem para os convidados (opcional)",{exact:true}).fill("Passagem de som às 18h");
      const invite=page.getByRole("button",{name:"Convidar equipe para este show",exact:true});await confirm(invite,false);assert.equal(state.teamWrites.length,0);
      await confirm(invite,true);await page.getByRole("status").filter({hasText:"Convites registrados para 1"}).waitFor();
      assert.equal(state.teamWrites.length,1);assert.equal(state.teamWrites[0].p_event_id,secondId);assert.equal(state.teamWrites[0].p_team_id,threadB);assert.equal(state.teamWrites[0].p_message,"Passagem de som às 18h");
      await noHorizontalOverflow(page,"saved team "+width);
      if(width===360)assert.ok(await page.getByLabel("Nome da equipe *",{exact:true}).evaluate(n=>parseFloat(getComputedStyle(n).fontSize))>=16);
      await page.screenshot({path:`test-results/saved-team-${width}.png`,fullPage:true});
      const remove=page.getByRole("button",{name:"Remover Contato profissional",exact:true});await confirm(remove,false);assert.equal(state.savedMembers[threadB].length,1);
      await confirm(remove,true);await page.getByText("Integrante removido da equipe, sem alterar os convites anteriores.",{exact:true}).waitFor();assert.equal(state.teamWrites.length,1);assert.equal(state.savedMembers[threadA].length,1);
      const del=page.getByRole("button",{name:"Excluir",exact:true});await confirm(del,false);assert.equal(state.savedTeams.length,2);
      await confirm(del,true);await page.getByText("Equipe excluída. Os convites anteriores foram preservados.",{exact:true}).waitFor();assert.equal(state.savedTeams.length,1);assert.equal(state.teamWrites.length,1);
      state.savedTeamsEnabled=false;state.recurringFail=true;
      await page.goto(origin+"/shows-recorrentes");
      await page.getByText("Programação indisponível",{exact:true}).waitFor();assert.equal(await page.getByText("Sem programação recorrente ainda",{exact:true}).count(),0);
      await activate(page.getByRole("button",{name:"Tentar novamente",exact:true}));await page.getByText("Programação indisponível",{exact:true}).waitFor();assert.deepEqual(errors,[],"failed refresh must stay handled");
      state.recurringFail=false;await activate(page.getByRole("button",{name:"Tentar novamente",exact:true}));await page.getByText("Sem programação recorrente ainda",{exact:true}).waitFor();
      await page.getByLabel("Nome do show *",{exact:true}).fill("Sextas no palco");
      await page.getByLabel("Dia da semana",{exact:true}).selectOption("5");await page.getByLabel("Horário do show",{exact:true}).fill("20:00");
      await page.getByLabel("Início do período",{exact:true}).fill("2026-11-06");await page.getByLabel("Última data da temporada",{exact:true}).fill("2026-12-25");
      await page.getByLabel("Local do show",{exact:true}).fill("Casa de teste");await page.getByLabel("Cidade",{exact:true}).fill("São Paulo");await page.getByLabel("Equipe fixa (opcional)",{exact:true}).selectOption(threadA);
      state.recurringInvalid=true;const create=page.getByRole("button",{name:"Criar e gerar primeiras datas",exact:true});await activate(create);
      await page.getByRole("alert").filter({hasText:"Revise datas, dia da semana"}).waitFor();assert.equal(state.recurringWrites.length,0);
      state.recurringInvalid=false;await activate(create);
      await page.getByRole("status").filter({hasText:"8 show(s) criado(s) como rascunho"}).waitFor();
      const series=page.getByRole("article",{name:"Programação Sextas no palco",exact:true});await series.waitFor();
      assert.equal(state.recurringSeries[0].occurrences.length,8);assert.ok(state.recurringSeries[0].occurrences.every(e=>e.status==="draft"&&e.invites_sent===0));assert.equal(state.teamWrites.length,1,"creating recurring drafts must not invite");
      const pause=series.getByRole("button",{name:"Pausar programação Sextas no palco",exact:true});await confirm(pause,false);assert.equal(state.recurringSeries[0].active,true);
      await confirm(pause,true);await series.getByText("Pausada",{exact:true}).waitFor();assert.equal(await series.getByRole("button",{name:"Gerar próximas 8",exact:true}).isDisabled(),true);assert.equal(state.recurringSeries[0].occurrences.length,8);
      await confirm(series.getByRole("button",{name:"Reativar programação Sextas no palco",exact:true}),true);await series.getByText("Ativa",{exact:true}).waitFor();
      await activate(series.getByRole("button",{name:"Gerar próximas 8",exact:true}));await page.getByRole("status").filter({hasText:"Não há novas datas disponíveis"}).waitFor();assert.equal(state.recurringSeries[0].occurrences.length,8);
      const occurrence=series.locator(".recurring-occurrence").first();const occurrenceInvite=occurrence.getByRole("button",{name:"Convidar equipe",exact:true});await confirm(occurrenceInvite,false);assert.equal(state.teamWrites.length,1);
      await confirm(occurrenceInvite,true);await page.getByRole("status").filter({hasText:"1 novo(s) convite(s) individual(is) registrado(s)"}).waitFor();
      assert.equal(state.teamWrites.length,2);assert.equal(state.teamWrites[1].p_event_id,state.recurringSeries[0].occurrences[0].event_id);assert.equal(state.recurringSeries[0].occurrences.filter(e=>e.invites_sent>0).length,1);
      const layout=await series.locator(".recurring-card-top").evaluate(n=>({available:n.clientWidth,textWidth:n.firstElementChild.getBoundingClientRect().width}));assert.ok(layout.textWidth>=Math.min(160,layout.available)-1,"recurring heading must stay readable");
      assert.ok(await series.getByRole("button",{name:"Pausar programação Sextas no palco",exact:true}).evaluate(n=>n.getBoundingClientRect().height)>=44);
      await noHorizontalOverflow(page,"recurring season "+width);await page.screenshot({path:`test-results/recurring-season-${width}.png`,fullPage:true});
      assert.deepEqual(errors,[]);console.log(`PASS saved teams/recurring ${width}px: duplicate/create/edit/member removal, explicit invites, handled read retry, private drafts and pause preservation`);
    }catch(error){await page.screenshot({path:`test-results/failure-recurring-${width}.png`,fullPage:true}).catch(()=>{});throw error;}
    finally{await context.close();}
  }
  // Part 17: private summary, sent-invite filters and audited lineup presentation.
  for(const width of [360,768,1280]) {
    const {context,page,state,errors}=await setup(width);
    async function confirm(button,accept){
      await button.focus();const dialogReady=page.waitForEvent("dialog");const activation=button.press("Enter");
      const dialog=await dialogReady;assert.equal(dialog.type(),"confirm");
      if(accept)await dialog.accept();else await dialog.dismiss();await activation;
    }
    try{
      state.detailedSummary=true;
      await page.goto(origin+"/eventos");
      const card=page.locator("#stage-event-"+firstId);
      await card.getByRole("button",{name:"Equipe, convites e financeiro",exact:true}).click();
      const summary=card.getByRole("region",{name:"Resumo financeiro privado deste show",exact:true});
      await summary.locator(".event-financial-total strong").waitFor();
      const summaryHeading=await summary.locator(".event-financial-heading").evaluate(n=>({available:n.clientWidth,textWidth:n.firstElementChild.getBoundingClientRect().width}));
      assert.ok(summaryHeading.textWidth>=Math.min(180,summaryHeading.available)-1,"summary heading must wrap the refresh action instead of squeezing text into a narrow column");
      assert.match(await summary.locator(".event-financial-total strong").innerText(),/R\$\s*500,00/);
      const breakdown=summary.getByRole("button",{name:/Ver cachês por músico/});await breakdown.focus();await breakdown.press("Enter");
      const rows=summary.locator(".event-financial-row");assert.equal(await rows.count(),4);
      assert.equal(await rows.filter({hasText:"Valor indefinido"}).getByText("A definir",{exact:true}).count(),1);
      assert.equal(await rows.filter({hasText:"Convite inativo"}).getByText("Não computado",{exact:true}).count(),1);
      assert.ok(!/9\.000/.test(await summary.innerText()));
      await noHorizontalOverflow(page,"fee summary "+width);await summary.screenshot({path:`test-results/fee-summary-${width}.png`});
      state.detailedInvites=true;
      await page.goto(origin+"/convites?evento="+secondId);
      const sent=page.getByRole("region",{name:"Convites enviados",exact:true});
      await sent.getByText("Músico autorizado",{exact:true}).waitFor();
      assert.equal(await sent.locator("article").count(),3);
      const permitted=sent.getByRole("link",{name:"Enviar lembrete",exact:true});assert.ok((await permitted.getAttribute("href")).startsWith("https://wa.me/5511999999999?text="));
      assert.equal(await sent.getByRole("button",{name:"Enviar lembrete",exact:true}).isDisabled(),true);
      const unused=sent.getByRole("button",{name:"Links não utilizados",exact:true});await unused.focus();await unused.press("Enter");
      assert.equal(await unused.getAttribute("aria-pressed"),"true");assert.equal(await sent.locator("article").count(),1);
      await sent.getByLabel("Acompanhar qual show?",{exact:true}).selectOption(firstId);
      await sent.getByText("Nenhum convite nesta categoria.",{exact:true}).waitFor();
      await sent.getByLabel("Acompanhar qual show?",{exact:true}).selectOption(secondId);
      const all=sent.getByRole("button",{name:"Todos",exact:true});await all.focus();await all.press("Enter");
      assert.equal(await sent.locator("article").count(),3);
      await noHorizontalOverflow(page,"sent invites "+width);await sent.screenshot({path:`test-results/sent-invites-${width}.png`});
      if(width===360){state.failSentDetails=true;const reload=sent.getByRole("button",{name:"Atualizar respostas",exact:true});await reload.focus();await reload.press("Enter");
        const readError=sent.getByRole("alert");await readError.waitFor();await readable(readError,"sent-invite read error");assert.equal(await sent.locator("article").count(),0);state.failSentDetails=false;}
      await page.goto(origin+"/eventos/equipe?evento="+secondId);
      await page.getByRole("heading",{name:"Escala de teste",exact:true}).waitFor();
      await page.getByLabel("Adicionar uma posição",{exact:true}).fill("Percussão");
      const add=page.getByRole("button",{name:"Adicionar vaga",exact:true});await add.focus();await add.press("Enter");
      await page.getByRole("article",{name:"Vaga Percussão",exact:true}).waitFor();assert.equal(state.lineupWrites.filter(x=>x.kind==="invite").length,0);
      const bass=page.getByRole("article",{name:"Vaga Baixo",exact:true});
      await bass.getByLabel("Escolher músico",{exact:true}).selectOption(otherUserId);
      await bass.getByLabel("Mensagem do convite (opcional)",{exact:true}).fill("Confirma o horário?");
      const invite=bass.getByRole("button",{name:"Convidar músico",exact:true});await confirm(invite,false);assert.equal(state.lineupWrites.filter(x=>x.kind==="invite").length,0);
      await confirm(invite,true);await bass.getByText("Aguardando resposta",{exact:true}).waitFor();
      assert.equal(state.lineupWrites.filter(x=>x.kind==="invite").length,1);
      assert.equal(state.lineupWrites.find(x=>x.kind==="invite").p_message,"Confirma o horário?");
      const drums=page.getByRole("article",{name:"Vaga Bateria",exact:true});
      const releaseToggle=drums.getByRole("button",{name:"Liberar vaga / substituir músico",exact:true});await releaseToggle.focus();await releaseToggle.press("Enter");
      const reason=drums.getByLabel("Motivo da substituição",{exact:true});await reason.fill("curt");
      const release=drums.getByRole("button",{name:"Cancelar participação e abrir vaga",exact:true});assert.equal(await release.isDisabled(),true);
      await reason.fill("Músico não poderá comparecer");await confirm(release,false);assert.equal(state.lineupWrites.filter(x=>x.kind==="release").length,0);
      await confirm(release,true);await page.getByRole("status").filter({hasText:"Participação cancelada e liberada"}).waitFor();
      assert.equal(state.lineupWrites.filter(x=>x.kind==="release").length,1);
      await drums.locator("summary").click();await drums.getByText(/Músico não poderá comparecer/).waitFor();
      await noHorizontalOverflow(page,"lineup "+width);await page.screenshot({path:`test-results/lineup-${width}.png`,fullPage:true});
      state.lineupClosed=true;await page.reload();await page.getByText(/Este show já passou ou está encerrado/).waitFor();
      assert.equal(await page.getByRole("button",{name:"Adicionar vaga",exact:true}).isDisabled(),true);
      assert.equal(await page.getByRole("button",{name:"Convidar músico",exact:true}).count(),0);
      assert.deepEqual(errors,[]);console.log(`PASS lineup/summary/invites ${width}px: unknown/inactive fees, filters, authorized reminder link, slot creation, explicit invite/release and closed-show guards`);
    }catch(error){await page.screenshot({path:`test-results/failure-lineup-${width}.png`,fullPage:true}).catch(()=>{});throw error;}
    finally{await context.close();}
  }
  for(const width of [360,768,1280]) {
    const {context,page,state,errors}=await setup(width);
    let releaseMessages,releaseProposals;
    const choose=async(name)=>{
      if(width<=750&&await page.locator(".hiring-layout.has-active").count())
        await page.getByRole("button",{name:"Todas as conversas",exact:true}).click();
      await page.getByRole("button",{name:"Abrir conversa com "+name,exact:true}).click();
    };
    try{
      state.showProposal=true;state.guestStartsAt="2026-12-02T23:00:00Z";
      state.failChatPreferences=width===360;
      state.proposalDelay=new Promise(resolve=>{releaseProposals=resolve;});
      await page.goto(origin+"/conversas");
      await choose("Contratante A");
      await page.locator(".hiring-messages").getByText("Mensagem privada A",{exact:true}).waitFor();
      assert.equal(state.reads.get(userId+":stage_hiring_messages"),1,"initial thread must load messages only once");
      await page.getByLabel("Sua mensagem",{exact:true}).fill("Rascunho exclusivo A");
      state.messageDelay=new Promise(resolve=>{releaseMessages=resolve;});
      await page.getByRole("button",{name:"Atualizar mensagens",exact:true}).click();
      await until(()=>state.delayedMessagesStarted===1);
      await choose("Contratante B");
      await page.locator(".hiring-messages").getByText("Mensagem privada B",{exact:true}).waitFor();
      assert.equal(await page.getByLabel("Sua mensagem",{exact:true}).inputValue(),"");
      await page.getByLabel("Sua mensagem",{exact:true}).fill("Rascunho exclusivo B");
      releaseMessages();await until(()=>state.delayedMessagesCompleted===1);state.messageDelay=null;
      releaseProposals();await until(()=>state.proposalCompleted===1);state.proposalDelay=null;
      await delay(100);
      assert.equal(await page.locator(".hiring-messages").getByText("Mensagem privada A",{exact:true}).count(),0);
      assert.equal(await page.getByText("Proposta de show de teste",{exact:true}).count(),0);
      await choose("Contratante A");
      await page.locator(".hiring-messages").getByText("Mensagem privada A",{exact:true}).waitFor();
      assert.equal(await page.getByLabel("Sua mensagem",{exact:true}).inputValue(),"Rascunho exclusivo A");
      state.failMessageId=threadB;
      await choose("Contratante B");
      await page.locator(".hiring-messages").getByRole("alert").waitFor();
      assert.equal(await page.locator(".hiring-messages").getByText("Mensagem privada A",{exact:true}).count(),0);
      state.failMessageId=null;
      await page.locator(".hiring-messages").getByRole("button",{name:"Tentar novamente",exact:true}).click();
      await page.locator(".hiring-messages").getByText("Mensagem privada B",{exact:true}).waitFor();
      assert.equal(await page.getByLabel("Sua mensagem",{exact:true}).inputValue(),"Rascunho exclusivo B");
      assert.equal(new URL(page.url()).searchParams.get("conversa"),threadB);
      await page.getByRole("button",{name:"Enviar",exact:true}).click();
      await page.locator(".hiring-messages").getByText("Rascunho exclusivo B",{exact:true}).waitFor();
      assert.deepEqual(state.sent,[{p_thread_id:threadB,p_body:"Rascunho exclusivo B"}]);
      await noHorizontalOverflow(page,"booking "+width);
      if(width===360){
       // Simula um viewport visual curto enquanto o campo de mensagem recebe foco.
       await page.setViewportSize({width:375,height:520});
       const input=page.getByLabel("Sua mensagem",{exact:true});
       await input.focus();
       await page.waitForTimeout(80);
       const layout=await page.locator(".hiring-composer").evaluate(el=>{
        const send=el.querySelector('button[type="submit"]')?.getBoundingClientRect();
        const panel=el.closest(".hiring-layout").getBoundingClientRect();
        const nav=document.querySelector(".sf-workspace-bottom-nav");
        const field=el.querySelector("textarea").getBoundingClientRect();
        return {sendBottom:send?.bottom,fieldTop:field.top,fieldBottom:field.bottom,
         navTop:nav?.getBoundingClientRect().top,panelBottom:panel.bottom,viewport:innerHeight,
         nav:nav?getComputedStyle(nav).display:null,
         textSize:parseFloat(getComputedStyle(el.querySelector("textarea")).fontSize),
         overflow:document.documentElement.scrollWidth-innerWidth};
       });
       assert.notEqual(layout.nav,"none","Global bottom navigation remains visible while typing");
       assert.ok(typeof layout.navTop === "number" && layout.fieldTop>=-2 &&
        Math.max(layout.fieldBottom,layout.sendBottom)<=Math.min(layout.viewport,layout.navTop)+2,
        "Message field and Send button must stay above global navigation: "+JSON.stringify(layout));
       assert.ok(layout.textSize>=16,"Chat text field should avoid iPhone zoom");
       assert.ok(layout.sendBottom<=layout.panelBottom+2,
        "Send button must remain inside the message panel: "+JSON.stringify(layout));
       assert.ok(layout.overflow<=2,"Chat must not overflow at 375x520: "+JSON.stringify(layout));
       await page.screenshot({path:"test-results/mobile-chat-keyboard-375.png",fullPage:false});
       await input.blur();await page.setViewportSize({width:360,height:900});
      }
      assert.ok(await page.locator(".hiring-composer").evaluate(form=>{
        const panel=form.closest(".hiring-layout").getBoundingClientRect();
        const send=form.querySelector('button[type="submit"]').getBoundingClientRect();
        return send.bottom<=panel.bottom+1;
      }),"message composer must not be clipped by the panel at "+width+"px");
      await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:`test-results/booking-${width}.png`,fullPage:true});
      await choose("Contratante A");
      state.proposalReadFail=true;
      await page.getByRole("button",{name:"Atualizar propostas",exact:true}).click();
      await page.locator(".hiring-proposals").getByRole("alert").waitFor();
      assert.equal(await page.getByText("Ainda não há proposta formal nesta conversa.",{exact:true}).count(),0);
      state.proposalReadFail=false;
      await page.getByRole("button",{name:"Atualizar propostas",exact:true}).click();
      page.once("dialog",dialog=>void dialog.accept());
      await page.getByRole("button",{name:"Aceitar proposta",exact:true}).click();
      await page.getByRole("link",{name:"Ver show na agenda",exact:true}).click();
      await page.waitForURL(origin+"/eventos?evento="+guestId);
      const target=page.locator("#stage-event-"+guestId);
      await target.getByText("Show selecionado",{exact:true}).waitFor();
      assert.equal(await target.getByRole("button",{name:/Excluir/}).count(),0);
      assert.equal(await target.count(),1);
      if(width===360){
        const messageReads=state.reads.get(userId+":stage_hiring_messages");
        await page.goto(origin+"/conversas?conversa="+otherEventId);
        await page.getByRole("alert").filter({hasText:"Conversa não encontrada nesta conta"}).waitFor();
        assert.equal(state.reads.get(userId+":stage_hiring_messages"),messageReads,"unowned deep link must not query messages");
        state.failInvites=true;
        await page.goto(origin+"/meus-convites");
        await page.getByRole("alert").filter({hasText:"Não foi possível carregar os convites"}).waitFor();
        assert.equal(await page.getByText("Nenhum convite por enquanto",{exact:true}).count(),0);
        state.failInvites=false;
        await page.getByRole("button",{name:"Tentar carregar convites novamente",exact:true}).click();
        await page.getByRole("link",{name:"Ver show na minha agenda",exact:true}).waitFor();
      }
      assert.deepEqual(errors,[],"booking browser errors");
      console.log(`PASS booking ${width}px: thread response/draft isolation, retry/send, private deep links, accepted proposal to selected participation in another month`);
    }catch(error){await page.screenshot({path:`test-results/failure-booking-${width}.png`,fullPage:true}).catch(()=>{});throw error;}
    finally{releaseMessages?.();releaseProposals?.();await context.close();}
  }
  {
    const {context,page,state,errors}=await setup(360);
    let releasePrefill,releaseSchedule;
    try{
      state.asRequester=true;
      state.prefillDelay=new Promise(resolve=>{releasePrefill=resolve;});
      await page.goto(origin+"/conversas?conversa="+threadA);
      await page.getByRole("button",{name:"Montar proposta",exact:true}).click();
      await page.getByLabel("Nome da apresentação *",{exact:true}).fill("Meu rascunho preservado");
      await until(()=>state.prefillStarted===1);releasePrefill();await until(()=>state.prefillCompleted===1);await delay(100);
      assert.equal(await page.getByLabel("Nome da apresentação *",{exact:true}).inputValue(),"Meu rascunho preservado");
      state.scheduleDelay=new Promise(resolve=>{releaseSchedule=resolve;});
      await page.getByRole("button",{name:"Verificar conflito antes de enviar",exact:true}).click();
      await until(()=>state.scheduleCalls.length===1);
      await page.getByLabel("Data e horário *",{exact:true}).fill("2026-12-02T20:00");
      releaseSchedule();state.scheduleDelay=null;await delay(100);
      assert.equal(await page.getByText("Sem conflito registrado — confirme com o músico",{exact:true}).count(),0);
      await page.getByRole("button",{name:"Verificar conflito antes de enviar",exact:true}).click();
      await page.getByText("Sem conflito registrado — confirme com o músico",{exact:true}).waitFor();
      assert.equal(state.scheduleCalls.at(-1).p_start,"2026-12-02T23:00:00.000Z");
      await noHorizontalOverflow(page,"formal proposal form 360");
      await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:"test-results/proposal-form-360.png",fullPage:true});
      await page.getByRole("button",{name:"Enviar proposta",exact:true}).click();
      await page.locator(".hiring-proposals").getByRole("alert").filter({hasText:"compromisso confirmado"}).waitFor();
      assert.equal(await page.getByLabel("Nome da apresentação *",{exact:true}).inputValue(),"Meu rascunho preservado");
      state.sendResult="ok";
      await page.getByRole("button",{name:"Enviar proposta",exact:true}).click();
      await page.getByText("Proposta enviada. O show só entrará na agenda após o músico aceitar.",{exact:true}).waitFor();
      assert.equal(state.proposalWrites.length,2);assert.equal(state.proposalWrites.at(-1).p_fee,null);
      page.once("dialog",dialog=>void dialog.accept());
      await page.getByRole("button",{name:"Retirar proposta",exact:true}).click();
      await page.getByText("Proposta retirada. Você pode enviar outra com novos detalhes.",{exact:true}).waitFor();
      await page.getByText("Retirada",{exact:true}).waitFor();
      await noHorizontalOverflow(page,"formal proposal editor 360");
      await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:"test-results/proposal-editor-360.png",fullPage:true});
      assert.deepEqual(errors,[]);
      console.log("PASS proposal editor 360px: late prefill preserves draft, stale schedule discarded, conflict recovery, unknown fee and withdrawal");
    }catch(error){await page.screenshot({path:"test-results/failure-proposal-editor.png",fullPage:true}).catch(()=>{});throw error;}
    finally{releasePrefill?.();releaseSchedule?.();await context.close();}
  }
  {
    const {context,page,state,errors}=await setup(360);
    try{
      state.bulkHistory=true;
      await page.goto(origin+"/conversas?conversa="+bulkIds.at(-1));
      await page.getByRole("heading",{name:"Histórico 78",exact:true}).waitFor();
      await page.getByRole("button",{name:"Todas as conversas",exact:true}).click();
      assert.equal(await page.locator(".hiring-thread").count(),20);
      await page.getByText(/A consulta atingiu o limite de conversas recentes/).waitFor();
      for(const count of [40,60,80]){
        await page.getByRole("button",{name:/Mostrar mais conversas recebidas/}).click();
        assert.equal(await page.locator(".hiring-thread").count(),count);
      }
      assert.equal(await page.getByRole("button",{name:/Mostrar mais conversas recebidas/}).count(),0);
      await page.getByRole("button",{name:"Abrir conversa com Histórico 78",exact:true}).click();
      await page.locator(".hiring-messages").getByText("Mensagem histórica 199",{exact:true}).waitFor();
      assert.equal(await page.locator(".hiring-bubble").count(),50);
      await page.getByText(/A consulta atingiu o limite de mensagens recentes/).waitFor();
      const reads=state.reads.get(userId+":stage_hiring_messages");
      for(const count of [100,150,200]){
        await page.getByRole("button",{name:/Mostrar mensagens anteriores recebidas/}).click();
        assert.equal(await page.locator(".hiring-bubble").count(),count);
      }
      assert.equal(state.reads.get(userId+":stage_hiring_messages"),reads,"expanding received data must not pretend to request another server page");
      assert.equal(await page.getByRole("button",{name:/Mostrar mensagens anteriores recebidas/}).count(),0);
      await noHorizontalOverflow(page,"bounded history 360");
      await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:"test-results/history-limits-360.png",fullPage:true});
      await page.getByRole("button",{name:"Todas as conversas",exact:true}).click();
      await page.getByRole("button",{name:"Abrir conversa com Contratante B",exact:true}).click();
      await page.locator(".hiring-messages").getByText("Mensagem histórica 199",{exact:true}).waitFor();
      assert.equal(await page.locator(".hiring-bubble").count(),50,"another thread starts with its own recent window");
      const oldReads=state.reads.get(userId+":stage_hiring_messages");
      await page.goto(origin+"/conversas?conversa="+otherEventId);
      await page.getByRole("alert").filter({hasText:"não está na lista recente disponível"}).waitFor();
      assert.equal(state.reads.get(userId+":stage_hiring_messages"),oldReads);
      assert.deepEqual(errors,[]);
      console.log("PASS recent history 360px: bounded rendering, all received rows reachable, explicit 80/200 limits, window reset and unavailable deep-link semantics");
    }catch(error){await page.screenshot({path:"test-results/failure-history.png",fullPage:true}).catch(()=>{});throw error;}
    finally{await context.close();}
  }
  const { context, page, state, errors } = await setup(360);
  let releaseFinance;
  try {
    state.adminA = true;
    const reads = (id, name) => state.reads.get(id + ":" + name) ?? 0;
    await page.goto(origin + "/financeiro");
    await page.getByRole("region", { name: "Resumo financeiro" }).waitFor();
    await page.getByRole("link", { name: "Abrir agenda", exact: true }).click();
    await page.locator(".agenda-event-list").first().waitFor();
    await page.getByRole("link", { name: "Voltar ao painel", exact: true }).click();
    await page.getByRole("heading", { name: /^(Bom dia|Boa tarde|Boa noite), Teste/ }).waitFor();
    // A barra inferior foca Inicio, Agenda, Chats, Explorar e Conta.
    // Financeiro permanece disponivel no menu completo do celular.
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("navigation", { name: "Navegação do StageFlow" })
      .getByRole("link", { name: "Financeiro", exact: true }).click();
    await page.getByRole("region", { name: "Resumo financeiro" }).waitFor();
    for (const name of ["profiles", "stage_owner_admin_status", "stage_venue_partner_access"])
      assert.equal(reads(userId, name), 1, name + " should be shared across client navigation");
    assert.ok(await page.locator('a[href="/admin/central"]').count() > 0);
    await page.getByRole("button", { name: "Editar financeiro e pagamentos", exact: true }).first().click();
    await page.getByLabel("Valor pago a Equipe A", { exact: true }).fill("123,45");
    state.financeDelay = new Promise(resolve => { releaseFinance = resolve; });
    await page.locator(".finance-toolbar").getByRole("button", { name: "Atualizar", exact: true }).click();
    await until(() => state.delayedFinanceStarted === 1);

    // Same storage key and payload as Supabase Auth's real cross-tab BroadcastChannel.
    // The message only invalidates; getUser must then verify the new cookie's identity.
    const otherTab = await context.newPage();
    await otherTab.goto(origin + "/marketplace");
    const nextSession = sessionFor(otherUserId);
    await context.addCookies([{ name: "sb-example-auth-token", value: "base64-" + encoded(nextSession), url: origin, sameSite: "Lax" }]);
    await otherTab.evaluate(value => {
      const channel = new BroadcastChannel("sb-example-auth-token");
      channel.postMessage({ event: "SIGNED_IN", session: value });channel.close();
    }, nextSession);
    await page.getByText("Show exclusivo da conta B", { exact: true }).waitFor();
    assert.equal(await page.locator(".finance-event-detail").count(), 0, "old expanded form must be cleared");
    assert.equal(await page.locator('a[href="/admin/central"]').count(), 0, "old admin presentation must be cleared");
    releaseFinance();
    await until(() => state.delayedFinanceCompleted === 1);
    await delay(150);
    assert.equal(await page.getByText(initialEvents()[0].title, { exact: true }).count(), 0);
    assert.equal(await page.getByText("Show exclusivo da conta B", { exact: true }).count(), 1);
    assert.equal(reads(otherUserId, "profiles"), 1);
    await page.getByRole("button", { name: "Editar financeiro e pagamentos", exact: true }).click();
    assert.equal(await page.getByLabel("Valor pago a Equipe B", { exact: true }).inputValue(), "0,00");
    await noHorizontalOverflow(page, "account switch 360");
    await page.screenshot({ path: "test-results/account-switch-360.png", fullPage: true });

    await context.clearCookies();
    await otherTab.evaluate(() => {
      const channel = new BroadcastChannel("sb-example-auth-token");
      channel.postMessage({ event: "SIGNED_OUT", session: null });channel.close();
    });
    await page.waitForURL(origin + "/login");
    await page.getByLabel("E-mail", { exact: true }).waitFor();
    assert.equal(await page.locator(".finance-event").count(), 0);
    const privateReads = [...state.reads].filter(([key]) => /:(profiles|stage_owner_admin_status|stage_venue_partner_access)$/.test(key));
    await page.goto(origin + "/marketplace");
    await page.getByText("MARKETPLACE ABERTO", { exact: true }).waitFor();
    await page.getByRole("link", { name: /Preparar meu portfólio/ }).waitFor();
    assert.deepEqual([...state.reads].filter(([key]) => /:(profiles|stage_owner_admin_status|stage_venue_partner_access)$/.test(key)), privateReads,
      "public marketplace must not query private account data");
    assert.deepEqual(errors, [], "account scenario browser errors");
    console.log("PASS shared account: one profile/permission read across SPA navigation, cross-tab identity/logout, stale finance response and draft isolation, public marketplace without private queries");
  } catch (error) {
    await page.screenshot({ path: "test-results/failure-account.png", fullPage: true }).catch(() => {});
    throw error;
  } finally { releaseFinance?.();await context.close(); }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await writeFile("test-results/server.log", serverLog);
}
