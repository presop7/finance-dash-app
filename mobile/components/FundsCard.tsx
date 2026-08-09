import { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { GlobalStyles } from "../constants/styles";
import { Transaction } from "../store/useFinanceStore";
import { FundCategory } from "../constants/fundCategories";
import { daysAgo, percentageChange } from "../utils/dateRanges";

type FundsCardProps = {
  transactions: Transaction[];
  fundCategories: FundCategory[];
};

const CARD_WIDTH = 148;
const CARD_GAP = 12;

export default function FundsCard({
  transactions,
  fundCategories,
}: FundsCardProps) {
  const funds = useMemo(() => {
    const thirtyDaysAgo = daysAgo(30);

    return fundCategories.map((fund) => {
      const fundTransactions = transactions.filter(
        (t) => t.fundCategory === fund.id,
      );

      const balance = fundTransactions.reduce(
        (sum, t) => sum + (t.type === "income" ? t.amount : -t.amount),
        0,
      );

      const balance30DaysAgo = fundTransactions
        .filter((t) => new Date(t.date).getTime() < thirtyDaysAgo.getTime())
        .reduce((sum, t) => sum + (t.type === "income" ? t.amount : -t.amount), 0);

      return {
        fund,
        balance,
        trendPct: percentageChange(balance, balance30DaysAgo),
        hasHistory: balance30DaysAgo !== 0,
      };
    });
  }, [transactions, fundCategories]);

  if (funds.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        decelerationRate="fast"
        contentContainerStyle={styles.scrollContent}
      >
        {funds.map(({ fund, balance, trendPct, hasHistory }) => {
          const isUp = trendPct >= 0;
          return (
            <View key={fund.id} style={[styles.card, GlobalStyles.shadow]}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: fund.color + "22" },
                ]}
              >
                <Ionicons
                  name={fund.icon as keyof typeof Ionicons.glyphMap}
                  size={20}
                  color={fund.color}
                />
              </View>

              <Text style={styles.fundName} numberOfLines={1}>
                {fund.name}
              </Text>

              <Text style={styles.balance}>{balance.toFixed(2)} BGN</Text>

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
                    {Math.abs(trendPct)}% (30d)
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
  scrollContent: {
    paddingHorizontal: 16,
    gap: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  fundName: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  balance: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  trendText: {
    fontSize: 11,
    fontWeight: "500",
  },
});
