import { useEffect } from "react";
import { useFinanceStore } from "../store/useFinanceStore";
import { evaluateAlerts } from "../utils/alertEvaluation";
import { sendLocalNotification } from "../utils/notifications";
import { isDemoId } from "../utils/demoTransactions";
import { goalSaved, goalSpent } from "../utils/goals";
import i18n from "../i18n";

export function useAlertsMonitor() {
  const transactions = useFinanceStore((s) => s.transactions);
  const alertRules = useFinanceStore((s) => s.alertRules);
  const expenseCategories = useFinanceStore((s) => s.expenseCategories);
  const incomeCategories = useFinanceStore((s) => s.incomeCategories);
  const updateAlertRule = useFinanceStore((s) => s.updateAlertRule);
  const goals = useFinanceStore((s) => s.goals);

  useEffect(() => {
    const { goalsNotified, setGoalsNotified, notificationsEnabled, transactions: all } = useFinanceStore.getState();
    const real = all.filter((t) => !isDemoId(t.id));
    const reached = goals
      .filter((g) => !goalSpent(g, real) && goalSaved(g) >= g.target)
      .map((g) => g.id);
    for (const goal of goals) {
      if (reached.includes(goal.id) && !goalsNotified.includes(goal.id) && notificationsEnabled) {
        sendLocalNotification(i18n.t("alerts.savingsDone"), i18n.t("alerts.trackerDoneBody", { name: goal.name, amount: goal.target.toFixed(2) }));
      }
    }
    if (reached.join() !== goalsNotified.join()) setGoalsNotified(reached);
  }, [goals]);

  useEffect(() => {
    const results = evaluateAlerts(
      alertRules,
      // The app tour's sample rows mustn't trigger real notifications.
      transactions.filter((t) => !isDemoId(t.id)),
      expenseCategories,
      incomeCategories,
    );

    for (const result of results) {
      // Still marked as triggered while notifications are off, so turning
      // them back on doesn't fire a backlog of old alerts.
      if (result.notify && useFinanceStore.getState().notificationsEnabled) {
        sendLocalNotification(result.title, result.body);
      }
      updateAlertRule(result.rule.id, { lastTriggeredKey: result.newKey });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, alertRules, expenseCategories, incomeCategories]);
}
