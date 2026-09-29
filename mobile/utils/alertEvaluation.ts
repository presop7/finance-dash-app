import { AlertRule, Transaction } from "../store/useFinanceStore";
import { Category } from "../constants/categories";
import i18n from "../i18n";

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
            title: i18n.t("alerts.lowBalance"),
            body: i18n.t("alerts.lowBalanceBody", { amount: rule.amount.toFixed(2) }),
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
            title: i18n.t("alerts.balanceAbove"),
            body: i18n.t("alerts.balanceAboveBody", { amount: rule.amount.toFixed(2) }),
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
            title: i18n.t("alerts.monthlyExpense"),
            body: i18n.t("alerts.monthlyExpenseBody", { spent: spent.toFixed(2), limit: rule.amount.toFixed(2) }),
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
            title: i18n.t("alerts.monthlyIncome"),
            body: i18n.t("alerts.monthlyIncomeBody", { earned: earned.toFixed(2), target: rule.amount.toFixed(2) }),
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
          const label = categories.find((c) => c.id === rule.categoryId)?.label ?? i18n.t("addTx.category");
          triggered.push({
            rule,
            title: i18n.t("alerts.categoryLimit"),
            body: i18n.t("alerts.categoryLimitBody", { category: label, spent: spent.toFixed(2), limit: rule.amount.toFixed(2) }),
            newKey: key,
            notify: true,
          });
        }
        break;
      }
      case "dailyReminder":
        // Time-based, not state-based — OS-scheduled directly (see
        // scheduleDailyReminder/useDailyReminderSync) rather than evaluated
        // here, since this effect only ever runs while the app's JS is
        // actually executing and couldn't fire a reminder on its own at an
        // arbitrary time of day with the app closed.
        break;
    }
  }

  return triggered;
}
