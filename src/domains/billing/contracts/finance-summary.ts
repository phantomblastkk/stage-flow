/** Versioned contract for a FUTURE server aggregate. No RPC is installed or called here. */
import type { Mode } from "../types";
import { addCents, assertCents } from "../model/money";

export type FinanceSummaryRequest = {
  version: 1; currency: "BRL"; timeZone: "America/Sao_Paulo";
  mode: Mode; period: { from: string; to: string };
};
export const summaryKeys = ["gross", "received", "extras", "extrasPaid", "teamAgreed", "teamPaid", "personalCost",
  "cashFlow", "projected", "pendingReceivables", "pendingPayables"] as const;
export type FinanceSummaryResponse = FinanceSummaryRequest & {
  subject: string;
  totals: Record<typeof summaryKeys[number], number>;
  counts: { shows: number; missingRevenue: number; unpricedFees: number };
  coverage: { historyComplete: boolean };
};
export class FinanceSummaryContractError extends Error {
  constructor() { super("Contrato de resumo financeiro inválido."); }
}
export function buildFinanceSummaryRequest(period: { from: string; to: string }, mode: Mode): FinanceSummaryRequest {
  const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
  if (!timestamp.test(period.from) || !timestamp.test(period.to)) throw new FinanceSummaryContractError();
  const from = new Date(period.from), to = new Date(period.to), length = to.getTime() - from.getTime();
  if (!Number.isFinite(length) || length <= 0 || length > 366 * 86400000
    || !["all", "organizer", "musician"].includes(mode)) throw new FinanceSummaryContractError();
  // The request intentionally has no editable owner/user ID. Server must use auth.uid().
  return { version: 1, currency: "BRL", timeZone: "America/Sao_Paulo", mode,
    period: { from: from.toISOString(), to: to.toISOString() } };
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new FinanceSummaryContractError();
  return value as Record<string, unknown>;
}
export function parseFinanceSummaryResponse(value: unknown, request: FinanceSummaryRequest, expectedSubject: string): FinanceSummaryResponse {
  const row = object(value), period = object(row.period), counts = object(row.counts), coverage = object(row.coverage);
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(expectedSubject) || row.subject !== expectedSubject || row.version !== 1 || row.currency !== request.currency || row.timeZone !== request.timeZone || row.mode !== request.mode
    || period.from !== request.period.from || period.to !== request.period.to || typeof coverage.historyComplete !== "boolean")
    throw new FinanceSummaryContractError();
  const inputTotals = object(row.totals), totals = {} as FinanceSummaryResponse["totals"];
  for (const key of summaryKeys) {
    const amount = inputTotals[key];
    if (typeof amount !== "number" || !Number.isSafeInteger(amount)
      || (key !== "cashFlow" && key !== "projected" && amount < 0)) throw new FinanceSummaryContractError();
    totals[key] = assertCents(amount);
  }
  for (const key of ["shows", "missingRevenue", "unpricedFees"] as const)
    if (typeof counts[key] !== "number" || !Number.isSafeInteger(counts[key]) || counts[key] < 0) throw new FinanceSummaryContractError();
  if ((counts.missingRevenue as number) > (counts.shows as number)) throw new FinanceSummaryContractError();
  try {
    if (totals.cashFlow !== addCents(totals.received, -totals.extrasPaid, -totals.teamPaid, -totals.personalCost)
      || totals.projected !== addCents(totals.gross, -totals.extras, -totals.teamAgreed, -totals.personalCost)) throw new FinanceSummaryContractError();
  } catch { throw new FinanceSummaryContractError(); }
  return { ...request, subject: expectedSubject, totals, counts: { shows: counts.shows as number, missingRevenue: counts.missingRevenue as number,
    unpricedFees: counts.unpricedFees as number }, coverage: { historyComplete: coverage.historyComplete } };
}
