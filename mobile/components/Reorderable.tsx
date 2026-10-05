import { ComponentProps, ReactNode, useEffect, useRef, useState } from "react";
import { LayoutChangeEvent, Platform, Pressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { moveTo } from "../utils/reorder";

// Hold-and-drag reordering for a row or grid of items (the savings cards, the
// category carousels, the category manager), with the same two plain gestures
// on every item: tap (onPress) and hold-then-release (onHold). Same feel as
// HoldPressable: nothing shows for the first HOLD_DELAY_MS (a tap or a scroll
// never flashes it), then the fill runs HOLD_FILL_MS. Once full the item is
// picked up — release in place for onHold, or move it: the others make way as
// it passes over them, and the new order goes to onCommit on release.
const HOLD_DELAY_MS = 150;
const HOLD_FILL_MS = 150;
const HOLD_MS = HOLD_DELAY_MS + HOLD_FILL_MS;
// Finger travel (px) below which a release counts as "didn't move".
const MOVE_TOLERANCE = 10;

type Rect = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };

export type Reorder = ReturnType<typeof useReorder>;

// `ids` in their current order; render the items in `order` (the order while
// dragging), each as a <ReorderItem>. `enabled` false (e.g. while a search
// filters the list) keeps tap and hold-release but doesn't move anything.
export function useReorder(ids: string[], onCommit: (ids: string[]) => void, enabled = true) {
  const [draft, setDraft] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const order = draft ?? ids;
  // Read by the gesture callbacks, which may hold an earlier render's
  // functions: everything they need lives here, current.
  const s = useRef({
    ids,
    order,
    enabled,
    onCommit,
    dragId: null as string | null,
    rects: new Map<string, Rect>(),
    start: { x: 0, y: 0 }, // the dragged item's spot when picked up
    grab: { x: 0, y: 0 }, // where on it the finger is
    // After a move, until the items are laid out again: their old spots
    // would make the item jump straight back.
    waitingForLayout: false,
  }).current;
  s.ids = ids;
  s.order = order;
  s.enabled = enabled;
  s.onCommit = onCommit;
  // The dragged item is drawn at (its spot when picked up + finger travel),
  // wherever the list has laid it out meanwhile: offset = start − laid-out spot.
  const offset = useSharedValue<Point>({ x: 0, y: 0 });
  const travel = useSharedValue<Point>({ x: 0, y: 0 });

  const pickUp = (id: string, grabX: number, grabY: number) => {
    const r = s.rects.get(id);
    if (!r) return;
    s.start = { x: r.x, y: r.y };
    s.grab = { x: grabX, y: grabY };
    s.dragId = id;
    offset.value = { x: 0, y: 0 };
    setDragId(id);
  };

  // The item whose center is nearest the finger takes the dragged one's place.
  const follow = (dx: number, dy: number) => {
    const id = s.dragId;
    if (!id || !s.enabled || s.waitingForLayout) return;
    const fx = s.start.x + s.grab.x + dx;
    const fy = s.start.y + s.grab.y + dy;
    let nearest = id;
    let best = Infinity;
    for (const other of s.order) {
      const r = s.rects.get(other);
      if (!r) continue;
      const d = Math.hypot(r.x + r.width / 2 - fx, r.y + r.height / 2 - fy);
      if (d < best) {
        best = d;
        nearest = other;
      }
    }
    if (nearest === id) return;
    s.order = moveTo(s.order, id, nearest);
    s.waitingForLayout = true;
    setDraft(s.order);
  };

  const drop = (commit: boolean) => {
    if (commit && s.dragId && s.order.join() !== s.ids.join()) s.onCommit(s.order);
    s.dragId = null;
    s.waitingForLayout = false;
    setDraft(null);
    setDragId(null);
  };

  const onItemLayout = (id: string, e: LayoutChangeEvent) => {
    const r = e.nativeEvent.layout;
    s.rects.set(id, r);
    if (id === s.dragId) {
      offset.value = { x: s.start.x - r.x, y: s.start.y - r.y };
      s.waitingForLayout = false;
    }
  };

  // rects: each item's measured spot in the container, by id.
  return { order, dragId, offset, travel, rects: s.rects, pickUp, follow, drop, onItemLayout };
}

