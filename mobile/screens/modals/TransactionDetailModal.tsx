import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../constants/colors";
import { useFinanceStore, Transaction } from "../../store/useFinanceStore";
import { confirmAsync } from "../../utils/confirm";
import { formatCurrency } from "../../utils/currency";
import { formatDate, formatTime } from "../../utils/formatDateTime";

type TransactionDetailModalProps = {
  transaction: Transaction | null;
  onClose: () => void;
  onEdit: (transaction: Transaction) => void;
};

export default function TransactionDetailModal({
  transaction,
  onClose,
  onEdit,
}: TransactionDetailModalProps) {
  const { expenseCategories, incomeCategories, fundCategories, deleteTransaction, settings } =
    useFinanceStore();
  const insets = useSafeAreaInsets();

  if (!transaction) return null;

  const categories =
    transaction.type === "expense" ? expenseCategories : incomeCategories;
  const category = categories.find((c) => c.id === transaction.category);
  const fund = fundCategories.find((f) => f.id === transaction.fundCategory);
  const isExpense = transaction.type === "expense";
  const amountColor = isExpense ? Colors.expense : Colors.income;

  const date = new Date(transaction.date);
  const formattedDate = formatDate(date, settings.dateFormat);
  const formattedTime = formatTime(date, settings.timeFormat);

  const handleDelete = async () => {
    const ok = await confirmAsync(
      "Delete Transaction",
      `Delete "${transaction.title || category?.label || "this transaction"}"? This can't be undone.`,
    );
    if (!ok) return;
    deleteTransaction(transaction.id);
    onClose();
  };

  return (
    <Modal
      visible={Boolean(transaction)}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable style={styles.overlay} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Transaction Details</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            showsVerticalScrollIndicator={false}
          >
            {/* Icon + Amount */}
            <View style={styles.amountBlock}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: (category?.color ?? Colors.primary) + "22" },
                ]}
              >
                <Ionicons
                  name={
                    (category?.icon ?? "ellipsis-horizontal-outline") as keyof typeof Ionicons.glyphMap
                  }
                  size={26}
                  color={category?.color ?? Colors.primary}
                />
              </View>
              <Text style={[styles.amount, { color: amountColor }]}>
                {isExpense ? "-" : "+"}
                {formatCurrency(transaction.amount, settings.currency)}
              </Text>
              <Text style={styles.transactionTitle}>
                {transaction.title || category?.label || "Transaction"}
              </Text>
            </View>

            {/* Details */}
            <View style={styles.detailsList}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Category</Text>
                <Text style={styles.detailValue}>
                  {category?.label ?? "Unknown"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Fund</Text>
                <Text style={styles.detailValue}>{fund?.name ?? "Unknown"}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{formattedDate}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Time</Text>
                <Text style={styles.detailValue}>{formattedTime}</Text>
              </View>
            </View>

            {/* Note */}
            {transaction.note ? (
              <View style={styles.noteBlock}>
                <Text style={styles.noteLabel}>Note</Text>
                <Text style={styles.noteText}>{transaction.note}</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Actions — pinned outside the ScrollView so they're always reachable */}
          <View
            style={[
              styles.actions,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={16} color={Colors.expense} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => onEdit(transaction)}
            >
              <Ionicons name="pencil" size={16} color="#fff" />
              <Text style={styles.editBtnText}>Edit Transaction</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "75%",
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
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
  scrollArea: {
    flexShrink: 1,
  },
  amountBlock: {
    alignItems: "center",
    paddingVertical: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  amount: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 4,
  },
  transactionTitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  detailsList: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: 4,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.textPrimary,
  },
  noteBlock: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 12,
  },
  noteLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  noteText: {
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 12,
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
  editBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
  },
  editBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
});
