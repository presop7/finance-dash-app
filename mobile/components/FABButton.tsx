import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useRef } from "react";
import { Colors } from "../constants/colors";

type FABButtonProps = {
  onAddExpense: () => void;
  onAddIncome: () => void;
};

export default function FABButton({
  onAddExpense,
  onAddIncome,
}: FABButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;

  const toggleExpand = () => {
    const toValue = isExpanded ? 0 : 1;

    Animated.spring(animation, {
      toValue,
      useNativeDriver: true,
      friction: 6,
    }).start();

    setIsExpanded(!isExpanded);
  };

  // Rotation animation for the + icon
  const rotation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  // Slide and fade for income button
  const incomeStyle = {
    opacity: animation,
    transform: [
      {
        translateX: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -70],
        }),
      },
    ],
  };

  // Slide and fade for expense button
  const expenseStyle = {
    opacity: animation,
    transform: [
      {
        translateX: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 70],
        }),
      },
    ],
  };

  return (
    <View style={styles.container}>
      {/* Income Button */}
      <Animated.View style={[styles.sideButton, incomeStyle]}>
        <TouchableOpacity
          style={[styles.sideButtonInner, { backgroundColor: Colors.income }]}
          onPress={() => {
            toggleExpand();
            onAddIncome();
          }}
        >
          <Ionicons name="arrow-up" size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.sideLabel}>Income</Text>
      </Animated.View>

      {/* Main FAB Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={toggleExpand}
        activeOpacity={0.9}
      >
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Ionicons name="add" size={28} color="#fff" />
        </Animated.View>
      </TouchableOpacity>

      {/* Expense Button */}
      <Animated.View style={[styles.sideButton, expenseStyle]}>
        <TouchableOpacity
          style={[styles.sideButtonInner, { backgroundColor: Colors.expense }]}
          onPress={() => {
            toggleExpand();
            onAddExpense();
          }}
        >
          <Ionicons name="arrow-down" size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.sideLabel}>Expense</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 60,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  sideButton: {
    position: "absolute",
    alignItems: "center",
    gap: 4,
  },
  sideButtonInner: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  sideLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: "500",
  },
});
