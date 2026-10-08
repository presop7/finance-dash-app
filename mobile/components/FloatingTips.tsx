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
import { currentLocale } from "../i18n";
import { usePlan, usePremiumStore } from "../store/usePremiumStore";

export type Tip = {
  id: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
  // Called when it's closed (✕ or its button): for tips that must not come
  // back at the next opening, like an offer.
  onDismiss?: () => void;
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
  const premium = usePremiumTips();

  const queue = [
    enabled.install ? install : null,
    // The rest wait while the app tour is running.
    ...(touring
      ? []
      : [
          enabled.notifications ? notifications.tip : null,
          premium.timer,
          premium.offer, // offers stop with Premium, not with a switch
          premium.report,
          ...(enabled.alerts ? alerts : []),
          enabled.reminder ? reminder : null,
        ]),
  ].filter((tip): tip is Tip => tip !== null && !closed.has(tip.id));

  const tip = queue[0];
  if (!tip) return null;
  const close = () => {
    tip.onDismiss?.();
    setClosed((prev) => new Set(prev).add(tip.id));
  };

  return (
    <View pointerEvents="box-none" style={[styles.stack, { top: insets.top + 8 }]}>
      <View style={styles.column}>
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

// Premium tips:
//   - timer: the trial-end offer's last hour, on every opening until it ends;
//   - offer: the one offer the offers engine picked today (utils/offers);
//   - report: on the first opening of a month, last month's report is ready.
function usePremiumTips(): { timer: Tip | null; offer: Tip | null; report: Tip | null } {
  const { t } = useTranslation();
  const signedIn = useAuthStore((s) => s.session !== null);
  const offer = usePremiumStore((s) => s.offer);
  const offerUntil = usePremiumStore((s) => s.trialEndOfferUntil);
  const reportTipMonth = usePremiumStore((s) => s.reportTipMonth);
  const transactions = useFinanceStore((s) => s.transactions);
  const { paid } = usePlan();
  if (!signedIn) return { timer: null, offer: null, report: null };
  const premium = usePremiumStore.getState();

  const now = Date.now();
  const timer: Tip | null =
    !paid && offerUntil !== null && offerUntil > now
      ? {
          id: "offerTimer",
          icon: "time-outline",
          title: t("offers.timerTitle"),
          text: t("offers.timerText", { minutes: Math.max(1, Math.ceil((offerUntil - now) / 60000)) }),
          action: t("offers.see"),
          onAction: () => premium.showPremium("offer"),
        }
      : null;

  const offerTip: Tip | null = offer
    ? {
        id: `offer-${offer}`,
        icon: "diamond-outline",
        title: t(`offers.${offer}.title`),
        text: t(`offers.${offer}.text`),
        action: t("offers.see"),
        onAction: () => premium.showPremium("offer"),
        onDismiss: () => premium.clearOffer(),
      }
    : null;

  // Last month's report, on the first opening of a new month (if last month
  // had anything in it).
  const today = new Date();
  const monthKey = `${today.getFullYear()}-${today.getMonth()}`;
  const last = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthHasData =
    reportTipMonth !== monthKey &&
    transactions.some((tx) => {
      const d = new Date(tx.date);
      return !isDemoId(tx.id) && d.getFullYear() === last.getFullYear() && d.getMonth() === last.getMonth();
    });
  const report: Tip | null = lastMonthHasData
    ? {
        id: `report-${monthKey}`,
        icon: "document-text-outline",
        title: t("report.tipTitle"),
        text: t("report.tipText", { month: last.toLocaleDateString(currentLocale(), { month: "long" }) }),
        action: t("report.open"),
        onAction: () => premium.setReportOpen(true),
        onDismiss: () => premium.setReportTipMonth(monthKey),
      }
    : null;

  return { timer, offer: offerTip, report };
}

const styles = StyleSheet.create({
  // Full width on a phone; a centered column on a computer's wide window.
  stack: { position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: 12 },
  column: { width: "100%", maxWidth: 480 },
});
