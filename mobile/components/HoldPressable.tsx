import { ReactNode, useRef } from "react";
import { Pressable, Animated, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { Colors } from "../constants/colors";

const HOLD_MS = 300;

type HoldPressableProps = {
  onHoldComplete: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  fillColor?: string;
  children: ReactNode;
};

export default function HoldPressable({
  onHoldComplete,
  disabled,
  style,
  fillColor,
  children,
}: HoldPressableProps) {
  const holdAnim = useRef(new Animated.Value(0)).current;

  const startHoldAnim = () => {
    holdAnim.setValue(0);
    Animated.timing(holdAnim, {
      toValue: 1,
      duration: HOLD_MS,
      useNativeDriver: false,
    }).start();
  };

  const cancelHoldAnim = () => {
    Animated.timing(holdAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };

  const fillWidth = holdAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <Pressable
      style={[styles.container, style]}
      disabled={disabled}
      delayLongPress={HOLD_MS}
      onPressIn={startHoldAnim}
      onPressOut={cancelHoldAnim}
      onLongPress={() => {
        cancelHoldAnim();
        onHoldComplete();
      }}
    >
      <Animated.View
        style={[
          styles.holdFill,
          { width: fillWidth, backgroundColor: fillColor ?? Colors.primary + "22" },
        ]}
      />
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  holdFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 8,
  },
});
