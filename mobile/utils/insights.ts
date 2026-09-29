import { Transaction } from "../store/useFinanceStore";
import { Category } from "../constants/categories";
import { daysAgo, percentageChange } from "./dateRanges";
import { formatCurrency } from "./currency";
import i18n from "../i18n";

function inLast(transactions: Transaction[], days: number, now: Date) {
  const since = daysAgo(days, now);
  return transactions.filter((t) => new Date(t.date).getTime() >= since.getTime());
}

export function getInsights(
  transactions: Transaction[],
  expenseCategories: Category[],
  now: Date = new Date(),
  currency: string = "EUR",
): string[] {
  if (transactions.length === 0) {
    return [i18n.t("insights.first")];
  }

  const insights: string[] = [];

  const totalSavings = transactions.reduce(
    (sum, t) => sum + (t.type === "income" ? t.amount : -t.amount),
    0,
  );
  if (totalSavings >= 0) {
    insights.push(
      i18n.t("insights.savedTotal", { amount: formatCurrency(totalSavings, currency) }),
    );
  } else {
    insights.push(
      i18n.t("insights.inRed", { amount: formatCurrency(Math.abs(totalSavings), currency) }),
    );
  }

  const last30 = inLast(transactions, 30, now);
  const income30 = last30
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  if (income30 > 0) {
    insights.push(
      i18n.t("insights.earned30", { amount: formatCurrency(income30, currency) }),
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
      i18n.t("insights.topCategory", { category: label, amount: formatCurrency(topCategoryAmount, currency) }),
    );

    const biggestExpense = [...expenses30].sort(
      (a, b) => b.amount - a.amount,
    )[0];
    insights.push(
      i18n.t("insights.biggestExpense", { title: biggestExpense.title || label, amount: formatCurrency(biggestExpense.amount, currency) }),
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
        i18n.t("insights.spendingUp", { pct: change }),
      );
    } else if (change < 0) {
      insights.push(
        i18n.t("insights.spendingDown", { pct: Math.abs(change) }),
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
        i18n.t("insights.noSpend", { count: daysSince }),
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
