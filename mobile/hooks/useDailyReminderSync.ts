import { useEffect, useRef } from "react";
import { useFinanceStore } from "../store/useFinanceStore";
import { scheduleDailyReminder, cancelDailyReminder } from "../utils/notifications";

// Keeps the OS-scheduled daily reminder notifications in sync with the
// "dailyReminder" alert rules — re-syncs whenever alertRules changes (add,
// edit, toggle, delete), not just once on mount, so e.g. changing the time
// or turning a reminder off takes effect immediately rather than needing an
// app restart.
export function useDailyReminderSync() {
  const alertRules = useFinanceStore((s) => s.alertRules);
  // Rules that disappear entirely (deleted, or switched away from
  // "dailyReminder") wouldn't otherwise get their OS-scheduled notification
  // cancelled — they just wouldn't show up in the next pass. Tracking the
  // last-synced id set is what catches that case.
  const syncedIdsRef = useRef(new Set<string>());

  useEffect(() => {
    const reminders = alertRules.filter((r) => r.type === "dailyReminder");
    const currentIds = new Set(reminders.map((r) => r.id));

    for (const staleId of syncedIdsRef.current) {
      if (!currentIds.has(staleId)) cancelDailyReminder(staleId);
    }

    for (const rule of reminders) {
      if (rule.enabled && rule.hour !== undefined && rule.minute !== undefined) {
        scheduleDailyReminder(
          rule.id,
          rule.hour,
          rule.minute,
          "Log today's transactions",
          "Don't forget to add any transactions from today.",
        );
      } else {
        cancelDailyReminder(rule.id);
      }
    }

    syncedIdsRef.current = currentIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertRules]);
}
