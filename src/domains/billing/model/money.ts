export class FinanceDataError extends Error {
  constructor() { super("Os dados financeiros contêm um valor inválido. Atualize o relatório ou revise os lançamentos."); }
}

export type MoneyValue = number | string | null | undefined;

/** Database amounts have at most two decimal places. Do not round malformed data. */
export function toCents(value: MoneyValue): number | null {
  if (value == null) return null;
  const text = typeof value === "number" && Number.isFinite(value) ? String(value)
    : typeof value === "string" ? value : "";
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(text)) throw new FinanceDataError();
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = text.replace(/^-/, "").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new FinanceDataError();
  return cents === 0 ? 0 : negative ? -cents : cents;
}

export function assertCents(value: number): number {
  if (!Number.isSafeInteger(value)) throw new FinanceDataError();
  return value;
}
export function addCents(...values: number[]): number {
  return values.reduce((sum, value) => assertCents(sum + assertCents(value)), 0);
}
export function recordedCents(value: MoneyValue): number {
  const cents = toCents(value) ?? 0;
  if (cents < 0) throw new FinanceDataError();
  return cents;
}
export function optionalCents(value: MoneyValue): number | null {
  return value == null ? null : recordedCents(value);
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatCents(value: number | null | undefined): string {
  if (value == null) return "A definir";
  assertCents(value);
  const units = Math.trunc(value / 100);
  const whole = units === 0 ? (value < 0 ? -0 : 0) : units;
  const fraction = String(Math.abs(value % 100)).padStart(2, "0");
  // Format the integer part separately: dividing very large safe-cent values would lose cents.
  return currency.formatToParts(whole).map(part => part.type === "fraction" ? fraction : part.value).join("");
}
export function formatAmount(value: MoneyValue): string { return formatCents(toCents(value)); }
export function decimalCents(value: number, separator = ","): string {
  assertCents(value);
  const absolute = Math.abs(value);
  return (value < 0 ? "-" : "") + Math.trunc(absolute / 100) + separator + String(absolute % 100).padStart(2, "0");
}
export function formatAmountInput(value: number): string { return decimalCents(recordedCents(value)); }
export function parseAmountInput(value: string): number | null {
  const text = value.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) return null;
  try { return recordedCents(text.replace(",", ".")) / 100; } catch { return null; }
}

const monthFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" });
export function financeMonthKey(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new FinanceDataError();
  const parts = monthFormatter.formatToParts(date);
  return parts.find(part => part.type === "year")!.value + "-" + parts.find(part => part.type === "month")!.value;
}
export function financeMonthLabel(value: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new FinanceDataError();
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", month: "long", year: "numeric" })
    .format(new Date(value + "-15T12:00:00-03:00"));
}
