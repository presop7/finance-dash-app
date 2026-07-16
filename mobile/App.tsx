import { View, StyleSheet } from "react-native";
import { useState } from "react";
import DashboardScreen from "./screens/DashboardScreen";
import FABButton from "./components/FABButton";
import AddExpenseModal from "./screens/modals/AddExpenseModal";
import { Colors } from "./constants/colors";

export default function App() {
  const [showExpense, setShowExpense] = useState(false);
  const [showIncome, setShowIncome] = useState(false);

  return (
    <View style={styles.container}>
      <DashboardScreen />

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <FABButton
          onAddExpense={() => setShowExpense(true)}
          onAddIncome={() => setShowIncome(true)}
        />
      </View>

      {/* Modals */}
      <AddExpenseModal
        visible={showExpense}
        onClose={() => setShowExpense(false)}
        onSave={(amount, category, note) => {
          console.log("Expense saved:", { amount, category, note });
          setShowExpense(false);
        }}
      />
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
