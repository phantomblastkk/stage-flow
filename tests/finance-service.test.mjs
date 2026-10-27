import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
const source = readFileSync(new URL("../src/domains/billing/services/finance-service.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { loadFinance, loadFinanceTeam, saveMusicianPayment, FinanceSessionRequired } =
  await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const basicProfile = { is_artist: false, artist_kind: null, username: null };
function fixture(overrides = {}, auth = { data: { user: { id } }, error: null }) {
  const calls = [];
  const db = createClient("https://example.supabase.co", "test-only-not-a-secret", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, options) => {
      const name = new URL(url).pathname.split("/").at(-1);
      calls.push({ name, url: new URL(url), method: options.method, body: options.body ? JSON.parse(options.body) : null });
      const defaults = { profiles: basicProfile, stage_finance_organizer_overview: [], stage_my_show_history: [], stage_my_pro_site_publication: { entitled: false }, stage_finance_event_team: { status: "ok", items: [] }, stage_finance_save_musician_payment: "saved" };
      const response = Object.hasOwn(overrides, name) ? overrides[name] : defaults[name];
      const data = typeof response === "function" ? await response() : response;
      return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
    } },
  });
  return { calls, db: { auth: { getUser: async () => auth }, from: db.from.bind(db), rpc: db.rpc.bind(db) } };
}

test("finance reads private RPC snapshots and the validated owner's profile; participation history stays separate", async () => {
  const own = { event_id: "show", received: 100 }, guest = { kind: "participation", record_id: "invite", personal_fee: 400 };
  const { db, calls } = fixture({ stage_finance_organizer_overview: [own], stage_my_show_history: [{ kind: "organized" }, guest] });
  const result = await loadFinance(db, new AbortController().signal);
  assert.deepEqual(result.organized, [own]);
  assert.deepEqual(result.participations, [guest]);
  assert.equal(result.coverageLimited, false);
  assert.equal(calls.find(call => call.name === "profiles").url.searchParams.get("id"), "eq." + id);
  assert.equal(calls.length, 3);
  assert.ok(calls.every(call => !call.url.searchParams.has("limit")), "a paginated JSON snapshot must not be mistaken for a financial total");
});

test("singer reports require explicit server entitlement, and a failed profile cannot unlock them", async () => {
  for (const entitled of [false, true]) {
    const { db, calls } = fixture({ profiles: { is_artist: true, artist_kind: "lead", username: "cantor" }, stage_my_pro_site_publication: { entitled } });
    const result = await loadFinance(db, new AbortController().signal);
    assert.equal(result.reportAccess, entitled);
    assert.equal(calls.at(-1).name, "stage_my_pro_site_publication");
  }
  const missing = fixture({ profiles: null });
  await assert.rejects(loadFinance(missing.db, new AbortController().signal), /perfil financeiro/);
});

test("the known 400/300 RPC boundaries are reported instead of presented as complete history", async () => {
  for (const [own, guest, limited] of [[399, 299, false], [400, 0, true], [0, 300, true]]) {
    const { db } = fixture({ stage_finance_organizer_overview: Array.from({ length: own }, () => ({})), stage_my_show_history: Array.from({ length: guest }, () => ({ kind: "participation" })) });
    assert.equal((await loadFinance(db, new AbortController().signal)).coverageLimited, limited);
  }
});

test("failed/malformed financial snapshots never silently turn into zero totals", async () => {
  const { db } = fixture({ stage_finance_organizer_overview: null });
  await assert.rejects(loadFinance(db, new AbortController().signal), /carregar o financeiro/);
});

test("an aborted financial refresh cannot return an old account's snapshot", async () => {
  const request = new AbortController();
  const { db } = fixture({ stage_finance_organizer_overview: async () => { request.abort(); return []; } });
  await assert.rejects(loadFinance(db, request.signal), { name: "AbortError" });
});

test("team reads require an authorized response and reject forbidden/invalid shapes", async () => {
  for (const response of [{ status: "forbidden" }, { status: "ok", items: null }]) {
    const { db } = fixture({ stage_finance_event_team: response });
    await assert.rejects(loadFinanceTeam(db, "show", new AbortController().signal), /pagamentos da equipe/);
  }
});

test("manual payment validates values before RPC and never writes financial tables directly", async () => {
  const { db, calls } = fixture();
  for (const amount of [NaN, Infinity, -1, 10000000, 0.001]) await assert.rejects(saveMusicianPayment(db, "invite", amount));
  assert.equal(calls.length, 0);
  await saveMusicianPayment(db, "invite", 0.29);
  assert.deepEqual(calls.map(call => call.name), ["stage_finance_save_musician_payment"]);
  assert.deepEqual(calls[0].body, { p_invitation_id: "invite", p_paid: 0.29 });
  const exceeds = fixture({ stage_finance_save_musician_payment: "amount_exceeds_agreed" });
  await assert.rejects(saveMusicianPayment(exceeds.db, "invite", 500), /cachê acordado/);
});

test("temporary Auth failures are distinct from a missing session", async () => {
  const retry = fixture({}, { data: { user: null }, error: { name: "AuthRetryableFetchError" } });
  await assert.rejects(loadFinance(retry.db, new AbortController().signal), error => !(error instanceof FinanceSessionRequired));
  assert.equal(retry.calls.length, 0);
  const missing = fixture({}, { data: { user: null }, error: { name: "AuthSessionMissingError" } });
  await assert.rejects(loadFinance(missing.db, new AbortController().signal), FinanceSessionRequired);
});

test("shared account profile avoids a duplicate profile request but is bound to a freshly validated identity", async () => {
  const {db,calls}=fixture();
  const result=await loadFinance(db,new AbortController().signal,{id,...basicProfile});
  assert.equal(result.ownerId,id);assert.equal(calls.length,2);
  assert.ok(calls.every(call=>call.name!=="profiles"));
  const mismatch=fixture();
  await assert.rejects(loadFinance(mismatch.db,new AbortController().signal,{id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",...basicProfile}),/Sua conta mudou/);
  assert.equal(mismatch.calls.length,0);
});
