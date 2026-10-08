import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ColorsType } from "../constants/colors";
import { GlobalStyles } from "../constants/styles";
import { FONT } from "../constants/typography";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";
import { useFinanceStore, Goal } from "../store/useFinanceStore";
import { formatCurrency } from "../utils/currency";
import { goalSaved, goalSpent } from "../utils/goals";
import { isDemoId } from "../utils/demoTransactions";
import GoalModal from "../screens/modals/GoalModal";
import { FREE } from "../constants/plan";
import { usePlan, usePremiumStore } from "../store/usePremiumStore";
import { useTranslation } from "react-i18next";

const CARD_WIDTH = 148;

// The Dashboard's savings goals, under the funds: one card per goal with its
// progress, and a "New goal" card. Tapping a goal opens its sheet (set money
// aside, release it, history); goals are created and managed only here.
export default function GoalsCard() {
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);
  const goals = useFinanceStore((s) => s.goals);
  const transactions = useFinanceStore((s) => s.transactions);
  const currency = useFinanceStore((s) => s.settings.currency);
  const [open, setOpen] = useState<{ goal: Goal | null } | null>(null);
  const real = transactions.filter((tx) => !isDemoId(tx.id));
  const { premium } = usePlan();
  const atLimit = !premium && goals.length >= FREE.goals;

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {goals.map((goal) => {
          const saved = goalSaved(goal);
          const spent = goalSpent(goal, real);
          const share = Math.min(1, saved / goal.target);
          const done = Boolean(spent) || saved >= goal.target;
          return (
            <TouchableOpacity
              key={goal.id}
              style={[styles.card, GlobalStyles.shadow, spent && styles.cardUsed]}
              activeOpacity={0.7}
              onPress={() => setOpen({ goal })}
            >
              <View style={styles.iconBox}>
                <Ionicons name={spent ? "checkmark" : "flag-outline"} size={20} color={done ? Colors.income : Colors.primary} />
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {goal.name}
              </Text>
              <Text style={styles.saved}>{formatCurrency(saved, currency)}</Text>
              <Text style={styles.target} numberOfLines={1}>
                {spent ? t("goals.used") : t("goals.of", { target: formatCurrency(goal.target, currency) })}
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${share * 100}%`, backgroundColor: done ? Colors.income : Colors.primary }]} />
              </View>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.card, styles.addCard]}
          activeOpacity={0.7}
          onPress={() => (atLimit ? usePremiumStore.getState().showPremium("goals") : setOpen({ goal: null }))}
        >
          <Ionicons name={atLimit ? "lock-closed-outline" : "add-circle-outline"} size={26} color={Colors.primary} />
          <Text style={styles.addText}>{atLimit ? t("goals.unlockMore") : t("goals.new")}</Text>
          <Text style={styles.addHint}>
            {atLimit
              ? t("funds.withPremium")
              : !premium
                ? t("funds.left", { count: FREE.goals - goals.length })
                : goals.length === 0
                  ? t("goals.emptyHint")
                  : ""}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      <GoalModal visible={open !== null} goal={open?.goal ?? null} onClose={() => setOpen(null)} />
    </View>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    row: { paddingHorizontal: 16, paddingVertical: 4, gap: 12 },
    card: {
      width: CARD_WIDTH,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 16,
      padding: 14,
    },
    cardUsed: { opacity: 0.6 },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: Colors.primary + "15",
      marginBottom: 10,
    },
    name: { fontSize: FONT.small, color: Colors.textMuted, marginBottom: 4 },
    saved: { fontSize: FONT.field, fontWeight: "600", color: Colors.textPrimary },
    target: { fontSize: FONT.small, color: Colors.textMuted, marginBottom: 8 },
    track: { height: 6, borderRadius: 3, backgroundColor: Colors.border, overflow: "hidden" },
    fill: { height: "100%", borderRadius: 3 },
    addCard: {
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderStyle: "dashed",
      backgroundColor: Colors.surfaceSecondary,
    },
    addText: { fontSize: FONT.body, fontWeight: "600", color: Colors.primary, textAlign: "center" },
    addHint: { fontSize: FONT.label, color: Colors.textMuted, textAlign: "center" },
  });
}
