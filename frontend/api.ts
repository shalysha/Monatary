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

export type DashboardCard = Card & { breakdown: Record<string, number> };

export type Dashboard = {
  accounts: DashboardAccount[];
  cards: DashboardCard[];
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
};
