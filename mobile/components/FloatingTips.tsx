import { ComponentProps, useEffect, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useInstallTip } from "./InstallTip";
import TipCard from "./TipCard";
import { useFinanceStore } from "../store/useFinanceStore";
import { useAuthStore } from "../store/useAuthStore";
import { useTutorialStore } from "../store/useTutorialStore";
import { useHighlightStore } from "../store/useHighlightStore";
import { hasNotificationPermission, notificationsSupported } from "../utils/notifications";
import { activeAlerts } from "../utils/alertEvaluation";
import { isDemoId } from "../utils/demoTransactions";

export type Tip = {
  id: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
};

// Hours without a newly added transaction before the reminder tip shows.
const REMINDER_AFTER_H = 12;

// Set by the signed-in app: lets a tip open the new-transaction form.
let openAddTransaction: (() => void) | null = null;
export const setTipAddOpener = (fn: (() => void) | null) => {
  openAddTransaction = fn;
};

// Tips that float over the top of the app when it opens — one at a time, in
// this order; closing one (✕, or its button) brings the next. Each kind can
// be switched off in Settings → Floating tips. Closed tips stay closed until
// the app is next opened.
export default function FloatingTips({ onShowNotifications }: { onShowNotifications: () => void }) {
  const insets = useSafeAreaInsets();
  const enabled = useFinanceStore((s) => s.tips);
  const touring = useTutorialStore((s) => s.active);
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());

  const install = useInstallTip();
  const notifications = useNotificationTip(onShowNotifications);
  const alerts = useAlertTips(notifications.delivered);
  const reminder = useReminderTip();

  const queue = [
    enabled.install ? install : null,
    // The rest wait while the app tour is running.
    ...(touring
      ? []
      : [
          enabled.notifications ? notifications.tip : null,
          ...(enabled.alerts ? alerts : []),
          enabled.reminder ? reminder : null,
        ]),
  ].filter((tip): tip is Tip => tip !== null && !closed.has(tip.id));

  const tip = queue[0];
  if (!tip) return null;
  const close = () => setClosed((prev) => new Set(prev).add(tip.id));

  return (
    <View pointerEvents="box-none" style={[styles.stack, { top: insets.top + 8 }]}>
      <TipCard
        key={tip.id}
        icon={tip.icon}
        title={tip.title}
        text={tip.text}
        action={tip.action}
        onAction={
          tip.onAction &&
          (() => {
            tip.onAction?.();
            close();
          })
        }
        onClose={close}
      />
    </View>
  );
}

// Signed in, notifications possible here but not on: a nudge to turn them
// on. "Show me" opens Settings at the Notifications switch and flashes it.
// Also says whether notifications reach this device (null: not known yet).
function useNotificationTip(onShow: () => void): { tip: Tip | null; delivered: boolean | null } {
  const { t } = useTranslation();
  const signedIn = useAuthStore((s) => s.session !== null);
  const enabled = useFinanceStore((s) => s.notificationsEnabled);
  const [permitted, setPermitted] = useState<boolean | null>(notificationsSupported ? null : false);

  // Re-checked when the app comes back: permission may have been given in
  // the phone's or browser's settings meanwhile.
  useEffect(() => {
    if (!notificationsSupported) return;
    const check = () => hasNotificationPermission().then(setPermitted);
    check();
    const sub = AppState.addEventListener("change", (state) => state === "active" && check());
    return () => sub.remove();
  }, []);

  const delivered = permitted === null ? null : permitted && enabled;
  if (!notificationsSupported || !signedIn || delivered !== false) return { tip: null, delivered };
  return {
    delivered,
    tip: {
      id: "notifications",
      icon: "notifications-outline",
      title: t("notificationTip.title"),
      text: t("notificationTip.text"),
      action: t("notificationTip.show"),
      onAction: () => {
        onShow();
        useHighlightStore.getState().highlight("notifications");
      },
    },
  };
}

// No notifications on this device (an older phone, a Safari tab, or simply
// not turned on): the money alerts that are true right now (low balance, a
// monthly limit passed...) show as tips instead — taken once, when the app
// opens with data to look at.
function useAlertTips(delivered: boolean | null): Tip[] {
  const signedIn = useAuthStore((s) => s.session !== null);
  const status = useFinanceStore((s) => s.status);
  const [tips, setTips] = useState<Tip[] | null>(null);

  useEffect(() => {
    if (tips !== null || !signedIn || delivered === null) return;
    if (status !== "loaded" && status !== "refreshing") return;
    if (delivered) {
      setTips([]);
      return;
    }
    const s = useFinanceStore.getState();
    const real = s.transactions.filter((tx) => !isDemoId(tx.id));
    setTips(
      activeAlerts(s.alertRules, real, s.expenseCategories, s.incomeCategories).map((a) => ({
        id: `alert:${a.id}`,
        icon: "warning-outline",
        title: a.title,
        text: a.body,
      })),
    );
  }, [tips, signedIn, delivered, status]);

  return tips ?? [];
}

// Nothing added for REMINDER_AFTER_H hours: a nudge with a button straight
// to the new-transaction form. Goes away by itself once something's added.
function useReminderTip(): Tip | null {
  const { t } = useTranslation();
  const signedIn = useAuthStore((s) => s.session !== null);
  const status = useFinanceStore((s) => s.status);
  const lastAddedAt = useFinanceStore((s) => s.lastAddedAt);
  const transactions = useFinanceStore((s) => s.transactions);

  if (!signedIn || (status !== "loaded" && status !== "refreshing")) return null;
  const now = Date.now();
  let latest = lastAddedAt ?? 0;
  let any = false;
  for (const tx of transactions) {
    if (isDemoId(tx.id)) continue;
    any = true;
    const at = tx.date.getTime();
    if (at <= now && at > latest) latest = at;
  }
  // A brand-new account has the app tour for its first steps instead.
  if (!any && lastAddedAt === null) return null;
  if (now - latest < REMINDER_AFTER_H * 3600_000) return null;
  return {
    id: "reminder",
    icon: "time-outline",
    title: t("reminderTip.title"),
    text: t("reminderTip.text", { count: REMINDER_AFTER_H }),
    action: t("reminderTip.add"),
    onAction: () => openAddTransaction?.(),
  };
}

const styles = StyleSheet.create({
  stack: { position: "absolute", left: 12, right: 12 },
});
