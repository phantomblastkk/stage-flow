"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AlertCircle, ArrowDownRight, ArrowUpRight, CheckCircle2, CircleHelp,
  CreditCard, FilePlus2, LoaderCircle, LockKeyhole, Pencil, Plus,
  Receipt, RefreshCw, Save, Trash2, Wallet, X
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./event-budget-panel.css";

type Category = "transport" | "equipment" | "staff" | "food" | "other";

type Expense = {
  id: string;
  description: string;
  category: Category;
  amount: number;
  paid_amount: number;
};

type EventBudget = {
  event_id: string;
  client_fee: number | null;
  received_amount: number;
  to_receive: number | null;
  expenses_total: number;
  expenses_paid_total: number;
  expenses_unpaid_total: number;
  expenses: Expense[];
  musician_agreed_total: number;
  musician_unpriced_count: number;
  projected_partial_result: number | null;
};

type Props = { eventId: string; refreshToken?: number };

const categoryNames: Record<Category, string> = {
  transport: "Transporte",
  equipment: "Equipamentos",
  staff: "Serviços / equipe externa",
  food: "Alimentação",
  other: "Outros"
};
const categories = Object.keys(categoryNames) as Category[];
const real = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function money(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "A definir";
  return real.format(value);
}
function inputMoney(value: number): string {
  return Number(value).toFixed(2).replace(".", ",");
}
function decimal(value: string, max: number, emptyAllowed = false) {
  const raw = value.trim();
  if (raw === "" && emptyAllowed) return null;
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(raw)) return undefined;
  const parsed = Number(raw.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed > max || parsed < 0) return undefined;
  return parsed;
}
const initialExpense = () => ({
  description: "",
  category: "other" as Category,
  amount: "",
  paid: "0,00"
});

