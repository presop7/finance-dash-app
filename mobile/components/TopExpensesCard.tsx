import { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { Transaction } from "../store/useFinanceStore";
import { getTopExpenses } from "../utils/insights";
import TransactionList from "./TransactionList";

type RangePreset = "7d" | "30d" | "90d" | "365d" | "all";

const RANGE_LABELS: Record<RangePreset, string> = {
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  "90d": "Last 90 Days",
  "365d": "Last 365 Days",
  all: "All Time",
};

const RANGE_DAYS: Record<RangePreset, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
  all: null,
};

const RANGE_PRESETS: RangePreset[] = ["7d", "30d", "90d", "365d", "all"];

type TopExpensesCardProps = {
  transactions: Transaction[];
  onTransactionPress?: (transaction: Transaction) => void;
};

export default function TopExpensesCard({
  transactions,
  onTransactionPress,
}: TopExpensesCardProps) {
  const [range, setRange] = useState<RangePreset>("30d");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const topExpenses = useMemo(
    () => getTopExpenses(transactions, RANGE_DAYS[range], 5),
    [transactions, range],
  );

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={styles.rangePill}
        onPress={() => setDropdownOpen((v) => !v)}
        activeOpacity={0.7}
      >
        <Text style={styles.rangeText}>{RANGE_LABELS[range]}</Text>
        <Ionicons
          name={dropdownOpen ? "chevron-up" : "chevron-down"}
          size={14}
          color={Colors.textMuted}
        />
      </TouchableOpacity>

      {dropdownOpen && (
        <View style={styles.dropdown}>
          {RANGE_PRESETS.map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                styles.dropdownItem,
                p === range && styles.dropdownItemActive,
              ]}
              onPress={() => {
                setRange(p);
                setDropdownOpen(false);
              }}
            >
              <Text
                style={[
                  styles.dropdownItemText,
                  p === range && styles.dropdownItemTextActive,
                ]}
              >
                {RANGE_LABELS[p]}
              </Text>
              {p === range && (
                <Ionicons name="checkmark" size={14} color={Colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {topExpenses.length > 0 ? (
        <TransactionList
          transactions={topExpenses}
          onTransactionPress={onTransactionPress}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No expenses in this range yet.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
  rangePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 0.5,
    borderColor: Colors.border,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  rangeText: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.textSecondary,
  },
  dropdown: {
    borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 0.5,
    borderColor: Colors.border,
    marginHorizontal: 16,
    marginBottom: 10,
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
    backgroundColor: Colors.primary + "10",
  },
  dropdownItemText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  dropdownItemTextActive: {
    color: Colors.primary,
    fontWeight: "600",
  },
  emptyContainer: {
    marginHorizontal: 16,
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});
