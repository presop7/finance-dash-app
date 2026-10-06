import { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ColorsType } from "../constants/colors";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";
import { useFinanceStore, Transaction } from "../store/useFinanceStore";
import { Category } from "../constants/categories";
import { getInsights } from "../utils/insights";
import { FONT } from "../constants/typography";
import { useTranslation } from "react-i18next";
import { usePlan, usePremiumStore } from "../store/usePremiumStore";

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
  const { t } = useTranslation();
  const { premium } = usePlan();
  // Free plan, per app opening at random: one free insight, or the Premium
  // message ("tap to see the free one"). Tapping the free insight again shows
  // "get Premium for the rest" until the next opening.
  const [teaser, setTeaser] = useState<"insight" | "promo" | "locked">(() =>
    Math.random() < 0.5 ? "insight" : "promo",
  );

  if (!premium) {
    const text = teaser === "insight" ? insights[0] : teaser === "promo" ? t("insights.promo") : t("insights.locked");
    return (
      <Pressable
        style={styles.banner}
        onPress={() => setTeaser((m) => (m === "promo" ? "insight" : "locked"))}
      >
        <View style={styles.iconContainer}>
          <Ionicons name={teaser === "insight" ? "bulb-outline" : "lock-closed-outline"} size={16} color={Colors.primary} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.message} numberOfLines={3}>
            {text}
          </Text>
        </View>
        {teaser !== "insight" && (
          <Pressable style={styles.premiumBtn} onPress={() => usePremiumStore.getState().showPremium("insights")} hitSlop={6}>
            <Text style={styles.premiumBtnText}>{t("premium.short")}</Text>
          </Pressable>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      style={styles.banner}
      disabled={!canCycle}
      onPress={() => {
        setIndex((i) => i + 1);
        usePremiumStore.getState().recordPremiumUse(); // more insights: a Premium use in the trial
      }}
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
    fontSize: FONT.small,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  premiumBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    flexShrink: 0,
  },
  premiumBtnText: { fontSize: FONT.label, fontWeight: "700", color: "#fff" },
  counter: {
    fontSize: FONT.label,
    color: Colors.textMuted,
    flexShrink: 0,
  },
  });
}
