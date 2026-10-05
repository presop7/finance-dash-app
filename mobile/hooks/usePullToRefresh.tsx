import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFinanceStore } from "../store/useFinanceStore";
import { useThemeColors } from "./useThemeColors";
import { GlobalStyles } from "../constants/styles";

// Pull distance (px, after damping) that refreshes on release.
const TRIGGER = 70;
const MAX_PULL = 110;
// A touch held this long before moving is a hold (reorder, drag-select), not a pull.
const HOLD_MS = 250;
// How long the spinner shows to acknowledge a pull.
const ACK_MS = 600;

// Pull-to-refresh for the transaction screens: re-sends anything still queued
// (including failed writes) and re-downloads everything from the server — in
// the background. The server can take 30-60s to wake up, so the spinner only
// acknowledges the pull and goes away; the screen stays usable, and the sync
// line above the tab bar shows it's still syncing (store status "refreshing").
//
// The phone apps use RefreshControl with refreshing/onRefresh. On the web
// RefreshControl does nothing, so there the scroll view's own touches are
// watched instead (getScrollNode): a pull down from the very top shows
// `webIndicator` (place it over the top of the screen) and refreshes on
// release past TRIGGER.
export function usePullToRefresh(
  getScrollNode?: () => HTMLElement | null | undefined,
  enabled = true,
) {
  const Colors = useThemeColors();
  const [refreshing, setRefreshing] = useState(false);
  const [pull, setPull] = useState(0);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), ACK_MS);
    const store = useFinanceStore.getState();
    // Already syncing (app start, reconnect, an earlier pull): that one will do.
    if (store.status !== "refreshing" && store.status !== "loading") store.hydrate();
  }, []);

  const getNodeRef = useRef(getScrollNode);
  getNodeRef.current = getScrollNode;
  useEffect(() => {
    if (Platform.OS !== "web" || !enabled) return;
    const node = getNodeRef.current?.();
    if (!node?.addEventListener) return;
    let startY: number | null = null;
    let downAt = 0;
    let distance = 0;
    const start = (e: TouchEvent) => {
      startY = e.touches.length === 1 && node.scrollTop <= 0 ? e.touches[0].clientY : null;
      downAt = Date.now();
      distance = 0;
    };
    const move = (e: TouchEvent) => {
      if (startY === null) return;
      const dy = e.touches[0].clientY - startY;
      // Scrolling the list, scrolled away from the top, or a hold: not a pull.
      if (dy < 0 || node.scrollTop > 0 || (distance === 0 && Date.now() - downAt > HOLD_MS)) {
        startY = null;
        distance = 0;
        setPull(0);
        return;
      }
      distance = Math.min(dy * 0.5, MAX_PULL);
      setPull(distance);
    };
    const end = () => {
      if (startY !== null && distance >= TRIGGER) onRefresh();
      startY = null;
      distance = 0;
      setPull(0);
    };
    node.addEventListener("touchstart", start, { passive: true });
    node.addEventListener("touchmove", move, { passive: true });
    node.addEventListener("touchend", end);
    node.addEventListener("touchcancel", end);
    return () => {
      node.removeEventListener("touchstart", start);
      node.removeEventListener("touchmove", move);
      node.removeEventListener("touchend", end);
      node.removeEventListener("touchcancel", end);
    };
  }, [enabled, onRefresh]);

  const webIndicator =
    Platform.OS === "web" && (pull > 0 || refreshing) ? (
      <View
        pointerEvents="none"
        style={[
          styles.indicator,
          GlobalStyles.shadow,
          { backgroundColor: Colors.surface, transform: [{ translateY: refreshing ? TRIGGER : pull }] },
        ]}
      >
        {refreshing ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          // Turns as it's pulled; points up (release to refresh) once far enough.
          <Ionicons
            name="arrow-down"
            size={18}
            color={Colors.primary}
            style={{ opacity: Math.min(1, pull / TRIGGER), transform: [{ rotate: pull >= TRIGGER ? "180deg" : "0deg" }] }}
          />
        )}
      </View>
    ) : null;

  return { refreshing, onRefresh, webIndicator };
}

const styles = StyleSheet.create({
  indicator: {
    position: "absolute",
    top: -28,
    alignSelf: "center",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
});
