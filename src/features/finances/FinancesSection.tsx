import { useEffect, useState } from "react";
import { SectionCard } from "../../components/SectionCard";
import { MetricCard } from "../../components/ui";
import { supabase } from "../../lib/supabase";
import type {
  AccountBalanceRow,
  BudgetRow,
  BudgetStatusRow,
  FinanceCategoryRow,
  FinanceRow,
  FinanceStatus,
  ProjectRow,
  SoldeReelRow,
  TransactionType
} from "../../lib/types";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  localDateTimeInputToIso,
  messageFromError,
  slugify,
  todayDate,
  toNumber
} from "../../lib/utils";

interface FinancesSectionProps {
  userId: string;
  timezone: string;
  refreshToken: number;
  onDataChanged: () => void;
  onInfo: (message: string) => void;
  onError: (message: string) => void;
}

const EXPENSE_STATUSES: FinanceStatus[] = ["planned", "committed", "paid", "cancelled"];
const INCOME_STATUSES: FinanceStatus[] = ["planned", "committed", "received", "cancelled"];

export function FinancesSection({
  userId,
  timezone,
  refreshToken,
  onDataChanged,
  onInfo,
  onError
}: FinancesSectionProps) {
  const [categories, setCategories] = useState<FinanceCategoryRow[]>([]);
  const [transactions, setTransactions] = useState<FinanceRow[]>([]);
  const [balances, setBalances] = useState<AccountBalanceRow[]>([]);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [budgetStatuses, setBudgetStatuses] = useState<BudgetStatusRow[]>([]);
  const [balanceView, setBalanceView] = useState<SoldeReelRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [transactionSaving, setTransactionSaving] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);
  const [balanceSaving, setBalanceSaving] = useState(false);
  const [budgetSaving, setBudgetSaving] = useState(false);

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    slug: "",
    transaction_type: "expense" as TransactionType
  });
  const [transactionForm, setTransactionForm] = useState({
    transaction_type: "expense" as TransactionType,
    category_id: "",
    amount: "",
    currency: "EUR",
    transaction_date: todayDate(timezone),
    status: "planned" as FinanceStatus,
    project_id: "",
    is_mandatory: false,
    is_reserved: false,
    description: ""
  });
  const [balanceForm, setBalanceForm] = useState({
    account_name: "",
    balance: "",
    currency: "EUR",
    balance_date: ""
  });
  const [budgetForm, setBudgetForm] = useState({
    category_id: "",
    period_start: "",
    period_end: "",
    planned_amount: "",
    currency: "EUR"
  });

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const client = supabase;
    let active = true;

    async function load() {
      try {
        const [
          { data: categoryData, error: categoryError },
          { data: transactionData, error: transactionError },
          { data: balanceData, error: balanceError },
          { data: budgetData, error: budgetError },
          { data: budgetStatusData, error: budgetStatusError },
          { data: balanceViewData, error: balanceViewError },
          { data: projectData, error: projectError }
        ] = await Promise.all([
          client.from("finance_categories").select("*").order("sort_order", { ascending: true }),
          client.from("finances").select("*").order("transaction_date", { ascending: false }).limit(12),
          client.from("account_balances").select("*").order("balance_date", { ascending: false }),
          client.from("budgets").select("*").order("period_start", { ascending: false }),
          client
            .from("vue_budget_status")
            .select("*")
            .order("period_start", { ascending: false }),
          client.from("vue_solde_reel_disponible").select("*").order("currency", { ascending: true }),
          client.from("projects").select("*").order("title", { ascending: true })
        ]);

        if (
          categoryError ??
          transactionError ??
          balanceError ??
          budgetError ??
          budgetStatusError ??
          balanceViewError ??
          projectError
        ) {
          throw (
            categoryError ??
            transactionError ??
            balanceError ??
            budgetError ??
            budgetStatusError ??
            balanceViewError ??
            projectError
          );
        }

        if (!active) {
          return;
        }

        setCategories((categoryData as FinanceCategoryRow[]) ?? []);
        setTransactions((transactionData as FinanceRow[]) ?? []);
        setBalances((balanceData as AccountBalanceRow[]) ?? []);
        setBudgets((budgetData as BudgetRow[]) ?? []);
        setBudgetStatuses((budgetStatusData as BudgetStatusRow[]) ?? []);
        setBalanceView((balanceViewData as SoldeReelRow[]) ?? []);
        setProjects((projectData as ProjectRow[]) ?? []);
      } catch (error) {
        if (active) {
          onError(messageFromError(error));
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [onError, refreshToken, userId]);

  async function createCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      return;
    }

    setCategorySaving(true);

    try {
      const slug = categoryForm.slug || slugify(categoryForm.name);

      const { error } = await supabase.from("finance_categories").insert({
        user_id: userId,
        name: categoryForm.name,
        slug,
        transaction_type: categoryForm.transaction_type,
        is_system: false,
        is_active: true
      });

      if (error) {
        throw error;
      }

      setCategoryForm({
        name: "",
        slug: "",
        transaction_type: "expense"
      });
      onInfo("Catégorie personnelle créée.");
      onDataChanged();
    } catch (error) {
      onError(messageFromError(error));
    } finally {
      setCategorySaving(false);
    }
  }

  async function createTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      return;
    }

    setTransactionSaving(true);

    try {
      const { error } = await supabase.from("finances").insert({
        user_id: userId,
        project_id: transactionForm.project_id || null,
        category_id: transactionForm.category_id,
        transaction_type: transactionForm.transaction_type,
        amount: Number(transactionForm.amount),
        currency: transactionForm.currency,
        transaction_date: transactionForm.transaction_date || todayDate(timezone),
        status: transactionForm.status,
        is_mandatory: transactionForm.is_mandatory,
        is_reserved: transactionForm.is_reserved,
        description: transactionForm.description || null
      });

      if (error) {
        throw error;
      }

      setTransactionForm({
        transaction_type: "expense",
        category_id: "",
        amount: "",
        currency: "EUR",
        transaction_date: todayDate(timezone),
        status: "planned",
        project_id: "",
        is_mandatory: false,
        is_reserved: false,
        description: ""
      });
      onInfo("Transaction enregistrée.");
      onDataChanged();
    } catch (error) {
      onError(messageFromError(error));
    } finally {
      setTransactionSaving(false);
    }
  }

  async function createBalance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      return;
    }

    setBalanceSaving(true);

    try {
      const { error } = await supabase.from("account_balances").insert({
        user_id: userId,
        account_name: balanceForm.account_name,
        balance: Number(balanceForm.balance),
        currency: balanceForm.currency,
        balance_date:
          localDateTimeInputToIso(balanceForm.balance_date) ?? new Date().toISOString()
      });

      if (error) {
        throw error;
      }

      setBalanceForm({
        account_name: "",
        balance: "",
        currency: "EUR",
        balance_date: ""
      });
      onInfo("Solde courant enregistré.");
      onDataChanged();
    } catch (error) {
      onError(messageFromError(error));
    } finally {
      setBalanceSaving(false);
    }
  }

  async function createBudget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      return;
    }

    setBudgetSaving(true);

    try {
      const { error } = await supabase.from("budgets").insert({
        user_id: userId,
        category_id: budgetForm.category_id,
        period_start: budgetForm.period_start,
        period_end: budgetForm.period_end,
        planned_amount: Number(budgetForm.planned_amount),
        currency: budgetForm.currency
      });

      if (error) {
        throw error;
      }

      setBudgetForm({
        category_id: "",
        period_start: "",
        period_end: "",
        planned_amount: "",
        currency: "EUR"
      });
      onInfo("Budget enregistré.");
      onDataChanged();
    } catch (error) {
      onError(messageFromError(error));
    } finally {
      setBudgetSaving(false);
    }
  }

  async function removeTransaction(transactionId: string) {
    if (!supabase) {
      return;
    }

    try {
      const { error } = await supabase.from("finances").delete().eq("id", transactionId);

      if (error) {
        throw error;
      }

      onInfo("Transaction supprimée.");
      onDataChanged();
    } catch (error) {
      onError(messageFromError(error));
    }
  }

  async function removeBudget(budgetId: string) {
    if (!supabase) {
      return;
    }

    try {
      const { error } = await supabase.from("budgets").delete().eq("id", budgetId);

      if (error) {
        throw error;
      }

      onInfo("Budget supprimé.");
      onDataChanged();
    } catch (error) {
      onError(messageFromError(error));
    }
  }

  async function removeCategory(categoryId: string) {
    if (!supabase) {
      return;
    }

    try {
      const { error } = await supabase.from("finance_categories").delete().eq("id", categoryId);

      if (error) {
        throw error;
      }

      onInfo("Catégorie supprimée.");
      onDataChanged();
    } catch (error) {
      onError(messageFromError(error));
    }
  }

  const availableStatuses =
    transactionForm.transaction_type === "expense" ? EXPENSE_STATUSES : INCOME_STATUSES;
  const transactionCategories = categories.filter((category) => {
    return !category.transaction_type || category.transaction_type === transactionForm.transaction_type;
  });
  const expenseCategories = categories.filter((category) => category.transaction_type !== "income");
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const budgetMap = new Map(budgets.map((budget) => [budget.id, budget]));

  return (
    <div className="content-grid">
      <SectionCard title="Pilotage des soldes" subtitle="La vue base + engagements protégés sert de boussole financière.">
        {balanceView.length === 0 ? (
          <p className="muted-copy">Aucun solde agrégé disponible.</p>
        ) : (
          <div className="stats-grid">
            {balanceView.map((row) => (
              <MetricCard
                key={`${row.user_id}-${row.currency}`}
                label={`Disponible réel · ${row.currency}`}
                value={formatMoney(row.real_available_balance, row.currency)}
                hint={`Courant ${formatMoney(row.current_balance, row.currency)} · Protégé ${formatMoney(
                  row.protected_outflows,
                  row.currency
                )}`}
                tone="accent"
              />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Ajouter une catégorie personnelle" subtitle="Les catégories système restent visibles, mais non modifiables par l'utilisateur.">
        <form className="stack-form" onSubmit={createCategory}>
          <div className="grid-three">
            <label>
              <span>Nom</span>
              <input
                value={categoryForm.name}
                onChange={(event) =>
                  setCategoryForm((current) => ({
                    ...current,
                    name: event.target.value,
                    slug: slugify(event.target.value)
                  }))
                }
                required
              />
            </label>
            <label>
              <span>Slug</span>
              <input
                value={categoryForm.slug}
                onChange={(event) =>
                  setCategoryForm((current) => ({
                    ...current,
                    slug: slugify(event.target.value)
                  }))
                }
                required
              />
            </label>
            <label>
              <span>Type</span>
              <select
                value={categoryForm.transaction_type}
                onChange={(event) =>
                  setCategoryForm((current) => ({
                    ...current,
                    transaction_type: event.target.value as TransactionType
                  }))
                }
              >
                <option value="expense">expense</option>
                <option value="income">income</option>
              </select>
            </label>
          </div>
          <button type="submit" className="secondary-button" disabled={categorySaving}>
            {categorySaving ? "Création..." : "Créer la catégorie"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Enregistrer une transaction" subtitle="Le couple catégorie/type est validé par la base avant insertion.">
        <form className="stack-form" onSubmit={createTransaction}>
          <div className="grid-three">
            <label>
              <span>Type</span>
              <select
                value={transactionForm.transaction_type}
                onChange={(event) =>
                  setTransactionForm((current) => ({
                    ...current,
                    transaction_type: event.target.value as TransactionType,
                    status: "planned",
                    category_id: ""
                  }))
                }
              >
                <option value="expense">expense</option>
                <option value="income">income</option>
              </select>
            </label>
            <label>
              <span>Catégorie</span>
              <select
                value={transactionForm.category_id}
                onChange={(event) =>
                  setTransactionForm((current) => ({
                    ...current,
                    category_id: event.target.value
                  }))
                }
                required
              >
                <option value="">Choisir</option>
                {transactionCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Projet lié</span>
              <select
                value={transactionForm.project_id}
                onChange={(event) =>
                  setTransactionForm((current) => ({
                    ...current,
                    project_id: event.target.value
                  }))
                }
              >
                <option value="">Aucun</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid-three">
            <label>
              <span>Montant</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={transactionForm.amount}
                onChange={(event) =>
                  setTransactionForm((current) => ({
                    ...current,
                    amount: event.target.value
                  }))
                }
                required
              />
            </label>
            <label>
              <span>Devise</span>
              <input
                value={transactionForm.currency}
                maxLength={3}
                onChange={(event) =>
                  setTransactionForm((current) => ({
                    ...current,
                    currency: event.target.value.toUpperCase()
                  }))
                }
              />
            </label>
            <label>
              <span>Date</span>
              <input
                type="date"
                value={transactionForm.transaction_date}
                onChange={(event) =>
                  setTransactionForm((current) => ({
                    ...current,
                    transaction_date: event.target.value
                  }))
                }
                required
              />
            </label>
          </div>

          <div className="grid-three">
            <label>
              <span>Statut</span>
              <select
                value={transactionForm.status}
                onChange={(event) =>
                  setTransactionForm((current) => ({
                    ...current,
                    status: event.target.value as FinanceStatus
                  }))
                }
              >
                {availableStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={transactionForm.is_mandatory}
                onChange={(event) =>
                  setTransactionForm((current) => ({
                    ...current,
                    is_mandatory: event.target.checked
                  }))
                }
              />
              <span>Obligatoire</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={transactionForm.is_reserved}
                onChange={(event) =>
                  setTransactionForm((current) => ({
                    ...current,
                    is_reserved: event.target.checked
                  }))
                }
                disabled={transactionForm.transaction_type !== "expense"}
              />
              <span>Réservé</span>
            </label>
          </div>

          <label>
            <span>Description</span>
            <textarea
              rows={3}
              value={transactionForm.description}
              onChange={(event) =>
                setTransactionForm((current) => ({
                  ...current,
                  description: event.target.value
                }))
              }
            />
          </label>

          <button type="submit" className="primary-button" disabled={transactionSaving}>
            {transactionSaving ? "Enregistrement..." : "Enregistrer la transaction"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Solde courant d'un compte" subtitle="Un nouvel insert sur le même compte mettra à jour la ligne existante côté base.">
        <form className="stack-form" onSubmit={createBalance}>
          <div className="grid-three">
            <label>
              <span>Compte</span>
              <input
                value={balanceForm.account_name}
                onChange={(event) =>
                  setBalanceForm((current) => ({
                    ...current,
                    account_name: event.target.value
                  }))
                }
                required
              />
            </label>
            <label>
              <span>Solde</span>
              <input
                type="number"
                step="0.01"
                value={balanceForm.balance}
                onChange={(event) =>
                  setBalanceForm((current) => ({
                    ...current,
                    balance: event.target.value
                  }))
                }
                required
              />
            </label>
            <label>
              <span>Devise</span>
              <input
                value={balanceForm.currency}
                maxLength={3}
                onChange={(event) =>
                  setBalanceForm((current) => ({
                    ...current,
                    currency: event.target.value.toUpperCase()
                  }))
                }
              />
            </label>
          </div>
          <label>
            <span>Date du solde</span>
            <input
              type="datetime-local"
              value={balanceForm.balance_date}
              onChange={(event) =>
                setBalanceForm((current) => ({
                  ...current,
                  balance_date: event.target.value
                }))
              }
            />
          </label>
          <button type="submit" className="secondary-button" disabled={balanceSaving}>
            {balanceSaving ? "Enregistrement..." : "Mettre à jour le solde"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Programmer un budget" subtitle="Uniquement sur des catégories compatibles dépense.">
        <form className="stack-form" onSubmit={createBudget}>
          <div className="grid-three">
            <label>
              <span>Catégorie</span>
              <select
                value={budgetForm.category_id}
                onChange={(event) =>
                  setBudgetForm((current) => ({
                    ...current,
                    category_id: event.target.value
                  }))
                }
                required
              >
                <option value="">Choisir</option>
                {expenseCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Montant prévu</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={budgetForm.planned_amount}
                onChange={(event) =>
                  setBudgetForm((current) => ({
                    ...current,
                    planned_amount: event.target.value
                  }))
                }
                required
              />
            </label>
            <label>
              <span>Devise</span>
              <input
                value={budgetForm.currency}
                maxLength={3}
                onChange={(event) =>
                  setBudgetForm((current) => ({
                    ...current,
                    currency: event.target.value.toUpperCase()
                  }))
                }
              />
            </label>
          </div>
          <div className="grid-two">
            <label>
              <span>Début</span>
              <input
                type="date"
                value={budgetForm.period_start}
                onChange={(event) =>
                  setBudgetForm((current) => ({
                    ...current,
                    period_start: event.target.value
                  }))
                }
                required
              />
            </label>
            <label>
              <span>Fin</span>
              <input
                type="date"
                value={budgetForm.period_end}
                onChange={(event) =>
                  setBudgetForm((current) => ({
                    ...current,
                    period_end: event.target.value
                  }))
                }
                required
              />
            </label>
          </div>
          <button type="submit" className="secondary-button" disabled={budgetSaving}>
            {budgetSaving ? "Création..." : "Créer le budget"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Transactions récentes" subtitle="Lecture directe des écritures protégées par RLS.">
        {transactions.length === 0 ? (
          <p className="muted-copy">Aucune transaction enregistrée.</p>
        ) : (
          <div className="list-stack">
            {transactions.map((transaction) => (
              <article className="list-card" key={transaction.id}>
                <div>
                  <h3>{categoryNames.get(transaction.category_id) ?? "Catégorie inconnue"}</h3>
                  <p>
                    {transaction.transaction_type} · {transaction.status} · {formatDate(transaction.transaction_date)}
                  </p>
                  <p>{transaction.description ?? "Sans description."}</p>
                </div>
                <div className="button-row">
                  <strong className="accent-value">
                    {formatMoney(transaction.amount, transaction.currency)}
                  </strong>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => removeTransaction(transaction.id)}
                  >
                    Supprimer
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Budgets et soldes" subtitle="Croisement des lignes courantes et des vues agrégées issues de PostgreSQL.">
        <div className="list-stack">
          {balances.map((balance) => (
            <article className="list-card" key={balance.id}>
              <div>
                <h3>{balance.account_name}</h3>
                <p>
                  {formatMoney(balance.balance, balance.currency)} · date {formatDateTime(balance.balance_date)}
                </p>
              </div>
            </article>
          ))}

          {budgetStatuses.map((budgetStatus) => {
            const budget = budgetMap.get(budgetStatus.budget_id);

            return (
              <article className="list-card" key={budgetStatus.budget_id}>
                <div>
                  <h3>{categoryNames.get(budgetStatus.category_id) ?? "Budget"}</h3>
                  <p>
                    {formatDate(budgetStatus.period_start)} → {formatDate(budgetStatus.period_end)} ·
                    prévu {formatMoney(budgetStatus.planned_amount, budgetStatus.currency)}
                  </p>
                  <p>
                    dépensé {formatMoney(budgetStatus.spent_amount, budgetStatus.currency)} · engagé{" "}
                    {formatMoney(budgetStatus.committed_amount, budgetStatus.currency)} · restant{" "}
                    {formatMoney(budgetStatus.remaining_amount, budgetStatus.currency)}
                  </p>
                </div>
                <div className="button-row">
                  <strong className="accent-value">
                    {budgetStatus.consumption_percentage === null
                      ? "—"
                      : `${toNumber(budgetStatus.consumption_percentage).toFixed(2)} %`}
                  </strong>
                  {budget ? (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => removeBudget(budget.id)}
                    >
                      Supprimer
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Catégories visibles" subtitle="Système + personnelles, avec restriction d'action sur les catégories système.">
        <div className="list-stack">
          {categories.map((category) => (
            <article className="list-card" key={category.id}>
              <div>
                <h3>{category.name}</h3>
                <p>
                  {category.slug} · {category.transaction_type ?? "mixed"} ·{" "}
                  {category.is_system ? "système" : "personnelle"}
                </p>
              </div>
              {!category.is_system ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => removeCategory(category.id)}
                >
                  Supprimer
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
