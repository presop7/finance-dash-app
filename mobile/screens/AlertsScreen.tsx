import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { GlobalStyles } from "../constants/styles";
import { useFinanceStore, AlertRule, AlertRuleType } from "../store/useFinanceStore";
import { formatCurrency } from "../utils/currency";
import { confirmAsync } from "../utils/confirm";
import {
  hasNotificationPermission,
  ensureNotificationPermission,
  notificationsSupported,
} from "../utils/notifications";
import AlertRuleModal from "./modals/AlertRuleModal";

const TYPE_ICONS: Record<AlertRuleType, keyof typeof Ionicons.glyphMap> = {
  lowBalance: "trending-down-outline",
  balanceAbove: "trending-up-outline",
  monthlyExpenseOver: "cash-outline",
  monthlyIncomeOver: "wallet-outline",
  categoryAmount: "pricetag-outline",
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

  const [permissionGranted, setPermissionGranted] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

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
        return `Notify when balance drops below ${amount}`;
      case "balanceAbove":
        return `Notify when balance rises above ${amount}`;
      case "monthlyExpenseOver":
        return `Notify when monthly expenses exceed ${amount}`;
      case "monthlyIncomeOver":
        return `Notify when monthly income exceeds ${amount}`;
      case "categoryAmount": {
        const categories = rule.categoryType === "income" ? incomeCategories : expenseCategories;
        const label = categories.find((c) => c.id === rule.categoryId)?.label ?? "Category";
        return `Notify when ${label} exceeds ${amount} this month`;
      }
    }
  };

  const ruleTitle = (rule: AlertRule): string => {
    switch (rule.type) {
      case "lowBalance":
        return "Low Balance";
      case "balanceAbove":
        return "Balance Above";
      case "monthlyExpenseOver":
        return "Monthly Expenses Over";
      case "monthlyIncomeOver":
        return "Monthly Income Over";
      case "categoryAmount":
        return "Category Amount";
    }
  };

  const handleDelete = async (rule: AlertRule) => {
    const ok = await confirmAsync("Delete Alert", "Delete this alert rule?");
    if (!ok) return;
    deleteAlertRule(rule.id);
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.header, GlobalStyles.screenPadding]}>
          <Text style={styles.headerTitle}>Alerts</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              setEditingRule(null);
              setShowModal(true);
            }}
          >
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.addBtnText}>Add Rule</Text>
          </TouchableOpacity>
        </View>

        {!notificationsSupported ? (
          <View style={[styles.banner, GlobalStyles.screenPadding]}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
            <Text style={styles.bannerText}>
              Alerts still track your spending here, but device notifications aren't
              available in Expo Go — they need a development build.
            </Text>
          </View>
        ) : (
          !permissionGranted && (
            <View style={[styles.banner, GlobalStyles.screenPadding]}>
              <Ionicons name="notifications-outline" size={18} color={Colors.primary} />
              <Text style={styles.bannerText}>
                Enable notifications to get alerts about your finances
              </Text>
              <TouchableOpacity style={styles.enableBtn} onPress={handleEnable}>
                <Text style={styles.enableBtnText}>Enable</Text>
              </TouchableOpacity>
            </View>
          )
        )}

        <Text style={[styles.sectionLabel, GlobalStyles.screenPadding]}>Alert Rules</Text>

        <View style={styles.list}>
          {alertRules.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={36} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No alert rules yet</Text>
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
                  <Text style={styles.ruleHint}>Tap to edit</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: "600", color: Colors.textPrimary },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.primary,
  },
  addBtnText: { fontSize: 12, fontWeight: "600", color: "#fff" },
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
  bannerText: { flex: 1, fontSize: 12, color: Colors.textSecondary },
  enableBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  enableBtnText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  sectionLabel: {
    fontSize: 11,
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
  ruleTitle: { fontSize: 13, fontWeight: "500", color: Colors.textPrimary },
  ruleDescription: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  ruleHint: { fontSize: 10, fontStyle: "italic", color: Colors.textMuted, marginTop: 2 },
  deleteBtn: { padding: 4 },
  emptyContainer: { alignItems: "center", paddingVertical: 32 },
  emptyText: { fontSize: 13, color: Colors.textMuted, marginTop: 10 },
  bottomPadding: { height: 20 },
});
