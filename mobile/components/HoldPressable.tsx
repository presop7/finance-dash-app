import { ReactNode, useEffect, useRef } from "react";
import { Pressable, Animated, StyleSheet, StyleProp, ViewStyle, LayoutChangeEvent } from "react-native";
import { Colors } from "../constants/colors";

// Two independent phases, not one derived from the other: DELAY is how long
// a press has to hold still before anything appears (so a normal tap never
// even flashes it), and FILL is how long the fill itself then takes to go
// 0->100%, on its own clock — not squeezed into whatever time is left
// before the action fires. The action fires exactly when the fill finishes
// (delayLongPress = DELAY + FILL below), so the two always stay in sync.
const DEFAULT_DELAY_MS = 150;
const DEFAULT_FILL_MS = 150;

type HoldPressableProps = {
  onHoldComplete: () => void;
  // Optional plain tap, alongside the hold gesture — Pressable supports
  // both natively (a press shorter than delayLongPress fires this instead).
  onPress?: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  fillColor?: string;
  // Override the two phases above per-instance, in ms, if a particular
  // hold interaction wants to feel faster/slower than the shared default.
  holdDelayMs?: number;
  holdFillMs?: number;
  // Plain content gets the default behavior: the fill covers this whole
  // component. Pass a function instead to place the fill somewhere more
  // specific yourself (e.g. just inside an icon square, not the whole row)
  // — it's called with the same 0%-100% animated width the default fill
  // would have used, and the built-in full-coverage fill is skipped.
  children: ReactNode | ((fillWidth: Animated.AnimatedInterpolation<string | number>) => ReactNode);
};

export default function HoldPressable({
  onHoldComplete,
  onPress,
  onLayout,
  disabled,
  style,
  fillColor,
  holdDelayMs = DEFAULT_DELAY_MS,
  holdFillMs = DEFAULT_FILL_MS,
  children,
}: HoldPressableProps) {
  const holdAnim = useRef(new Animated.Value(0)).current;
  const fillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFillTimer = () => {
    if (fillTimerRef.current) {
      clearTimeout(fillTimerRef.current);
      fillTimerRef.current = null;
    }
  };

  useEffect(() => clearFillTimer, []);

  const startHoldAnim = () => {
    holdAnim.setValue(0);
    fillTimerRef.current = setTimeout(() => {
      Animated.timing(holdAnim, {
        toValue: 1,
        duration: holdFillMs,
        useNativeDriver: false,
      }).start();
    }, holdDelayMs);
  };

  const cancelHoldAnim = () => {
    clearFillTimer();
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

  const isRenderProp = typeof children === "function";

  return (
    <Pressable
      style={[styles.container, style]}
      disabled={disabled}
      delayLongPress={holdDelayMs + holdFillMs}
      onPress={onPress}
      onLayout={onLayout}
      onPressIn={startHoldAnim}
      onPressOut={cancelHoldAnim}
      onLongPress={() => {
        cancelHoldAnim();
        onHoldComplete();
      }}
    >
      {!isRenderProp && (
        <Animated.View
          style={[
            styles.holdFill,
            { width: fillWidth, backgroundColor: fillColor ?? Colors.primary + "22" },
          ]}
        />
      )}
      {isRenderProp ? children(fillWidth) : children}
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
