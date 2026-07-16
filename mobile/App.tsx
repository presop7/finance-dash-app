import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";

// Screens
import DashboardScreen from "./screens/DashboardScreen";
import AnalyticsScreen from "./screens/AnalyticsScreen";
import AlertsScreen from "./screens/AlertsScreen";
import SettingsScreen from "./screens/SettingsScreen";

// Modals
import AddTransactionModal from "./screens/modals/AddTransactionModal";

// Components
import FABButton from "./components/FABButton";

// Constants
import { Colors } from "./constants/colors";
import AnalysisScreen from "./screens/AnalyticsScreen";

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
  const [activeTab, setActiveTab] = useState<TabName>("dashboard");
  const [showTransaction, setShowTransaction] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [showManageFundCategories, setShowManageFundCategories] =
    useState(false);

  const renderScreen = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardScreen />;
      case "analytics":
        return <AnalysisScreen />;
      case "alerts":
        return <AlertsScreen />;
      case "settings":
        return <SettingsScreen />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Active Screen */}
      <View style={styles.screenContainer}>{renderScreen()}</View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
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
          <FABButton onPress={() => setShowTransaction(true)} />
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
        onClose={() => setShowTransaction(false)}
        onOpenManageCategories={() => setShowManageCategories(true)}
        onOpenManageFundCategories={() => setShowManageFundCategories(true)}
        onSave={(type, amount, category, fundCategory, title, note, date) => {
          console.log("Transaction saved:", {
            type,
            amount,
            category,
            fundCategory,
            title,
            note,
            date,
          });
          setShowTransaction(false);
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
  screenContainer: {
    flex: 1,
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
