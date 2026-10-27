import test from "node:test";
import assert from "node:assert/strict";
import { loadTsModule } from "./helpers/load-ts-module.mjs";
const { buildFinanceReport } = await loadTsModule("src/domains/billing/model/finance-report.ts");
const { toCents, addCents, decimalCents, formatCents, parseAmountInput, financeMonthKey } = await loadTsModule("src/domains/billing/model/money.ts");
const { buildFinanceCsv, safeCsvCell } = await loadTsModule("src/domains/billing/model/finance-csv.ts");
const { buildFinanceSummaryRequest, parseFinanceSummaryResponse } = await loadTsModule("src/domains/billing/contracts/finance-summary.ts");
const all = { mode: "all", year: "all", month: "all" };
function owner(overrides = {}) {
  return { event_id: "own", title: "Show próprio", starts_at: "2026-11-15T22:00:00Z", venue: "Deck", city: "São Paulo", event_status: "published", has_budget: true,
    gross_revenue: 1000.10, received: 300.10, expense_total: 200.20, expense_paid: 50.05, transport_total: 100.10, food_total: 100.10,
    equipment_total: 0, staff_total: 0, other_total: 0, musician_agreed: 400.40, musician_paid: 100.10, musician_unpriced: 0, musician_unpaid_count: 1, ...overrides };
}
function musician(overrides = {}) {
  return { kind: "participation", record_id: "invite", event_id: "guest", title: "Participação", starts_at: "2026-11-16T22:00:00Z", venue: null, city: "São Paulo", event_status: "published",
    personal_fee: 500.50, personal_received: 100.20, personal_expenses: 25.25, has_financial_record: true, ...overrides };
}
// Minimal RFC4180 reader, independent of the exporter, including embedded newlines.
function csvRows(csv) {
  const rows = [], row = []; let value = "", quoted = false;
  for (let index = 1; index < csv.length; index++) {
    const char = csv[index];
    if (char === '"') { if (quoted && csv[index + 1] === '"') { value += '"'; index++; } else quoted = !quoted; }
    else if (char === ";" && !quoted) { row.push(value); value = ""; }
    else if (char === "\r" && csv[index + 1] === "\n" && !quoted) { row.push(value); rows.push([...row]); row.length = 0; value = ""; index++; }
    else value += char;
  }
  row.push(value); rows.push([...row]); return rows;
}

test("summary combines organizer and musician in exact cents while separating cash from projected result", () => {
  const report = buildFinanceReport([owner()], [musician()], all);
  assert.equal(report.gross, 150060);
  assert.equal(report.received, 40030);
  assert.equal(report.expensesTotal, 22545);
  assert.equal(report.teamAgreed, 40040);
  assert.equal(report.projected, 87475);
  assert.equal(report.cashFlow, 22490);
  assert.equal(report.pendingReceivables, 110030);
  assert.equal(report.pendingPayables, 45045);
  assert.equal(report.monthly[0].projected, 87475);
  assert.equal(report.monthly[0].cash, 22490);
  assert.equal(report.monthly[0].count, 2);
  assert.equal(report.incomplete, false);
});

test("decimal addition never accumulates binary floating-point drift", () => {
  const report = buildFinanceReport([owner({ gross_revenue: 0.10, received: 0.10 }), owner({ event_id: "second", gross_revenue: 0.20, received: 0.20 })], [], all);
  assert.equal(report.gross, 30);
  assert.equal(report.received, 30);
  assert.equal(toCents("0.29"), 29);
  assert.equal(decimalCents(-29), "-0,29");
  assert.equal(parseAmountInput(" 12,34 "), 12.34);
  assert.equal(parseAmountInput("12,345"), null);
  assert.match(formatCents(-29), /-R\$\s*0,29/);
  assert.match(formatCents(Number.MAX_SAFE_INTEGER), /90\.071\.992\.547\.409,91$/);
});

test("cancelled shows are excluded from totals, monthly analyses and exported rows", () => {
  const report = buildFinanceReport([owner({ event_status: "cancelled" })], [musician({ event_status: "cancelled" })], all);
  assert.equal(report.gross, 0); assert.equal(report.hasAny, false); assert.deepEqual(report.monthly, []);
  assert.equal(csvRows(buildFinanceCsv(report)).length, 1);
});

test("mode, year and month filters agree across summary, cards and CSV", () => {
  const rows = [owner(), owner({ event_id: "old", starts_at: "2025-11-01T12:00:00Z", gross_revenue: 900 })];
  const report = buildFinanceReport(rows, [musician()], { mode: "organizer", year: "2026", month: "2026-11" });
  assert.equal(report.visibleOwner.length, 1); assert.equal(report.visibleMusician.length, 0); assert.equal(report.gross, 100010);
  assert.equal(csvRows(buildFinanceCsv(report)).length, 2);
  assert.equal(buildFinanceReport(rows, [musician()], { ...all, mode: "musician" }).gross, 50050);
  assert.throws(() => buildFinanceReport(rows, [], { ...all, year: "2025", month: "2026-11" }));
});

test("month boundaries use Sao Paulo, including UTC midnight and a historical DST transition", () => {
  assert.equal(financeMonthKey("2026-11-01T02:59:59Z"), "2026-10");
  assert.equal(financeMonthKey("2026-11-01T03:00:00Z"), "2026-11");
  assert.equal(financeMonthKey("2018-12-01T01:59:59Z"), "2018-11");
  assert.equal(financeMonthKey("2018-12-01T02:00:00Z"), "2018-12");
  const report = buildFinanceReport([owner({ starts_at: "2026-11-01T02:30:00Z" })], [], { ...all, month: "2026-10" });
  assert.equal(report.gross, 100010); assert.equal(report.monthly[0].key, "2026-10");
});

