import { View, Text, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFinanceStore } from "../store/useFinanceStore";
import BalanceCard from "../components/BalanceCard";
import TransactionList from "../components/TransactionList";
import AIInsightBanner from "../components/AIInsightBanner";
import { Colors } from "../constants/colors";
import { GlobalStyles } from "../constants/styles";

export default function DashboardScreen() {
  const { transactions } = useFinanceStore();

  // Calculate balance data from real transactions
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpense;

  // Calculate percentage change vs last month
  const now = new Date();
  const thisMonth = transactions.filter((t) => {
    const d = new Date(t.date);
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  });

  const lastMonth = transactions.filter((t) => {
    const d = new Date(t.date);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1);
    return (
      d.getMonth() === lastMonthDate.getMonth() &&
      d.getFullYear() === lastMonthDate.getFullYear()
    );
  });

  const thisMonthIncome = thisMonth
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const lastMonthIncome = lastMonth
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const thisMonthExpense = thisMonth
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const lastMonthExpense = lastMonth
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  // Calculate percentage changes
  const incomePercentage =
    lastMonthIncome === 0
      ? 0
      : Math.round(
          ((thisMonthIncome - lastMonthIncome) / lastMonthIncome) * 100,
        );

  const expensePercentage =
    lastMonthExpense === 0
      ? 0
      : Math.round(
          ((thisMonthExpense - lastMonthExpense) / lastMonthExpense) * 100,
        );

  // AI insight message based on real data
  const getAIInsight = () => {
    if (transactions.length === 0) {
      return "Add your first transaction to get started!";
    }
    if (totalExpense > totalIncome) {
      return `Your expenses exceed your income by ${(totalExpense - totalIncome).toFixed(2)} BGN. Consider reviewing your spending.`;
    }
    if (expensePercentage > 20) {
      return `Your expenses are up ${expensePercentage}% compared to last month. Keep an eye on your spending!`;
    }
    return `You have saved ${(totalIncome - totalExpense).toFixed(2)} BGN so far. Great job keeping your finances in check!`;
  };

  // Show only last 5 transactions on dashboard
  const recentTransactions = transactions.slice(0, 5);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, GlobalStyles.screenPadding]}>
          <Text style={styles.greeting}>Good morning,</Text>
          <Text style={styles.name}>Alexander 👋</Text>
        </View>

        {/* Balance Card */}
        <BalanceCard
          balance={balance}
          totalIncome={totalIncome}
          totalExpense={totalExpense}
          incomePercentage={incomePercentage}
          expensePercentage={expensePercentage}
        />

        {/* AI Insight Banner */}
        <AIInsightBanner
          message={getAIInsight()}
          onPress={() => console.log("Navigate to AI screen")}
        />

        {/* Recent Transactions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <Text style={styles.sectionCount}>{transactions.length} total</Text>
        </View>

        <TransactionList
          transactions={recentTransactions}
          onTransactionPress={(transaction) =>
            console.log("Transaction pressed:", transaction)
          }
        />

        {/* Bottom padding for nav bar */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  name: {
    fontSize: 22,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  sectionCount: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  bottomPadding: {
    height: 20,
  },
});
