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
import { useFinanceStore } from "../../store/useFinanceStore";
import { Category } from "../../constants/categories";
import { FundCategory } from "../../constants/fundCategories";
import { confirmAsync } from "../../utils/confirm";

const AVAILABLE_ICONS: Array<keyof typeof Ionicons.glyphMap> = [
  "cart-outline",
  "cafe-outline",
  "car-outline",
  "game-controller-outline",
  "business-outline",
  "briefcase-outline",
  "trending-up-outline",
  "home-outline",
  "heart-outline",
  "book-outline",
  "airplane-outline",
  "fitness-outline",
  "medical-outline",
  "gift-outline",
  "restaurant-outline",
  "phone-portrait-outline",
  "musical-notes-outline",
  "bus-outline",
  "bicycle-outline",
  "cash-outline",
  "card-outline",
  "wallet-outline",
  "diamond-outline",
  "ellipsis-horizontal-outline",
];

const AVAILABLE_COLORS = [
  "#1D9E75",
  "#D85A30",
  "#185FA5",
  "#854F0B",
  "#0F6E56",
  "#993C1D",
  "#6B21A8",
  "#0E7490",
  "#B45309",
  "#BE123C",
  "#1D2B4F",
];

export type CategoryTabType = "expense" | "income" | "fund";

type CategoriesModalProps = {
  visible: boolean;
  initialType?: CategoryTabType;
  onClose: () => void;
};

