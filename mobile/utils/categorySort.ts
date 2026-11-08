import { sortByOrder } from "./reorder";
import { isDemoId } from "./demoTransactions";

// How categories/funds are ordered: last used, A–Z, most transactions, or the
// user's own arranged order.
export type CategorySort = "lastUsed" | "alpha" | "count" | "custom";

type Tx = { id: string; category: string; fundCategory: string; date: Date };
export type Usage = { last: Map<string, number>; count: Map<string, number> };

// Per category/fund id (expense, income and fund ids never clash): when it
// was last used — the later of its last save on this device and its newest
// transaction's date — and how many transactions use it.
export function usage(transactions: Tx[], stamps: Record<string, number>, now = Date.now()): Usage {
  const last = new Map<string, number>(Object.entries(stamps));
  const count = new Map<string, number>();
  for (const t of transactions) {
    if (isDemoId(t.id)) continue;
    // A future-dated transaction counts as used now, not as used later.
    const at = Math.min(new Date(t.date).getTime(), now);
    for (const id of [t.category, t.fundCategory]) {
      count.set(id, (count.get(id) ?? 0) + 1);
      if (at > (last.get(id) ?? 0)) last.set(id, at);
    }
  }
  return { last, count };
}

// Items in `mode` order; ties (and never-used ones) keep the custom order.
export function sortItems<T extends { id: string }>(
  items: T[],
  mode: CategorySort,
  order: string[],
  u: Usage,
  label: (item: T) => string,
): T[] {
  const custom = sortByOrder(items, order);
  if (mode === "custom") return custom;
  const by = (m: Map<string, number>) => (a: T, b: T) => (m.get(b.id) ?? 0) - (m.get(a.id) ?? 0);
  return [...custom].sort(
    mode === "alpha" ? (a, b) => label(a).localeCompare(label(b)) : by(mode === "count" ? u.count : u.last),
  );
}

// What keeps a transaction from being saved on the server (everything the
// backend requires): empty title, no positive amount, a category/fund that
// doesn't exist (or isn't set), an invalid date, or a deleted savings goal.
export type TxProblem = "title" | "amount" | "category" | "fund" | "date" | "goal";

export function txProblems(
  tx: { title: string; amount: number; category: string; fundCategory: string; date: Date; goalId?: string },
  known: { categories: { id: string }[]; funds: { id: string }[]; goals: { id: string }[] },
): TxProblem[] {
  const has = (list: { id: string }[], id: string) => list.some((x) => x.id === id);
  const problems: TxProblem[] = [];
  if (!tx.title?.trim()) problems.push("title");
  if (!(Number(tx.amount) > 0)) problems.push("amount");
  if (!has(known.categories, tx.category)) problems.push("category");
  if (!has(known.funds, tx.fundCategory)) problems.push("fund");
  if (isNaN(new Date(tx.date).getTime())) problems.push("date");
  if (tx.goalId && !has(known.goals, tx.goalId)) problems.push("goal");
  return problems;
}
