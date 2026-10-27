import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

// Execute the service with the real PostgREST request builder, without real credentials.
const source = readFileSync(new URL("../src/domains/events/services/agenda-service.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { loadAgenda, eventPayload, saveEvent, removeEvent, searchVenues, AgendaSessionRequired, agendaWindow, loadMoreAgenda, loadAgendaMarkers, loadAgendaEvent, AGENDA_PAGE_SIZE } =
  await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const period = { from: "2026-11-01T03:00:00.000Z", to: "2026-12-01T03:00:00.000Z" };
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const draft = { title: "  Show teste  ", description: " ", venue: " Deck ", venueId: null, city: " São Paulo ", startsAt: "2026-11-01T20:00:00-03:00", endsAt: "", publicly: false };
function client(handle, auth = { data: { user: { id: userId } }, error: null }) {
  const calls = [];
  const db = createClient("https://example.supabase.co", "test-only-not-a-secret", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, options) => {
      const call = { url: new URL(url), options, body: options.body ? JSON.parse(options.body) : null };
      calls.push(call);
      const result = await handle(call);
      return new Response(JSON.stringify(result.body), { status: result.status ?? 200, headers: { "Content-Type": "application/json" } });
    } },
  });
  return { calls, db: { from: db.from.bind(db), rpc: db.rpc.bind(db), auth: { getUser: async () => auth } } };
}

test("agenda requests only the authenticated owner's events and keeps accepted participations separate", async () => {
  const own = { id: "own", title: "Show próprio" }, guest = { event_id: "guest", title: "Participação" };
  const { db, calls } = client(call => ({ body: call.url.pathname.endsWith("/events") ? [own] : [guest] }));
  const result = await loadAgenda(db, new AbortController().signal, period);
  assert.equal(result.ownerId, userId);
  assert.deepEqual(result.events, [own]);
  assert.deepEqual(result.guestShows, [guest]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url.searchParams.get("producer_id"), "eq." + userId);
  assert.equal(calls[0].url.searchParams.get("order"), "starts_at.asc,id.asc");
  assert.equal(calls[1].url.pathname, "/rest/v1/rpc/stage_accepted_shows");
  assert.ok(!calls[0].url.searchParams.get("select").includes("*"));
});

test("failed or malformed agenda responses stay unavailable, rather than becoming an empty agenda", async () => {
  for (const response of [{ status: 403, body: { message: "denied", code: "42501" } }, { body: {} }]) {
    const { db } = client(call => call.url.pathname.endsWith("/events") ? response : { body: [] });
    const result = await loadAgenda(db, new AbortController().signal, period);
    assert.equal(result.events, null);
    assert.deepEqual(result.guestShows, []);
  }
});

test("cancelled navigation discards responses and does not keep loading data for the old page", async () => {
  const request = new AbortController();
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const { db } = client(async () => { started(); await new Promise(resolve => setTimeout(resolve, 10)); return { body: [] }; });
  const result = loadAgenda(db, request.signal, period);
  await ready; request.abort();
  await assert.rejects(result, { name: "AbortError" });
});

test("transient Auth errors are not treated as sign-out; a missing session is explicit", async () => {
  const network = client(() => { throw Error("must not query"); }, { data: { user: null }, error: { name: "AuthRetryableFetchError" } });
  await assert.rejects(loadAgenda(network.db, new AbortController().signal, period), error => !(error instanceof AgendaSessionRequired));
  assert.equal(network.calls.length, 0);
  const missing = client(() => { throw Error("must not query"); }, { data: { user: null }, error: { name: "AuthSessionMissingError" } });
  await assert.rejects(loadAgenda(missing.db, new AbortController().signal, period), AgendaSessionRequired);
});

test("invalid event dates, empty names and end-before-start are rejected before mutation", async () => {
  const { db, calls } = client(() => { throw Error("must not mutate"); });
  for (const change of [{ title: " " }, { startsAt: "invalid" }, { endsAt: "invalid" }, { endsAt: draft.startsAt }, { endsAt: "2026-11-01T19:59:00-03:00" }]) {
    await assert.rejects(saveEvent(db, { ...draft, ...change }));
  }
  assert.equal(calls.length, 0);
  assert.equal(eventPayload(draft).starts_at, "2026-11-01T23:00:00.000Z");
});

test("creation ignores a forged owner in form input and preserves private versus published status", async () => {
  const { db, calls } = client(() => ({ body: { id: "created", ...eventPayload(draft) } }));
  await saveEvent(db, { ...draft, producer_id: "forged-owner" });
  assert.equal(calls[0].body.producer_id, userId);
  assert.equal(calls[0].body.title, "Show teste");
  assert.equal(calls[0].body.status, "draft");
  assert.equal(calls[0].body.show_publicly, false);
  assert.equal(eventPayload({ ...draft, publicly: true }).status, "published");
});

