import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { GlobalStyles } from "../constants/styles";

// TypeScript types
export type Transaction = {
  id: string;
  name: string;
  category: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  note?: string;
};

type TransactionListProps = {
  transactions: Transaction[];
  onTransactionPress?: (transaction: Transaction) => void;
};

// Category icon and color mapper
const getCategoryStyle = (category: string) => {
  const map: Record<
    string,
    { icon: keyof typeof Ionicons.glyphMap; bg: string; color: string }
  > = {
    food: {
      icon: "cart-outline",
      bg: Colors.categories.food.bg,
      color: Colors.categories.food.icon,
    },
    restaurant: {
      icon: "cafe-outline",
      bg: Colors.categories.restaurant.bg,
      color: Colors.categories.restaurant.icon,
    },
    transport: {
      icon: "car-outline",
      bg: Colors.categories.transport.bg,
      color: Colors.categories.transport.icon,
    },
    entertainment: {
      icon: "game-controller-outline",
      bg: Colors.categories.entertainment.bg,
      color: Colors.categories.entertainment.icon,
    },
    salary: {
      icon: "business-outline",
      bg: Colors.categories.salary.bg,
      color: Colors.categories.salary.icon,
    },
    freelance: {
      icon: "briefcase-outline",
      bg: Colors.categories.freelance.bg,
      color: Colors.categories.freelance.icon,
    },
    investment: {
      icon: "trending-up-outline",
      bg: Colors.categories.investment.bg,
      color: Colors.categories.investment.icon,
    },
    other: {
      icon: "ellipsis-horizontal-outline",
      bg: Colors.categories.other.bg,
      color: Colors.categories.other.icon,
    },
  };

  return map[category] ?? map.other;
};

export default function TransactionList({
  transactions,
  onTransactionPress,
}: TransactionListProps) {
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
        const categoryStyle = getCategoryStyle(transaction.category);

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
                { backgroundColor: categoryStyle.bg },
              ]}
            >
              <Ionicons
                name={categoryStyle.icon}
                size={18}
                color={categoryStyle.color}
              />
            </View>

            {/* Name and Category */}
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>
                {transaction.name}
              </Text>
              <Text style={styles.category}>{transaction.category}</Text>
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
  name: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.textPrimary,
  },
  category: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    textTransform: "capitalize",
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
