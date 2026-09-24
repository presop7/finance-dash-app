import { memo } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useFinanceStore, Transaction } from "../store/useFinanceStore";
import { useAuthStore } from "../store/useAuthStore";
import BalanceCard from "../components/BalanceCard";
import TransactionList from "../components/SwipeableTransactionList";
import InsightBanner from "../components/InsightBanner";
import TopExpensesCard from "../components/TopExpensesCard";
import FundsCard from "../components/FundsCard";
import DashboardCardList, {
  DashboardCardDef,
} from "../components/DashboardCardList";
import { ColorsType } from "../constants/colors";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";
import { GlobalStyles } from "../constants/styles";
import { getGreeting, nameFromEmail } from "../utils/greeting";
import type { AnalyticsInitialFilter } from "./AnalyticsScreen";

type DashboardScreenProps = {
  onTransactionPress: (transaction: Transaction) => void;
  // Swipe-left-to-edit target for the recent-transactions/top-expenses
  // rows — same "open AddTransactionModal in edit mode" transition the
  // detail modal's own Edit button triggers.
  onEditTransaction?: (transaction: Transaction) => void;
  onNavigateToAnalytics: (filter: AnalyticsInitialFilter) => void;
};

function DashboardScreen({
  onTransactionPress,
  onEditTransaction,
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
    displayNameOverride,
  } = useFinanceStore();
  const session = useAuthStore((s) => s.session);
  const Colors = useThemeColors();
  const styles = getThemedStyles(createStyles, Colors);
  const displayName = displayNameOverride || nameFromEmail(session?.user.email) || "there";
  const greeting = getGreeting();

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
          onEditTransaction={onEditTransaction}
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
          onEdit={onEditTransaction}
        />
      ),
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, GlobalStyles.screenPadding]}>
          <Text style={styles.greeting}>{greeting.text}</Text>
          <Text style={styles.name}>{displayName} {greeting.emoji}</Text>
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

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
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
}

// Screens are memoized so opening a modal (which changes App-level state)
// doesn't re-render them — App passes only stable props (see AppContent).
export default memo(DashboardScreen);