export default function EventBudgetPanel({ eventId, refreshToken = 0 }: Props) {
  const [budget, setBudget] = useState<EventBudget | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [clientFee, setClientFee] = useState("");
  const [received, setReceived] = useState("0,00");
  const [editingExpense, setEditingExpense] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState(initialExpense);
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  function refresh() {
    setRefreshNonce(value => value + 1);
  }

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      const { data, error: loadError } = await createClient().rpc(
        "stage_my_event_budget", { p_event_id: eventId }
      );
      if (!active) return;
      if (loadError) {
        setBudget(null);
        const migrationMissing = loadError.code === "PGRST202" ||
          loadError.code === "42883";
        setError(migrationMissing
          ? "Para ativar o financeiro completo, execute event_revenue_expenses_migration.sql no Supabase."
          : "Não foi possível carregar os valores privados deste show. " + loadError.message);
      } else if (!data || !Array.isArray(data.expenses)) {
        setBudget(null);
        setError("Não foi possível consultar o financeiro: verifique se este evento pertence à sua conta.");
      } else {
        const current = data as EventBudget;
        setBudget(current);
        setClientFee(current.client_fee === null ? "" : inputMoney(current.client_fee));
        setReceived(inputMoney(current.received_amount ?? 0));
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [eventId, refreshToken, refreshNonce]);

  async function saveRevenue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setFeedback("");
    const price = decimal(clientFee, 9999999.99, true);
    const paid = decimal(received, 9999999.99);
    if (price === undefined || paid === undefined || paid === null ||
        (price === null && paid > 0) ||
        (price !== null && paid > price)) {
      setError("Confira os valores: use até duas casas decimais, sem pontos de milhar. O recebido não pode superar o valor combinado.");
      return;
    }
    setBusy(true);
    const { data, error: saveError } = await createClient().rpc(
      "stage_save_event_budget", {
        p_event_id: eventId,
        p_client_fee: price,
        p_received_amount: paid
      }
    );
    if (saveError || data !== "saved") {
      setError(saveError?.message || "Não foi possível salvar a receita do show.");
    } else {
      setFeedback("Valor combinado e recebimentos registrados no controle privado.");
      refresh();
    }
    setBusy(false);
  }

  function newExpense() {
    setEditingExpense(null);
    setExpenseForm(initialExpense());
    setShowExpenseForm(true);
    setError("");
    setFeedback("");
  }

  function editExpense(item: Expense) {
    setEditingExpense(item.id);
    setExpenseForm({
      description: item.description,
      category: item.category,
      amount: inputMoney(item.amount),
      paid: inputMoney(item.paid_amount)
    });
    setShowExpenseForm(true);
    setError("");
    setFeedback("");
  }

  async function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setFeedback("");
    const planned = decimal(expenseForm.amount, 999999.99);
    const paid = decimal(expenseForm.paid, 999999.99);
    if (expenseForm.description.trim().length < 2 ||
      expenseForm.description.trim().length > 120 ||
      planned === undefined || planned === null || planned <= 0 ||
      paid === undefined || paid === null || paid > planned) {
      setError("Confira a despesa: descrição de 2 a 120 caracteres, valor positivo e pagamento entre R$ 0 e o valor previsto.");
      return;
    }
    setBusy(true);
    const { data, error: saveError } = await createClient().rpc(
      "stage_save_event_expense", {
        p_event_id: eventId,
        p_expense_id: editingExpense,
        p_description: expenseForm.description.trim(),
        p_category: expenseForm.category,
        p_amount: planned,
        p_paid_amount: paid
      }
    );
    const result = data as { status?: string } | null;
    if (saveError || !["created", "updated"].includes(result?.status || "")) {
      const reasons: Record<string, string> = {
        limit_reached: "Limite de 60 despesas por show atingido.",
        expense_not_found: "Não foi possível localizar essa despesa no show.",
        invalid: "Confira a descrição e os valores preenchidos."
      };
      setError(saveError?.message || reasons[result?.status || ""] ||
        "Não foi possível salvar a despesa.");
    } else {
      setShowExpenseForm(false);
      setEditingExpense(null);
      setExpenseForm(initialExpense());
      setFeedback(result?.status === "updated"
        ? "Despesa atualizada no financeiro privado."
        : "Despesa adicionada ao financeiro do show.");
      refresh();
    }
    setBusy(false);
  }

  async function deleteExpense(item: Expense) {
    if (busy || !window.confirm("Excluir a despesa \"" + item.description + "\" deste show? Os valores deixarão de entrar no resumo.")) return;
    setBusy(true);
    setError("");
    setFeedback("");
    const { data, error: deleteError } = await createClient().rpc(
      "stage_delete_event_expense", {
        p_event_id: eventId,
        p_expense_id: item.id
      }
    );
    if (deleteError || data !== "deleted") {
      setError(deleteError?.message || "Não foi possível excluir a despesa.");
    } else {
      if (editingExpense === item.id) {
        setEditingExpense(null);
        setShowExpenseForm(false);
      }
      setFeedback("Despesa excluída do controle privado.");
      refresh();
    }
    setBusy(false);
  }

  return <section className="event-budget-panel" aria-label="Receita e despesas privadas do show">
    <div className="event-budget-header">
      <div>
        <span className="event-budget-eyebrow"><LockKeyhole size={13}/> FINANCEIRO PRIVADO · ORGANIZADOR</span>
        <h4><Wallet size={20}/> Receita e despesas do show</h4>
        <p>Informe quanto foi combinado com o contratante e organize despesas extras. Nada é cobrado ou pago pelo Stage Flow.</p>
      </div>
      <button type="button" className="event-budget-refresh" disabled={loading || busy}
        onClick={() => {setFeedback("");refresh();}}>
        <RefreshCw size={15}/> Atualizar
      </button>
    </div>

    {loading && <p className="event-budget-loading" role="status">
      <LoaderCircle size={17}/> Carregando controle financeiro...
    </p>}
    {!loading && error && <p className="event-budget-error" role="alert">
      <AlertCircle size={16}/> {error}
    </p>}
    {!loading && feedback && <p className="event-budget-success" role="status">
      <CheckCircle2 size={16}/> {feedback}
    </p>}

    {!loading && budget && <>
      <div className="event-budget-overview">
        <div className="event-budget-highlight">
          <span>Resultado parcial previsto</span>
          <strong className={budget.projected_partial_result !== null &&
            budget.projected_partial_result < 0 ? "is-negative" : ""}>
            {money(budget.projected_partial_result)}
          </strong>
          <small>
            {budget.client_fee === null
              ? "Informe o valor combinado para calcular."
              : "Valor combinado − cachês acordados − despesas extras."}
          </small>
        </div>
        <div className="event-budget-summary-grid">
          <div>
            <span>Valor combinado</span>
            <strong>{money(budget.client_fee)}</strong>
          </div>
          <div>
            <span>Recebido (manual)</span>
            <strong>{money(budget.received_amount)}</strong>
          </div>
          <div>
            <span>A receber</span>
            <strong>{money(budget.to_receive)}</strong>
          </div>
          <div>
            <span>Cachês acordados da banda</span>
            <strong>{money(budget.musician_agreed_total)}</strong>
          </div>
          <div>
            <span>Despesas extras previstas</span>
            <strong>{money(budget.expenses_total)}</strong>
          </div>
          <div>
            <span>Despesas extras já pagas</span>
            <strong>{money(budget.expenses_paid_total)}</strong>
          </div>
        </div>
      </div>

      {budget.musician_unpriced_count > 0 && <p className="event-budget-warning">
        <CircleHelp size={16}/>
        Existem {budget.musician_unpriced_count} convite(s) ativo(s) sem cachê acordado.
        O resultado previsto é parcial e pode diminuir quando esses valores forem definidos.
      </p>}
      <p className="event-budget-explainer">
        O valor recebido e os pagamentos extras são <strong>lançamentos manuais</strong>.
        Ainda não registramos pagamento aos músicos, impostos nem taxas. O resultado previsto
        não é lucro realizado e pode mudar com novas despesas.
      </p>

      <div className="event-budget-editors">
        <form className="event-budget-editor" onSubmit={e => void saveRevenue(e)}>
          <span className="event-budget-subtitle"><ArrowUpRight size={16}/> Receita do contratante</span>
          <p>Preencha o valor combinado, mesmo que ainda não tenha recebido. Atualize o recebido quando houver pagamento.</p>
          <div className="event-budget-field">
            <label htmlFor={"event-budget-client-" + eventId}>Valor combinado (R$)</label>
            <input id={"event-budget-client-" + eventId} type="text" inputMode="decimal"
              maxLength={12} placeholder="Ex.: 3500,00" value={clientFee}
              onChange={e => setClientFee(e.target.value)}
              disabled={busy}/>
            <small>Deixe vazio enquanto não houver valor definido.</small>
          </div>
          <div className="event-budget-field">
            <label htmlFor={"event-budget-received-" + eventId}>Já recebido (R$)</label>
            <input id={"event-budget-received-" + eventId} type="text" inputMode="decimal"
              maxLength={12} required placeholder="Ex.: 1000,00" value={received}
              onChange={e => setReceived(e.target.value)} disabled={busy}/>
            <small>Não pode ultrapassar o valor combinado.</small>
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? <LoaderCircle size={15}/> : <Save size={15}/>}
            {busy ? "Salvando..." : "Salvar receita"}
          </button>
        </form>

        <div className="event-budget-editor">
          <div className="event-budget-expenses-title">
            <div>
              <span className="event-budget-subtitle"><ArrowDownRight size={16}/> Despesas extras</span>
              <p>Transporte, alimentação, equipamentos e outros custos separados dos cachês da banda.</p>
            </div>
            {!showExpenseForm && <button type="button" className="btn btn-quiet" disabled={busy || budget.expenses.length >= 60}
              onClick={newExpense}><Plus size={15}/> Adicionar</button>}
          </div>

          {showExpenseForm && <form className="event-budget-expense-form" onSubmit={e => void saveExpense(e)}>
            <div className="event-budget-expense-form-header">
              <strong><FilePlus2 size={15}/> {editingExpense ? "Editar despesa" : "Nova despesa"}</strong>
              <button type="button" aria-label="Fechar formulário de despesa"
                disabled={busy} onClick={() => {setShowExpenseForm(false);setEditingExpense(null);setError("");}}>
                <X size={16}/>
              </button>
            </div>
            <div className="event-budget-field">
              <label htmlFor={"event-expense-description-" + eventId}>Descrição *</label>
              <input id={"event-expense-description-" + eventId} maxLength={120} minLength={2}
                required value={expenseForm.description} disabled={busy}
                onChange={e => setExpenseForm(prev => ({...prev,description:e.target.value}))}
                placeholder="Ex.: Transporte da equipe"/>
            </div>
            <div className="event-budget-field">
              <label htmlFor={"event-expense-category-" + eventId}>Categoria</label>
              <select id={"event-expense-category-" + eventId} value={expenseForm.category}
                disabled={busy}
                onChange={e => setExpenseForm(prev => ({...prev,category:e.target.value as Category}))}>
                {categories.map(category => <option key={category} value={category}>{categoryNames[category]}</option>)}
              </select>
            </div>
            <div className="event-budget-field-grid">
              <div className="event-budget-field">
                <label htmlFor={"event-expense-amount-" + eventId}>Valor total (R$) *</label>
                <input id={"event-expense-amount-" + eventId} type="text" inputMode="decimal"
                  required value={expenseForm.amount} disabled={busy}
                  onChange={e => setExpenseForm(prev => ({...prev,amount:e.target.value}))}
                  placeholder="Ex.: 250,00"/>
              </div>
              <div className="event-budget-field">
                <label htmlFor={"event-expense-paid-" + eventId}>Pago até agora (R$) *</label>
                <input id={"event-expense-paid-" + eventId} type="text" inputMode="decimal"
                  required value={expenseForm.paid} disabled={busy}
                  onChange={e => setExpenseForm(prev => ({...prev,paid:e.target.value}))}
                  placeholder="Ex.: 0,00"/>
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? <LoaderCircle size={15}/> : <Save size={15}/>}
              {busy ? "Salvando..." : editingExpense ? "Salvar despesa" : "Adicionar despesa"}
            </button>
          </form>}

          {budget.expenses.length === 0 ? <div className="event-budget-expenses-empty">
            <Receipt size={20}/>
            <span>Nenhuma despesa extra cadastrada neste show.</span>
          </div> : <div className="event-budget-expenses-list">
            {budget.expenses.map(item =>
              <div key={item.id} className="event-budget-expense-row">
                <div className="event-budget-expense-info">
                  <strong>{item.description}</strong>
                  <span>{categoryNames[item.category] || "Outros"}</span>
                  <small>Pago: {money(item.paid_amount)} · Falta: {money(item.amount - item.paid_amount)}</small>
                </div>
                <div className="event-budget-expense-actions">
                  <strong>{money(item.amount)}</strong>
                  <div>
                    <button type="button" disabled={busy} onClick={() => editExpense(item)}
                      aria-label={"Editar despesa " + item.description}><Pencil size={15}/></button>
                    <button type="button" disabled={busy} onClick={() => void deleteExpense(item)}
                      aria-label={"Excluir despesa " + item.description}><Trash2 size={15}/></button>
                  </div>
                </div>
              </div>
            )}
          </div>}

          <div className="event-budget-expense-footer">
            <div><span>Total extra previsto</span><strong>{money(budget.expenses_total)}</strong></div>
            <div><span>Ainda não pago (extra)</span><strong>{money(budget.expenses_unpaid_total)}</strong></div>
          </div>
          <p className="event-budget-no-double">Evite repetir aqui os cachês dos músicos que já estão no sistema de convites.</p>
        </div>
      </div>
      <p className="event-budget-privacy"><LockKeyhole size={14}/>
        Seus dados não aparecem na página do cantor ou no site profissional.
        Nenhum registro financeiro realiza transferência, cobrança ou comprova pagamento.
      </p>
    </>}
  </section>;
}
