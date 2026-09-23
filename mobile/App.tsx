import { Easing, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { enableScreens } from "react-native-screens";
import { NavigationContainer } from "@react-navigation/native";
import {
  createBottomTabNavigator,
  SceneStyleInterpolators,
  type BottomTabBarProps,
} from "@react-navigation/bottom-tabs";

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
import ImportCsvModal from "./screens/modals/ImportCsvModal";

// Alerts monitoring
import { useAlertsMonitor } from "./hooks/useAlertsMonitor";

// Explanation dialog for the offline / failed-sync status bar
import { alertAsync } from "./utils/confirm";

// react-native-screens' native screen containers, used under the hood by the
// tab navigator below — this is what makes tab switches use real native
// transitions instead of hand-rolled JS animation over mounted React trees
// (which is what produced the flicker: two heavy, stateful screens stacked
// and cross-faded in JS).
enableScreens();

export type TabParamList = {
  Dashboard: undefined;
  Analytics: { filter?: AnalyticsInitialFilter } | undefined;
  Alerts: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

// 250ms crossfade, as opposed to the library's 150ms default.
const FADE_TRANSITION_SPEC = {
  animation: "timing" as const,
  config: { duration: 250, easing: Easing.inOut(Easing.ease) },
};

const NAV_ITEMS: {
  name: keyof TabParamList;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    name: "Dashboard",
    label: "Dashboard",
    icon: "home-outline",
    activeIcon: "home",
  },
  {
    name: "Analytics",
    label: "Analytics",
    icon: "bar-chart-outline",
    activeIcon: "bar-chart",
  },
  {
    name: "Alerts",
    label: "Alerts",
    icon: "notifications-outline",
    activeIcon: "notifications",
  },
  {
    name: "Settings",
    label: "Settings",
    icon: "settings-outline",
    activeIcon: "settings",
  },
];

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { session, initializing } = useAuthStore();
  const { status, syncError, persistHydrated, hydrate, reset } = useFinanceStore();

  // Keyed on the user id rather than the session object: Supabase hands back a
  // new session object on every token refresh, and re-running hydrate() then
  // would race with (and could clobber) whatever the user is doing at that
  // moment — e.g. a settings toggle landing locally just before a stale
  // in-flight hydrate() overwrites it back.
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (userId) {
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
  }, [userId]);

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

const unsyncedAdvice = (count: number) =>
  `Your changes are saved on this phone and will sync automatically as soon as you're back online.\n\n` +
  `Until ${count === 1 ? "it syncs" : "they sync"}:\n` +
  `• ${count === 1 ? "It exists" : "They exist"} only on this device — not on your other devices yet.\n` +
  `• Avoid signing out, uninstalling, or clearing the app's data. That's the only way unsynced changes can be lost.\n\n` +
  `You can keep adding, editing and deleting transactions as normal — everything is queued and sent in order once you reconnect.`;

