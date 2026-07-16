import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Colors } from "../../constants/colors";
import CategoryPicker from "../../components/CategoryPicker";
import FundCategoryPicker from "../../components/FundCategoryPicker";
import { useFinanceStore } from "../../store/useFinanceStore";

type TransactionType = "expense" | "income";

type AddTransactionModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (
    type: TransactionType,
    amount: number,
    category: string,
    fundCategory: string,
    title: string,
    note: string,
    date: Date,
  ) => void;
  onOpenManageCategories: () => void;
  onOpenManageFundCategories: () => void;
};

export default function AddTransactionModal({
  visible,
  onClose,
  onSave,
  onOpenManageCategories,
  onOpenManageFundCategories,
}: AddTransactionModalProps) {
  const { expenseCategories, incomeCategories, fundCategories } =
    useFinanceStore();

  const [type, setType] = useState<TransactionType>("expense");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [showNumpad, setShowNumpad] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("food");
  const [selectedFundCategory, setSelectedFundCategory] = useState("cash");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const isExpense = type === "expense";
  const activeColor = isExpense ? Colors.expense : Colors.income;
  const categories = isExpense ? expenseCategories : incomeCategories;

  // Format date for display
  const formatDate = (d: Date) => {
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Format time for display
  const formatTime = (d: Date) => {
    return d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Reset form
  const handleClose = () => {
    setType("expense");
    setTitle("");
    setAmount("");
    setShowNumpad(false);
    setSelectedCategory("food");
    setSelectedFundCategory("cash");
    setNote("");
    setDate(new Date());
    setShowDatePicker(false);
    setShowTimePicker(false);
    onClose();
  };

  // Switch type
  const handleTypeSwitch = (newType: TransactionType) => {
    setType(newType);
    setSelectedCategory(newType === "expense" ? "food" : "salary");
  };

  // Save
  const handleSave = () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    onSave(
      type,
      parsedAmount,
      selectedCategory,
      selectedFundCategory,
      title,
      note,
      date,
    );
    handleClose();
  };

  // Numpad handler
  const handleNumpadPress = (key: string) => {
    if (key === "done") {
      setShowNumpad(false);
      return;
    }
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      {/* Background overlay — closes numpad or modal */}
      <TouchableWithoutFeedback
        onPress={() => {
          if (showNumpad) {
            setShowNumpad(false);
          } else {
            handleClose();
          }
        }}
      >
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
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

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Type Toggle */}
            <View style={styles.typeToggle}>
              <TouchableOpacity
                style={[
                  styles.toggleOption,
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
                    isExpense
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

            {/* Title Input */}
            <View style={styles.fieldContainer}>
              <Ionicons
                name="text-outline"
                size={18}
                color={Colors.textMuted}
              />
              <TextInput
                style={styles.fieldInput}
                placeholder="Transaction title"
                placeholderTextColor={Colors.textMuted}
                value={title}
                onChangeText={setTitle}
                onFocus={() => setShowNumpad(false)}
              />
            </View>

            {/* Amount Field */}
            <TouchableOpacity
              style={[
                styles.fieldContainer,
                showNumpad && { borderColor: activeColor },
              ]}
              onPress={() => setShowNumpad(true)}
              activeOpacity={0.8}
            >
              <Ionicons
                name="cash-outline"
                size={18}
                color={showNumpad ? activeColor : Colors.textMuted}
              />
              <Text
                style={[
                  styles.amountFieldText,
                  { color: amount ? activeColor : Colors.textMuted },
                ]}
              >
                {amount
                  ? `${isExpense ? "-" : "+"}${amount} BGN`
                  : "Tap to enter amount"}
              </Text>
              {amount ? (
                <TouchableOpacity onPress={() => setAmount("")}>
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={Colors.textMuted}
                  />
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>

            {/* Numpad — only shown when amount field is tapped */}
            {showNumpad && (
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

                {/* Done button spans full width */}
                <TouchableOpacity
                  style={[styles.numpadDone, { backgroundColor: activeColor }]}
                  onPress={() => setShowNumpad(false)}
                >
                  <Text style={styles.numpadDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Category */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Category</Text>
              <TouchableOpacity
                style={styles.manageCatBtn}
                onPress={onOpenManageCategories}
              >
                <Ionicons name="add" size={14} color={Colors.primary} />
                <Text style={styles.manageCatText}>New</Text>
              </TouchableOpacity>
            </View>

            <CategoryPicker
              categories={categories}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
            />

            {/* Fund Category */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Fund</Text>
              <TouchableOpacity
                style={styles.manageCatBtn}
                onPress={onOpenManageFundCategories}
              >
                <Ionicons name="add" size={14} color={Colors.primary} />
                <Text style={styles.manageCatText}>New</Text>
              </TouchableOpacity>
            </View>

            <FundCategoryPicker
              fundCategories={fundCategories}
              selected={selectedFundCategory}
              onSelect={setSelectedFundCategory}
              onAdd={onOpenManageFundCategories}
            />

            {/* Date and Time Row */}
            <View style={styles.dateTimeRow}>
              {/* Date */}
              <TouchableOpacity
                style={[styles.fieldContainer, styles.dateField]}
                onPress={() => {
                  setShowNumpad(false);
                  setShowTimePicker(false);
                  setShowDatePicker(true);
                }}
              >
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={Colors.textMuted}
                />
                <Text style={styles.dateTimeText}>{formatDate(date)}</Text>
              </TouchableOpacity>

              {/* Time */}
              <TouchableOpacity
                style={[styles.fieldContainer, styles.timeField]}
                onPress={() => {
                  setShowNumpad(false);
                  setShowDatePicker(false);
                  setShowTimePicker(true);
                }}
              >
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={Colors.textMuted}
                />
                <Text style={styles.dateTimeText}>{formatTime(date)}</Text>
              </TouchableOpacity>
            </View>

            {/* Date Picker */}
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display="default"
                maximumDate={new Date()}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) setDate(selectedDate);
                }}
              />
            )}

            {/* Time Picker */}
            {showTimePicker && (
              <DateTimePicker
                value={date}
                mode="time"
                display="default"
                onChange={(event, selectedTime) => {
                  setShowTimePicker(false);
                  if (selectedTime) setDate(selectedTime);
                }}
              />
            )}

            {/* Note Input */}
            <View style={[styles.fieldContainer, { marginBottom: 8 }]}>
              <Ionicons
                name="create-outline"
                size={18}
                color={Colors.textMuted}
              />
              <TextInput
                style={styles.fieldInput}
                placeholder="Add a note (optional)"
                placeholderTextColor={Colors.textMuted}
                value={note}
                onChangeText={setNote}
                onFocus={() => setShowNumpad(false)}
              />
            </View>
          </ScrollView>

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
      </KeyboardAvoidingView>
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
    maxHeight: "90%",
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
    marginBottom: 12,
  },
  toggleOption: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
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
  fieldContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 10,
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
  amountFieldText: {
    flex: 1,
    fontSize: 15,
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
    width: "33%",
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
  numpadDone: {
    width: "100%",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  numpadDoneText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  manageCatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  manageCatText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: "500",
  },
  dateTimeRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    gap: 8,
    marginBottom: 10,
  },
  dateField: {
    flex: 2,
    marginHorizontal: 0,
    marginBottom: 0,
  },
  timeField: {
    flex: 1,
    marginHorizontal: 0,
    marginBottom: 0,
  },
  dateTimeText: {
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
