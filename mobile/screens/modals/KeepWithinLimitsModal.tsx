import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Modal from "../../components/AppModal";
import { ColorsType } from "../../constants/colors";
import { CONTENT_MAX_WIDTH } from "../../constants/layout";
import { FONT } from "../../constants/typography";
import { freeLimit, isTracker, TRACKER_TYPES } from "../../utils/alertEvaluation";
import { useThemeColors, getThemedStyles } from "../../hooks/useThemeColors";
import { useFinanceStore, AlertRule, AlertRuleType } from "../../store/useFinanceStore";
import { usePlan, usePremiumStore } from "../../store/usePremiumStore";
import { useTranslation } from "react-i18next";

const limitFor = (type: AlertRuleType) => freeLimit(type);

// Reminders and trackers over the free plan's limits: per type, with loans
// and lends together under the first tracker type.
export function overLimit(rules: AlertRule[]): Map<AlertRuleType, AlertRule[]> {
  const byType = new Map<AlertRuleType, AlertRule[]>();
  for (const r of rules) {
    const key = isTracker(r) ? TRACKER_TYPES[0] : r.type;
    byType.set(key, [...(byType.get(key) ?? []), r]);
  }
  return new Map([...byType].filter(([type, list]) => list.length > limitFor(type)));
}

// When Premium ends (trial or subscription) with more reminders or trackers
// than the free plan allows: pick which to keep, the rest are removed.
// Savings goals and funds aren't touched here — the extra ones stay, read-only.
export default function KeepWithinLimitsModal() {
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);
  const { premium } = usePlan();
  const alertRules = useFinanceStore((s) => s.alertRules);
  const deleteAlertRule = useFinanceStore((s) => s.deleteAlertRule);
  const trialEndOpen = usePremiumStore((s) => s.modal === "trialEnded");
  const over = useMemo(() => overLimit(alertRules), [alertRules]);
  const visible = !premium && over.size > 0 && !trialEndOpen;

  // Kept by default: the first ones of each type (the oldest).
  const [keep, setKeep] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!visible) return;
    setKeep(new Set([...over].flatMap(([type, list]) => list.slice(0, limitFor(type)).map((r) => r.id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const toggle = (type: AlertRuleType, id: string) =>
    setKeep((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      const kept = (over.get(type) ?? []).filter((r) => next.has(r.id));
      if (kept.length >= limitFor(type)) next.delete(kept[0].id); // swap: keep the limit
      next.add(id);
      return next;
    });

  const confirm = () => {
    for (const list of over.values()) for (const r of list) if (!keep.has(r.id)) deleteAlertRule(r.id);
  };

  const describe = (r: AlertRule) => r.name || t(`reminders.types.${r.type}`);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{t("limits.title")}</Text>
          <Text style={styles.text}>{t("limits.text")}</Text>
          <ScrollView style={styles.list}>
            {[...over].map(([type, list]) => (
              <View key={type} style={styles.group}>
                <Text style={styles.groupLabel}>
                  {type === TRACKER_TYPES[0] ? t("reminders.trackersLabel") : t(`reminders.types.${type}`)} ·{" "}
                  {t("limits.keep", { count: limitFor(type) })}
                </Text>
                {list.map((r) => (
                  <TouchableOpacity key={r.id} style={styles.row} onPress={() => toggle(type, r.id)}>
                    <Ionicons
                      name={keep.has(r.id) ? "checkbox" : "square-outline"}
                      size={20}
                      color={keep.has(r.id) ? Colors.primary : Colors.textMuted}
                    />
                    <Text style={styles.rowText} numberOfLines={1}>
                      {describe(r)}
                      {r.amount ? ` · ${r.amount}` : ""}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.primary} onPress={confirm}>
            <Text style={styles.primaryText}>{t("limits.confirm")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={() => usePremiumStore.getState().showPremium("reminders")}>
            <Text style={styles.secondaryText}>{t("limits.keepAll")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: "rgba(0,0,0,0.5)" },
    dialog: { width: "100%", maxWidth: Math.min(420, CONTENT_MAX_WIDTH), maxHeight: "85%", backgroundColor: Colors.surface, borderRadius: 16, padding: 20, gap: 10 },
    title: { fontSize: FONT.title, fontWeight: "700", color: Colors.textPrimary },
    text: { fontSize: FONT.small, color: Colors.textSecondary },
    list: { flexGrow: 0 },
    group: { marginTop: 8, gap: 4 },
    groupLabel: { fontSize: FONT.label, fontWeight: "600", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.4 },
    row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
    rowText: { flex: 1, fontSize: FONT.body, color: Colors.textPrimary },
    primary: { padding: 14, borderRadius: 12, alignItems: "center", backgroundColor: Colors.primary, marginTop: 6 },
    primaryText: { fontSize: FONT.body, fontWeight: "600", color: "#fff" },
    secondary: { padding: 8, alignItems: "center" },
    secondaryText: { fontSize: FONT.body, color: Colors.primary, fontWeight: "600" },
  });
}
