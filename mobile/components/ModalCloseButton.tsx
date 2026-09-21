import { Pressable, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";

type ModalCloseButtonProps = {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
};

// TouchableOpacity's default dim-on-press was too subtle on this small a
// target for users to register the tap landed — an inside border (drawn
// within the circle, not adding to its size, since RN sizes borders like
// CSS border-box) gives a much clearer hit confirmation.
//
// Two things this has to guard against, both about timing rather than the
// border itself:
// - A tap fast enough delivers press-in and press-out to JS in the same
//   event-loop tick, so React batches setPressed(true) then setPressed(false)
//   into one commit and only ever paints the final (false) value — the
//   border never appears at all. Tying the fade-out to a minimum-duration
//   timer instead of directly to release guarantees at least one visible
//   frame regardless of how quick the tap was.
// - onPress here closes the modal this button lives in, which (on Android)
//   plays an exit animation on a snapshot of the view rather than a
//   live-rerendering one — closing before that un-pressed frame has actually
//   painted freezes the border for the whole close animation. So the real
//   close is deferred until the same timer clears the border, not fired
//   immediately on release.
const MIN_VISIBLE_MS = 140;

export default function ModalCloseButton({ onPress, style, hitSlop }: ModalCloseButtonProps) {
  const [pressed, setPressed] = useState(false);
  const pressStartRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  useEffect(() => clearHideTimer, []);

  const remainingVisibleMs = () => Math.max(0, MIN_VISIBLE_MS - (Date.now() - pressStartRef.current));

  return (
    <Pressable
      onPressIn={() => {
        clearHideTimer();
        pressStartRef.current = Date.now();
        setPressed(true);
      }}
      // Fires on a cancelled press (dragged off before release) — onPress
      // won't fire in that case, so this is what clears the border then.
      onPressOut={() => {
        hideTimerRef.current = setTimeout(() => setPressed(false), remainingVisibleMs());
      }}
      onPress={() => {
        clearHideTimer();
        hideTimerRef.current = setTimeout(() => {
          setPressed(false);
          requestAnimationFrame(onPress);
        }, remainingVisibleMs());
      }}
      hitSlop={hitSlop}
      style={[styles.closeBtn, style, pressed && styles.closeBtnPressed]}
    >
      <Ionicons name="close" size={25} color={Colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  closeBtn: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: Colors.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnPressed: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
});
