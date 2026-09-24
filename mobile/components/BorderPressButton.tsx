import { Pressable, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useEffect, useRef, useState, ReactNode } from "react";
import { ColorsType } from "../constants/colors";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";

type BorderPressButtonProps = {
  onPress?: () => void;
  disabled?: boolean;
  hitSlop?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

// A tap fast enough delivers its touch-start and touch-end to JS within the
// same event-loop tick — onPressIn's setPressed(true) and onPressOut's
// setPressed(false) then land in the same React batch, and only the final
// (false) value ever gets painted, so the border never appears at all. Tying
// the fade-out to a minimum-duration timer instead of directly to release
// guarantees the "true" frame actually paints before it's allowed to clear,
// no matter how quick the tap was.
const MIN_VISIBLE_MS = 140;

// Same inside-border press feedback as ModalCloseButton (which builds on
// this), generalized for any small icon button — e.g. a card's collapse/
// expand chevron — that wants the same clear tap confirmation.
export default function BorderPressButton({
  onPress,
  disabled,
  hitSlop,
  style,
  children,
}: BorderPressButtonProps) {
  const [pressed, setPressed] = useState(false);
  const Colors = useThemeColors();
  const styles = getThemedStyles(createStyles, Colors);
  const pressStartRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  useEffect(() => clearHideTimer, []);

  return (
    <Pressable
      disabled={disabled}
      hitSlop={hitSlop}
      onPress={onPress}
      onPressIn={() => {
        clearHideTimer();
        pressStartRef.current = Date.now();
        setPressed(true);
      }}
      onPressOut={() => {
        const remaining = MIN_VISIBLE_MS - (Date.now() - pressStartRef.current);
        hideTimerRef.current = setTimeout(() => setPressed(false), Math.max(0, remaining));
      }}
      style={[style, pressed && styles.pressedBorder]}
    >
      {children}
    </Pressable>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    pressedBorder: {
      borderWidth: 2,
      borderColor: Colors.primary,
    },
  });
}
