import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../constants/colors";
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

  const [draft, setDraft] = useState<TransactionFilters>(filters);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  // The sheet still slides in for a beat after the native Modal reports
  // "shown" — a tap that lands on a chip mid-slide lands on a target that's
  // still moving, so it hits nothing and reads back as the whole sheet
  // "jumping". Ignore touches until that entrance animation has actually
  // settled instead of accepting taps the moment the dialog appears.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraft(filters);
      setDateDropdownOpen(Boolean(initialDateDropdownOpen));
      setReady(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, filters]);

  const handleModalShow = () => {
    setTimeout(() => setReady(true), 300);
  };

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
      onShow={handleModalShow}
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRows}>
                  {splitIntoRows(fundCategories).map((row, rowIndex) => (
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
                              color={active ? "#fff" : fund.color}
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

              <Text style={styles.sectionLabel}>Expense Categories</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRows}>
                  {splitIntoRows(expenseCategories).map((row, rowIndex) => (
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
                                active ? "#fff" : (cat.color ?? Colors.expense)
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

              <Text style={styles.sectionLabel}>Income Categories</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRows}>
                  {splitIntoRows(incomeCategories).map((row, rowIndex) => (
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
                                active ? "#fff" : (cat.color ?? Colors.income)
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

const styles = StyleSheet.create({
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
