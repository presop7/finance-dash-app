import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../constants/colors";
import { Category } from "../../constants/categories";
import { FundCategory } from "../../constants/fundCategories";
import ModalCloseButton from "../../components/ModalCloseButton";

export const AVAILABLE_ICONS: Array<keyof typeof Ionicons.glyphMap> = [
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

export const AVAILABLE_COLORS = [
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

type CategoryEditModalProps = {
  visible: boolean;
  noun: string; // "Category" | "Fund"
  // null means creating a new one instead of editing an existing item.
  item: Category | FundCategory | null;
  getLabel: (item: Category | FundCategory) => string;
  onSave: (fields: {
    name: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
  }) => Promise<void>;
  // Omitted entirely while creating new — there's nothing to delete yet.
  onDelete?: () => void;
  onClose: () => void;
};

// A separate modal (stacked on top of CategoriesModal) instead of an inline
// form appended below the grid — with the form inline, editing an item near
// the top of a long list meant scrolling all the way down to reach the form,
// then back up to find the next item to edit. As its own modal, the list
// underneath never moves; closing this returns to it exactly where it was.
export default function CategoryEditModal({
  visible,
  noun,
  item,
  getLabel,
  onSave,
  onDelete,
  onClose,
}: CategoryEditModalProps) {
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [selectedIcon, setSelectedIcon] =
    useState<keyof typeof Ionicons.glyphMap>("cart-outline");
  const [selectedColor, setSelectedColor] = useState(AVAILABLE_COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (item) {
      setName(getLabel(item));
      setSelectedIcon(item.icon as keyof typeof Ionicons.glyphMap);
      setSelectedColor(item.color ?? AVAILABLE_COLORS[0]);
    } else {
      setName("");
      setSelectedIcon("cart-outline");
      setSelectedColor(AVAILABLE_COLORS[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, item]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), icon: selectedIcon, color: selectedColor });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.overlay} onPress={onClose} />

        {/* android.softwareKeyboardLayoutMode isn't set in app.json, so
            Android has no native window-resize to lean on here — "height"
            drives the push-up directly instead of assuming one exists. */}
        <KeyboardAvoidingView
          style={styles.keyboardAvoider}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <Text style={styles.title}>{item ? `Edit ${noun}` : `New ${noun}`}</Text>
              <ModalCloseButton onPress={onClose} />
            </View>

            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
              <View style={styles.body}>
                <Text style={styles.formLabel}>{noun} Name</Text>
                <View style={styles.fieldContainer}>
                  <Ionicons name="text-outline" size={16} color={Colors.textMuted} />
                  <TextInput
                    style={styles.fieldInput}
                    placeholder={noun === "Fund" ? "e.g. Bank Account" : "e.g. Groceries"}
                    placeholderTextColor={Colors.textMuted}
                    value={name}
                    onChangeText={setName}
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
                    {name || `${noun} Name`}
                  </Text>
                </View>

                <View style={styles.formActions}>
                  {onDelete && (
                    <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
                      <Ionicons name="trash-outline" size={16} color={Colors.expense} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, (!name.trim() || saving) && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={!name.trim() || saving}
                  >
                    <Text style={styles.saveBtnText}>
                      {saving ? "Saving…" : item ? "Save Changes" : `Save ${noun}`}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    maxHeight: "75%",
  },
  keyboardAvoider: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  scrollArea: { flexShrink: 1 },
  body: { paddingHorizontal: 16 },
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
  formActions: { flexDirection: "row", gap: 10, marginTop: 16, marginBottom: 16 },
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
