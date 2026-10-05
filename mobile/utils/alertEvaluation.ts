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

// One rule's state right now: whether it's in alarm (`active`), the key that
// remembers having told the user about this state, and what to tell them.
// Balance rules (bothWays) record leaving the alarm state too, so that going
// back below the limit later alerts again; month rules alert once a month.
type Check = { active: boolean; key: string; title: string; body: string; bothWays: boolean };

function checkRule(
  rule: AlertRule,
  transactions: Transaction[],
  expenseCategories: Category[],
  incomeCategories: Category[],
  now: Date,
): Check | null {
  const balance = () =>
    transactions.reduce((sum, t) => sum + (t.type === "income" ? t.amount : -t.amount), 0);
  switch (rule.type) {
    case "lowBalance": {
      const active = balance() < rule.amount;
      return {
        active,
        key: active ? "below" : "above",
        title: i18n.t("alerts.lowBalance"),
        body: i18n.t("alerts.lowBalanceBody", { amount: rule.amount.toFixed(2) }),
        bothWays: true,
      };
    }
    case "balanceAbove": {
      const active = balance() > rule.amount;
      return {
        active,
        key: active ? "above" : "below",
        title: i18n.t("alerts.balanceAbove"),
        body: i18n.t("alerts.balanceAboveBody", { amount: rule.amount.toFixed(2) }),
        bothWays: true,
      };
    }
    case "monthlyExpenseOver": {
      const spent = sumInMonth(transactions, now, "expense");
      return {
        active: spent > rule.amount,
        key: monthKey(now),
        title: i18n.t("alerts.monthlyExpense"),
        body: i18n.t("alerts.monthlyExpenseBody", { spent: spent.toFixed(2), limit: rule.amount.toFixed(2) }),
        bothWays: false,
      };
    }
    case "monthlyIncomeOver": {
      const earned = sumInMonth(transactions, now, "income");
      return {
        active: earned > rule.amount,
        key: monthKey(now),
        title: i18n.t("alerts.monthlyIncome"),
        body: i18n.t("alerts.monthlyIncomeBody", { earned: earned.toFixed(2), target: rule.amount.toFixed(2) }),
        bothWays: false,
      };
    }
    case "categoryAmount": {
      if (!rule.categoryId || !rule.categoryType) return null;
      const spent = sumInMonth(transactions, now, rule.categoryType, rule.categoryId);
      const categories = rule.categoryType === "expense" ? expenseCategories : incomeCategories;
      const label = categories.find((c) => c.id === rule.categoryId)?.label ?? i18n.t("addTx.category");
      return {
        active: spent > rule.amount,
        key: `${monthKey(now)}:${rule.categoryId}`,
        title: i18n.t("alerts.categoryLimit"),
        body: i18n.t("alerts.categoryLimitBody", { category: label, spent: spent.toFixed(2), limit: rule.amount.toFixed(2) }),
        bothWays: false,
      };
    }
    case "dailyReminder":
      // Time-based, not state-based — OS-scheduled directly (see
      // scheduleDailyReminder/useDailyReminderSync) rather than evaluated
      // here, since this effect only ever runs while the app's JS is
      // actually executing and couldn't fire a reminder on its own at an
      // arbitrary time of day with the app closed.
      return null;
  }
}

// What changed since the user was last told: notifications to send, and the
// keys to remember (see useAlertsMonitor).
export function evaluateAlerts(
  rules: AlertRule[],
  transactions: Transaction[],
  expenseCategories: Category[],
  incomeCategories: Category[],
  now: Date = new Date(),
): TriggeredAlert[] {
  const triggered: TriggeredAlert[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const c = checkRule(rule, transactions, expenseCategories, incomeCategories, now);
    if (!c || c.key === rule.lastTriggeredKey) continue;
    if (!c.bothWays && !c.active) continue;
    triggered.push({ rule, title: c.title, body: c.body, newKey: c.key, notify: c.active });
  }
  return triggered;
}

// Every enabled rule that's in alarm right now, told before or not — what a
// device that gets no notifications shows as tips when the app opens.
export function activeAlerts(
  rules: AlertRule[],
  transactions: Transaction[],
  expenseCategories: Category[],
  incomeCategories: Category[],
  now: Date = new Date(),
): { id: string; title: string; body: string }[] {
  return rules.flatMap((rule) => {
    if (!rule.enabled) return [];
    const c = checkRule(rule, transactions, expenseCategories, incomeCategories, now);
    return c?.active ? [{ id: rule.id, title: c.title, body: c.body }] : [];
  });
}
