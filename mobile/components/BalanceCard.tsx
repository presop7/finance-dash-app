import { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { useFinanceStore, Transaction } from "../store/useFinanceStore";
import {
  TIMEFRAME_LABELS,
  TIMEFRAME_PRESETS,
  TimeframePreset,
  getRangeForPreset,
  isWithinRange,
  percentageChange,
} from "../utils/dateRanges";
import { formatCurrency } from "../utils/currency";
import HoldPressable from "./HoldPressable";
import type { AnalyticsInitialFilter } from "../screens/AnalyticsScreen";

type BalanceCardProps = {
  transactions: Transaction[];
  onNavigateToAnalytics?: (filter: AnalyticsInitialFilter) => void;
};

export default function BalanceCard({ transactions, onNavigateToAnalytics }: BalanceCardProps) {
  const settings = useFinanceStore((s) => s.settings);
  const [preset, setPreset] = useState<TimeframePreset>("30d");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // Total Balance always reflects all-time activity, regardless of the
  // timeframe selected for the Income/Expense/Savings row below it.
  const balance = useMemo(() => {
    return transactions.reduce(
      (sum, t) => sum + (t.type === "income" ? t.amount : -t.amount),
      0,
    );
  }, [transactions]);

  const stats = useMemo(() => {
    const { start, end, prevStart, prevEnd } = getRangeForPreset(preset);

    const inRange = transactions.filter((t) =>
      isWithinRange(new Date(t.date), start, end),
    );
    const inPrevRange =
      prevStart && prevEnd
        ? transactions.filter((t) =>
            isWithinRange(new Date(t.date), prevStart, prevEnd),
          )
        : [];

    const income = inRange
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = inRange
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    const savings = income - expense;

    const prevIncome = inPrevRange
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const prevExpense = inPrevRange
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    const prevSavings = prevIncome - prevExpense;

    return {
      income,
      expense,
      savings,
      incomePct: percentageChange(income, prevIncome),
      expensePct: percentageChange(expense, prevExpense),
      savingsPct: percentageChange(savings, prevSavings),
      hasPrevPeriod: Boolean(prevStart && prevEnd),
    };
  }, [transactions, preset]);

  const masked = settings.hideBalance && !revealed;

  return (
    <LinearGradient
      colors={[Colors.primary, "#7383ac"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <Pressable
        disabled={!settings.hideBalance}
        onPressIn={() => setRevealed(true)}
        onPressOut={() => setRevealed(false)}
      >
      {/* Main Balance */}
      <Text style={styles.balanceLabel}>Total Balance</Text>
      <Text style={styles.balanceAmount}>
        {masked ? "•••••" : formatCurrency(balance, settings.currency)}
      </Text>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Timeframe selector */}
      <TouchableOpacity
        style={styles.timeframePill}
        onPress={() => setDropdownOpen((v) => !v)}
        activeOpacity={0.7}
      >
        <Text style={styles.timeframeText}>{TIMEFRAME_LABELS[preset]}</Text>
        <Ionicons
          name={dropdownOpen ? "chevron-up" : "chevron-down"}
          size={14}
          color="rgba(255,255,255,0.8)"
        />
      </TouchableOpacity>

      {dropdownOpen && (
        <View style={styles.dropdown}>
          {TIMEFRAME_PRESETS.map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                styles.dropdownItem,
                p === preset && styles.dropdownItemActive,
              ]}
              onPress={() => {
                setPreset(p);
                setDropdownOpen(false);
              }}
            >
              <Text
                style={[
                  styles.dropdownItemText,
                  p === preset && styles.dropdownItemTextActive,
                ]}
              >
                {TIMEFRAME_LABELS[p]}
              </Text>
              {p === preset && (
                <Ionicons name="checkmark" size={14} color="#fff" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Income / Expense / Savings Row */}
      <View style={styles.row}>
        <HoldPressable
          style={styles.col}
          fillColor="rgba(255,255,255,0.18)"
          disabled={!onNavigateToAnalytics}
          onHoldComplete={() => onNavigateToAnalytics?.({ mainType: "income" })}
        >
          <Text style={styles.colLabel}>Income</Text>
          <Text style={styles.colAmount}>
            {masked ? "•••" : `+${stats.income.toFixed(2)}`}
          </Text>
          {stats.hasPrevPeriod && (
            <Text style={styles.colTrend}>
              {stats.incomePct >= 0 ? "▲" : "▼"} {Math.abs(stats.incomePct)}%
            </Text>
          )}
        </HoldPressable>

        <View style={styles.separator} />

        <HoldPressable
          style={styles.col}
          fillColor="rgba(255,255,255,0.18)"
          disabled={!onNavigateToAnalytics}
          onHoldComplete={() => onNavigateToAnalytics?.({ mainType: "expense" })}
        >
          <Text style={styles.colLabel}>Expenses</Text>
          <Text style={[styles.colAmount, styles.expenseAmount]}>
            {masked ? "•••" : `-${stats.expense.toFixed(2)}`}
          </Text>
          {stats.hasPrevPeriod && (
            <Text style={[styles.colTrend, styles.expenseTrend]}>
              {stats.expensePct >= 0 ? "▲" : "▼"} {Math.abs(stats.expensePct)}%
            </Text>
          )}
        </HoldPressable>

        <View style={styles.separator} />

        <View style={styles.col}>
          <Text style={styles.colLabel}>Savings</Text>
          <Text
            style={[
              styles.colAmount,
              stats.savings < 0 && styles.expenseAmount,
            ]}
          >
            {masked ? "•••" : `${stats.savings >= 0 ? "+" : ""}${stats.savings.toFixed(2)}`}
          </Text>
          {stats.hasPrevPeriod && (
            <Text
              style={[
                styles.colTrend,
                stats.savingsPct < 0 && styles.expenseTrend,
              ]}
            >
              {stats.savingsPct >= 0 ? "▲" : "▼"} {Math.abs(stats.savingsPct)}%
            </Text>
          )}
        </View>
      </View>
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 8,
  },
  balanceLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 16,
  },
  divider: {
    height: 0.5,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginBottom: 12,
  },
  timeframePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginBottom: 12,
  },
  timeframeText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#fff",
  },
  dropdown: {
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.2)",
    marginBottom: 12,
    overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dropdownItemActive: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  dropdownItemText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
  },
  dropdownItemTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  col: {
    flex: 1,
  },
  colLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 2,
  },
  colAmount: {
    fontSize: 15,
    fontWeight: "500",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  expenseAmount: {
    color: "#FF8A70",
  },
  colTrend: {
    fontSize: 11,
    color: "#4ade80",
  },
  expenseTrend: {
    color: "#FF8A70",
  },
  separator: {
    width: 0.5,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginHorizontal: 10,
  },
});
