import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
} from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from "../../constants/categories";
import CategoryPicker from "../../components/CategoryPicker";

type TransactionType = "expense" | "income";

type AddTransactionModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (
    type: TransactionType,
    amount: number,
    category: string,
    note: string,
  ) => void;
};

export default function AddTransactionModal({
  visible,
  onClose,
  onSave,
}: AddTransactionModalProps) {
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("food");
  const [note, setNote] = useState("");

  const isExpense = type === "expense";

  // Reset form on close
  const handleClose = () => {
    setType("expense");
    setAmount("");
    setSelectedCategory("food");
    setNote("");
    onClose();
  };

  // Switch between expense and income
  const handleTypeSwitch = (newType: TransactionType) => {
    setType(newType);
    // Reset category when switching type
    setSelectedCategory(newType === "expense" ? "food" : "salary");
  };

  // Save transaction
  const handleSave = () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    onSave(type, parsedAmount, selectedCategory, note);
    handleClose();
  };

  // Numpad handler
  const handleNumpadPress = (key: string) => {
    if (key === "delete") {
      setAmount((prev) => prev.slice(0, -1));
      return;
    }
    if (key === "." && amount.includes(".")) return;
    if (amount.split(".")[1]?.length >= 2) return;
    setAmount((prev) => prev + key);
  };

  const numpadKeys = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    ".",
    "0",
    "delete",
  ];

  const activeColor = isExpense ? Colors.expense : Colors.income;
  const categories = isExpense ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      {/* Dark background overlay */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleClose}
      />

      {/* Bottom Sheet */}
      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>New Transaction</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Type Toggle */}
        <View style={styles.typeToggle}>
          <TouchableOpacity
            style={[
              styles.toggleOption,
              isExpense && styles.toggleActive,
              isExpense && { backgroundColor: Colors.expense },
            ]}
            onPress={() => handleTypeSwitch("expense")}
          >
            <Ionicons
              name="arrow-up-circle-outline"
              size={16}
              color={isExpense ? "#fff" : Colors.textMuted}
            />
            <Text
              style={[
                styles.toggleText,
                isExpense ? styles.toggleActiveText : styles.toggleInactiveText,
              ]}
            >
              Expense
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleOption,
              !isExpense && styles.toggleActive,
              !isExpense && { backgroundColor: Colors.income },
            ]}
            onPress={() => handleTypeSwitch("income")}
          >
            <Ionicons
              name="arrow-down-circle-outline"
              size={16}
              color={!isExpense ? "#fff" : Colors.textMuted}
            />
            <Text
              style={[
                styles.toggleText,
                !isExpense
                  ? styles.toggleActiveText
                  : styles.toggleInactiveText,
              ]}
            >
              Income
            </Text>
          </TouchableOpacity>
        </View>

        {/* Amount Display */}
        <View style={styles.amountContainer}>
          <Text style={styles.amountLabel}>Amount</Text>
          <Text style={[styles.amountValue, { color: activeColor }]}>
            {isExpense ? "-" : "+"}
            {amount || "0.00"} BGN
          </Text>
        </View>

        {/* Numpad */}
        <View style={styles.numpad}>
          {numpadKeys.map((key) => (
            <TouchableOpacity
              key={key}
              style={styles.numpadKey}
              onPress={() => handleNumpadPress(key)}
              activeOpacity={0.6}
            >
              {key === "delete" ? (
                <Ionicons
                  name="backspace-outline"
                  size={20}
                  color={Colors.textSecondary}
                />
              ) : (
                <Text style={styles.numpadText}>{key}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Category Label */}
        <Text style={styles.sectionLabel}>Category</Text>

        {/* Category Picker */}
        <CategoryPicker
          categories={categories}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
        />

        {/* Note Input */}
        <View style={styles.noteContainer}>
          <Ionicons name="create-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.noteInput}
            placeholder="Add a note (optional)"
            placeholderTextColor={Colors.textMuted}
            value={note}
            onChangeText={setNote}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveBtn,
            { backgroundColor: activeColor },
            !amount && styles.saveBtnDisabled,
          ]}
          onPress={handleSave}
          disabled={!amount}
        >
          <Text style={styles.saveBtnText}>
            Save {isExpense ? "Expense" : "Income"}
          </Text>
        </TouchableOpacity>
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
    marginBottom: 8,
  },
  toggleOption: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  toggleActive: {
    borderRadius: 8,
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
  amountContainer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  amountLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: "500",
  },
  numpad: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 1,
    backgroundColor: Colors.border,
    borderRadius: 10,
    overflow: "hidden",
  },
  numpadKey: {
    width: "33.2%",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
  },
  numpadText: {
    fontSize: 18,
    fontWeight: "500",
    color: Colors.textPrimary,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.textMuted,
    paddingHorizontal: 16,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  noteContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: Colors.border,
    gap: 8,
  },
  noteInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  saveBtn: {
    margin: 16,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
});
