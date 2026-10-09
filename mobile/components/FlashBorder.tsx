import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import { useThemeColors } from "../hooks/useThemeColors";

// A soft, pulsing outline just inside its parent's edge
// for something just added: three slow pulses, about 2.5 s, then gone.
export default function FlashBorder({ radius, onDone }: { radius: number; onDone?: () => void }) {
  const Colors = useThemeColors();
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const pulse = (to: number) =>
      Animated.timing(opacity, { toValue: to, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: true });
    const run = Animated.sequence([pulse(1), pulse(0.25), pulse(1), pulse(0.25), pulse(1), pulse(0)]);
    run.start(({ finished }) => finished && onDone?.());
    return () => run.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: radius, borderWidth: 2, borderColor: Colors.primary, opacity },
      ]}
    />
  );
}
