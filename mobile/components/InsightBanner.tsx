import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { Transaction } from "../store/useFinanceStore";
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
  // Picked once per mount (app open) so it doesn't shuffle on every re-render.
  const [message] = useState(() => {
    const insights = getInsights(transactions, expenseCategories);
    return insights[Math.floor(Math.random() * insights.length)];
  });

  return (
    <View style={styles.banner}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    gap: 10,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#E0E7FF",
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
});
