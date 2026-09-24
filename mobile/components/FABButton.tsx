import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { forwardRef } from "react";
import { ColorsType } from "../constants/colors";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";

type FABButtonProps = {
  onPress: () => void;
};

export type FABButtonRef = {
  close: () => void;
};

const FABButton = forwardRef<FABButtonRef, FABButtonProps>(
  ({ onPress }, ref) => {
    const Colors = useThemeColors();
    const styles = getThemedStyles(createStyles, Colors);
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

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
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
    // Colors.primary at 40% — the shadow* props this replaces were
    // deprecated in React Native 0.86.
    boxShadow: `0px 4px 8px ${Colors.primary}66`,
  },
  });
}
