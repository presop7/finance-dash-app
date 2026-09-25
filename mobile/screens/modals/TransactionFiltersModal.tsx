import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  Modal,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ColorsType } from "../../constants/colors";
import { useThemeColors, useResolvedScheme, getThemedStyles } from "../../hooks/useThemeColors";
import { themedCategoryColor } from "../../utils/color";
import { useDeferredReady } from "../../hooks/useDeferredReady";
import { PillRowsSkeleton } from "../../components/Skeleton";
import { useFinanceStore } from "../../store/useFinanceStore";
import { confirmUnsavedChanges } from "../../utils/confirm";
import CalendarRangePicker from "../../components/CalendarRangePicker";
import HoldPressable from "../../components/HoldPressable";
import ModalCloseButton from "../../components/ModalCloseButton";
import type { CategoryTabType } from "./CategoriesModal";
import {
  TransactionFilters,
  DATE_RANGE_PRESETS,
  DATE_RANGE_LABELS,
  DEFAULT_FILTERS,
  getDateRangeLabel,
} from "../../utils/filterTransactions";

type TransactionFiltersModalProps = {
  visible: boolean;
  filters: TransactionFilters;
  onApply: (filters: TransactionFilters) => void;
  onClose: () => void;
  // Holding a chip opens it for editing in the category manager instead of
  // toggling it, same gesture as everywhere else chips are held in the app.
  onHoldEditCategory?: (type: CategoryTabType, id: string) => void;
  // Opens straight into the date-range dropdown instead of the plain list —
  // used when the Analytics header's own date-range label is tapped.
  initialDateDropdownOpen?: boolean;
};

