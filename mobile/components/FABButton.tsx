import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { forwardRef } from "react";
import { Colors } from "../constants/colors";

type FABButtonProps = {
  onPress: () => void;
};

export type FABButtonRef = {
  close: () => void;
};

const FABButton = forwardRef<FABButtonRef, FABButtonProps>(
  ({ onPress }, ref) => {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.fab}
          onPress={onPress}
          activeOpacity={0.9}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  },
);

export default FABButton;

const styles = StyleSheet.create({
  container: {
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
    zIndex: 1002,
    elevation: 1002,
    // Colors.primary (#1D2B4F) at 40% — the shadow* props this replaces were
    // deprecated in React Native 0.86.
    boxShadow: "0px 4px 8px rgba(29, 43, 79, 0.4)",
  },
});
