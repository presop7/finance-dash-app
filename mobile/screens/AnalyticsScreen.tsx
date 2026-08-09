import { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { GlobalStyles } from "../constants/styles";
import { useFinanceStore, Transaction } from "../store/useFinanceStore";
import CollapsibleCard from "../components/CollapsibleCard";
import TransactionList from "../components/TransactionList";
import TransactionFiltersModal from "./modals/TransactionFiltersModal";
import {
  TransactionFilters,
  MainTypeFilter,
  DEFAULT_FILTERS,
  DATE_RANGE_LABELS,
  applyFilters,
  countActiveFilters,
} from "../utils/filterTransactions";
import { formatCurrency } from "../utils/currency";

export type AnalyticsInitialFilter = {
  mainType?: MainTypeFilter;
  fundIds?: string[];
};

type AnalyticsScreenProps = {
  initialFilter?: AnalyticsInitialFilter | null;
  onTransactionPress?: (transaction: Transaction) => void;
};

export default function AnalyticsScreen({
  initialFilter,
  onTransactionPress,
}: AnalyticsScreenProps) {
  const { transactions, settings } = useFinanceStore();

  const [mainType, setMainType] = useState<MainTypeFilter>(initialFilter?.mainType ?? "all");
  const [filters, setFilters] = useState<TransactionFilters>({
    ...DEFAULT_FILTERS,
    fundIds: initialFilter?.fundIds ?? [],
  });
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);

  const filtered = useMemo(
    () => applyFilters(transactions, filters, mainType),
    [transactions, filters, mainType],
  );

  const summary = useMemo(() => {
    const income = filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return { income, expense, net: income - expense };
  }, [filtered]);

  const maxBar = Math.max(summary.income, summary.expense, 1);
  const activeFilterCount = countActiveFilters(filters);

  return (
    <View style={styles.container}>
      <View style={[styles.header, GlobalStyles.screenPadding]}>
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>Analytics</Text>
          <TouchableOpacity
            style={styles.filterBtn}
            onPress={() => setShowFiltersModal(true)}
          >
            <Ionicons name="options-outline" size={14} color={Colors.primary} />
            <Text style={styles.filterBtnText}>
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mainTypeRow}>
          {(["expense", "income", "all"] as MainTypeFilter[]).map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.mainTypeOption, mainType === type && styles.mainTypeOptionActive]}
              onPress={() => setMainType(type)}
            >
              <Text
                style={[
                  styles.mainTypeText,
                  mainType === type && styles.mainTypeTextActive,
                ]}
              >
                {type === "expense" ? "Expenses" : type === "income" ? "Income" : "All"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.dateRangeLabel}>{DATE_RANGE_LABELS[filters.dateRangePreset]}</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <CollapsibleCard
          title="Summary"
          collapsed={summaryCollapsed}
          onToggleCollapse={() => setSummaryCollapsed((v) => !v)}
        >
          <View style={styles.summaryCard}>
            <View style={styles.barRow}>
              <View style={styles.barLabelRow}>
                <View style={[styles.dot, { backgroundColor: Colors.income }]} />
                <Text style={styles.barLabel}>Income</Text>
                <Text style={styles.barAmount}>{formatCurrency(summary.income, settings.currency)}</Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${(summary.income / maxBar) * 100}%`, backgroundColor: Colors.income },
                  ]}
                />
              </View>
            </View>

            <View style={styles.barRow}>
              <View style={styles.barLabelRow}>
                <View style={[styles.dot, { backgroundColor: Colors.expense }]} />
                <Text style={styles.barLabel}>Expenses</Text>
                <Text style={styles.barAmount}>{formatCurrency(summary.expense, settings.currency)}</Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${(summary.expense / maxBar) * 100}%`, backgroundColor: Colors.expense },
                  ]}
                />
              </View>
            </View>

            <View style={styles.netRow}>
              <Text style={styles.netLabel}>Net</Text>
              <Text style={[styles.netAmount, summary.net < 0 && { color: Colors.expense }]}>
                {summary.net >= 0 ? "+" : ""}
                {formatCurrency(summary.net, settings.currency)}
              </Text>
            </View>
          </View>
        </CollapsibleCard>

        <View style={styles.transactionsSection}>
          <Text style={[styles.sectionLabel, GlobalStyles.screenPadding]}>
            All Transactions ({filtered.length})
          </Text>
          <TransactionList transactions={filtered} onTransactionPress={onTransactionPress} />
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      <TransactionFiltersModal
        visible={showFiltersModal}
        filters={filters}
        onApply={setFilters}
        onClose={() => setShowFiltersModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: {
    paddingTop: 60,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  headerTitle: { fontSize: 22, fontWeight: "600", color: Colors.textPrimary },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: Colors.primary + "12",
    borderWidth: 0.5,
    borderColor: Colors.primary + "40",
  },
  filterBtnText: { fontSize: 12, fontWeight: "600", color: Colors.primary },
  mainTypeRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignSelf: "center",
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 20,
    padding: 3,
    marginBottom: 8,
  },
  mainTypeOption: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 18,
  },
  mainTypeOptionActive: { backgroundColor: Colors.primary },
  mainTypeText: { fontSize: 12, fontWeight: "600", color: Colors.textMuted },
  mainTypeTextActive: { color: "#fff" },
  dateRangeLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: "center",
  },
  scrollView: { flex: 1 },
  summaryCard: { paddingHorizontal: 16 },
  barRow: { marginBottom: 12 },
  barLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  barLabel: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  barAmount: { fontSize: 13, fontWeight: "600", color: Colors.textPrimary },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.surfaceSecondary,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 4 },
  netRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  netLabel: { fontSize: 13, fontWeight: "600", color: Colors.textPrimary },
  netAmount: { fontSize: 16, fontWeight: "700", color: Colors.income },
  transactionsSection: { marginTop: 16 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  bottomPadding: { height: 20 },
});
