import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Modal from "../../components/AppModal";
import ModalCloseButton from "../../components/ModalCloseButton";
import { ColorsType } from "../../constants/colors";
import { CONTENT_MAX_WIDTH } from "../../constants/layout";
import { FONT } from "../../constants/typography";
import { FREE, OFFER_PRICES, PRICES } from "../../constants/plan";
import { useThemeColors, getThemedStyles } from "../../hooks/useThemeColors";
import { useFinanceStore } from "../../store/useFinanceStore";
import { usePlan, usePremiumStore } from "../../store/usePremiumStore";
import { isTracker } from "../../utils/alertEvaluation";
import { alertAsync } from "../../utils/confirm";
import { useTranslation } from "react-i18next";
import i18n from "../../i18n";

const FEATURES = ["funds", "goals", "reminders", "charts", "insights", "report", "csv"] as const;

const euro = (n: number) => `€${n.toFixed(2)}`;

// The Premium screen: why it opened, what Premium adds, the prices (with an
// offer's price when one runs) and the buy button. Opened from every Premium
// button and lock, from Settings → Premium, and once when the trial ends
// (then with what was used, what goes, and the 1-hour offer).
// Buying isn't wired yet: store billing comes before the Play launch.
export default function PremiumModal() {
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);
  const insets = useSafeAreaInsets();
  const reason = usePremiumStore((s) => s.modal);
  const hide = usePremiumStore((s) => s.hidePremium);
  const trialEndUntil = usePremiumStore((s) => s.trialEndOfferUntil);
  const activeOffer = usePremiumStore((s) => s.activeOffer);
  const openedFor = usePremiumStore((s) => s.modalOffer);
  const premiumUses = usePremiumStore((s) => s.premiumUses);
  const plan = usePlan();
  const trialEndsAt = useFinanceStore((s) => s.plan.trialEndsAt);
  const { goals, fundCategories, alertRules } = useFinanceStore();
  const [plan_, setPlan] = useState<"yearly" | "monthly">("yearly");

  // The trial-end offer's countdown, ticking while the screen is open.
  const [now, setNow] = useState(Date.now());
  // The running offer window: the trial-end hour first, else a 15-minute one.
  const trialEndRunning = trialEndUntil !== null && trialEndUntil > now;
  const offerRunning = activeOffer !== null && activeOffer.until > now;
  const offerUntil = trialEndRunning ? trialEndUntil : offerRunning ? activeOffer.until : null;
  const timerRunning = offerUntil !== null;
  const offerKind = offerRunning ? activeOffer.kind : openedFor;
  useEffect(() => {
    if (!reason || (!trialEndUntil && !activeOffer)) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [reason, trialEndUntil, activeOffer]);

  const prices = trialEndRunning
    ? { monthly: OFFER_PRICES.trialEnd.monthly, yearly: OFFER_PRICES.trialEnd.yearly }
    : offerKind === "trialUse" || offerKind === "trialEnding"
      ? { monthly: PRICES.monthly, yearly: OFFER_PRICES.trial.yearly }
      : offerKind
        ? { monthly: PRICES.monthly, yearly: OFFER_PRICES.milestone.yearly }
        : PRICES;

  const left = Math.max(0, (offerUntil ?? 0) - now);
  const countdown = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;
  const trialDaysLeft = trialEndsAt ? Math.max(1, Math.ceil((trialEndsAt - now) / 86400000)) : 0;

  // What a free plan would take away (shown when the trial ends).
  const extraFunds = Math.max(0, fundCategories.filter((f) => !f.locked).length - FREE.funds);
  const extraGoals = Math.max(0, goals.length - FREE.goals);
  const reminders = alertRules.filter((r) => !isTracker(r));
  const extraReminders = reminders.length - new Set(reminders.map((r) => r.type)).size;

  const buy = () => alertAsync(t("premium.comingTitle"), t("premium.coming"));

  return (
    <Modal visible={reason !== null} animationType="slide" transparent onRequestClose={hide}>
      <View style={styles.root}>
        <Pressable style={styles.overlay} onPress={hide} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          <View style={styles.header}>
            <View style={styles.badge}>
              <Ionicons name="diamond-outline" size={18} color="#fff" />
            </View>
            <Text style={styles.title}>{reason === "trialEnded"
                ? t("premium.trialEndedTitle")
                : reason === "trialStarted"
                  ? t("premium.trialStartedTitle")
                  : t("premium.title")}</Text>
            <ModalCloseButton onPress={hide} />
          </View>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {reason && reason !== "general" && reason !== "trialEnded" && (
              <View style={styles.reasonBox}>
                <Ionicons
                  name={reason === "trialStarted" ? "gift-outline" : reason === "offer" ? "pricetag-outline" : "lock-open-outline"}
                  size={20}
                  color={Colors.primary}
                />
                <Text style={styles.reason}>
                  {t(`premium.reason.${reason}`, {
                    funds: FREE.funds,
                    goals: FREE.goals,
                    trackers: FREE.trackers,
                    date: trialEndsAt ? new Date(trialEndsAt).toLocaleDateString(i18n.language) : "",
                  })}
                </Text>
              </View>
            )}
            {plan.inTrial && <Text style={styles.trial}>{t("premium.trialLeft", { count: trialDaysLeft })}</Text>}
            {plan.paid && <Text style={styles.trial}>{t("premium.active")}</Text>}

            {reason === "trialEnded" && (
              <View style={styles.summary}>
                <Text style={styles.summaryText}>{t("premium.used", { count: premiumUses })}</Text>
                {(extraFunds > 0 || extraGoals > 0 || extraReminders > 0) && (
                  <Text style={styles.summaryText}>
                    {t("premium.loses", { funds: extraFunds, goals: extraGoals, reminders: Math.max(0, extraReminders) })}
                  </Text>
                )}
              </View>
            )}

            {timerRunning && (
              <View style={styles.offer}>
                <Ionicons name="time-outline" size={18} color={Colors.expense} />
                <Text style={styles.offerText}>{t("premium.offerEndsIn", { time: countdown })}</Text>
              </View>
            )}

            <View style={styles.features}>
              {FEATURES.map((f) => (
                <View key={f} style={styles.feature}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.income} />
                  <Text style={styles.featureText}>{t(`premium.feature.${f}`)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.plans}>
              {(["yearly", "monthly"] as const).map((p) => {
                const price = prices[p];
                const list = PRICES[p];
                return (
                  <TouchableOpacity key={p} style={[styles.plan, plan_ === p && styles.planActive]} onPress={() => setPlan(p)}>
                    <Text style={styles.planName}>{t(`premium.plan.${p}`)}</Text>
                    <Text style={styles.planPrice}>{euro(price)}</Text>
                    {price < list && <Text style={styles.planWas}>{euro(list)}</Text>}
                    <Text style={styles.planNote}>
                      {p === "yearly"
                        ? t("premium.perMonth", { price: euro(price / 12) })
                        : price < list
                          ? t("premium.firstMonth")
                          : t("premium.cancelAnytime")}
                    </Text>
                    {p === "yearly" && (
                      // Against paying monthly for a year at the list price.
                      <Text style={styles.planSave}>
                        {t("premium.save", {
                          amount: euro(PRICES.monthly * 12 - price),
                          pct: Math.round((1 - price / (PRICES.monthly * 12)) * 100),
                        })}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {!plan.paid && (
              <TouchableOpacity style={styles.buy} onPress={buy}>
                <Text style={styles.buyText}>{t("premium.continue")}</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.fine}>{t("premium.fine")}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    root: { flex: 1, justifyContent: "flex-end" },
    overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: {
      width: "100%",
      maxWidth: CONTENT_MAX_WIDTH,
      alignSelf: "center",
      maxHeight: "92%",
      backgroundColor: Colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    header: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16 },
    badge: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
    title: { flex: 1, fontSize: FONT.title, fontWeight: "700", color: Colors.textPrimary },
    body: { paddingHorizontal: 16, gap: 12 },
    reasonBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.primary + "55",
      backgroundColor: Colors.primary + "12",
    },
    reason: { flex: 1, fontSize: FONT.body, fontWeight: "600", color: Colors.textPrimary },
    trial: { fontSize: FONT.small, fontWeight: "600", color: Colors.income },
    summary: { gap: 4, padding: 12, borderRadius: 12, backgroundColor: Colors.surfaceSecondary },
    summaryText: { fontSize: FONT.small, color: Colors.textSecondary },
    offer: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, backgroundColor: Colors.expense + "15" },
    offerText: { fontSize: FONT.body, fontWeight: "600", color: Colors.expense, fontVariant: ["tabular-nums"] },
    features: { gap: 8 },
    feature: { flexDirection: "row", alignItems: "center", gap: 8 },
    featureText: { flex: 1, fontSize: FONT.body, color: Colors.textPrimary },
    plans: { flexDirection: "row", gap: 10 },
    plan: {
      flex: 1,
      padding: 12,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: Colors.border,
      backgroundColor: Colors.surfaceSecondary,
      gap: 2,
    },
    // Same border width as unselected (only the color changes), so picking a
    // plan doesn't nudge the text.
    planActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "12" },
    planName: { fontSize: FONT.small, fontWeight: "600", color: Colors.textSecondary },
    planPrice: { fontSize: FONT.heading, fontWeight: "700", color: Colors.textPrimary },
    planWas: { fontSize: FONT.small, color: Colors.textMuted, textDecorationLine: "line-through" },
    planNote: { fontSize: FONT.label, color: Colors.textMuted },
    planSave: { fontSize: FONT.label, fontWeight: "700", color: Colors.income },
    buy: { padding: 15, borderRadius: 14, alignItems: "center", backgroundColor: Colors.primary },
    buyText: { fontSize: FONT.body, fontWeight: "700", color: "#fff" },
    fine: { fontSize: FONT.label, color: Colors.textMuted, textAlign: "center", marginBottom: 8 },
  });
}
