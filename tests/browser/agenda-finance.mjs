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
  const limit = Number(url.searchParams.get("limit") ?? result.length);
  return result.slice(0, limit);
}
const guest = { event_id: guestId, title: "Participação aceita de teste", venue: "Palco de teste", city: "São Paulo", starts_at: "2026-11-02T23:00:00Z", ends_at: null, event_status: "published", organizer_name: "Organizador de teste" };

async function setup(width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: "America/Sao_Paulo" });
  await context.addCookies([{ name: "sb-example-auth-token", value: "base64-" + encoded(session), url: origin, sameSite: "Lax" }]);
  const state = { events: [...initialEvents(), ...moreEvents(), { ...initialEvents()[1], id: "77777777-7777-4777-8777-777777777777", title: "Show de dezembro", starts_at: "2026-12-02T23:00:00Z" }], accepted: false, failAgenda: false, failFinance: false, invalidFinance: false, writes: [],
    reads: new Map(), adminA: false, financeDelay: null, delayedFinanceStarted: 0, delayedFinanceCompleted: 0 };
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
    else if (rpc === "stage_accepted_shows") result = filtered(state.accepted ? [guest] : [],url);
    else if (rpc === "stage_finance_organizer_overview") {
      const pending = actor === userId ? state.financeDelay : null;
      if (pending) { state.delayedFinanceStarted++;await pending;state.delayedFinanceCompleted++; }
      if (state.failFinance) { status = 503; result = { message: "Fixture unavailable" }; }
      else result = (actor === otherUserId ? [{ ...initialEvents()[1], id: otherEventId, title: "Show exclusivo da conta B" }] : initialEvents()).map(event => ({ event_id: event.id, title: event.title, starts_at: event.starts_at, event_status: event.status, gross_revenue: state.invalidFinance ? "invalid" : 3000, received: 1500, expense_total: 100, expense_paid: 50, musician_agreed: 800, musician_paid: 400, musician_unpriced: 0, transport_total: 100 }));
    } else if (rpc === "stage_finance_event_team") {
      await delay(body.p_event_id === firstId ? 350 : 20);
      result = { status: "ok", items: [{ invitation_id: invitationId, musician_name: body.p_event_id === firstId ? "Equipe A" : "Equipe B", fee: 400, paid_amount: 0 }] };
    } else if (rpc === "stage_my_event_budget") result = { event_id: body.p_event_id, client_fee: 3000, received_amount: 1500, to_receive: 1500, expenses_total: 100, expenses_paid_total: 50, expenses_unpaid_total: 50, expenses: [], musician_agreed_total: 800, musician_unpriced_count: 0, projected_partial_result: 2100 };
    else if (rpc === "stage_my_invitations") result = [{ id: invitationId, status: state.accepted ? "accepted" : "pending", message: null, created_at: "2026-10-27T12:00:00Z", responded_at: null, event_id: guestId, event_title: guest.title, event_starts_at: guest.starts_at, event_venue: guest.venue, event_city: guest.city, organizer_name: guest.organizer_name }];
    else if (rpc === "stage_respond_invite") { assert.equal(body.p_invitation_id, invitationId); state.accepted = body.p_accept; result = state.accepted ? "accepted" : "declined"; }
    else if (rpc === "stage_fee_details") result = null;
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
        await page.goto(origin + "/eventos");
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
      assert.deepEqual(errors, [], "browser console errors");
      console.log(`PASS ${width}px: month/cursor pagination, deep links, agenda creation, financial totals/CSV download, data-error recovery and team response isolation`);
    } catch (error) {
      await page.screenshot({ path: `test-results/failure-${width}.png`, fullPage: true }).catch(() => {});
      throw error;
    } finally { await context.close(); }
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
