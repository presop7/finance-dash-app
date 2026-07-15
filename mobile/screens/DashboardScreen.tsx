import { View, Text, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import BalanceCard from "../components/BalanceCard";
import { Colors } from "../constants/colors";
import { GlobalStyles } from "../constants/styles";
import TransactionList, { Transaction } from "../components/TransactionList";

export default function DashboardScreen() {
  // Temporary hardcoded data — later will come from Zustand store
  const mockData = {
    balance: 3840.0,
    totalIncome: 2200.0,
    totalExpense: 1360.0,
    incomePercentage: 12,
    expensePercentage: 5,
  };
  const mockTransactions: Transaction[] = [
    {
      id: "1",
      name: "Lidl",
      category: "food",
      amount: 42.0,
      type: "expense",
      date: "2026-07-01",
    },
    {
      id: "2",
      name: "Salary",
      category: "salary",
      amount: 2200.0,
      type: "income",
      date: "2026-07-01",
    },
    {
      id: "3",
      name: "Coffee 79",
      category: "restaurant",
      amount: 8.0,
      type: "expense",
      date: "2026-07-01",
    },
  ];

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
          balance={mockData.balance}
          totalIncome={mockData.totalIncome}
          totalExpense={mockData.totalExpense}
          incomePercentage={mockData.incomePercentage}
          expensePercentage={mockData.expensePercentage}
        />

        {/* Recent Transactions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
        </View>

        <TransactionList
          transactions={mockTransactions}
          onTransactionPress={(transaction) => console.log(transaction)}
        />
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
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
});
