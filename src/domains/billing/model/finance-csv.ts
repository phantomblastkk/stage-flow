import type { FinanceReport } from "./finance-report";
import { decimalCents } from "./money";

type MoneyCell = { cents: number | null };
const amount = (cents: number | null): MoneyCell => ({ cents });

/** Only user-supplied text is prefixed; trusted negative numeric cells stay numeric. */
export function safeCsvCell(value: string | MoneyCell): string {
  const text = typeof value === "string" ? value : value.cents === null ? "" : decimalCents(value.cents);
  const safe = typeof value === "string" && /^[\s\u0000-\u001f]*[=+@-]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}
export function buildFinanceCsv(report: FinanceReport): string {
  const lines: (string | MoneyCell)[][] = [["Data", "Tipo", "Show", "Local", "Receita contratada", "Recebido manual", "A receber estimado", "Custo extra", "Custo músicos acordado", "Custo músicos pago", "Despesas pagas", "Compromissos a pagar", "Resultado líquido previsto", "Saldo de caixa registrado", "Valores incompletos"]];
  for (const row of report.visibleOwner) {
    const value = row.financial;
    lines.push([row.starts_at, "Organizador", row.title, row.venue || row.city || "", amount(value.gross), amount(value.received),
      amount(value.receivable), amount(value.expenses), amount(value.team), amount(value.teamPaid), amount(value.expensesPaid),
      amount(value.payable), amount(value.projected), amount(value.cash), value.partial ? "Sim" : "Não"]);
  }
  for (const row of report.visibleMusician) {
    const value = row.financial;
    lines.push([row.starts_at, "Músico", row.title, row.venue || row.city || "", amount(value.gross),
      amount(row.personal_received == null ? null : value.received), amount(value.receivable),
      amount(row.personal_expenses == null ? null : value.expenses), amount(0), amount(0),
      amount(row.personal_expenses == null ? null : value.expensesPaid), amount(0), amount(value.projected), amount(value.cash), value.partial ? "Sim" : "Não"]);
  }
  return "\ufeff" + lines.map(row => row.map(safeCsvCell).join(";")).join("\r\n");
}
