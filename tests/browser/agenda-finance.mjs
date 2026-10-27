// Local browser regression. Every Supabase response is a synthetic fixture.
// Does not authenticate real users, send notifications or access a remote database.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
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
const otherId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const firstId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
const guestId = "33333333-3333-4333-8333-333333333333";
const invitationId = "44444444-4444-4444-8444-444444444444";
const user = { id: userId, aud: "authenticated", role: "authenticated", email: "musician@example.test", created_at: "2026-01-01T00:00:00Z", app_metadata: {}, user_metadata: {} };
const encoded = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = encoded({ alg: "HS256", typ: "JWT" }) + "." + encoded({ sub: userId, role: "authenticated", exp: 4102444800 }) + ".fixture";
const session = { access_token: token, refresh_token: "fixture-refresh", token_type: "bearer", expires_in: 3600, expires_at: 4102444800, user };
const initialEvents = () => [firstId, secondId].map((id, index) => ({ id, title: index ? "Segundo show" : "ShowComNomeMuitoLongoSemEspaços".repeat(4), description: "Detalhes do show de teste", venue: "Local de teste", city: "São Paulo", starts_at: "2026-11-01T23:00:00Z", ends_at: null, status: "draft", show_publicly: false }));
const guest = { event_id: guestId, title: "Participação aceita de teste", venue: "Palco de teste", city: "São Paulo", starts_at: "2026-11-02T23:00:00Z", ends_at: null, event_status: "published", organizer_name: "Organizador de teste" };

async function setup(width) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await context.addCookies([{ name: "sb-example-auth-token", value: "base64-" + encoded(session), url: origin, sameSite: "Lax" }]);
  const state = { events: initialEvents(), accepted: false, failAgenda: false, failFinance: false, writes: [] };
  await context.route(api + "/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.postDataJSON();
    let result = [], status = 200;
    const rpc = url.pathname.split("/").at(-1);
    if (url.pathname === "/auth/v1/user") result = user;
    else if (url.pathname.endsWith("/profiles")) result = { id: userId, display_name: "Teste", is_singer: false, is_musician: true, is_producer: true, is_artist: false };
    else if (url.pathname.endsWith("/events")) {
      if (request.method() === "POST") {
        assert.equal(body.producer_id, userId);
        state.writes.push(body);
        state.events.push({ ...body, id: "55555555-5555-4555-8555-555555555555" });
        result = null;
      } else if (request.method() === "DELETE") {
        assert.equal(url.searchParams.get("producer_id"), "eq." + userId);
        const id = url.searchParams.get("id").slice(3);
        state.events = state.events.filter(event => event.id !== id);
        result = { id };
      } else if (state.failAgenda) { status = 503; result = { code: "unavailable", message: "Fixture unavailable" }; }
      else result = state.events;
    } else if (rpc === "stage_venue_partner_access") result = { status: "ok", items: [] };
    else if (rpc === "stage_owner_admin_status") result = false;
    else if (rpc === "stage_accepted_shows") result = state.accepted ? [guest] : [];
    else if (rpc === "stage_finance_organizer_overview") {
      if (state.failFinance) { status = 503; result = { message: "Fixture unavailable" }; }
      else result = initialEvents().map(event => ({ event_id: event.id, title: event.title, starts_at: event.starts_at, event_status: event.status, gross_revenue: 3000, received: 1500, expense_total: 100, expense_paid: 50, musician_agreed: 800, musician_paid: 400, musician_unpriced: 0, transport_total: 100 }));
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
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  return { context, page, state, errors };
}
async function noHorizontalOverflow(page, label) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), label + " overflows horizontally");
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
      assert.equal(state.events.length, 3);
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
      await page.getByRole("button", { name: "Editar financeiro e pagamentos", exact: true }).first().click();
      await page.getByRole("button", { name: "Editar financeiro e pagamentos", exact: true }).last().click();
      await page.getByText("Equipe B", { exact: true }).waitFor();
      await delay(450);
      assert.equal(await page.getByText("Equipe A", { exact: true }).count(), 0);
      await noHorizontalOverflow(page, "finance editor " + width);
      await page.screenshot({ path: `test-results/finance-${width}.png`, fullPage: true });
      if (width === 360) {
        await page.goto(origin + "/meus-convites");
        await page.getByRole("button", { name: /Aceitar/ }).first().click();
        await page.getByText(/Presença confirmada!/).waitFor();
        await page.goto(origin + "/eventos");
        await page.getByText(guest.title, { exact: true }).waitFor();
        state.failAgenda = true;
        await page.reload();
        await page.getByRole("alert").filter({ hasText: "Não foi possível carregar seus shows" }).waitFor();
        assert.equal(await page.getByText("Sua agenda começa aqui", { exact: true }).count(), 0);
        state.failFinance = true;
        await page.goto(origin + "/financeiro");
        await page.getByText("Financeiro indisponível", { exact: true }).waitFor();
        assert.equal(await page.locator('section[aria-label="Resumo financeiro"]').count(), 0);
      }
      assert.deepEqual(errors, [], "browser console errors");
      console.log(`PASS ${width}px: agenda, creation validation, delete cancellation, finance filters and team response isolation`);
    } catch (error) {
      await page.screenshot({ path: `test-results/failure-${width}.png`, fullPage: true }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await writeFile("test-results/server.log", serverLog);
}
