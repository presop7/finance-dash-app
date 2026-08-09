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
  Pressable,
} from "react-native";
import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../constants/colors";
import CategoryPicker from "../../components/CategoryPicker";
import FundCategoryPicker from "../../components/FundCategoryPicker";
import DateTimeFields from "../../components/DateTimeFields";
import { useFinanceStore, Transaction } from "../../store/useFinanceStore";
import { confirmAsync } from "../../utils/confirm";

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
  // When set, the modal edits this transaction instead of creating a new one.
  editTransaction?: Transaction | null;
};

export default function AddTransactionModal({
  visible,
  onClose,
  onSave,
  onOpenManageCategories,
  onOpenManageFundCategories,
  editTransaction,
}: AddTransactionModalProps) {
  const { expenseCategories, incomeCategories, fundCategories, updateTransaction, deleteTransaction } =
    useFinanceStore();

  const isEditing = Boolean(editTransaction);
  const insets = useSafeAreaInsets();

  const [type, setType] = useState<TransactionType>("expense");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [showNumpad, setShowNumpad] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("food");
  const [selectedFundCategory, setSelectedFundCategory] = useState("cash");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date());

  const isExpense = type === "expense";
  const activeColor = isExpense ? Colors.expense : Colors.income;
  const categories = isExpense ? expenseCategories : incomeCategories;

  // Prefill the form when opened in edit mode.
  useEffect(() => {
    if (visible && editTransaction) {
      setType(editTransaction.type);
      setTitle(editTransaction.title);
      setAmount(editTransaction.amount.toString());
      setSelectedCategory(editTransaction.category);
      setSelectedFundCategory(editTransaction.fundCategory);
      setNote(editTransaction.note);
      setDate(new Date(editTransaction.date));
    }
  }, [visible, editTransaction]);

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

    if (isEditing && editTransaction) {
      updateTransaction(editTransaction.id, {
        type,
        amount: parsedAmount,
        category: selectedCategory,
        fundCategory: selectedFundCategory,
        title,
        note,
        date,
      });
    } else {
      onSave(
        type,
        parsedAmount,
        selectedCategory,
        selectedFundCategory,
        title,
        note,
        date,
      );
    }
    handleClose();
  };

  const handleDelete = async () => {
    if (!editTransaction) return;
    const ok = await confirmAsync(
      "Delete Transaction",
      `Delete "${editTransaction.title || "this transaction"}"? This can't be undone.`,
    );
    if (!ok) return;
    deleteTransaction(editTransaction.id);
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
      <View style={styles.root}>
        {/* Background overlay — closes numpad or modal */}
        <Pressable
          style={styles.overlay}
          onPress={() => {
            if (showNumpad) {
              setShowNumpad(false);
            } else {
              handleClose();
            }
          }}
        />

        {/* Android already resizes the window for the keyboard
            (windowSoftInputMode="adjustResize"); "height" behavior here would
            double-compensate and leave a permanent gap above the nav bar. */}
        <KeyboardAvoidingView
          style={styles.keyboardAvoider}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) + 16 },
          ]}
        >
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {isEditing ? "Edit Transaction" : "New Transaction"}
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
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

            {/* Amount Field — typeable directly, with an optional tap-numpad for touch */}
            <View
              style={[
                styles.fieldContainer,
                showNumpad && { borderColor: activeColor },
              ]}
            >
              <Ionicons
                name="cash-outline"
                size={18}
                color={amount ? activeColor : Colors.textMuted}
              />
              {amount ? (
                <Text style={[styles.amountSign, { color: activeColor }]}>
                  {isExpense ? "-" : "+"}
                </Text>
              ) : null}
              <TextInput
                style={[
                  styles.amountFieldText,
                  { color: amount ? activeColor : Colors.textMuted },
                ]}
                placeholder="Tap to enter amount"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9.]/g, "");
                  if (cleaned.split(".").length > 2) return;
                  setAmount(cleaned);
                }}
                onFocus={() => setShowNumpad(false)}
              />
              {amount ? <Text style={styles.amountSuffix}>BGN</Text> : null}
              {amount ? (
                <TouchableOpacity onPress={() => setAmount("")}>
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={Colors.textMuted}
                  />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={() => setShowNumpad((v) => !v)}>
                <Ionicons
                  name="keypad-outline"
                  size={18}
                  color={showNumpad ? activeColor : Colors.textMuted}
                />
              </TouchableOpacity>
            </View>

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

            {/* Date and Time — native tap-to-open pickers on iOS/Android,
                typeable fields + custom calendar/time popovers on web
                (see components/DateTimeFields.web.tsx) */}
            <DateTimeFields
              date={date}
              onChange={setDate}
              onInteract={() => setShowNumpad(false)}
            />

            {/* Note Input — compact by default, grows with content up to a cap */}
            <View
              style={[
                styles.fieldContainer,
                styles.noteFieldContainer,
                { marginBottom: 8 },
              ]}
            >
              <Ionicons
                name="create-outline"
                size={18}
                color={Colors.textMuted}
                style={styles.noteIcon}
              />
              <TextInput
                style={[styles.fieldInput, styles.noteInput]}
                placeholder="Add a note (optional)"
                placeholderTextColor={Colors.textMuted}
                value={note}
                onChangeText={setNote}
                onFocus={() => setShowNumpad(false)}
                multiline
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          {/* Save (+ Delete when editing) */}
          <View style={styles.footerRow}>
            {isEditing && (
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={18} color={Colors.expense} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.saveBtn,
                styles.saveBtnFlex,
                { backgroundColor: activeColor },
                !amount && styles.saveBtnDisabled,
              ]}
              onPress={handleSave}
              disabled={!amount}
            >
              <Text style={styles.saveBtnText}>
                {isEditing ? "Save Changes" : `Save ${isExpense ? "Expense" : "Income"}`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  keyboardAvoider: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    maxHeight: "75%",
  },
  scrollArea: {
    flexShrink: 1,
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
  noteFieldContainer: {
    alignItems: "flex-start",
  },
  noteIcon: {
    marginTop: 2,
  },
  noteInput: {
    minHeight: 20,
    maxHeight: 120,
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
  amountSign: {
    fontSize: 15,
    fontWeight: "600",
  },
  amountSuffix: {
    fontSize: 12,
    color: Colors.textMuted,
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
  footerRow: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 4,
  },
  deleteBtn: {
    width: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.expense + "15",
    borderWidth: 0.5,
    borderColor: Colors.expense + "40",
  },
  saveBtn: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveBtnFlex: {
    flex: 1,
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
