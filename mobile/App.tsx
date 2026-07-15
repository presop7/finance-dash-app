import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import DashboardScreen from "./screens/DashboardScreen";
import { Colors } from "./constants/colors";
import FABButton from "./components/FABButton";

export default function App() {
  return (
    <View style={styles.container}>
      {/* Main Screen */}
      <DashboardScreen />

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <FABButton
          onAddExpense={() => console.log("Add expense")}
          onAddIncome={() => console.log("Add income")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomNav: {
    backgroundColor: Colors.surface,
    borderTopWidth: 0,
    borderTopColor: Colors.border,
    paddingBottom: 8,
  },
});
