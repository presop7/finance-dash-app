import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ColorsType } from "../constants/colors";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";
import { GlobalStyles } from "../constants/styles";
import { useScreenTop } from "../hooks/useScreenTop";
import { useFinanceStore, AlertRule } from "../store/useFinanceStore";
import { isTracker, ruleProgress, trackerProgress } from "../utils/alertEvaluation";
import { FREE } from "../constants/plan";
import { usePlan } from "../store/usePremiumStore";
import { isDemoId } from "../utils/demoTransactions";
import { formatCurrency } from "../utils/currency";
import { confirmAsync } from "../utils/confirm";
import {
  hasNotificationPermission,
  ensureNotificationPermission,
  notificationsSupported,
} from "../utils/notifications";
import AlertRuleModal, { RULE_ICONS } from "./modals/AlertRuleModal";
import { useTutorialTarget } from "../store/useTutorialStore";
import { useTranslation } from "react-i18next";
import { currentLocale } from "../i18n";
import { notificationsUnavailableKey } from "../utils/notificationHint";
import { FONT } from "../constants/typography";

export default function AlertsScreen() {
  const {
    alertRules,
    transactions,
    expenseCategories,
    incomeCategories,
    settings,
    toggleAlertRule,
    deleteAlertRule,
  } = useFinanceStore();

  const Colors = useThemeColors();

  const screenTop = useScreenTop();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);

  const [permissionGranted, setPermissionGranted] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const addRef = useTutorialTarget("alerts:add");
  const listRef = useTutorialTarget("alerts:list");

  useEffect(() => {
    hasNotificationPermission().then(setPermissionGranted);
  }, []);

  const notificationsEnabled = useFinanceStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useFinanceStore((s) => s.setNotificationsEnabled);
  const handleEnable = async () => {
    const granted = await ensureNotificationPermission();
    setPermissionGranted(granted);
    if (granted) setNotificationsEnabled(true);
  };

  const describeRule = (rule: AlertRule): string => {
    const amount = formatCurrency(rule.amount, settings.currency);
    switch (rule.type) {
      case "lowBalance":
        return t("reminders.desc.lowBalance", { amount });
      case "balanceAbove":
        return t("reminders.desc.balanceAbove", { amount });
      case "monthlyExpenseOver":
        return t("reminders.desc.monthlyExpenseOver", { amount });
      case "monthlyIncomeOver":
        return t("reminders.desc.monthlyIncomeOver", { amount });
      case "categoryAmount": {
        const categories = rule.categoryType === "income" ? incomeCategories : expenseCategories;
        const label = categories.find((c) => c.id === rule.categoryId)?.label ?? t("addTx.category");
        return t("reminders.desc.categoryAmount", { category: label, amount });
      }
      case "dailyReminder": {
        if (rule.hour === undefined || rule.minute === undefined) return t("reminders.desc.dailyUnset");
        const d = new Date();
        d.setHours(rule.hour, rule.minute, 0, 0);
        const time = d.toLocaleTimeString(currentLocale(), { hour: "2-digit", minute: "2-digit" });
        return t("reminders.desc.dailyReminder", { time });
      }
      case "loanTracker":
      case "lendTracker": {
        const done = formatCurrency(Math.min(progressOf(rule), rule.amount), settings.currency);
        return t(`reminders.desc.${rule.type}`, { done, total: amount });
      }
      case "savingsTracker":
        return ""; // retired: migrated to a Goal
    }
  };

  // Tracker progress, from real transactions only (not the tour's samples).
  const realTransactions = transactions.filter((tx) => !isDemoId(tx.id));
  const progressOf = (rule: AlertRule) => trackerProgress(rule, realTransactions);
  const reminders = alertRules.filter((rule) => !isTracker(rule));
  const { premium } = usePlan();
  const trackers = alertRules.filter(isTracker);

  const ruleTitle = (rule: AlertRule): string => {
    switch (rule.type) {
      case "lowBalance":
        return t("reminders.types.lowBalance");
      case "balanceAbove":
        return t("reminders.types.balanceAbove");
      case "monthlyExpenseOver":
        return t("reminders.types.monthlyExpenseOver");
      case "monthlyIncomeOver":
        return t("reminders.types.monthlyIncomeOver");
      case "categoryAmount":
        return t("reminders.types.categoryAmount");
      case "dailyReminder":
        return t("reminders.types.dailyReminder");
      case "loanTracker":
      case "lendTracker":
      case "savingsTracker":
        return rule.name || t(`reminders.types.${rule.type}`);
    }
  };

  const handleDelete = async (rule: AlertRule) => {
    const ok = await confirmAsync(t("reminders.deleteTitle"), t("reminders.deleteConfirm"));
    if (!ok) return;
    deleteAlertRule(rule.id);
  };

  // Both lists fold away from their heading (tap it); the count stays visible.
  const [showReminders, setShowReminders] = useState(true);
  const [showTrackers, setShowTrackers] = useState(true);
  const sectionHeader = (label: string, count: number | string, open: boolean, toggle: () => void) => (
    <TouchableOpacity style={[styles.sectionHeader, GlobalStyles.screenPadding]} onPress={toggle} activeOpacity={0.6}>
      <Text style={styles.sectionLabel}>
        {label} · {count}
      </Text>
      <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );

  const renderRule = (rule: AlertRule) => {
    const tracker = isTracker(rule);
    const share = tracker ? Math.min(1, progressOf(rule) / rule.amount) : 0;
    // Amount reminders: where it stands now against its amount.
    const standing = tracker ? null : ruleProgress(rule, realTransactions);
    return (
      <TouchableOpacity
        key={rule.id}
        style={styles.ruleRow}
        activeOpacity={0.7}
        onPress={() => {
          setEditingRule(rule);
          setShowModal(true);
        }}
      >
        <View style={styles.ruleIcon}>
          <Ionicons name={RULE_ICONS[rule.type]} size={18} color={Colors.primary} />
        </View>
        <View style={styles.ruleInfo}>
          <Text style={styles.ruleTitle}>{ruleTitle(rule)}</Text>
          <Text style={styles.ruleDescription}>{describeRule(rule)}</Text>
          {tracker ? (
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${share * 100}%`, backgroundColor: share >= 1 ? Colors.income : Colors.primary },
                ]}
              />
            </View>
          ) : standing ? (
            <>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.max(0, Math.min(1, standing.value / standing.limit)) * 100}%`,
                      backgroundColor: standing.bad ? Colors.expense : standing.reached ? Colors.income : Colors.primary,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.ruleHint, standing.reached && { color: standing.bad ? Colors.expense : Colors.income, fontStyle: "normal", fontWeight: "600" }]}>
                {t("reminders.standing", {
                  value: formatCurrency(standing.value, settings.currency),
                  limit: formatCurrency(standing.limit, settings.currency),
                })}
                {standing.reached ? ` · ${t("reminders.reachedNow")}` : ""}
              </Text>
            </>
          ) : (
            <Text style={styles.ruleHint}>{t("reminders.tapToEdit")}</Text>
          )}
          {tracker && share >= 1 && <Text style={styles.ruleDone}>{t("reminders.desc.trackerDone")}</Text>}
        </View>
        <Switch
          value={rule.enabled}
          onValueChange={() => toggleAlertRule(rule.id)}
          trackColor={{ false: Colors.border, true: Colors.primary }}
        />
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(rule)} hitSlop={8}>
          <Ionicons name="trash-outline" size={16} color={Colors.expense} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.header, GlobalStyles.screenPadding, { paddingTop: screenTop }]}>
          <Text style={styles.headerTitle}>{t("nav.reminders")}</Text>
          <View ref={addRef} collapsable={false}>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => {
                setEditingRule(null);
                setShowModal(true);
              }}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.addBtnText}>{t("reminders.add")}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!notificationsSupported ? (
          <View style={[styles.banner, GlobalStyles.screenPadding]}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
            <Text style={styles.bannerText}>
              {t(notificationsUnavailableKey())}
            </Text>
          </View>
        ) : (
          !(permissionGranted && notificationsEnabled) && (
            <View style={[styles.banner, GlobalStyles.screenPadding]}>
              <Ionicons name="notifications-outline" size={18} color={Colors.primary} />
              <Text style={styles.bannerText}>
                {t("reminders.enableInfo")}
              </Text>
              <TouchableOpacity style={styles.enableBtn} onPress={handleEnable}>
                <Text style={styles.enableBtnText}>{t("reminders.enable")}</Text>
              </TouchableOpacity>
            </View>
          )
        )}

        {sectionHeader(t("reminders.listLabel"), reminders.length, showReminders, () => setShowReminders((v) => !v))}

        <View style={styles.list} ref={listRef} collapsable={false}>
          {!showReminders ? null : reminders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={36} color={Colors.textMuted} />
              <Text style={styles.emptyText}>{t("reminders.empty")}</Text>
            </View>
          ) : (
            reminders.map(renderRule)
          )}
        </View>

        {/* Loans and lends: progress toward an amount. */}
        <View style={styles.sectionGap} />
        {sectionHeader(
          t("reminders.trackersLabel"),
          // Free plan: out of the 2 trackers it allows.
          premium ? trackers.length : `${trackers.length}/${FREE.trackers}`,
          showTrackers,
          () => setShowTrackers((v) => !v),
        )}
        <View style={styles.list}>
          {!showTrackers ? null : trackers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="card-outline" size={36} color={Colors.textMuted} />
              <Text style={styles.emptyText}>{t("reminders.trackersEmpty")}</Text>
            </View>
          ) : (
            trackers.map(renderRule)
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      <AlertRuleModal
        visible={showModal}
        editingRule={editingRule}
        onClose={() => {
          setShowModal(false);
          setEditingRule(null);
        }}
      />
    </View>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
  },
  headerTitle: { fontSize: FONT.heading, fontWeight: "600", color: Colors.textPrimary },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.primary,
  },
  addBtnText: { fontSize: FONT.small, fontWeight: "600", color: "#fff" },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.primary + "10",
    borderRadius: 14,
    marginHorizontal: 16,
    padding: 14,
    marginBottom: 16,
  },
  bannerText: { flex: 1, fontSize: FONT.small, color: Colors.textSecondary },
  enableBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  enableBtnText: { fontSize: FONT.small, fontWeight: "600", color: "#fff" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  sectionLabel: {
    fontSize: FONT.label,
    fontWeight: "500",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  list: { marginHorizontal: 16, backgroundColor: Colors.surface, borderRadius: 16, ...GlobalStyles.shadow },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  ruleIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.primary + "15",
  },
  ruleInfo: { flex: 1 },
  ruleTitle: { fontSize: FONT.body, fontWeight: "500", color: Colors.textPrimary },
  ruleDescription: { fontSize: FONT.small, color: Colors.textMuted, marginTop: 2 },
  ruleHint: { fontSize: FONT.label, fontStyle: "italic", color: Colors.textMuted, marginTop: 2 },
  ruleDone: { fontSize: FONT.label, fontWeight: "600", color: Colors.income, marginTop: 4 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.border, marginTop: 6, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  sectionGap: { marginTop: 20 },
  deleteBtn: { padding: 4 },
  emptyContainer: { alignItems: "center", paddingVertical: 32 },
  emptyText: { fontSize: FONT.small, color: Colors.textMuted, marginTop: 10 },
  bottomPadding: { height: 20 },
  });
}
