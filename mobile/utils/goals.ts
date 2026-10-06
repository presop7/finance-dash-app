import type { Goal, Transaction } from "../store/useFinanceStore";

const cents = (n: number) => Math.round(n * 100) / 100;

// How much is set aside for a goal right now.
export function goalSaved(goal: Goal): number {
  return cents(goal.allocations.reduce((sum, a) => sum + a.amount, 0));
}

// Where a goal's money sits: per fund, largest first (funds at 0 left out).
export function goalByFund(goal: Goal): { fundId: string; amount: number }[] {
  const byFund = new Map<string, number>();
  for (const a of goal.allocations) byFund.set(a.fundId, (byFund.get(a.fundId) ?? 0) + a.amount);
  return [...byFund]
    .map(([fundId, amount]) => ({ fundId, amount: cents(amount) }))
    .filter((f) => f.amount !== 0)
    .sort((a, b) => b.amount - a.amount);
}

// The expenses paid from a goal: once there's one, the goal is done (used),
// and its money no longer counts as set aside.
export function goalSpent(goal: Goal, transactions: Transaction[]): { amount: number; date: Date } | null {
  const paid = transactions.filter((t) => t.type === "expense" && t.goalId === goal.id);
  if (paid.length === 0) return null;
  return {
    amount: cents(paid.reduce((sum, t) => sum + t.amount, 0)),
    date: new Date(Math.max(...paid.map((t) => new Date(t.date).getTime()))),
  };
}

// Money set aside for goals still being saved for, per fund.
export function reservedByFund(goals: Goal[], transactions: Transaction[]): Map<string, number> {
  const reserved = new Map<string, number>();
  for (const goal of goals) {
    if (goalSpent(goal, transactions)) continue;
    for (const { fundId, amount } of goalByFund(goal)) {
      reserved.set(fundId, cents((reserved.get(fundId) ?? 0) + amount));
    }
  }
  return reserved;
}

// A fund's balance: income into it minus expenses from it.
export function fundBalance(fundId: string, transactions: Transaction[]): number {
  return cents(
    transactions.reduce(
      (sum, t) => (t.fundCategory === fundId ? sum + (t.type === "income" ? t.amount : -t.amount) : sum),
      0,
    ),
  );
}
