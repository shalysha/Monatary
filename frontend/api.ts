const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

async function req(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export type Account = {
  key: string;
  name: string;
  balance: number;
  target: number;
  color: string;
};

export type Card = {
  key: string;
  name: string;
  balance: number;
  color: string;
};

export type DashboardAccount = Account & {
  owed_to_cards: number;
  projected_balance: number;
  spent_this_month: number;
  is_negative_projected: boolean;
  is_zero_projected: boolean;
};

export type Category = {
  id: string;
  name: string;
  parent_account: string;
  monthly_target: number;
  auto_create: boolean;
  day_of_month: number;
  last_run_month?: string;
  spent_this_month?: number;
  remaining?: number;
  over_budget?: boolean;
};

export type DashboardCard = Card & { breakdown: Record<string, number> };

export type Dashboard = {
  accounts: DashboardAccount[];
  cards: DashboardCard[];
  categories: Category[];
  totals: { total_balance: number; total_owed: number; total_projected: number };
  month: string;
};

export type Expense = {
  id: string;
  description: string;
  amount: number;
  category?: string;
  date: string;
  payment_method: "cash" | "credit";
  source_account?: string;
  card?: string;
  payoff_account?: string;
  created_at: string;
};

export type Income = {
  id: string;
  source: string;
  date: string;
  total: number;
  allocation: { fixed_expenses: number; variable: number; general: number; savings: number };
  created_at: string;
};

export type Recurring = {
  id: string;
  description: string;
  amount: number;
  category?: string;
  payment_method: "cash" | "credit";
  source_account?: string;
  card?: string;
  payoff_account?: string;
  day_of_month: number;
  last_run_month?: string;
  created_at: string;
};

export type AnalyticsMonth = {
  month: string;
  income: number;
  expense: number;
  net: number;
  by_account: Record<string, number>;
};

export const api = {
  init: () => req("/init", { method: "POST" }),
  dashboard: (): Promise<Dashboard> => req("/dashboard"),
  accounts: (): Promise<Account[]> => req("/accounts"),
  cards: (): Promise<Card[]> => req("/cards"),
  updateAccount: (key: string, body: Partial<Account>) =>
    req(`/accounts/${key}`, { method: "PUT", body: JSON.stringify(body) }),
  expenses: (month?: string): Promise<Expense[]> =>
    req(`/expenses${month ? `?month=${month}` : ""}`),
  createExpense: (body: any): Promise<Expense> =>
    req("/expenses", { method: "POST", body: JSON.stringify(body) }),
  deleteExpense: (id: string) => req(`/expenses/${id}`, { method: "DELETE" }),
  incomes: (): Promise<Income[]> => req("/incomes"),
  createIncome: (body: any): Promise<Income> =>
    req("/incomes", { method: "POST", body: JSON.stringify(body) }),
  deleteIncome: (id: string) => req(`/incomes/${id}`, { method: "DELETE" }),
  payoffCard: (card: string) =>
    req("/cards/payoff", { method: "POST", body: JSON.stringify({ card }) }),
  reset: () => req("/reset", { method: "POST" }),
  recurring: (): Promise<Recurring[]> => req("/recurring"),
  createRecurring: (body: any): Promise<Recurring> =>
    req("/recurring", { method: "POST", body: JSON.stringify(body) }),
  deleteRecurring: (id: string) => req(`/recurring/${id}`, { method: "DELETE" }),
  runRecurring: (id: string) => req(`/recurring/${id}/run`, { method: "POST" }),
  analytics: (months: number = 6): Promise<{ months: AnalyticsMonth[] }> =>
    req(`/analytics?months=${months}`),
  rollover: (sweepToSavings: boolean = true) =>
    req("/rollover", { method: "POST", body: JSON.stringify({ sweep_to_savings: sweepToSavings }) }),
  categories: (): Promise<Category[]> => req("/categories"),
  createCategory: (body: any): Promise<Category> =>
    req("/categories", { method: "POST", body: JSON.stringify(body) }),
  updateCategory: (id: string, body: any): Promise<Category> =>
    req(`/categories/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteCategory: (id: string) => req(`/categories/${id}`, { method: "DELETE" }),
  runCategory: (id: string) => req(`/categories/${id}/run`, { method: "POST" }),
  seedBudget: () => req("/seed-budget", { method: "POST" }),
};
