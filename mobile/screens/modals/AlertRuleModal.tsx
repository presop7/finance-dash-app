import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
} from "react-native";
import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../constants/colors";
import { useFinanceStore, AlertRule, AlertRuleType } from "../../store/useFinanceStore";
import { confirmAsync } from "../../utils/confirm";

const TYPE_LABELS: Record<AlertRuleType, string> = {
  lowBalance: "Low Balance",
  balanceAbove: "Balance Above",
  monthlyExpenseOver: "Monthly Expenses Over",
  monthlyIncomeOver: "Monthly Income Over",
  categoryAmount: "Category Amount",
};

const TYPE_ICONS: Record<AlertRuleType, keyof typeof Ionicons.glyphMap> = {
  lowBalance: "trending-down-outline",
  balanceAbove: "trending-up-outline",
  monthlyExpenseOver: "cash-outline",
  monthlyIncomeOver: "wallet-outline",
  categoryAmount: "pricetag-outline",
};

const ALL_TYPES: AlertRuleType[] = [
  "lowBalance",
  "balanceAbove",
  "monthlyExpenseOver",
  "monthlyIncomeOver",
  "categoryAmount",
];

type AlertRuleModalProps = {
  visible: boolean;
  editingRule: AlertRule | null;
  onClose: () => void;
};

export default function AlertRuleModal({
  visible,
  editingRule,
  onClose,
}: AlertRuleModalProps) {
  const {
    expenseCategories,
    incomeCategories,
    addAlertRule,
    updateAlertRule,
    deleteAlertRule,
  } = useFinanceStore();
  const insets = useSafeAreaInsets();

  const [type, setType] = useState<AlertRuleType>("lowBalance");
  const [amount, setAmount] = useState("");
  const [categoryType, setCategoryType] = useState<"expense" | "income">("expense");
  const [categoryId, setCategoryId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (editingRule) {
      setType(editingRule.type);
      setAmount(editingRule.amount.toString());
      setCategoryType(editingRule.categoryType ?? "expense");
      setCategoryId(editingRule.categoryId ?? null);
    } else {
      setType("lowBalance");
      setAmount("");
      setCategoryType("expense");
      setCategoryId(null);
    }
  }, [visible, editingRule]);

  const categories = categoryType === "expense" ? expenseCategories : incomeCategories;

  const handleSave = () => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) return;
    if (type === "categoryAmount" && !categoryId) return;

    const changes = {
      type,
      amount: numericAmount,
      categoryId: type === "categoryAmount" ? categoryId ?? undefined : undefined,
      categoryType: type === "categoryAmount" ? categoryType : undefined,
      enabled: editingRule?.enabled ?? true,
    };

    if (editingRule) {
      updateAlertRule(editingRule.id, { ...changes, lastTriggeredKey: undefined });
    } else {
      addAlertRule(changes);
    }
    onClose();
  };

  const handleDelete = async () => {
    if (!editingRule) return;
    const ok = await confirmAsync("Delete Alert", "Delete this alert rule?");
    if (!ok) return;
    deleteAlertRule(editingRule.id);
    onClose();
  };

  const numericAmount = parseFloat(amount);
  const canSave =
    !isNaN(numericAmount) &&
    numericAmount > 0 &&
    (type !== "categoryAmount" || Boolean(categoryId));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.overlay} onPress={onClose} />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>{editingRule ? "Edit Alert" : "Add Alert"}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            <View style={styles.body}>
              <Text style={styles.formLabel}>Alert Type</Text>
              <View style={styles.typeGrid}>
                {ALL_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeChip, type === t && styles.typeChipActive]}
                    onPress={() => setType(t)}
                  >
                    <Ionicons
                      name={TYPE_ICONS[t]}
                      size={16}
                      color={type === t ? "#fff" : Colors.textMuted}
                    />
                    <Text style={[styles.typeChipText, type === t && styles.typeChipTextActive]}>
                      {TYPE_LABELS[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Amount</Text>
              <View style={styles.fieldContainer}>
                <Ionicons name="pricetag-outline" size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder="0.00"
                  placeholderTextColor={Colors.textMuted}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
              </View>

              {type === "categoryAmount" && (
                <>
                  <Text style={styles.formLabel}>Category Type</Text>
                  <View style={styles.typeToggle}>
                    <TouchableOpacity
                      style={[
                        styles.toggleOption,
                        categoryType === "expense" && { backgroundColor: Colors.expense },
                      ]}
                      onPress={() => {
                        setCategoryType("expense");
                        setCategoryId(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.toggleText,
                          categoryType === "expense" ? styles.toggleActiveText : styles.toggleInactiveText,
                        ]}
                      >
                        Expense
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.toggleOption,
                        categoryType === "income" && { backgroundColor: Colors.income },
                      ]}
                      onPress={() => {
                        setCategoryType("income");
                        setCategoryId(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.toggleText,
                          categoryType === "income" ? styles.toggleActiveText : styles.toggleInactiveText,
                        ]}
                      >
                        Income
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.formLabel}>Category</Text>
                  <View style={styles.typeGrid}>
                    {categories.map((cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.typeChip, categoryId === cat.id && styles.typeChipActive]}
                        onPress={() => setCategoryId(cat.id)}
                      >
                        <Ionicons
                          name={cat.icon as keyof typeof Ionicons.glyphMap}
                          size={16}
                          color={categoryId === cat.id ? "#fff" : (cat.color ?? Colors.textMuted)}
                        />
                        <Text
                          style={[
                            styles.typeChipText,
                            categoryId === cat.id && styles.typeChipTextActive,
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <View style={styles.formActions}>
                {editingRule && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                    <Ionicons name="trash-outline" size={16} color={Colors.expense} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={!canSave}
                >
                  <Text style={styles.saveBtnText}>{editingRule ? "Save Changes" : "Add Alert"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
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
    paddingBottom: 32,
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
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  body: { paddingHorizontal: 16 },
  formLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
    marginTop: 12,
  },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeChipText: { fontSize: 12, color: Colors.textPrimary, fontWeight: "500" },
  typeChipTextActive: { color: "#fff" },
  fieldContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: Colors.border,
    gap: 8,
  },
  fieldInput: { flex: 1, fontSize: 13, color: Colors.textPrimary },
  typeToggle: {
    flexDirection: "row",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  toggleOption: { flex: 1, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  toggleText: { fontSize: 13, fontWeight: "500" },
  toggleActiveText: { color: "#fff" },
  toggleInactiveText: { color: Colors.textMuted },
  formActions: { flexDirection: "row", gap: 10, marginTop: 20, marginBottom: 8 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  deleteBtn: {
    width: 44,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.expense + "15",
    borderWidth: 0.5,
    borderColor: Colors.expense + "40",
  },
  cancelBtnText: { fontSize: 14, fontWeight: "500", color: Colors.textSecondary },
  saveBtn: { flex: 2, padding: 14, borderRadius: 12, alignItems: "center", backgroundColor: Colors.primary },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
});
