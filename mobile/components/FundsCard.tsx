import { useMemo, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { ColorsType } from "../constants/colors";
import { useThemeColors, useResolvedScheme, getThemedStyles } from "../hooks/useThemeColors";
import { GlobalStyles } from "../constants/styles";
import { useFinanceStore, Transaction } from "../store/useFinanceStore";
import { FundCategory } from "../constants/fundCategories";
import { daysAgo, percentageChange } from "../utils/dateRanges";
import { formatCurrency } from "../utils/currency";
import { themedCategoryColor } from "../utils/color";
import { sortByOrder } from "../utils/reorder";
import { reservedByFund } from "../utils/goals";
import { isDemoId } from "../utils/demoTransactions";
import { ReorderItem, useReorder } from "./Reorderable";
import type { AnalyticsInitialFilter } from "../screens/AnalyticsScreen";
import { useTranslation } from "react-i18next";
import { FONT } from "../constants/typography";

type FundsCardProps = {
  transactions: Transaction[];
  fundCategories: FundCategory[];
  onNavigateToAnalytics?: (filter: AnalyticsInitialFilter) => void;
};

const CARD_WIDTH = 148;
const CARD_GAP = 12;

export default function FundsCard({
  transactions,
  fundCategories,
  onNavigateToAnalytics,
}: FundsCardProps) {
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);
  const isDark = useResolvedScheme() === "dark";
  const currency = useFinanceStore((s) => s.settings.currency);
  const fundCardOrder = useFinanceStore((s) => s.fundCardOrder);
  const goals = useFinanceStore((s) => s.goals);
  const reserved = reservedByFund(goals, transactions.filter((tx) => !isDemoId(tx.id)));
  const setFundCardOrder = useFinanceStore((s) => s.setFundCardOrder);

  const funds = useMemo(() => {
    const thirtyDaysAgo = daysAgo(30);

    return sortByOrder(fundCategories, fundCardOrder).map((fund) => {
      const fundTransactions = transactions.filter(
        (t) => t.fundCategory === fund.id,
      );

      const balance = fundTransactions.reduce(
        (sum, t) => sum + (t.type === "income" ? t.amount : -t.amount),
        0,
      );

      const balance30DaysAgo = fundTransactions
        .filter((t) => new Date(t.date).getTime() < thirtyDaysAgo.getTime())
        .reduce(
          (sum, t) => sum + (t.type === "income" ? t.amount : -t.amount),
          0,
        );

      return {
        fund,
        balance,
        trendPct: percentageChange(balance, balance30DaysAgo),
        hasHistory: balance30DaysAgo !== 0,
      };
    });
  }, [transactions, fundCategories, fundCardOrder]);

  // Hold a card, then release to open it in Analytics or move it to reorder.
  const scrollRef = useRef<ScrollView>(null);
  const reorder = useReorder(funds.map((f) => f.fund.id), setFundCardOrder, true, {
    ref: scrollRef,
    horizontal: true,
  });
  const byId = new Map(funds.map((f) => [f.fund.id, f]));

  if (funds.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollRef}
        {...reorder.scrollProps}
        horizontal
        showsHorizontalScrollIndicator={false}
        // Off while dragging: snapping would fight the auto-scroll.
        snapToInterval={reorder.dragId ? undefined : CARD_WIDTH + CARD_GAP}
        decelerationRate="fast"
        contentContainerStyle={styles.scrollContent}
      >
          {reorder.order.map((id) => {
            const { fund, balance, trendPct, hasHistory } = byId.get(id)!;
            const isUp = trendPct >= 0;
            return (
              <ReorderItem
                key={fund.id}
                id={fund.id}
                reorder={reorder}
                style={[styles.card, GlobalStyles.shadow]}
                fillColor={fund.color + "18"}
                onHold={onNavigateToAnalytics && (() => onNavigateToAnalytics({ fundIds: [fund.id] }))}
              >
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: fund.color + "22", borderColor: fund.color + "80" },
                  ]}
                >
                  <Ionicons
                    name={fund.icon as keyof typeof Ionicons.glyphMap}
                    size={20}
                    color={themedCategoryColor(fund.color, Colors.primary, isDark)}
                  />
                </View>

                <Text style={styles.fundName} numberOfLines={1}>
                  {fund.name}
                </Text>

                <Text style={styles.balance}>{formatCurrency(balance, currency)}</Text>
                {(reserved.get(fund.id) ?? 0) > 0 && (
                  <Text style={styles.reserved} numberOfLines={1}>
                    {t("goals.reservedInFund", { amount: formatCurrency(reserved.get(fund.id)!, currency) })}
                  </Text>
                )}

                {hasHistory && (
                  <View style={styles.trendRow}>
                    <Ionicons
                      name={isUp ? "trending-up" : "trending-down"}
                      size={12}
                      color={isUp ? Colors.income : Colors.expense}
                    />
                    <Text
                      style={[
                        styles.trendText,
                        { color: isUp ? Colors.income : Colors.expense },
                      ]}
                    >
                      {t("dashboard.trend30", { pct: Math.abs(trendPct) })}
                    </Text>
                  </View>
                )}
              </ReorderItem>
            );
          })}
      </ScrollView>
    </View>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
  wrapper: {},
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    overflow: "hidden",
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  fundName: {
    fontSize: FONT.small,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  balance: {
    fontSize: FONT.field,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  reserved: { fontSize: FONT.label, color: Colors.textMuted, marginTop: -4, marginBottom: 6 },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  trendText: {
    fontSize: FONT.small,
    fontWeight: "500",
  },
  });
}
