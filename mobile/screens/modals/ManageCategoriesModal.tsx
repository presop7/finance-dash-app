import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
} from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { useFinanceStore } from "../../store/useFinanceStore";
import { Category } from "../../constants/categories";

// Available icons to pick from
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
  "shirt-outline",
  "musical-notes-outline",
  "bus-outline",
  "bicycle-outline",
];

// Available colors to pick from
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
];

type ManageCategoriesModalProps = {
  visible: boolean;
  onClose: () => void;
};

type CategoryType = "expense" | "income";

export default function ManageCategoriesModal({
  visible,
  onClose,
}: ManageCategoriesModalProps) {
  const {
    expenseCategories,
    incomeCategories,
    addExpenseCategory,
    addIncomeCategory,
  } = useFinanceStore();

  const [activeType, setActiveType] = useState<CategoryType>("expense");
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedIcon, setSelectedIcon] =
    useState<keyof typeof Ionicons.glyphMap>("cart-outline");
  const [selectedColor, setSelectedColor] = useState(AVAILABLE_COLORS[0]);

  const categories =
    activeType === "expense" ? expenseCategories : incomeCategories;

  const resetForm = () => {
    setNewName("");
    setSelectedIcon("cart-outline");
    setSelectedColor(AVAILABLE_COLORS[0]);
    setShowForm(false);
  };

  const handleSave = () => {
    if (!newName.trim()) return;

    const newCategory: Category = {
      id: newName.toLowerCase().replace(/\s+/g, "_") + "_" + Date.now(),
      label: newName.trim(),
      icon: selectedIcon,
      color: selectedColor,
    };

    if (activeType === "expense") {
      addExpenseCategory(newCategory);
    } else {
      addIncomeCategory(newCategory);
    }

    resetForm();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      {/* Overlay */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      />

      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Manage Categories</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Type Toggle */}
        <View style={styles.typeToggle}>
          <TouchableOpacity
            style={[
              styles.toggleOption,
              activeType === "expense" && {
                backgroundColor: Colors.expense,
              },
            ]}
            onPress={() => {
              setActiveType("expense");
              resetForm();
            }}
          >
            <Text
              style={[
                styles.toggleText,
                activeType === "expense"
                  ? styles.toggleActiveText
                  : styles.toggleInactiveText,
              ]}
            >
              Expense
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleOption,
              activeType === "income" && {
                backgroundColor: Colors.income,
              },
            ]}
            onPress={() => {
              setActiveType("income");
              resetForm();
            }}
          >
            <Text
              style={[
                styles.toggleText,
                activeType === "income"
                  ? styles.toggleActiveText
                  : styles.toggleInactiveText,
              ]}
            >
              Income
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Existing Categories */}
          <View style={styles.categoriesGrid}>
            {categories.map((cat) => (
              <View key={cat.id} style={styles.categoryChip}>
                <Ionicons
                  name={cat.icon as keyof typeof Ionicons.glyphMap}
                  size={16}
                  color={cat.color ?? Colors.primary}
                />
                <Text style={styles.categoryChipText}>{cat.label}</Text>
              </View>
            ))}
          </View>

          {/* Add New Category Form */}
          {showForm ? (
            <View style={styles.form}>
              {/* Name Input */}
              <Text style={styles.formLabel}>Category Name</Text>
              <View style={styles.fieldContainer}>
                <Ionicons
                  name="text-outline"
                  size={16}
                  color={Colors.textMuted}
                />
                <TextInput
                  style={styles.fieldInput}
                  placeholder="e.g. Groceries"
                  placeholderTextColor={Colors.textMuted}
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                />
              </View>

              {/* Icon Picker */}
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
                      color={
                        selectedIcon === icon ? selectedColor : Colors.textMuted
                      }
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Color Picker */}
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
                    {selectedColor === color && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Preview */}
              <Text style={styles.formLabel}>Preview</Text>
              <View style={styles.preview}>
                <View
                  style={[
                    styles.previewIcon,
                    { backgroundColor: selectedColor + "22" },
                  ]}
                >
                  <Ionicons
                    name={selectedIcon}
                    size={24}
                    color={selectedColor}
                  />
                </View>
                <Text style={[styles.previewLabel, { color: selectedColor }]}>
                  {newName || "Category Name"}
                </Text>
              </View>

              {/* Form Actions */}
              <View style={styles.formActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    !newName.trim() && styles.saveBtnDisabled,
                  ]}
                  onPress={handleSave}
                  disabled={!newName.trim()}
                >
                  <Text style={styles.saveBtnText}>Save Category</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // Add New Button
            <TouchableOpacity
              style={styles.addNewBtn}
              onPress={() => setShowForm(true)}
            >
              <Ionicons
                name="add-circle-outline"
                size={20}
                color={Colors.primary}
              />
              <Text style={styles.addNewText}>Add New Category</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    maxHeight: "85%",
  },
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
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
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
  toggleText: {
    fontSize: 13,
    fontWeight: "500",
  },
  toggleActiveText: {
    color: "#fff",
  },
  toggleInactiveText: {
    color: Colors.textMuted,
  },
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
  categoryChipText: {
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: "500",
  },
  form: {
    paddingHorizontal: 16,
  },
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
  fieldInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  iconGrid: {
    gap: 8,
    paddingBottom: 4,
  },
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
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
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
  previewLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  formActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.textSecondary,
  },
  saveBtn: {
    flex: 2,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: Colors.primary,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
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
  addNewText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: "500",
  },
});
