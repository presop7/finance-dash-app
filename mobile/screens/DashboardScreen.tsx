import { View, Text, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFinanceStore, Transaction } from "../store/useFinanceStore";
import BalanceCard from "../components/BalanceCard";
import TransactionList from "../components/TransactionList";
import InsightBanner from "../components/InsightBanner";
import TopExpensesCard from "../components/TopExpensesCard";
import FundsCard from "../components/FundsCard";
import DashboardCardList, {
  DashboardCardDef,
} from "../components/DashboardCardList";
import { Colors } from "../constants/colors";
import { GlobalStyles } from "../constants/styles";
import type { AnalyticsInitialFilter } from "./AnalyticsScreen";

type DashboardScreenProps = {
  onTransactionPress: (transaction: Transaction) => void;
  onNavigateToAnalytics: (filter: AnalyticsInitialFilter) => void;
};

export default function DashboardScreen({
  onTransactionPress,
  onNavigateToAnalytics,
}: DashboardScreenProps) {
  const {
    transactions,
    expenseCategories,
    fundCategories,
    dashboardCardOrder,
    dashboardCollapsedCards,
    setDashboardCardOrder,
    toggleDashboardCard,
  } = useFinanceStore();

  // Show only the last 5 added transactions on the dashboard.
  const recentTransactions = transactions.slice(0, 5);

  const cards: DashboardCardDef[] = [
    {
      id: "insights",
      title: "Insights",
      content: (
        <InsightBanner
          transactions={transactions}
          expenseCategories={expenseCategories}
        />
      ),
    },
    {
      id: "topExpenses",
      title: "Top Expenses",
      content: (
        <TopExpensesCard
          transactions={transactions}
          onTransactionPress={onTransactionPress}
        />
      ),
    },
    {
      id: "funds",
      title: "Your Funds",
      content: (
        <FundsCard
          transactions={transactions}
          fundCategories={fundCategories}
          onNavigateToAnalytics={onNavigateToAnalytics}
        />
      ),
    },
    {
      id: "transactions",
      title: "Recent Transactions",
      subtitle: `${transactions.length} total`,
      content: (
        <TransactionList
          transactions={recentTransactions}
          onTransactionPress={onTransactionPress}
        />
      ),
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

        {/* Balance Card — always pinned at the top, not collapsible/draggable */}
        <BalanceCard transactions={transactions} onNavigateToAnalytics={onNavigateToAnalytics} />

        {/* Everything else: collapsible + reorderable (hold a title to enter reorder mode) */}
        <DashboardCardList
          cards={cards}
          order={dashboardCardOrder}
          collapsed={dashboardCollapsedCards}
          onReorder={setDashboardCardOrder}
          onToggleCollapse={toggleDashboardCard}
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
  bottomPadding: {
    height: 20,
  },
});
