import { AlertRule, Transaction } from "../store/useFinanceStore";
import { Category } from "../constants/categories";

export type TriggeredAlert = {
  rule: AlertRule;
  title: string;
  body: string;
  newKey: string;
  notify: boolean;
};

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
}

function sumInMonth(
  transactions: Transaction[],
  now: Date,
  type: "income" | "expense",
  categoryId?: string,
): number {
  const key = monthKey(now);
  return transactions
    .filter((t) => t.type === type)
    .filter((t) => monthKey(new Date(t.date)) === key)
    .filter((t) => !categoryId || t.category === categoryId)
    .reduce((sum, t) => sum + t.amount, 0);
}

export function evaluateAlerts(
  rules: AlertRule[],
  transactions: Transaction[],
  expenseCategories: Category[],
  incomeCategories: Category[],
  now: Date = new Date(),
): TriggeredAlert[] {
  const balance = transactions.reduce(
    (sum, t) => sum + (t.type === "income" ? t.amount : -t.amount),
    0,
  );
  const triggered: TriggeredAlert[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    switch (rule.type) {
      case "lowBalance": {
        const crossed = balance < rule.amount;
        const newKey = crossed ? "below" : "above";
        if (newKey !== rule.lastTriggeredKey) {
          triggered.push({
            rule,
            title: "Low Balance",
            body: `Your balance dropped below ${rule.amount.toFixed(2)}.`,
            newKey,
            notify: crossed,
          });
        }
        break;
      }
      case "balanceAbove": {
        const crossed = balance > rule.amount;
        const newKey = crossed ? "above" : "below";
        if (newKey !== rule.lastTriggeredKey) {
          triggered.push({
            rule,
            title: "Balance Above Target",
            body: `Your balance is now above ${rule.amount.toFixed(2)}.`,
            newKey,
            notify: crossed,
          });
        }
        break;
      }
      case "monthlyExpenseOver": {
        const spent = sumInMonth(transactions, now, "expense");
        const key = monthKey(now);
        if (spent > rule.amount && rule.lastTriggeredKey !== key) {
          triggered.push({
            rule,
            title: "Monthly Expenses Over Budget",
            body: `You've spent ${spent.toFixed(2)} this month, over your ${rule.amount.toFixed(2)} limit.`,
            newKey: key,
            notify: true,
          });
        }
        break;
      }
      case "monthlyIncomeOver": {
        const earned = sumInMonth(transactions, now, "income");
        const key = monthKey(now);
        if (earned > rule.amount && rule.lastTriggeredKey !== key) {
          triggered.push({
            rule,
            title: "Monthly Income Over Target",
            body: `You've earned ${earned.toFixed(2)} this month, over your ${rule.amount.toFixed(2)} target.`,
            newKey: key,
            notify: true,
          });
        }
        break;
      }
      case "categoryAmount": {
        if (!rule.categoryId || !rule.categoryType) break;
        const spent = sumInMonth(
          transactions,
          now,
          rule.categoryType,
          rule.categoryId,
        );
        const key = `${monthKey(now)}:${rule.categoryId}`;
        if (spent > rule.amount && rule.lastTriggeredKey !== key) {
          const categories =
            rule.categoryType === "expense" ? expenseCategories : incomeCategories;
          const label = categories.find((c) => c.id === rule.categoryId)?.label ?? "Category";
          triggered.push({
            rule,
            title: "Category Limit Reached",
            body: `${label} reached ${spent.toFixed(2)}, over your ${rule.amount.toFixed(2)} limit.`,
            newKey: key,
            notify: true,
          });
        }
        break;
      }
    }
  }

  return triggered;
}
