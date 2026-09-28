import { useEffect } from "react";
import { useFinanceStore } from "../store/useFinanceStore";
import { evaluateAlerts } from "../utils/alertEvaluation";
import { sendLocalNotification } from "../utils/notifications";
import { isDemoId } from "../utils/demoTransactions";

export function useAlertsMonitor() {
  const transactions = useFinanceStore((s) => s.transactions);
  const alertRules = useFinanceStore((s) => s.alertRules);
  const expenseCategories = useFinanceStore((s) => s.expenseCategories);
  const incomeCategories = useFinanceStore((s) => s.incomeCategories);
  const updateAlertRule = useFinanceStore((s) => s.updateAlertRule);

  useEffect(() => {
    const results = evaluateAlerts(
      alertRules,
      // The app tour's sample rows mustn't trigger real notifications.
      transactions.filter((t) => !isDemoId(t.id)),
      expenseCategories,
      incomeCategories,
    );

    for (const result of results) {
      if (result.notify) {
        sendLocalNotification(result.title, result.body);
      }
      updateAlertRule(result.rule.id, { lastTriggeredKey: result.newKey });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, alertRules, expenseCategories, incomeCategories]);
}
