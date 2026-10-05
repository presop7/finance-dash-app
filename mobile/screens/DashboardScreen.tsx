import { memo, useCallback, useRef } from "react";
import { View, Text, ScrollView, RefreshControl, StyleSheet } from "react-native";
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
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { scrollIntoView, useTutorialStore, useTutorialTarget } from "../store/useTutorialStore";
import { GlobalStyles } from "../constants/styles";
import { useScreenTop } from "../hooks/useScreenTop";
import { getGreeting, firstNameFromUser } from "../utils/greeting";
import type { AnalyticsInitialFilter } from "./AnalyticsScreen";
import { useTranslation } from "react-i18next";
import { FONT } from "../constants/typography";

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
  const screenTop = useScreenTop();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);
  const { refreshing, onRefresh, webIndicator } = usePullToRefresh(
    () => (scrollRef.current as any)?.getScrollableNode?.() as HTMLElement | undefined,
  );
  const scrollRef = useRef<ScrollView>(null);
  const scrollTo = useCallback((view: View) => scrollIntoView(scrollRef, view), []);
  const heroRef = useTutorialTarget("hero", scrollTo);
  // Finger scrolling is off during the tour (it positions the page itself):
  // scrolling inside a lit spot would slide the spot out from under it.
  const tourActive = useTutorialStore((s) => s.active);
  const displayName = displayNameOverride || firstNameFromUser(session?.user) || "there";
  const greeting = getGreeting();

  // Show only the last 5 added transactions on the dashboard.
  const recentTransactions = transactions.slice(0, 5);

  const cards: DashboardCardDef[] = [
    {
      id: "insights",
      title: t("dashboard.insights"),
      content: (
        <InsightBanner
          transactions={transactions}
          expenseCategories={expenseCategories}
        />
      ),
    },
    {
      id: "topExpenses",
      title: t("dashboard.topExpenses"),
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
      title: t("dashboard.yourFunds"),
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
      title: t("dashboard.recentTransactions"),
      subtitle: t("dashboard.total", { count: transactions.length }),
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
        ref={scrollRef}
        scrollEnabled={!tourActive}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={[styles.header, GlobalStyles.screenPadding, { paddingTop: screenTop }]}>
          <Text style={styles.greeting}>{greeting.text}</Text>
          <Text style={styles.name}>{displayName} {greeting.emoji}</Text>
        </View>

        {/* Balance Card — always pinned at the top, not collapsible/draggable */}
        <View ref={heroRef} collapsable={false}>
          <BalanceCard transactions={transactions} onNavigateToAnalytics={onNavigateToAnalytics} />
        </View>

        {/* Everything else: collapsible + reorderable (hold a title to enter reorder mode) */}
        <DashboardCardList
          cards={cards}
          order={dashboardCardOrder}
          collapsed={dashboardCollapsedCards}
          onReorder={setDashboardCardOrder}
          onToggleCollapse={toggleDashboardCard}
          tutorialScroll={scrollTo}
        />

        {/* Bottom padding for nav bar */}
        <View style={styles.bottomPadding} />
      </ScrollView>
      {webIndicator}
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
      paddingBottom: 16,
    },
    greeting: {
      fontSize: FONT.small,
      color: Colors.textMuted,
    },
    name: {
      fontSize: FONT.heading,
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