export default function TransactionFiltersModal({
  visible,
  filters,
  onApply,
  onClose,
  onHoldEditCategory,
  initialDateDropdownOpen,
}: TransactionFiltersModalProps) {
  const { fundCategories, expenseCategories, incomeCategories, settings } =
    useFinanceStore();
  const insets = useSafeAreaInsets();
  const Colors = useThemeColors();
  const styles = getThemedStyles(createStyles, Colors);
  const isDark = useResolvedScheme() === "dark";

  const [draft, setDraft] = useState<TransactionFilters>(filters);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [fundSearch, setFundSearch] = useState("");
  const [expenseSearch, setExpenseSearch] = useState("");
  const [incomeSearch, setIncomeSearch] = useState("");
  // Serves two purposes off one signal. (1) The sheet is still sliding in
  // for a beat after opening — a tap landing on a chip mid-slide hits a
  // moving target and reads back as the whole sheet "jumping", so touches
  // are ignored until the entrance has settled (see the glass pane below).
  // (2) The chip sections are the expensive part to mount, so they're
  // swapped in for a skeleton until that same moment, keeping the slide-in
  // itself smooth instead of skipped.
  const ready = useDeferredReady(visible, 400);

  useEffect(() => {
    if (visible) {
      setDraft(filters);
      setDateDropdownOpen(Boolean(initialDateDropdownOpen));
      setFundSearch("");
      setExpenseSearch("");
      setIncomeSearch("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, filters]);

  const matches = (name: string, query: string) =>
    name.toLowerCase().includes(query.trim().toLowerCase());
  const filteredFunds = useMemo(
    () => (fundSearch.trim() ? fundCategories.filter((f) => matches(f.name, fundSearch)) : fundCategories),
    [fundCategories, fundSearch],
  );
  const filteredExpenseCategories = useMemo(
    () =>
      expenseSearch.trim()
        ? expenseCategories.filter((c) => matches(c.label, expenseSearch))
        : expenseCategories,
    [expenseCategories, expenseSearch],
  );
  const filteredIncomeCategories = useMemo(
    () =>
      incomeSearch.trim()
        ? incomeCategories.filter((c) => matches(c.label, incomeSearch))
        : incomeCategories,
    [incomeCategories, incomeSearch],
  );

  const toggleId = (list: string[], id: string): string[] =>
    list.includes(id) ? list.filter((i) => i !== id) : [...list, id];

  // Splits into two rows (even indices on top, odd on bottom) instead of
  // faking a 2-row grid with flexWrap-column + a fixed pixel height.
  const splitIntoRows = <T,>(items: T[]): [T[], T[]] => {
    const top: T[] = [];
    const bottom: T[] = [];
    items.forEach((item, i) => (i % 2 === 0 ? top : bottom).push(item));
    return [top, bottom];
  };

  const handleReset = () => setDraft(DEFAULT_FILTERS);

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  const hasUnsavedChanges = JSON.stringify(draft) !== JSON.stringify(filters);

  const handleRequestClose = async () => {
    if (!hasUnsavedChanges) {
      onClose();
      return;
    }
    const choice = await confirmUnsavedChanges(
      "Unapplied Filters",
      "You changed some filters but didn't apply them. Apply them now, or discard the changes?",
      "Apply Filters",
      "Discard",
    );
    if (choice === "apply") {
      onApply(draft);
      onClose();
    } else if (choice === "discard") {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleRequestClose}
    >
      <View style={styles.root}>
        <Pressable style={styles.overlay} onPress={handleRequestClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Filters</Text>
            <View style={styles.headerRight}>
              <TouchableOpacity onPress={handleReset}>
                <Text style={styles.resetText}>Reset all</Text>
              </TouchableOpacity>
              <ModalCloseButton onPress={handleRequestClose} />
            </View>
          </View>

          <ScrollView
            style={styles.scrollArea}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.body}>
              <Text style={styles.sectionLabel}>Date Range</Text>
              <TouchableOpacity
                style={styles.dateDropdownTrigger}
                onPress={() => setDateDropdownOpen((v) => !v)}
              >
                <Text style={styles.dateDropdownText}>
                  {getDateRangeLabel(draft, settings.dateFormat)}
                </Text>
                <Ionicons
                  name={dateDropdownOpen ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>

              {dateDropdownOpen && (
                <View style={styles.dropdown}>
                  {DATE_RANGE_PRESETS.map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.dropdownItem,
                        p === draft.dateRangePreset &&
                          styles.dropdownItemActive,
                      ]}
                      onPress={() => {
                        setDraft((d) => ({ ...d, dateRangePreset: p }));
                        if (p !== "custom") setDateDropdownOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          p === draft.dateRangePreset &&
                            styles.dropdownItemTextActive,
                        ]}
                      >
                        {DATE_RANGE_LABELS[p]}
                      </Text>
                      {p === draft.dateRangePreset && (
                        <Ionicons
                          name="checkmark"
                          size={14}
                          color={Colors.primary}
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {draft.dateRangePreset === "custom" && (
                <View style={{ marginTop: 8 }}>
                  <CalendarRangePicker
                    start={draft.customStart}
                    end={draft.customEnd}
                    onChange={(start, end) =>
                      setDraft((d) => ({
                        ...d,
                        customStart: start,
                        customEnd: end,
                      }))
                    }
                  />
                </View>
              )}

              <Text style={styles.sectionLabel}>Fund Location</Text>
              {ready ? (
              <>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={14} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={fundSearch}
                  onChangeText={setFundSearch}
                  placeholder="Search funds"
                  placeholderTextColor={Colors.textMuted}
                />
                {fundSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setFundSearch("")} hitSlop={8}>
                    <Ionicons name="close-circle" size={14} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              {filteredFunds.length === 0 ? (
                <Text style={styles.emptySearchText}>No matching funds.</Text>
              ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRows}>
                  {splitIntoRows(filteredFunds).map((row, rowIndex) => (
                    <View key={rowIndex} style={styles.chipRow}>
                      {row.map((fund) => {
                        const active = draft.fundIds.includes(fund.id);
                        return (
                          <HoldPressable
                            key={fund.id}
                            style={[
                              styles.chip,
                              active && { backgroundColor: fund.color },
                            ]}
                            onPress={() =>
                              setDraft((d) => ({
                                ...d,
                                fundIds: toggleId(d.fundIds, fund.id),
                              }))
                            }
                            onHoldComplete={() =>
                              onHoldEditCategory?.("fund", fund.id)
                            }
                          >
                            <Ionicons
                              name={fund.icon as keyof typeof Ionicons.glyphMap}
                              size={14}
                              color={
                                active ? "#fff" : themedCategoryColor(fund.color, Colors.primary, isDark)
                              }
                            />
                            <Text
                              style={[
                                styles.chipText,
                                active && styles.chipTextActive,
                              ]}
                            >
                              {fund.name}
                            </Text>
                          </HoldPressable>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>
              )}
              </>
              ) : (
                <PillRowsSkeleton perRow={3} />
              )}

              <Text style={styles.sectionLabel}>Expense Categories</Text>
              {ready ? (
              <>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={14} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={expenseSearch}
                  onChangeText={setExpenseSearch}
                  placeholder="Search expense categories"
                  placeholderTextColor={Colors.textMuted}
                />
                {expenseSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setExpenseSearch("")} hitSlop={8}>
                    <Ionicons name="close-circle" size={14} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              {filteredExpenseCategories.length === 0 ? (
                <Text style={styles.emptySearchText}>No matching categories.</Text>
              ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRows}>
                  {splitIntoRows(filteredExpenseCategories).map((row, rowIndex) => (
                    <View key={rowIndex} style={styles.chipRow}>
                      {row.map((cat) => {
                        const active = draft.expenseCategoryIds.includes(
                          cat.id,
                        );
                        return (
                          <HoldPressable
                            key={cat.id}
                            style={[
                              styles.chip,
                              active && {
                                backgroundColor: cat.color ?? Colors.expense,
                              },
                            ]}
                            onPress={() =>
                              setDraft((d) => ({
                                ...d,
                                expenseCategoryIds: toggleId(
                                  d.expenseCategoryIds,
                                  cat.id,
                                ),
                              }))
                            }
                            onHoldComplete={() =>
                              onHoldEditCategory?.("expense", cat.id)
                            }
                          >
                            <Ionicons
                              name={cat.icon}
                              size={14}
                              color={
                                active
                                  ? "#fff"
                                  : themedCategoryColor(cat.color, Colors.expense, isDark)
                              }
                            />
                            <Text
                              style={[
                                styles.chipText,
                                active && styles.chipTextActive,
                              ]}
                            >
                              {cat.label}
                            </Text>
                          </HoldPressable>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>
              )}
              </>
              ) : (
                <PillRowsSkeleton />
              )}

              <Text style={styles.sectionLabel}>Income Categories</Text>
              {ready ? (
              <>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={14} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={incomeSearch}
                  onChangeText={setIncomeSearch}
                  placeholder="Search income categories"
                  placeholderTextColor={Colors.textMuted}
                />
                {incomeSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setIncomeSearch("")} hitSlop={8}>
                    <Ionicons name="close-circle" size={14} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              {filteredIncomeCategories.length === 0 ? (
                <Text style={styles.emptySearchText}>No matching categories.</Text>
              ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRows}>
                  {splitIntoRows(filteredIncomeCategories).map((row, rowIndex) => (
                    <View key={rowIndex} style={styles.chipRow}>
                      {row.map((cat) => {
                        const active = draft.incomeCategoryIds.includes(cat.id);
                        return (
                          <HoldPressable
                            key={cat.id}
                            style={[
                              styles.chip,
                              active && {
                                backgroundColor: cat.color ?? Colors.income,
                              },
                            ]}
                            onPress={() =>
                              setDraft((d) => ({
                                ...d,
                                incomeCategoryIds: toggleId(
                                  d.incomeCategoryIds,
                                  cat.id,
                                ),
                              }))
                            }
                            onHoldComplete={() =>
                              onHoldEditCategory?.("income", cat.id)
                            }
                          >
                            <Ionicons
                              name={cat.icon}
                              size={14}
                              color={
                                active
                                  ? "#fff"
                                  : themedCategoryColor(cat.color, Colors.income, isDark)
                              }
                            />
                            <Text
                              style={[
                                styles.chipText,
                                active && styles.chipTextActive,
                              ]}
                            >
                              {cat.label}
                            </Text>
                          </HoldPressable>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>
              )}
              </>
              ) : (
                <PillRowsSkeleton perRow={3} />
              )}
            </View>
          </ScrollView>

          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>

          {/* A glass pane that's actually unmounted once ready, rather than a
              pointerEvents flip on a view that stays mounted — Android is a
              beat slow to pick up a live pointerEvents change, so the flip
              approach silently ate the first real tap after it fired. An
              unmount takes effect immediately since the blocking node is
              gone from the tree, not just reconfigured. */}
          {!ready && (
            <View
              style={StyleSheet.absoluteFill}
              onStartShouldSetResponder={() => true}
              onResponderTerminationRequest={() => false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
  // justifyContent: "flex-end" (not position:"absolute"/bottom:0 on the sheet
  // itself) so Yoga measures the sheet's content height and places it in one
  // pass — pinning the sheet's bottom edge first and letting its height
  // resolve afterward is what produced a visible snap once real chip/text
  // measurements landed a beat after the entrance animation.
  root: { flex: 1, justifyContent: "flex-end" },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "75%",
  },
  scrollArea: { flexShrink: 1 },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 16, fontWeight: "600", color: Colors.textPrimary },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 14 },
  resetText: { fontSize: 12, fontWeight: "500", color: Colors.income },
  body: { paddingHorizontal: 16, paddingBottom: 12 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
    marginTop: 16,
  },
  dateDropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  dateDropdownText: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: "500",
  },
  dropdown: {
    borderRadius: 10,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 0.5,
    borderColor: Colors.border,
    marginTop: 6,
    overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dropdownItemActive: { backgroundColor: Colors.primary + "10" },
  dropdownItemText: { fontSize: 12, color: Colors.textSecondary },
  dropdownItemTextActive: { color: Colors.primary, fontWeight: "600" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 13, color: Colors.textPrimary, padding: 0 },
  emptySearchText: {
    fontSize: 12,
    color: Colors.textMuted,
    paddingVertical: 8,
  },
  chipRows: {
    flexDirection: "column",
  },
  chipRow: {
    flexDirection: "row",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 0.5,
    borderColor: Colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: { fontSize: 12, color: Colors.textPrimary, fontWeight: "500" },
  chipTextActive: { color: "#fff" },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  applyBtn: {
    backgroundColor: Colors.income,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  applyBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  });
}
