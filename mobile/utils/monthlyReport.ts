import type { Transaction } from "../store/useFinanceStore";

const cents = (n: number) => Math.round(n * 100) / 100;

export type CategoryLine = { id: string; now: number; before: number; change: number };

export type MonthlyReport = {
  income: number;
  expense: number;
  net: number;
  // Share of income not spent (null without income).
  keptShare: number | null;
  count: number;
  topCategory: CategoryLine | null;
  // Spending per category, this month vs the month before, largest first.
  categories: CategoryLine[];
  // The three categories that changed most against the month before.
  biggestChanges: CategoryLine[];
};

// A month in numbers (month is 0-11): the free headline (income, spending,
// net, top category) and the Premium detail (each category against the
// previous month, the share kept, the biggest changes).
export function monthlyReport(transactions: Transaction[], year: number, month: number): MonthlyReport {
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;
  const isIn = (t: Transaction, y: number, m: number) => {
    const d = new Date(t.date);
    return d.getFullYear() === y && d.getMonth() === m;
  };
  const current = transactions.filter((t) => isIn(t, year, month));
  const previous = transactions.filter((t) => isIn(t, prevYear, prevMonth));
  const sum = (list: Transaction[], type: "income" | "expense") =>
    cents(list.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0));

  const spending = (list: Transaction[]) => {
    const by = new Map<string, number>();
    for (const t of list) if (t.type === "expense") by.set(t.category, (by.get(t.category) ?? 0) + t.amount);
    return by;
  };
  const nowBy = spending(current);
  const beforeBy = spending(previous);
  const ids = new Set([...nowBy.keys(), ...beforeBy.keys()]);
  const categories = [...ids]
    .map((id) => {
      const now = cents(nowBy.get(id) ?? 0);
      const before = cents(beforeBy.get(id) ?? 0);
      return { id, now, before, change: cents(now - before) };
    })
    .sort((a, b) => b.now - a.now);

  const income = sum(current, "income");
  const expense = sum(current, "expense");
  return {
    income,
    expense,
    net: cents(income - expense),
    keptShare: income > 0 ? (income - expense) / income : null,
    count: current.length,
    topCategory: categories.find((c) => c.now > 0) ?? null,
    categories: categories.filter((c) => c.now > 0 || c.before > 0),
    biggestChanges: [...categories]
      .filter((c) => c.change !== 0)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 3),
  };
}
