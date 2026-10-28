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
    bulkHistory:false, reads: new Map(), adminA: false, financeDelay: null, delayedFinanceStarted: 0, delayedFinanceCompleted: 0,
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
    } else if (rpc === "stage_my_event_budget") result = { event_id: body.p_event_id, client_fee: 3000, received_amount: 1500, to_receive: 1500, expenses_total: 100, expenses_paid_total: 50, expenses_unpaid_total: 50, expenses: [], musician_agreed_total: 800, musician_unpriced_count: 0, projected_partial_result: 2100 };
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
    await page.getByRole("heading", { name: "Olá, Teste!", exact: true }).waitFor();
    await page.getByRole("link", { name: "Ver financeiro", exact: true }).first().click();
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
    await page.getByText("Em breve", { exact: true }).waitFor();
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