test("deletion is scoped to the validated owner and zero affected rows cannot report success", async () => {
  const { db, calls } = client(() => ({ body: null }));
  await assert.rejects(removeEvent(db, "event-id"), /sem permissão/);
  assert.equal(calls[0].options.method, "DELETE");
  assert.equal(calls[0].url.searchParams.get("producer_id"), "eq." + userId);
  assert.equal(calls[0].url.searchParams.get("id"), "eq.event-id");
  const success = client(() => ({ body: { id: "event-id" } }));
  await removeEvent(success.db, "event-id");
});

test("venue suggestions retain active-only filtering, city scope and an eight-result limit", async () => {
  const { db, calls } = client(call => ({ body: call.url.pathname.endsWith("/cities") ? [{ id: 10 }] : [{ id: "venue", name: "Deck", address: null, cities: { name: "São Paulo", state_code: "SP" } }] }));
  const rows = await searchVenues(db, "Deck", "São Paulo - SP", new AbortController().signal);
  assert.equal(calls[1].url.searchParams.get("city_id"), "eq.10");
  assert.equal(calls[1].url.searchParams.get("active"), "eq.true");
  assert.equal(calls[1].url.searchParams.get("limit"), "8");
  assert.equal(rows[0].city_name, "São Paulo");
});

test("agenda pages have a month/day window and a stable cursor for equal start times", async () => {
  const rows = Array.from({ length: AGENDA_PAGE_SIZE + 1 }, (_, index) => ({
    id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`,
    starts_at: "2026-11-01T23:00:00Z", title: "Show " + index,
  }));
  const { db, calls } = client(call => ({ body: call.url.pathname.endsWith("/events") ? rows : [] }));
  const first = await loadAgenda(db, new AbortController().signal, period);
  assert.equal(first.events.length, 20);
  assert.equal(first.ownNext.id, rows[19].id);
  assert.equal(calls[0].url.searchParams.get("limit"), "21");
  assert.deepEqual(calls[0].url.searchParams.getAll("starts_at"), ["gte." + period.from, "lt." + period.to]);
  await loadMoreAgenda(db, new AbortController().signal, period, "owned", first.ownNext);
  assert.match(calls[2].url.searchParams.get("or"), /and\(starts_at.eq.2026-11-01T23:00:00Z,id.gt.11111111-1111-4111-8111-000000000020\)/);
  assert.equal(calls[2].url.searchParams.get("offset"), null, "cursor must not skip rows by offset");
});

test("a date filter narrows server queries, and an invalid/unbounded interval cannot request data", async () => {
  const range = agendaWindow(new Date(2026, 10, 1), "2026-11-03");
  assert.equal(new Date(range.from).getDate(), 3);
  assert.equal(new Date(range.to).getDate(), 4);
  assert.throws(() => agendaWindow(new Date(2026, 10, 1), "2026-12-01"));
  const { db, calls } = client(() => ({ body: [] }));
  await assert.rejects(loadAgenda(db, new AbortController().signal, { from: "2026-01-01", to: "2027-01-01" }));
  assert.equal(calls.length, 0);
});

test("calendar markers stay independent of the 20-show list and clearly report their bound", async () => {
  const rows = Array.from({ length: 501 }, () => ({ starts_at: "2026-11-25T22:00:00Z" }));
  const { db, calls } = client(() => ({ body: rows }));
  const markers = await loadAgendaMarkers(db, new AbortController().signal, period);
  assert.equal(markers.own.length, 500);
  assert.equal(markers.partial, true);
  assert.equal(calls[0].url.searchParams.get("select"), "starts_at");
  assert.equal(calls[1].url.searchParams.get("limit"), "501");
  assert.equal(calls[1].url.searchParams.get("event_status"), "neq.cancelled");
});

test("deep links resolve a single owned show independently of current month or list page", async () => {
  const id = "99999999-9999-4999-8999-999999999999";
  const { db, calls } = client(() => ({ body: { id, starts_at: "2027-01-01T22:00:00Z" } }));
  const row = await loadAgendaEvent(db, new AbortController().signal, id);
  assert.equal(row.id, id);
  assert.equal(calls[0].url.searchParams.get("id"), "eq." + id);
  assert.equal(calls[0].url.searchParams.get("producer_id"), "eq." + userId);
});


test("PostgreSQL microseconds survive the cursor and cannot restart the same page", async () => {
  const { db, calls } = client(() => ({ body: [] }));
  await loadMoreAgenda(db, new AbortController().signal, period, "accepted", {
    startsAt: "2026-11-01T23:00:00.123456+00:00", id: "11111111-1111-4111-8111-000000000020",
  });
  assert.ok(calls[0].url.searchParams.get("or").includes("23:00:00.123456+00:00"));
  await assert.rejects(loadMoreAgenda(db, new AbortController().signal, period, "accepted", {
    startsAt: "2026-11-01T23:00:00Z,and(event_id.eq.injected)", id: "11111111-1111-4111-8111-000000000020",
  }));
  assert.equal(calls.length, 1);
});