export default function CategoriesModal({
  visible,
  initialType = "expense",
  onClose,
}: CategoriesModalProps) {
  const {
    expenseCategories,
    incomeCategories,
    fundCategories,
    addExpenseCategory,
    updateExpenseCategory,
    deleteExpenseCategory,
    addIncomeCategory,
    updateIncomeCategory,
    deleteIncomeCategory,
    addFundCategory,
    updateFundCategory,
    deleteFundCategory,
  } = useFinanceStore();
  const insets = useSafeAreaInsets();

  const [activeType, setActiveType] = useState<CategoryTabType>(initialType);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [selectedIcon, setSelectedIcon] =
    useState<keyof typeof Ionicons.glyphMap>("cart-outline");
  const [selectedColor, setSelectedColor] = useState(AVAILABLE_COLORS[0]);

  useEffect(() => {
    if (visible) {
      setActiveType(initialType);
      setShowForm(false);
      setEditingId(null);
    }
  }, [visible, initialType]);

  const items: Array<Category | FundCategory> =
    activeType === "expense"
      ? expenseCategories
      : activeType === "income"
        ? incomeCategories
        : fundCategories;

  const getLabel = (item: Category | FundCategory) =>
    activeType === "fund" ? (item as FundCategory).name : (item as Category).label;

  const resetForm = () => {
    setNewName("");
    setSelectedIcon("cart-outline");
    setSelectedColor(AVAILABLE_COLORS[0]);
    setShowForm(false);
    setEditingId(null);
  };

  const handleChipPress = (item: Category | FundCategory) => {
    setEditingId(item.id);
    setNewName(getLabel(item));
    setSelectedIcon(item.icon as keyof typeof Ionicons.glyphMap);
    setSelectedColor(item.color ?? AVAILABLE_COLORS[0]);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!newName.trim()) return;
    const id = editingId ?? newName.toLowerCase().replace(/\s+/g, "_") + "_" + Date.now();

    if (activeType === "expense") {
      const category: Category = { id, label: newName.trim(), icon: selectedIcon, color: selectedColor };
      if (editingId) updateExpenseCategory(editingId, category);
      else addExpenseCategory(category);
    } else if (activeType === "income") {
      const category: Category = { id, label: newName.trim(), icon: selectedIcon, color: selectedColor };
      if (editingId) updateIncomeCategory(editingId, category);
      else addIncomeCategory(category);
    } else {
      const fund: FundCategory = { id, name: newName.trim(), icon: selectedIcon, color: selectedColor };
      if (editingId) updateFundCategory(editingId, fund);
      else addFundCategory(fund);
    }

    resetForm();
  };

  const handleDelete = async () => {
    if (!editingId) return;
    const noun = activeType === "fund" ? "Fund" : "Category";
    const ok = await confirmAsync(
      `Delete ${noun}`,
      `Delete "${newName}"? Existing transactions using it will keep showing it as unknown.`,
    );
    if (!ok) return;
    if (activeType === "expense") deleteExpenseCategory(editingId);
    else if (activeType === "income") deleteIncomeCategory(editingId);
    else deleteFundCategory(editingId);
    resetForm();
  };

  const noun = activeType === "fund" ? "Fund" : "Category";

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.overlay} onPress={onClose} />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Manage Categories</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.typeToggle}>
            {(["expense", "income", "fund"] as CategoryTabType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.toggleOption,
                  activeType === type && {
                    backgroundColor:
                      type === "expense"
                        ? Colors.expense
                        : type === "income"
                          ? Colors.income
                          : Colors.primary,
                  },
                ]}
                onPress={() => {
                  setActiveType(type);
                  resetForm();
                }}
              >
                <Text
                  style={[
                    styles.toggleText,
                    activeType === type ? styles.toggleActiveText : styles.toggleInactiveText,
                  ]}
                >
                  {type === "expense" ? "Expense" : type === "income" ? "Income" : "Funds"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            <View style={styles.categoriesGrid}>
              {items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.categoryChip}
                  onPress={() => handleChipPress(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={item.icon as keyof typeof Ionicons.glyphMap}
                    size={16}
                    color={item.color ?? Colors.primary}
                  />
                  <Text style={styles.categoryChipText}>{getLabel(item)}</Text>
                  <Ionicons name="pencil" size={11} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>

            {showForm ? (
              <View style={styles.form}>
                <Text style={styles.formLabel}>
                  {editingId ? `Edit ${noun}` : `${noun} Name`}
                </Text>
                <View style={styles.fieldContainer}>
                  <Ionicons name="text-outline" size={16} color={Colors.textMuted} />
                  <TextInput
                    style={styles.fieldInput}
                    placeholder={activeType === "fund" ? "e.g. Bank Account" : "e.g. Groceries"}
                    placeholderTextColor={Colors.textMuted}
                    value={newName}
                    onChangeText={setNewName}
                    autoFocus
                  />
                </View>

                <Text style={styles.formLabel}>Icon</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.iconGrid}
                >
                  {AVAILABLE_ICONS.map((icon) => (
                    <TouchableOpacity
                      key={icon}
                      style={[
                        styles.iconOption,
                        selectedIcon === icon && {
                          borderColor: selectedColor,
                          borderWidth: 2,
                          backgroundColor: selectedColor + "22",
                        },
                      ]}
                      onPress={() => setSelectedIcon(icon)}
                    >
                      <Ionicons
                        name={icon}
                        size={22}
                        color={selectedIcon === icon ? selectedColor : Colors.textMuted}
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.formLabel}>Color</Text>
                <View style={styles.colorGrid}>
                  {AVAILABLE_COLORS.map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        selectedColor === color && styles.colorSelected,
                      ]}
                      onPress={() => setSelectedColor(color)}
                    >
                      {selectedColor === color && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.formLabel}>Preview</Text>
                <View style={styles.preview}>
                  <View style={[styles.previewIcon, { backgroundColor: selectedColor + "22" }]}>
                    <Ionicons name={selectedIcon} size={24} color={selectedColor} />
                  </View>
                  <Text style={[styles.previewLabel, { color: selectedColor }]}>
                    {newName || `${noun} Name`}
                  </Text>
                </View>

                <View style={styles.formActions}>
                  {editingId && (
                    <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                      <Ionicons name="trash-outline" size={16} color={Colors.expense} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, !newName.trim() && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={!newName.trim()}
                  >
                    <Text style={styles.saveBtnText}>
                      {editingId ? "Save Changes" : `Save ${noun}`}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.addNewBtn} onPress={() => setShowForm(true)}>
                <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                <Text style={styles.addNewText}>Add New {noun}</Text>
              </TouchableOpacity>
            )}
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
  typeToggle: {
    flexDirection: "row",
    marginHorizontal: 16,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleText: { fontSize: 13, fontWeight: "500" },
  toggleActiveText: { color: "#fff" },
  toggleInactiveText: { color: Colors.textMuted },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
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
  categoryChipText: { fontSize: 12, color: Colors.textPrimary, fontWeight: "500" },
  form: { paddingHorizontal: 16 },
  formLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
    marginTop: 12,
  },
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
  iconGrid: { gap: 8, paddingBottom: 4 },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: "#fff",
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.3)",
    elevation: 4,
  },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  previewIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  previewLabel: { fontSize: 14, fontWeight: "500" },
  formActions: { flexDirection: "row", gap: 10, marginTop: 16 },
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
  addNewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    margin: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: "dashed",
  },
  addNewText: { fontSize: 14, color: Colors.primary, fontWeight: "500" },
});