export function ReorderItem({
  id,
  reorder,
  onPress,
  onHold,
  style,
  fillColor,
  children,
}: {
  id: string;
  reorder: Reorder;
  onPress?: () => void;
  onHold?: () => void;
  style?: StyleProp<ViewStyle>;
  fillColor?: string;
  // Plain content gets a hold-fill over the whole item; a function places
  // the fill itself (e.g. only inside an icon square), given its style.
  children: ReactNode | ((fillStyle: ReturnType<typeof useAnimatedStyle>) => ReactNode);
}) {
  const fill = useSharedValue(0);
  const held = useRef(false);
  const node = useRef<View>(null);
  const { offset, travel } = reorder;
  const isDragged = reorder.dragId === id;

  const begin = () => {
    held.current = false;
  };
  const pickUp = (x: number, y: number) => {
    held.current = true;
    reorder.pickUp(id, x, y);
  };
  const finish = (ended: boolean, moved: boolean) => {
    if (!held.current) return; // a tap, or a scroll: never picked up
    if (ended && !moved) onHold?.();
    reorder.drop(ended);
  };
  // A hold that picked the item up isn't also a tap.
  const press = () => {
    if (!held.current) onPress?.();
  };

  // Only activates once the hold completes: moving earlier fails it, which
  // leaves the touch to the scroll view (so swiping still scrolls).
  const gesture = Gesture.Pan()
    .activateAfterLongPress(HOLD_MS)
    .onBegin(() => {
      runOnJS(begin)();
      fill.value = withDelay(HOLD_DELAY_MS, withTiming(1, { duration: HOLD_FILL_MS }));
    })
    .onStart((e) => {
      travel.value = { x: 0, y: 0 };
      runOnJS(pickUp)(e.x, e.y);
    })
    .onUpdate((e) => {
      travel.value = { x: e.translationX, y: e.translationY };
      runOnJS(reorder.follow)(e.translationX, e.translationY);
    })
    .onFinalize((e, success) => {
      fill.value = withTiming(0, { duration: 150 });
      runOnJS(finish)(success, Math.hypot(e.translationX, e.translationY) > MOVE_TOLERANCE);
    });

  const dragStyle = useAnimatedStyle(
    () =>
      isDragged
        ? {
            zIndex: 10,
            transform: [
              { translateX: offset.value.x + travel.value.x },
              { translateY: offset.value.y + travel.value.y },
              { scale: 1.05 },
            ],
          }
        : { zIndex: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] },
    [isDragged],
  );
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  // Web on a phone: once the hold completes, the browser mustn't turn the
  // drag into a scroll (it would cancel the gesture). It hasn't started
  // scrolling yet at that point, so it still honours being told not to.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const el = node.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    let downAt = 0;
    let x0 = 0;
    let y0 = 0;
    let still = false;
    const start = (e: TouchEvent) => {
      downAt = Date.now();
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      still = e.touches.length === 1;
    };
    const move = (e: TouchEvent) => {
      if (!still) return;
      const t = e.touches[0];
      if (Date.now() - downAt < HOLD_MS) {
        // Moved before the hold completed: a scroll — let it be one.
        if (Math.hypot(t.clientX - x0, t.clientY - y0) > MOVE_TOLERANCE) still = false;
        return;
      }
      if (e.cancelable) e.preventDefault();
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
    };
  }, []);

  return (
    // Web: keep the browser's own scrolling (the gesture library blocks all
    // touch scrolling by default there); the listener above stops it once
    // an item is picked up.
    <GestureDetector
      gesture={gesture}
      touchAction={"pan-x pan-y" as ComponentProps<typeof GestureDetector>["touchAction"]}
    >
      <Animated.View style={dragStyle} onLayout={(e) => reorder.onItemLayout(id, e)}>
        <View ref={node} style={styles.grow}>
          <Pressable onPress={press} style={[styles.item, style]}>
            {typeof children === "function" ? (
              children(fillStyle)
            ) : (
              <>
                <Animated.View
                  pointerEvents="none"
                  style={[styles.fill, { backgroundColor: fillColor }, fillStyle]}
                />
                {children}
              </>
            )}
          </Pressable>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  grow: { flexGrow: 1 },
  item: { flexGrow: 1, overflow: "hidden" },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0 },
});
