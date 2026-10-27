import type { Mode, Organized, Participation } from "../types";
import { addCents, financeMonthKey, FinanceDataError, optionalCents, recordedCents } from "./money";

export type FinanceFilter = { mode: Mode; year: string; month: string };
export type RowAmounts = {
  gross: number | null; received: number; expenses: number; expensesPaid: number;
  team: number; teamPaid: number; projected: number | null; cash: number;
  receivable: number | null; payable: number; partial: boolean;
};
export type OwnerReportRow = Organized & { financial: RowAmounts };
export type MusicianReportRow = Participation & { financial: RowAmounts };
export type FinanceMonth = { key: string; count: number; gross: number; received: number; expenses: number; team: number; cash: number; projected: number; hasMissing: boolean };
export type FinanceReport = ReturnType<typeof buildFinanceReport>;

function unpriced(value: number): number {
  const count = value ?? 0;
  if (!Number.isSafeInteger(count) || count < 0) throw new FinanceDataError();
  return count;
}
export function ownerAmounts(row: Organized): RowAmounts {
  const gross = optionalCents(row.gross_revenue), received = recordedCents(row.received);
  const expenses = recordedCents(row.expense_total), expensesPaid = recordedCents(row.expense_paid);
  const team = recordedCents(row.musician_agreed), teamPaid = recordedCents(row.musician_paid);
  return { gross, received, expenses, expensesPaid, team, teamPaid,
    projected: gross === null ? null : addCents(gross, -expenses, -team),
    cash: addCents(received, -expensesPaid, -teamPaid),
    receivable: gross === null ? null : Math.max(0, addCents(gross, -received)),
    payable: addCents(Math.max(0, addCents(expenses, -expensesPaid)), Math.max(0, addCents(team, -teamPaid))),
    partial: gross === null || unpriced(row.musician_unpriced) > 0 };
}
export function musicianAmounts(row: Participation): RowAmounts {
  const gross = optionalCents(row.personal_fee), received = recordedCents(row.personal_received);
  const expenses = recordedCents(row.personal_expenses);
  return { gross, received, expenses, expensesPaid: expenses, team: 0, teamPaid: 0,
    projected: gross === null ? null : addCents(gross, -expenses),
    cash: addCents(received, -expenses), receivable: gross === null ? null : Math.max(0, addCents(gross, -received)),
    payable: 0, partial: gross === null };
}

/** Pure, deterministic report. All monetary results are integer BRL cents. */
export function buildFinanceReport(organized: readonly Organized[], participations: readonly Participation[], filter: FinanceFilter) {
  if (!["all", "organizer", "musician"].includes(filter.mode)
    || (filter.year !== "all" && !/^\d{4}$/.test(filter.year))
    || (filter.month !== "all" && (!/^\d{4}-(0[1-9]|1[0-2])$/.test(filter.month)
      || (filter.year !== "all" && !filter.month.startsWith(filter.year + "-"))))) throw new FinanceDataError();
  const allDates = [...organized, ...participations].map(row => financeMonthKey(row.starts_at));
  const years = [...new Set(allDates.map(date => date.slice(0, 4)))].sort().reverse();
  const months = [...new Set(allDates.filter(date => filter.year === "all" || date.startsWith(filter.year + "-")))].sort().reverse();
  const inPeriod = (row: Organized | Participation) => {
    const key = financeMonthKey(row.starts_at);
    return row.event_status !== "cancelled" && (filter.year === "all" || key.startsWith(filter.year + "-"))
      && (filter.month === "all" || key === filter.month);
  };
  const visibleOwner: OwnerReportRow[] = filter.mode === "musician" ? []
    : organized.filter(inPeriod).map(row => ({ ...row, financial: ownerAmounts(row) }));
  const visibleMusician: MusicianReportRow[] = filter.mode === "organizer" ? []
    : participations.filter(inPeriod).map(row => ({ ...row, financial: musicianAmounts(row) }));
  const rows = [...visibleOwner, ...visibleMusician];
  const sum = (field: keyof Pick<RowAmounts, "gross" | "received" | "cash" | "projected" | "receivable" | "payable">) =>
    rows.reduce((total, row) => addCents(total, row.financial[field] ?? 0), 0);
  const ownerSum = (field: keyof Pick<RowAmounts, "expenses" | "team" | "expensesPaid" | "teamPaid">) =>
    visibleOwner.reduce((total, row) => addCents(total, row.financial[field]), 0);
  const personalCost = visibleMusician.reduce((total, row) => addCents(total, row.financial.expenses), 0);
  const extras = ownerSum("expenses"), extrasPaid = ownerSum("expensesPaid"), teamAgreed = ownerSum("team"), teamPaid = ownerSum("teamPaid");
  const missingRevenue = rows.filter(row => row.financial.gross === null).length;
  const unpricedCount = visibleOwner.reduce((total, row) => total + unpriced(row.musician_unpriced), 0);
  const incomplete = missingRevenue > 0 || unpricedCount > 0;
  const categories = [
    ["transport", "Transporte", "transport_total"], ["equipment", "Equipamentos", "equipment_total"],
    ["staff", "Equipe externa", "staff_total"], ["food", "Alimentação", "food_total"], ["other", "Outras despesas", "other_total"],
  ].map(([key, name, field]) => ({ key, name, value: visibleOwner.reduce((total, row) =>
    addCents(total, recordedCents(row[field as "transport_total" | "equipment_total" | "staff_total" | "food_total" | "other_total"])), 0) }));
  categories.push({ key: "personal", name: "Despesas pessoais de músico", value: personalCost });
  const groups = new Map<string, FinanceMonth>();
  for (const row of rows) {
    const key = financeMonthKey(row.starts_at), value = row.financial;
    const group = groups.get(key) ?? { key, count: 0, gross: 0, received: 0, expenses: 0, team: 0, cash: 0, projected: 0, hasMissing: false };
    group.count++; group.gross = addCents(group.gross, value.gross ?? 0);
    group.received = addCents(group.received, value.received); group.expenses = addCents(group.expenses, value.expenses);
    group.team = addCents(group.team, value.team); group.cash = addCents(group.cash, value.cash);
    group.projected = addCents(group.projected, value.projected ?? addCents(-value.expenses, -value.team));
    group.hasMissing ||= value.partial; groups.set(key, group);
  }
  // Unknown revenue contributes zero known revenue, while known costs still reduce the partial result.
  const gross = sum("gross"), received = sum("received");
  return { visibleOwner, visibleMusician, years, months, gross, received, extras, extrasPaid, teamAgreed, teamPaid, personalCost,
    expensesTotal: addCents(extras, personalCost), pendingPayables: sum("payable"), cashFlow: sum("cash"), projected: addCents(gross, -extras, -teamAgreed, -personalCost), missingRevenue,
    incomplete, hasAny: rows.length > 0, pendingIncomplete: incomplete, categories,
    maxCategory: Math.max(1, ...categories.map(category => category.value)),
    monthly: [...groups.values()].sort((a, b) => b.key.localeCompare(a.key)), pendingReceivables: sum("receivable"),
    pendingExpenses: visibleOwner.reduce((total, row) => addCents(total, Math.max(0, addCents(row.financial.expenses, -row.financial.expensesPaid))), 0),
    pendingFees: visibleOwner.reduce((total, row) => addCents(total, Math.max(0, addCents(row.financial.team, -row.financial.teamPaid))), 0) };
}
