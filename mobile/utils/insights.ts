import { Transaction } from "../store/useFinanceStore";
import { Category } from "../constants/categories";
import { daysAgo, percentageChange } from "./dateRanges";
import { formatCurrency } from "./currency";

function inLast(transactions: Transaction[], days: number, now: Date) {
  const since = daysAgo(days, now);
  return transactions.filter((t) => new Date(t.date).getTime() >= since.getTime());
}

export function getInsights(
  transactions: Transaction[],
  expenseCategories: Category[],
  now: Date = new Date(),
  currency: string = "BGN",
): string[] {
  if (transactions.length === 0) {
    return ["Add your first transaction to get started!"];
  }

  const insights: string[] = [];

  const totalSavings = transactions.reduce(
    (sum, t) => sum + (t.type === "income" ? t.amount : -t.amount),
    0,
  );
  if (totalSavings >= 0) {
    insights.push(
      `You've saved ${formatCurrency(totalSavings, currency)} in total. Great job keeping your finances in check!`,
    );
  } else {
    insights.push(
      `You're ${formatCurrency(Math.abs(totalSavings), currency)} in the red overall — time to review your spending.`,
    );
  }

  const last30 = inLast(transactions, 30, now);
  const income30 = last30
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  if (income30 > 0) {
    insights.push(
      `You've earned ${formatCurrency(income30, currency)} in the last 30 days.`,
    );
  }

  const expenses30 = last30.filter((t) => t.type === "expense");
  if (expenses30.length > 0) {
    const byCategory = new Map<string, number>();
    for (const t of expenses30) {
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount);
    }
    const [topCategoryId, topCategoryAmount] = [...byCategory.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0];
    const label =
      expenseCategories.find((c) => c.id === topCategoryId)?.label ??
      topCategoryId;
    insights.push(
      `Your biggest spending category in the last 30 days is ${label} at ${formatCurrency(topCategoryAmount, currency)}.`,
    );

    const biggestExpense = [...expenses30].sort(
      (a, b) => b.amount - a.amount,
    )[0];
    insights.push(
      `Your biggest single expense in the last 30 days was "${biggestExpense.title || label}" at ${formatCurrency(biggestExpense.amount, currency)}.`,
    );
  }

  const prev30 = transactions.filter((t) => {
    const time = new Date(t.date).getTime();
    return (
      time >= daysAgo(60, now).getTime() && time < daysAgo(30, now).getTime()
    );
  });
  const prevExpense30 = prev30
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const currExpense30 = expenses30.reduce((sum, t) => sum + t.amount, 0);
  if (prevExpense30 > 0) {
    const change = percentageChange(currExpense30, prevExpense30);
    if (change > 0) {
      insights.push(
        `Your spending is up ${change}% compared to the previous 30 days. Keep an eye on it!`,
      );
    } else if (change < 0) {
      insights.push(
        `Your spending is down ${Math.abs(change)}% compared to the previous 30 days. Nice work!`,
      );
    }
  }

  const lastExpense = [...transactions]
    .filter((t) => t.type === "expense")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  if (lastExpense) {
    const daysSince = Math.floor(
      (now.getTime() - new Date(lastExpense.date).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (daysSince >= 2) {
      insights.push(
        `It's been ${daysSince} days since your last expense — nice no-spend streak!`,
      );
    }
  }

  return insights;
}

// `days: null` means "all time" — no lower bound on the date filter.
export function getTopExpenses(
  transactions: Transaction[],
  days: number | null = 30,
  limit: number = 5,
  now: Date = new Date(),
): Transaction[] {
  const since = days === null ? null : daysAgo(days, now);
  return transactions
    .filter(
      (t) =>
        t.type === "expense" &&
        (since === null || new Date(t.date).getTime() >= since.getTime()),
    )
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}
