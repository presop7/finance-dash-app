import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  View,
  Text,
  StyleSheet,
  StyleProp,
  TextStyle,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { GlobalStyles } from "../constants/styles";
import { useFinanceStore, Transaction } from "../store/useFinanceStore";
import CollapsibleCard from "../components/CollapsibleCard";
import {
  TransactionRow,
  TransactionEmptyState,
  useCategoryDetailsMap,
  getTransactionDetails,
} from "../components/TransactionList";
import TransactionFiltersModal from "./modals/TransactionFiltersModal";
import type { CategoryTabType } from "./modals/CategoriesModal";
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
  onHoldEditCategory?: (type: CategoryTabType, id: string) => void;
};

export default function AnalyticsScreen({
  initialFilter,
  onTransactionPress,
  onHoldEditCategory,
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
  const detailsById = useCategoryDetailsMap();

  // Bars grow from empty and amounts count up from 0 to the real value
  // whenever the summary changes (switching the Expense/Income/All tab,
  // applying filters, etc.), instead of snapping straight to the new
  // numbers. JS-driven (width and arbitrary number values aren't eligible
  // for the native driver). The bar widths are cheap — Animated mutates the
  // native view directly each tick without going through React — but the
  // count-up numbers used to drive this via addListener -> setState *here*,
  // which re-rendered the whole screen (TransactionList included) on every
  // tick; that's what was choppy. CountUpAmount below owns its own listener
  // and state so those re-renders stay scoped to just the number text.
  const incomeBarAnim = useRef(new Animated.Value(0)).current;
  const expenseBarAnim = useRef(new Animated.Value(0)).current;
  const incomeAmountAnim = useRef(new Animated.Value(0)).current;
  const expenseAmountAnim = useRef(new Animated.Value(0)).current;
  const netAmountAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const incomePct = (summary.income / maxBar) * 100;
    const expensePct = (summary.expense / maxBar) * 100;

    [incomeBarAnim, expenseBarAnim, incomeAmountAnim, expenseAmountAnim, netAmountAnim].forEach((a) =>
      a.setValue(0),
    );
    Animated.parallel(
      [
        [incomeBarAnim, incomePct],
        [expenseBarAnim, expensePct],
        [incomeAmountAnim, summary.income],
        [expenseAmountAnim, summary.expense],
        [netAmountAnim, summary.net],
      ].map(([anim, toValue]) =>
        Animated.timing(anim as Animated.Value, {
          toValue: toValue as number,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ),
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary.income, summary.expense, summary.net, maxBar]);

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

      {/* A real FlatList, not a ScrollView wrapping a .map() — Analytics can
          show hundreds of transactions, and switching the Expense/Income/All
          toggle swaps out virtually the whole displayed set each time (they're
          mutually exclusive), so this needs to only ever mount what's
          actually on screen rather than every matching row at once. The
          summary card lives in ListHeaderComponent so it scrolls together
          with the list, same as before. */}
      <FlatList
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        data={filtered}
        keyExtractor={(t) => t.id}
        renderItem={({ item, index }) => (
          <TransactionRow
            transaction={item}
            details={getTransactionDetails(detailsById, item)}
            onPress={onTransactionPress}
            isLast={index === filtered.length - 1}
            style={[
              styles.transactionRow,
              index === 0 && styles.transactionRowFirst,
              index === filtered.length - 1 && styles.transactionRowLast,
            ]}
          />
        )}
        ListEmptyComponent={TransactionEmptyState}
        ListHeaderComponent={
          <>
            <CollapsibleCard
              title="Summary"
              reorderable={false}
              collapsed={summaryCollapsed}
              onToggleCollapse={() => setSummaryCollapsed((v) => !v)}
            >
              <View style={styles.summaryCard}>
                <View style={styles.barRow}>
                  <View style={styles.barLabelRow}>
                    <View style={[styles.dot, { backgroundColor: Colors.income }]} />
                    <Text style={styles.barLabel}>Income</Text>
                    <CountUpAmount anim={incomeAmountAnim} currency={settings.currency} style={styles.barAmount} />
                  </View>
                  <View style={styles.barTrack}>
                    <Animated.View
                      style={[
                        styles.barFill,
                        {
                          width: incomeBarAnim.interpolate({
                            inputRange: [0, 100],
                            outputRange: ["0%", "100%"],
                            extrapolate: "clamp",
                          }),
                          backgroundColor: Colors.income,
                        },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.barRow}>
                  <View style={styles.barLabelRow}>
                    <View style={[styles.dot, { backgroundColor: Colors.expense }]} />
                    <Text style={styles.barLabel}>Expenses</Text>
                    <CountUpAmount anim={expenseAmountAnim} currency={settings.currency} style={styles.barAmount} />
                  </View>
                  <View style={styles.barTrack}>
                    <Animated.View
                      style={[
                        styles.barFill,
                        {
                          width: expenseBarAnim.interpolate({
                            inputRange: [0, 100],
                            outputRange: ["0%", "100%"],
                            extrapolate: "clamp",
                          }),
                          backgroundColor: Colors.expense,
                        },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.netRow}>
                  <Text style={styles.netLabel}>Net</Text>
                  <CountUpAmount
                    anim={netAmountAnim}
                    currency={settings.currency}
                    style={styles.netAmount}
                    negativeStyle={{ color: Colors.expense }}
                    showSign
                  />
                </View>
              </View>
            </CollapsibleCard>

            <Text style={[styles.sectionLabel, GlobalStyles.screenPadding]}>
              All Transactions ({filtered.length})
            </Text>
          </>
        }
        ListFooterComponent={<View style={styles.bottomPadding} />}
        // Renders a small buffer beyond the viewport rather than everything
        // matching the filter — this, plus removeClippedSubviews on
        // Android, is what actually keeps switching Expense/Income/All fast
        // even when it swaps out most of the list.
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
      />

      <TransactionFiltersModal
        visible={showFiltersModal}
        filters={filters}
        onApply={setFilters}
        onClose={() => setShowFiltersModal(false)}
        onHoldEditCategory={onHoldEditCategory}
      />
    </View>
  );
}

// Owns its own listener + state for the count-up animation, so the re-render
// each tick produces is scoped to just this Text rather than the whole
// screen (which is what made the animation choppy when the parent held that
// state instead — every tick re-rendered AnalyticsScreen, TransactionList
// included).
function CountUpAmount({
  anim,
  currency,
  style,
  negativeStyle,
  showSign,
}: {
  anim: Animated.Value;
  currency: string;
  style?: StyleProp<TextStyle>;
  negativeStyle?: StyleProp<TextStyle>;
  showSign?: boolean;
}) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const id = anim.addListener(({ value }) => setValue(value));
    return () => anim.removeListener(id);
  }, [anim]);

  return (
    <Text style={[style, negativeStyle && value < 0 && negativeStyle]}>
      {showSign && value >= 0 ? "+" : ""}
      {formatCurrency(value, currency)}
    </Text>
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
  sectionLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 16,
    marginBottom: 8,
  },
  // Approximates the old single-card look (TransactionList's own container
  // style) across individually-rendered FlatList rows: each gets the
  // shared background/margin, only the first/last round their outer
  // corners. The old shared drop-shadow across the whole card doesn't
  // carry over cleanly to per-row rendering, so it's dropped here.
  transactionRow: {
    marginHorizontal: 16,
    backgroundColor: Colors.surface,
  },
  transactionRowFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  transactionRowLast: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  bottomPadding: { height: 20 },
});