// Status line above the tab bar. Offline and failed states get a colour so they
// actually get noticed, and are tappable for an explanation of what's at risk;
// routine background syncing stays quiet since it needs no action.
function SyncIndicator() {
  const status = useFinanceStore((s) => s.status);
  const syncError = useFinanceStore((s) => s.syncError);
  const isConnected = useFinanceStore((s) => s.isConnected);
  const pendingCount = useFinanceStore((s) => s.pendingOps.length);
  const failedCount = useFinanceStore((s) => s.pendingOps.filter((o) => o.status === "failed").length);

  if (!isConnected) {
    return (
      <TouchableOpacity
        style={[styles.syncBar, styles.syncBarWarning]}
        activeOpacity={0.7}
        onPress={() =>
          alertAsync(
            "You're offline",
            pendingCount > 0
              ? unsyncedAdvice(pendingCount)
              : "Anything you add, edit or delete while offline is saved on this phone and syncs automatically once you're back online.\n\nJust avoid signing out or uninstalling the app before it syncs — that's the only way unsynced changes can be lost.",
          )
        }
      >
        <Ionicons name="cloud-offline-outline" size={13} color={Colors.warningText} />
        <Text style={[styles.syncText, styles.syncTextWarning]}>
          {pendingCount > 0
            ? `You're offline — ${pendingCount} change${pendingCount === 1 ? "" : "s"} waiting to sync`
            : "You're offline — changes will sync when reconnected"}
        </Text>
        <Ionicons name="information-circle-outline" size={13} color={Colors.warningText} />
      </TouchableOpacity>
    );
  }

  if (failedCount > 0) {
    return (
      <TouchableOpacity
        style={[styles.syncBar, styles.syncBarError]}
        activeOpacity={0.7}
        onPress={() =>
          alertAsync(
            "Some changes haven't synced",
            `${failedCount} change${failedCount === 1 ? "" : "s"} couldn't reach the server yet.\n\n` +
              unsyncedAdvice(failedCount) +
              `\n\nThe app retries automatically whenever it syncs — reopening it is usually enough.`,
          )
        }
      >
        <Ionicons name="alert-circle-outline" size={13} color={Colors.errorText} />
        <Text style={[styles.syncText, styles.syncTextError]}>
          {failedCount} change{failedCount === 1 ? "" : "s"} couldn't sync — tap to learn more
        </Text>
      </TouchableOpacity>
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

// Reproduces the app's original bottom nav UI (icons/labels on either side of
// a floating add button) on top of react-navigation's tab bar, so the visual
// design is unchanged even though the navigator now owns tab switching.
function CustomTabBar({
  state,
  navigation,
  onAddPress,
}: BottomTabBarProps & { onAddPress: () => void }) {
  const insets = useSafeAreaInsets();

  const renderItem = (index: number) => {
    const route = state.routes[index];
    const item = NAV_ITEMS.find((i) => i.name === route.name);
    if (!item) return null;
    const isFocused = state.index === index;

    const onPress = () => {
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    return (
      <TouchableOpacity
        key={route.key}
        style={styles.navItem}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isFocused ? item.activeIcon : item.icon}
          size={22}
          color={isFocused ? Colors.primary : Colors.textMuted}
        />
        <Text style={[styles.navLabel, isFocused && styles.navLabelActive]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View>
      <SyncIndicator />
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {/* Left side — Dashboard and Analytics */}
        <View style={styles.navSide}>{[0, 1].map(renderItem)}</View>

        {/* Center — FAB Button */}
        <View style={styles.navCenter}>
          <FABButton onPress={onAddPress} />
        </View>

        {/* Right side — Alerts and Settings */}
        <View style={styles.navSide}>{[2, 3].map(renderItem)}</View>
      </View>
    </View>
  );
}

function AppContent() {
  const [showTransaction, setShowTransaction] = useState(false);
  const [categoriesModal, setCategoriesModal] = useState<CategoryTabType | null>(null);
  // Set only when categoriesModal was opened as a picker (from the
  // transaction form's "+New" button, via onOpenManageCategories/
  // onOpenManageFundCategories) rather than from Settings — stored as a
  // functional update since the value itself is a function.
  const [categoryPickHandler, setCategoryPickHandler] = useState<((id: string) => void) | null>(
    null,
  );
  // Set when the manager should open straight into editing this category,
  // instead of the list — holding a chip in the transaction form does this.
  const [categoryInitialEditId, setCategoryInitialEditId] = useState<string | undefined>(
    undefined,
  );
  const [showImportCsv, setShowImportCsv] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(
    null,
  );
  const { addTransaction } = useFinanceStore();

  // Stable reference (empty deps, setters are stable) for the same reason
  // setSelectedTransaction is passed directly below — a fresh arrow function
  // here on every AppContent render would defeat SwipeableTransactionRow's
  // row-level React.memo everywhere it's used (Dashboard's recent list, Top
  // Expenses, and Analytics), same class of bug fixed for onPress earlier.
  const handleEditTransaction = useCallback((transaction: Transaction) => {
    setEditTransaction(transaction);
    setShowTransaction(true);
  }, []);

  useAlertsMonitor();

  return (
    <View style={styles.container}>
      <Tab.Navigator
        tabBar={(props) => (
          <CustomTabBar
            {...props}
            onAddPress={() => {
              setEditTransaction(null);
              setShowTransaction(true);
            }}
          />
        )}
        screenOptions={{
          headerShown: false,
          transitionSpec: FADE_TRANSITION_SPEC,
          sceneStyleInterpolator: SceneStyleInterpolators.forFade,
        }}
      >
        <Tab.Screen name="Dashboard">
          {({ navigation }) => (
            <DashboardScreen
              // setSelectedTransaction directly, not a wrapping arrow — a
              // fresh closure here on every AppContent render (e.g. from
              // any modal's own state changing) would propagate down and
              // defeat TransactionList's row-level React.memo every time,
              // since useState's setter is otherwise referentially stable.
              onTransactionPress={setSelectedTransaction}
              onEditTransaction={handleEditTransaction}
              onNavigateToAnalytics={(filter) => navigation.navigate("Analytics", { filter })}
            />
          )}
        </Tab.Screen>
        {/* lazy: false — mounts this at app startup instead of on first tap.
            Rendering ~280 unvirtualized transaction rows is a genuine
            one-time cost; this just moves it to happen quietly in the
            background while Dashboard is already on screen, rather than
            right when the user switches to this tab. */}
        <Tab.Screen name="Analytics" options={{ lazy: false }}>
          {({ route }) => (
            <AnalyticsScreen
              initialFilter={route.params?.filter ?? null}
              onTransactionPress={setSelectedTransaction}
              onHoldEditCategory={(type, id) => {
                setCategoryInitialEditId(id);
                setCategoriesModal(type);
              }}
              onEditTransaction={handleEditTransaction}
              onOpenCategoryPicker={(type, onPicked) => {
                setCategoryPickHandler(() => onPicked);
                setCategoriesModal(type);
              }}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="Alerts" component={AlertsScreen} />
        <Tab.Screen name="Settings">
          {() => (
            <SettingsScreen
              onOpenCategories={(type) => setCategoriesModal(type)}
              onOpenImport={() => setShowImportCsv(true)}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>

      <AddTransactionModal
        visible={showTransaction}
        editTransaction={editTransaction}
        onClose={() => {
          setShowTransaction(false);
          setEditTransaction(null);
        }}
        onOpenManageCategories={(onPicked, initialEditId) => {
          setCategoryPickHandler(() => onPicked);
          setCategoryInitialEditId(initialEditId);
          setCategoriesModal("expense");
        }}
        onOpenManageFundCategories={(onPicked, initialEditId) => {
          setCategoryPickHandler(() => onPicked);
          setCategoryInitialEditId(initialEditId);
          setCategoriesModal("fund");
        }}
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
        initialEditId={categoryInitialEditId}
        onClose={() => {
          setCategoriesModal(null);
          setCategoryPickHandler(null);
          setCategoryInitialEditId(undefined);
        }}
        onPick={
          categoryPickHandler
            ? (id) => {
                categoryPickHandler(id);
                setCategoriesModal(null);
                setCategoryPickHandler(null);
                setCategoryInitialEditId(undefined);
              }
            : undefined
        }
      />
      <ImportCsvModal visible={showImportCsv} onClose={() => setShowImportCsv(false)} />

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
  syncBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 16,
    backgroundColor: Colors.surfaceSecondary,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  syncBarWarning: {
    backgroundColor: Colors.warningBg,
    borderTopColor: Colors.warningText + "40",
    paddingVertical: 7,
  },
  syncBarError: {
    backgroundColor: Colors.errorBg,
    borderTopColor: Colors.errorText + "40",
    paddingVertical: 7,
  },
  syncText: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: "center",
  },
  syncTextWarning: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.warningText,
  },
  syncTextError: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.errorText,
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
