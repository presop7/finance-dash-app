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
import CalendarRangePicker from "../../components/CalendarRangePicker";
import {
  TransactionFilters,
  DATE_RANGE_PRESETS,
  DATE_RANGE_LABELS,
  DEFAULT_FILTERS,
} from "../../utils/filterTransactions";

const CHIP_ROW_HEIGHT = 36;

type TransactionFiltersModalProps = {
  visible: boolean;
  filters: TransactionFilters;
  onApply: (filters: TransactionFilters) => void;
  onClose: () => void;
};

export default function TransactionFiltersModal({
  visible,
  filters,
  onApply,
  onClose,
}: TransactionFiltersModalProps) {
  const { fundCategories, expenseCategories, incomeCategories } = useFinanceStore();
  const insets = useSafeAreaInsets();

  const [draft, setDraft] = useState<TransactionFilters>(filters);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraft(filters);
      setDateDropdownOpen(false);
    }
  }, [visible, filters]);

  const toggleId = (list: string[], id: string): string[] =>
    list.includes(id) ? list.filter((i) => i !== id) : [...list, id];

  const handleReset = () => setDraft(DEFAULT_FILTERS);

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.overlay} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Filters</Text>
            <View style={styles.headerRight}>
              <TouchableOpacity onPress={handleReset}>
                <Text style={styles.resetText}>Reset all</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            <View style={styles.body}>
              <Text style={styles.sectionLabel}>Date Range</Text>
              <TouchableOpacity
                style={styles.dateDropdownTrigger}
                onPress={() => setDateDropdownOpen((v) => !v)}
              >
                <Text style={styles.dateDropdownText}>
                  {DATE_RANGE_LABELS[draft.dateRangePreset]}
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
                        p === draft.dateRangePreset && styles.dropdownItemActive,
                      ]}
                      onPress={() => {
                        setDraft((d) => ({ ...d, dateRangePreset: p }));
                        if (p !== "custom") setDateDropdownOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          p === draft.dateRangePreset && styles.dropdownItemTextActive,
                        ]}
                      >
                        {DATE_RANGE_LABELS[p]}
                      </Text>
                      {p === draft.dateRangePreset && (
                        <Ionicons name="checkmark" size={14} color={Colors.primary} />
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
                      setDraft((d) => ({ ...d, customStart: start, customEnd: end }))
                    }
                  />
                </View>
              )}

              <Text style={styles.sectionLabel}>Fund Location</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipColumns}>
                  {fundCategories.map((fund) => {
                    const active = draft.fundIds.includes(fund.id);
                    return (
                      <TouchableOpacity
                        key={fund.id}
                        style={[styles.chip, active && { backgroundColor: fund.color }]}
                        onPress={() => setDraft((d) => ({ ...d, fundIds: toggleId(d.fundIds, fund.id) }))}
                      >
                        <Ionicons
                          name={fund.icon as keyof typeof Ionicons.glyphMap}
                          size={14}
                          color={active ? "#fff" : fund.color}
                        />
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {fund.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <Text style={styles.sectionLabel}>Expense Categories</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipColumns}>
                  {expenseCategories.map((cat) => {
                    const active = draft.expenseCategoryIds.includes(cat.id);
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.chip, active && { backgroundColor: cat.color ?? Colors.expense }]}
                        onPress={() =>
                          setDraft((d) => ({
                            ...d,
                            expenseCategoryIds: toggleId(d.expenseCategoryIds, cat.id),
                          }))
                        }
                      >
                        <Ionicons
                          name={cat.icon}
                          size={14}
                          color={active ? "#fff" : (cat.color ?? Colors.expense)}
                        />
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <Text style={styles.sectionLabel}>Income Categories</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipColumns}>
                  {incomeCategories.map((cat) => {
                    const active = draft.incomeCategoryIds.includes(cat.id);
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.chip, active && { backgroundColor: cat.color ?? Colors.income }]}
                        onPress={() =>
                          setDraft((d) => ({
                            ...d,
                            incomeCategoryIds: toggleId(d.incomeCategoryIds, cat.id),
                          }))
                        }
                      >
                        <Ionicons
                          name={cat.icon}
                          size={14}
                          color={active ? "#fff" : (cat.color ?? Colors.income)}
                        />
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
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
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
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
  dateDropdownText: { fontSize: 13, color: Colors.textPrimary, fontWeight: "500" },
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
  chipColumns: {
    flexDirection: "column",
    flexWrap: "wrap",
    height: CHIP_ROW_HEIGHT * 2 + 8,
    alignContent: "flex-start",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: CHIP_ROW_HEIGHT,
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
