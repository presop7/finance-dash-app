import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Modal from "../../components/AppModal";
import ModalCloseButton from "../../components/ModalCloseButton";
import PremiumLock from "../../components/PremiumLock";
import { ColorsType } from "../../constants/colors";
import { CONTENT_MAX_WIDTH } from "../../constants/layout";
import { FONT } from "../../constants/typography";
import { useThemeColors, getThemedStyles } from "../../hooks/useThemeColors";
import { useFinanceStore } from "../../store/useFinanceStore";
import { usePlan, usePremiumStore } from "../../store/usePremiumStore";
import { formatCurrency } from "../../utils/currency";
import { monthlyReport } from "../../utils/monthlyReport";
import { goalSaved } from "../../utils/goals";
import { isDemoId } from "../../utils/demoTransactions";
import { currentLocale } from "../../i18n";
import { useTranslation } from "react-i18next";

// "Your month in numbers": opens on last month (from the 1st's notification or
// tip, or Analytics → Report); arrows step through months. Free: the headline.
// Premium: each category against the month before, the share of income kept,
// the biggest changes and the goals' progress.
export default function MonthlyReportModal() {
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);
  const insets = useSafeAreaInsets();
  const open = usePremiumStore((s) => s.reportOpen);
  const close = () => usePremiumStore.getState().setReportOpen(false);
  const { premium } = usePlan();
  const { transactions, expenseCategories, goals, settings } = useFinanceStore();
  const [offset, setOffset] = useState(1); // months back from this one

  useEffect(() => {
    if (open) setOffset(1);
  }, [open]);

  const now = new Date();
  const month = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const report = monthlyReport(
    transactions.filter((tx) => !isDemoId(tx.id)),
    month.getFullYear(),
    month.getMonth(),
  );
  const money = (n: number) => formatCurrency(n, settings.currency);
  const label = (id: string) => expenseCategories.find((c) => c.id === id)?.label ?? "—";
  const monthName = month.toLocaleDateString(currentLocale(), { month: "long", year: "numeric" });

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.root}>
        <Pressable style={styles.overlay} onPress={close} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          <View style={styles.header}>
            <Ionicons name="document-text-outline" size={20} color={Colors.primary} />
            <Text style={styles.title}>{t("report.title")}</Text>
            <ModalCloseButton onPress={close} />
          </View>
          <View style={styles.monthRow}>
            <TouchableOpacity onPress={() => setOffset((o) => o + 1)} hitSlop={10} accessibilityLabel={t("common.previous")}>
              <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.month}>{monthName}</Text>
            <TouchableOpacity
              onPress={() => setOffset((o) => Math.max(0, o - 1))}
              disabled={offset === 0}
              hitSlop={10}
              accessibilityLabel={t("common.next")}
            >
              <Ionicons name="chevron-forward" size={20} color={offset === 0 ? Colors.border : Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {report.count === 0 ? (
              <Text style={styles.muted}>{t("report.empty")}</Text>
            ) : (
              <>
                <View style={styles.tiles}>
                  <View style={styles.tile}>
                    <Text style={styles.tileLabel}>{t("common.income")}</Text>
                    <Text style={[styles.tileValue, { color: Colors.income }]}>{money(report.income)}</Text>
                  </View>
                  <View style={styles.tile}>
                    <Text style={styles.tileLabel}>{t("common.expenses")}</Text>
                    <Text style={[styles.tileValue, { color: Colors.expense }]}>{money(report.expense)}</Text>
                  </View>
                </View>
                <Text style={styles.line}>
                  {t("report.net")}: <Text style={styles.strong}>{money(report.net)}</Text>
                </Text>
                {report.topCategory && (
                  <Text style={styles.line}>
                    {t("report.top")}: <Text style={styles.strong}>{label(report.topCategory.id)}</Text> ·{" "}
                    {money(report.topCategory.now)}
                  </Text>
                )}

                {premium ? (
                  <>
                    {report.keptShare !== null && (
                      <Text style={styles.line}>
                        {t("report.kept")}: <Text style={styles.strong}>{Math.round(report.keptShare * 100)}%</Text>
                      </Text>
                    )}
                    {report.biggestChanges.length > 0 && (
                      <>
                        <Text style={styles.section}>{t("report.changes")}</Text>
                        {report.biggestChanges.map((c) => (
                          <Text key={c.id} style={styles.line}>
                            {label(c.id)}:{" "}
                            <Text style={{ color: c.change > 0 ? Colors.expense : Colors.income, fontWeight: "600" }}>
                              {c.change > 0 ? "+" : "−"}
                              {money(Math.abs(c.change))}
                            </Text>
                          </Text>
                        ))}
                      </>
                    )}
                    <Text style={styles.section}>{t("report.categories")}</Text>
                    {report.categories.map((c) => (
                      <View key={c.id} style={styles.catRow}>
                        <Text style={styles.catName} numberOfLines={1}>
                          {label(c.id)}
                        </Text>
                        <Text style={styles.catNow}>{money(c.now)}</Text>
                        <Text style={styles.catBefore}>{money(c.before)}</Text>
                      </View>
                    ))}
                    {goals.length > 0 && (
                      <>
                        <Text style={styles.section}>{t("goals.title")}</Text>
                        {goals.map((g) => (
                          <Text key={g.id} style={styles.line}>
                            {g.name}: <Text style={styles.strong}>{money(goalSaved(g))}</Text> / {money(g.target)}
                          </Text>
                        ))}
                      </>
                    )}
                  </>
                ) : (
                  <PremiumLock reason="report" text={t("report.locked")} />
                )}
              </>
            )}
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
    title: { flex: 1, fontSize: FONT.title, fontWeight: "700", color: Colors.textPrimary },
    monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, paddingBottom: 8 },
    month: { fontSize: FONT.body, fontWeight: "600", color: Colors.textPrimary, textTransform: "capitalize", minWidth: 150, textAlign: "center" },
    body: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
    muted: { fontSize: FONT.body, color: Colors.textMuted, textAlign: "center", paddingVertical: 24 },
    tiles: { flexDirection: "row", gap: 10 },
    tile: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: Colors.surfaceSecondary, gap: 4 },
    tileLabel: { fontSize: FONT.small, color: Colors.textMuted },
    tileValue: { fontSize: FONT.title, fontWeight: "700", fontVariant: ["tabular-nums"] },
    line: { fontSize: FONT.body, color: Colors.textSecondary },
    strong: { fontWeight: "700", color: Colors.textPrimary },
    section: {
      fontSize: FONT.label,
      fontWeight: "500",
      color: Colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginTop: 12,
    },
    catRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
    catName: { flex: 1, fontSize: FONT.body, color: Colors.textPrimary },
    catNow: { fontSize: FONT.body, fontWeight: "600", color: Colors.textPrimary, fontVariant: ["tabular-nums"] },
    catBefore: { width: 90, textAlign: "right", fontSize: FONT.small, color: Colors.textMuted, fontVariant: ["tabular-nums"] },
  });
}