test("unknown revenue stays null per show, but known costs still reduce a clearly partial monthly result", () => {
  const report = buildFinanceReport([owner({ gross_revenue: null, received: 0, musician_unpriced: 1 })], [], all);
  assert.equal(report.visibleOwner[0].financial.projected, null);
  assert.equal(report.pendingReceivables, 0); assert.equal(report.missingRevenue, 1); assert.equal(report.incomplete, true);
  assert.equal(report.projected, -60060); assert.equal(report.monthly[0].projected, -60060); assert.equal(report.monthly[0].hasMissing, true);
  const row = csvRows(buildFinanceCsv(report))[1];
  assert.equal(row[4], ""); assert.equal(row[6], ""); assert.equal(row[12], ""); assert.equal(row[14], "Sim");
});

test("a real zero fee differs from an unknown fee and unrecorded personal expenses", () => {
  const report = buildFinanceReport([], [musician({ personal_fee: 0, personal_received: null, personal_expenses: null, has_financial_record: false })], all);
  const row = csvRows(buildFinanceCsv(report))[1];
  assert.equal(report.incomplete, false); assert.equal(row[4], "0,00"); assert.equal(row[5], ""); assert.equal(row[7], ""); assert.equal(row[12], "0,00");
});

test("overpayments do not become negative receivables or negative pending commitments", () => {
  const report = buildFinanceReport([owner({ received: 2000, expense_paid: 400, musician_paid: 800 })], [], all);
  assert.equal(report.pendingReceivables, 0); assert.equal(report.pendingPayables, 0); assert.equal(report.cashFlow, 80000);
});

test("CSV uses decimal commas and keeps trusted negative results numeric", () => {
  const report = buildFinanceReport([owner({ gross_revenue: 10, received: 0, expense_total: 25, expense_paid: 0, musician_agreed: 0, musician_paid: 0 })], [], all);
  const rows = csvRows(buildFinanceCsv(report));
  assert.equal(rows[1][4], "10,00"); assert.equal(rows[1][12], "-15,00");
  assert.equal(rows[1].length, 15); assert.equal(buildFinanceCsv(report).charCodeAt(0), 0xfeff);
});

test("CSV formula-like names, quotes, semicolons and embedded newlines stay text in one cell", () => {
  const title = ' \t=HYPERLINK("evil");\nshow';
  const rows = csvRows(buildFinanceCsv(buildFinanceReport([owner({ title, venue: "+cmd" })], [], all)));
  assert.equal(rows.length, 2); assert.equal(rows[1].length, 15); assert.equal(rows[1][2], "'" + title); assert.equal(rows[1][3], "'+cmd");
  assert.equal(safeCsvCell("\u0000@SUM(1)"), '"\'\u0000@SUM(1)"');
});

test("invalid amounts, excessive precision and unsafe sums fail explicitly instead of showing zeros", () => {
  for (const value of [NaN, Infinity, "", "12,34", "1.001", "1e3", "-0.001"]) assert.throws(() => toCents(value));
  assert.throws(() => addCents(Number.MAX_SAFE_INTEGER, 1));
  assert.throws(() => buildFinanceReport([owner({ received: -1 })], [], all));
  assert.throws(() => buildFinanceReport([owner({ starts_at: "invalid" })], [], all));
});

test("report functions do not mutate the loaded RPC snapshots", () => {
  const item = Object.freeze(owner()), items = Object.freeze([item]);
  assert.doesNotThrow(() => buildFinanceReport(items, [], all));
  assert.equal(Object.hasOwn(item, "financial"), false);
});

const subject = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function summaryFixture() {
  const request = buildFinanceSummaryRequest({ from: "2026-11-01T03:00:00Z", to: "2026-12-01T03:00:00Z" }, "all");
  return { request, response: { ...request, subject, totals: { gross: 150060, received: 40030, extras: 20020, extrasPaid: 5005,
    teamAgreed: 40040, teamPaid: 10010, personalCost: 2525, cashFlow: 22490, projected: 87475, pendingReceivables: 110030, pendingPayables: 45045 },
    counts: { shows: 2, missingRevenue: 0, unpricedFees: 0 }, coverage: { historyComplete: true } } };
}
test("future aggregate contract is versioned, bounded and has no client-supplied owner", () => {
  const { request, response } = summaryFixture();
  assert.equal(request.version, 1); assert.equal(request.currency, "BRL"); assert.equal(request.timeZone, "America/Sao_Paulo");
  assert.equal(Object.hasOwn(request, "subject"), false);
  assert.deepEqual(parseFinanceSummaryResponse(response, request, subject), response);
  assert.throws(() => buildFinanceSummaryRequest({ from: "2026-01-01T00:00:00Z", to: "2028-01-01T00:00:00Z" }, "all"));
  assert.throws(() => buildFinanceSummaryRequest({ from: "invalid", to: "2026-01-01" }, "all"));
});

test("future aggregate rejects another identity, wrong period, fractional cents and inconsistent cash", () => {
  const { request, response } = summaryFixture();
  for (const bad of [{ ...response, subject: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }, { ...response, period: { ...response.period, to: "2027-01-01T03:00:00.000Z" } },
    { ...response, totals: { ...response.totals, gross: 10.5 } }, { ...response, totals: { ...response.totals, cashFlow: 1 } }])
    assert.throws(() => parseFinanceSummaryResponse(bad, request, subject));
});
