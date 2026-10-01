import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ColorsType } from "../constants/colors";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";
import { GlobalStyles } from "../constants/styles";
import { useScreenTop } from "../hooks/useScreenTop";
import { useFinanceStore, AlertRule, AlertRuleType } from "../store/useFinanceStore";
import { formatCurrency } from "../utils/currency";
import { confirmAsync } from "../utils/confirm";
import {
  hasNotificationPermission,
  ensureNotificationPermission,
  notificationsSupported,
} from "../utils/notifications";
import AlertRuleModal from "./modals/AlertRuleModal";
import { useTutorialTarget } from "../store/useTutorialStore";
import { useTranslation } from "react-i18next";
import { currentLocale } from "../i18n";
import { isAppleMobileWeb } from "../utils/webPlatform";
import { FONT } from "../constants/typography";

const TYPE_ICONS: Record<AlertRuleType, keyof typeof Ionicons.glyphMap> = {
  lowBalance: "trending-down-outline",
  balanceAbove: "trending-up-outline",
  monthlyExpenseOver: "cash-outline",
  monthlyIncomeOver: "wallet-outline",
  categoryAmount: "pricetag-outline",
  dailyReminder: "alarm-outline",
};

export default function AlertsScreen() {
  const {
    alertRules,
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

  const handleEnable = async () => {
    const granted = await ensureNotificationPermission();
    setPermissionGranted(granted);
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
    }
  };

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
    }
  };

  const handleDelete = async (rule: AlertRule) => {
    const ok = await confirmAsync(t("reminders.deleteTitle"), t("reminders.deleteConfirm"));
    if (!ok) return;
    deleteAlertRule(rule.id);
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
              {Platform.OS !== "web"
                ? t("reminders.expoGoNoNotifications")
                : isAppleMobileWeb
                  ? t("reminders.webInstallForNotifications") // a Safari tab; the installed app can
                  : t("reminders.webNoNotifications")}
            </Text>
          </View>
        ) : (
          !permissionGranted && (
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

        <Text style={[styles.sectionLabel, GlobalStyles.screenPadding]}>{t("reminders.listLabel")}</Text>

        <View style={styles.list} ref={listRef} collapsable={false}>
          {alertRules.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={36} color={Colors.textMuted} />
              <Text style={styles.emptyText}>{t("reminders.empty")}</Text>
            </View>
          ) : (
            alertRules.map((rule) => (
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
                  <Ionicons name={TYPE_ICONS[rule.type]} size={18} color={Colors.primary} />
                </View>
                <View style={styles.ruleInfo}>
                  <Text style={styles.ruleTitle}>{ruleTitle(rule)}</Text>
                  <Text style={styles.ruleDescription}>{describeRule(rule)}</Text>
                  <Text style={styles.ruleHint}>{t("reminders.tapToEdit")}</Text>
                </View>
                <Switch
                  value={rule.enabled}
                  onValueChange={() => toggleAlertRule(rule.id)}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                />
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(rule)}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={16} color={Colors.expense} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
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
  deleteBtn: { padding: 4 },
  emptyContainer: { alignItems: "center", paddingVertical: 32 },
  emptyText: { fontSize: FONT.small, color: Colors.textMuted, marginTop: 10 },
  bottomPadding: { height: 20 },
  });
}
