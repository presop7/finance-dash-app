import { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ColorsType } from "../constants/colors";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";
import { useFinanceStore, Transaction } from "../store/useFinanceStore";
import { Category } from "../constants/categories";
import { getInsights } from "../utils/insights";

type InsightBannerProps = {
  transactions: Transaction[];
  expenseCategories: Category[];
};

export default function InsightBanner({
  transactions,
  expenseCategories,
}: InsightBannerProps) {
  const Colors = useThemeColors();
  const styles = getThemedStyles(createStyles, Colors);
  const currency = useFinanceStore((s) => s.settings.currency);

  const insights = useMemo(
    () => getInsights(transactions, expenseCategories, new Date(), currency),
    [transactions, expenseCategories, currency],
  );
  // Random starting insight per mount (app open); tapping steps through the rest.
  const [index, setIndex] = useState(() => Math.floor(Math.random() * 1000));
  const message = insights[index % insights.length];
  const canCycle = insights.length > 1;

  return (
    <Pressable
      style={styles.banner}
      disabled={!canCycle}
      onPress={() => setIndex((i) => i + 1)}
    >
      {/* Icon */}
      <View style={styles.iconContainer}>
        <Ionicons name="bulb-outline" size={16} color={Colors.primary} />
      </View>

      {/* Message */}
      <View style={styles.textContainer}>
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
      </View>

      {canCycle && (
        <Text style={styles.counter}>
          {(index % insights.length) + 1}/{insights.length}
        </Text>
      )}
    </Pressable>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    // Translucent tint of the accent color plus a solid (non-transparent)
    // border of the same color — reads clearly as "highlighted" against
    // either theme's surface, rather than a hardcoded pale card that only
    // worked against a light background.
    backgroundColor: Colors.primary + "1A",
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    gap: 10,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primary + "22",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  counter: {
    fontSize: 10,
    color: Colors.textMuted,
    flexShrink: 0,
  },
  });
}
