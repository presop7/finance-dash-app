import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { GlobalStyles } from "../constants/styles";
import { useFinanceStore } from "../store/useFinanceStore";

export type Transaction = {
  id: string;
  title: string;
  name?: string;
  category: string;
  fundCategory: string;
  amount: number;
  type: "income" | "expense";
  date: Date;
  note?: string;
};

type TransactionListProps = {
  transactions: Transaction[];
  onTransactionPress?: (transaction: Transaction) => void;
};

export default function TransactionList({
  transactions,
  onTransactionPress,
}: TransactionListProps) {
  const { expenseCategories, incomeCategories } = useFinanceStore();

  // Look up category details from store
  const getCategoryDetails = (
    categoryId: string,
    type: "income" | "expense",
  ) => {
    const categories =
      type === "expense" ? expenseCategories : incomeCategories;
    const found = categories.find((c) => c.id === categoryId);

    if (found) {
      return {
        icon: found.icon as keyof typeof Ionicons.glyphMap,
        color: found.color ?? Colors.primary,
        bg: found.color ? found.color + "22" : Colors.surfaceSecondary,
        label: found.label,
      };
    }

    // Fallback
    return {
      icon: "ellipsis-horizontal-outline" as keyof typeof Ionicons.glyphMap,
      color: Colors.textMuted,
      bg: Colors.surfaceSecondary,
      label: categoryId,
    };
  };

  if (transactions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="receipt-outline" size={40} color={Colors.textMuted} />
        <Text style={styles.emptyText}>No transactions yet</Text>
        <Text style={styles.emptySubtext}>
          Tap the + button to add your first one
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {transactions.map((transaction) => {
        const categoryDetails = getCategoryDetails(
          transaction.category,
          transaction.type,
        );

        // Format date
        const date = new Date(transaction.date);
        const formattedDate = date.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        });

        return (
          <TouchableOpacity
            key={transaction.id}
            style={styles.row}
            onPress={() => onTransactionPress?.(transaction)}
            activeOpacity={0.7}
          >
            {/* Category Icon */}
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: categoryDetails.bg },
              ]}
            >
              <Ionicons
                name={categoryDetails.icon}
                size={18}
                color={categoryDetails.color}
              />
            </View>

            {/* Title and Category */}
            <View style={styles.info}>
              <Text style={styles.transactionTitle} numberOfLines={1}>
                {transaction.title || categoryDetails.label}
              </Text>
              <Text style={styles.category}>
                {categoryDetails.label} · {formattedDate}
              </Text>
            </View>

            {/* Amount */}
            <Text
              style={[
                styles.amount,
                transaction.type === "income"
                  ? styles.incomeAmount
                  : styles.expenseAmount,
              ]}
            >
              {transaction.type === "income" ? "+" : "-"}
              {transaction.amount.toFixed(2)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    ...GlobalStyles.shadow,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  info: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.textPrimary,
  },
  category: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  amount: {
    fontSize: 13,
    fontWeight: "500",
  },
  incomeAmount: {
    color: Colors.income,
  },
  expenseAmount: {
    color: Colors.expense,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 32,
    marginHorizontal: 16,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.textSecondary,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
