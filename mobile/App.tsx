import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

// Import zustand store
import { useFinanceStore, Transaction } from "./store/useFinanceStore";
import { useAuthStore } from "./store/useAuthStore";

// Screens
import DashboardScreen from "./screens/DashboardScreen";
import AnalyticsScreen, { AnalyticsInitialFilter } from "./screens/AnalyticsScreen";
import AlertsScreen from "./screens/AlertsScreen";
import SettingsScreen from "./screens/SettingsScreen";
import AuthScreen from "./screens/AuthScreen";

// Transaction Modal
import AddTransactionModal from "./screens/modals/AddTransactionModal";

// Components
import FABButton from "./components/FABButton";

// Constants
import { Colors } from "./constants/colors";

// Category Management Modal
import CategoriesModal, { CategoryTabType } from "./screens/modals/CategoriesModal";
import TransactionDetailModal from "./screens/modals/TransactionDetailModal";

// Alerts monitoring
import { useAlertsMonitor } from "./hooks/useAlertsMonitor";

// TypeScript type for tab names
type TabName = "dashboard" | "analytics" | "alerts" | "settings";

const NAV_ITEMS: {
  name: TabName;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    name: "dashboard",
    label: "Dashboard",
    icon: "home-outline",
    activeIcon: "home",
  },
  {
    name: "analytics",
    label: "Analytics",
    icon: "bar-chart-outline",
    activeIcon: "bar-chart",
  },
  {
    name: "alerts",
    label: "Alerts",
    icon: "notifications-outline",
    activeIcon: "notifications",
  },
  {
    name: "settings",
    label: "Settings",
    icon: "settings-outline",
    activeIcon: "settings",
  },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { session, initializing } = useAuthStore();
  const { status, syncError, persistHydrated, hydrate, reset } = useFinanceStore();

  useEffect(() => {
    if (session) {
      // Re-read the cache first so it resolves against *this* user's slot
      // (rehydration otherwise only happens once at launch, which would skip
      // the cache when switching accounts mid-session), then refresh.
      (async () => {
        await useFinanceStore.persist.rehydrate();
        // hydrate() flushes any queue left over from a previous session before
        // fetching, so a launch that's already online still drains it — the
        // connectivity listener alone wouldn't, since no transition occurs.
        await hydrate();
      })();
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  // Brief, local-disk-only wait — determines whether there's a cached snapshot
  // to render instead of a spinner.
  if (!persistHydrated || status === "loading" || status === "idle") {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (status === "error") {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="cloud-offline-outline" size={40} color={Colors.textMuted} />
        <Text style={styles.errorText}>{syncError ?? "Couldn't load your data"}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={hydrate}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <AppContent />;
}

// Thin status line for anything the user should know about data freshness:
// being offline, changes waiting to sync, a refresh in flight, or a failed one.
function SyncIndicator() {
  const status = useFinanceStore((s) => s.status);
  const syncError = useFinanceStore((s) => s.syncError);
  const isConnected = useFinanceStore((s) => s.isConnected);
  const pendingCount = useFinanceStore((s) => s.pendingOps.length);
  const failedCount = useFinanceStore((s) => s.pendingOps.filter((o) => o.status === "failed").length);

  if (!isConnected) {
    return (
      <View style={styles.syncBar}>
        <Text style={styles.syncText}>
          {pendingCount > 0
            ? `You're offline — ${pendingCount} change${pendingCount === 1 ? "" : "s"} will sync when reconnected`
            : "You're offline — changes will sync when reconnected"}
        </Text>
      </View>
    );
  }

  if (failedCount > 0) {
    return (
      <View style={styles.syncBar}>
        <Text style={styles.syncText}>
          {failedCount} change{failedCount === 1 ? "" : "s"} couldn't sync — will retry
        </Text>
      </View>
    );
  }

  if (pendingCount > 0) {
    return (
      <View style={styles.syncBar}>
        <Text style={styles.syncText}>
          Syncing {pendingCount} change{pendingCount === 1 ? "" : "s"}…
        </Text>
      </View>
    );
  }

  if (status === "refreshing") {
    return (
      <View style={styles.syncBar}>
        <Text style={styles.syncText}>Syncing…</Text>
      </View>
    );
  }

  if (syncError && status === "loaded") {
    return (
      <View style={styles.syncBar}>
        <Text style={styles.syncText}>Showing saved data — sync failed, will retry</Text>
      </View>
    );
  }

  return null;
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabName>("dashboard");
  const [showTransaction, setShowTransaction] = useState(false);
  const [categoriesModal, setCategoriesModal] = useState<CategoryTabType | null>(null);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(
    null,
  );
  const [analyticsFilter, setAnalyticsFilter] =
    useState<AnalyticsInitialFilter | null>(null);
  const { addTransaction } = useFinanceStore();

  useAlertsMonitor();

  const navigateToAnalytics = (filter: AnalyticsInitialFilter) => {
    setAnalyticsFilter(filter);
    setActiveTab("analytics");
  };

  const renderScreen = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <DashboardScreen
            onTransactionPress={(transaction) =>
              setSelectedTransaction(transaction)
            }
            onNavigateToAnalytics={navigateToAnalytics}
          />
        );
      case "analytics":
        return (
          <AnalyticsScreen
            initialFilter={analyticsFilter}
            onTransactionPress={(transaction) => setSelectedTransaction(transaction)}
          />
        );
      case "alerts":
        return <AlertsScreen />;
      case "settings":
        return (
          <SettingsScreen onOpenCategories={(type) => setCategoriesModal(type)} />
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* Active Screen */}
      <View style={styles.screenContainer}>{renderScreen()}</View>

      <SyncIndicator />

      {/* Bottom Navigation */}
      <View
        style={[
          styles.bottomNav,
          { paddingBottom: Math.max(insets.bottom, 8) },
        ]}
      >
        {/* Left side — Dashboard and Analytics */}
        <View style={styles.navSide}>
          {NAV_ITEMS.slice(0, 2).map((item) => (
            <TouchableOpacity
              key={item.name}
              style={styles.navItem}
              onPress={() => setActiveTab(item.name)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === item.name ? item.activeIcon : item.icon}
                size={22}
                color={
                  activeTab === item.name ? Colors.primary : Colors.textMuted
                }
              />
              <Text
                style={[
                  styles.navLabel,
                  activeTab === item.name && styles.navLabelActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Center — FAB Button */}
        <View style={styles.navCenter}>
          <FABButton
            onPress={() => {
              setEditTransaction(null);
              setShowTransaction(true);
            }}
          />
        </View>

        {/* Right side — Alerts and Settings */}
        <View style={styles.navSide}>
          {NAV_ITEMS.slice(2, 4).map((item) => (
            <TouchableOpacity
              key={item.name}
              style={styles.navItem}
              onPress={() => setActiveTab(item.name)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === item.name ? item.activeIcon : item.icon}
                size={22}
                color={
                  activeTab === item.name ? Colors.primary : Colors.textMuted
                }
              />
              <Text
                style={[
                  styles.navLabel,
                  activeTab === item.name && styles.navLabelActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <AddTransactionModal
        visible={showTransaction}
        editTransaction={editTransaction}
        onClose={() => {
          setShowTransaction(false);
          setEditTransaction(null);
        }}
        onOpenManageCategories={() => setCategoriesModal("expense")}
        onOpenManageFundCategories={() => setCategoriesModal("fund")}
        onSave={async (type, amount, category, fundCategory, title, note, date) => {
          // Errors propagate to AddTransactionModal's handleSave, which keeps
          // the modal open (with the entered data intact) so the user can retry.
          await addTransaction({
            title,
            type,
            amount,
            category,
            fundCategory,
            note,
            date,
          });
          setShowTransaction(false);
        }}
      />
      <CategoriesModal
        visible={categoriesModal !== null}
        initialType={categoriesModal ?? "expense"}
        onClose={() => setCategoriesModal(null)}
      />

      <TransactionDetailModal
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        onEdit={(transaction) => {
          setSelectedTransaction(null);
          setEditTransaction(transaction);
          setShowTransaction(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: Colors.surface,
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  screenContainer: {
    flex: 1,
  },
  syncBar: {
    paddingVertical: 4,
    paddingHorizontal: 16,
    backgroundColor: Colors.surfaceSecondary,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  syncText: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: "center",
  },
  bottomNav: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    paddingBottom: 8,
    paddingTop: 6,
    paddingHorizontal: 8,
  },
  navSide: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  navCenter: {
    width: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  navItem: {
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 8,
  },
  navLabel: {
    fontSize: 9,
    color: Colors.textMuted,
  },
  navLabelActive: {
    color: Colors.primary,
    fontWeight: "500",
  },
});
