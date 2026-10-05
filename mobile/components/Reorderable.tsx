import { ComponentProps, ReactNode, RefObject, useEffect, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { Box, dragStep, Flow, flowLayout, Size } from "../utils/reorder";

// Hold-and-drag reordering for a row or a wrapping grid of items (the savings
// cards, the category carousels, the category manager), with the same two
// plain gestures on every item: tap (onPress) and hold-then-release (onHold).
// Same feel as HoldPressable: nothing shows for the first HOLD_DELAY_MS (a tap
// or a scroll never flashes it), then the fill runs HOLD_FILL_MS. Once full the
// item is picked up — release in place for onHold, or move it: the others
// slide out of its way, the list auto-scrolls when it's held near the edge,
// and the new order goes to onCommit on release.
//
// Nothing is reordered on screen until the release: while dragging, the
// items stay where they're laid out and are only *drawn* moved (a transform)
// to where the new order puts them. Actually reordering them mid-drag made
// React move the dragged item's own view whenever it went right/down, and a
// moved view loses the finger — the drag got cancelled and snapped back.
const HOLD_DELAY_MS = 150;
const HOLD_FILL_MS = 150;
const HOLD_MS = HOLD_DELAY_MS + HOLD_FILL_MS;
// Finger travel (px) below which a release counts as "didn't move".
const MOVE_TOLERANCE = 10;
// Auto-scroll while dragging near the scroll view's edge (like multi-select).
const EDGE_ZONE = 48; // px from the visible edge
const SCROLL_STEP = 8; // px per frame
const SLIDE_MS = 120; // the others sliding out of the way

type Point = { x: number; y: number };
type Rect = Point & Size;
type Scrollable = { scrollTo: (o: { x?: number; y?: number; animated?: boolean }) => void };

export type Reorder = ReturnType<typeof useReorder>;

// Render the items in `ids` order, each as a <ReorderItem>. `enabled` false
// (e.g. while a search filters the list) keeps tap and hold-release but
// doesn't move anything. `scroll` is the scroll view the items sit in,
// directly in its content (spread the returned `scrollProps` on it):
// horizontal = one row (a strip); vertical = a row that wraps (a grid).
export function useReorder(
  ids: string[],
  onCommit: (ids: string[]) => void,
  enabled: boolean,
  scroll: { ref: RefObject<Scrollable | null>; horizontal: boolean },
) {
  const [draft, setDraft] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  // Read by the gesture callbacks, which may hold an earlier render's
  // functions: everything they need lives here, current.
  const s = useRef({
    ids,
    enabled,
    onCommit,
    scroll,
    draft: null as string[] | null,
    dragId: null as string | null,
    rects: new Map<string, Rect>(), // as laid out (in the scroll content)
    nodes: new Map<string, HTMLElement>(), // web: each item's element
    flow: { left: 0, top: 0, gap: 0, maxRight: Infinity } as Flow,
    sizes: new Map<string, Size>(),
    grab: { x: 0, y: 0 }, // where on the dragged item the finger is
    travel: { x: 0, y: 0 }, // finger travel since pick-up
    scrollPos: 0,
    scrollAtStart: 0,
    viewport: { width: 0, height: 0 },
    content: 0,
    frame: null as number | null,
  }).current;
  s.ids = ids;
  s.enabled = enabled;
  s.onCommit = onCommit;
  s.scroll = scroll;
  const travel = useSharedValue<Point>({ x: 0, y: 0 });
  const scrolled = useSharedValue<Point>({ x: 0, y: 0 });

  const layout = (order: string[]) => flowLayout(order, s.sizes, s.flow);

  // Where each item is drawn while dragging: its spot in the new order
  // minus its spot in the current one. Both spots come from the same
  // layout math, so any small difference to the real layout cancels out.
  let shifts: Map<string, Point> | null = null;
  if (draft && dragId) {
    const before = layout(ids);
    const after = layout(draft);
    shifts = new Map();
    for (const id of ids) {
      const a = after.get(id);
      const b = before.get(id);
      if (a && b) shifts.set(id, { x: a.x - b.x, y: a.y - b.y });
    }
  }

  const scrollShift = (): Point => {
    const d = s.scrollPos - s.scrollAtStart;
    return s.scroll.horizontal ? { x: d, y: 0 } : { x: 0, y: d };
  };
  // The finger, in the content's coordinates (as the layout math has it).
  const finger = (): Point => {
    const start = layout(s.ids).get(s.dragId!) as Box;
    const sh = scrollShift();
    return { x: start.x + s.grab.x + s.travel.x + sh.x, y: start.y + s.grab.y + s.travel.y + sh.y };
  };

  const hitTest = () => {
    const id = s.dragId;
    if (!id || !s.enabled) return;
    const current = s.draft ?? s.ids;
    const next = dragStep(current, id, finger(), layout);
    if (next.join() === current.join()) return;
    s.draft = next;
    setDraft(next);
  };

  // Finger near the visible edge: a step of scrolling each frame (as far as
  // the content goes), with the dragged item riding along.
  const autoScroll = () => {
    s.frame = null;
    if (!s.dragId) return;
    if (s.enabled) {
      const horizontal = s.scroll.horizontal;
      const f = finger();
      const pos = (horizontal ? f.x : f.y) - s.scrollPos;
      const size = horizontal ? s.viewport.width : s.viewport.height;
      const dir = pos < EDGE_ZONE ? -1 : pos > size - EDGE_ZONE ? 1 : 0;
      const next = Math.max(0, Math.min(s.content - size, s.scrollPos + dir * SCROLL_STEP));
      if (dir !== 0 && next !== s.scrollPos) {
        s.scrollPos = next;
        s.scroll.ref.current?.scrollTo(horizontal ? { x: next, animated: false } : { y: next, animated: false });
        scrolled.value = scrollShift();
        hitTest();
      }
    }
    s.frame = requestAnimationFrame(autoScroll);
  };

  // Web: onLayout only reports size changes there, not an item that moved
  // (after an earlier reorder) — read the spots from the page instead.
  const measureWeb = () => {
    for (const [id, el] of s.nodes) {
      const item = el.parentElement; // the item's own (animated) wrapper
      if (item) {
        s.rects.set(id, { x: item.offsetLeft, y: item.offsetTop, width: item.offsetWidth, height: item.offsetHeight });
      }
    }
  };

  const pickUp = (id: string, grabX: number, grabY: number) => {
    if (Platform.OS === "web") measureWeb();
    const first = s.rects.get(s.ids[0]);
    const second = s.rects.get(s.ids[1]);
    if (!s.rects.get(id) || !first) return;
    s.sizes = new Map([...s.rects].map(([k, r]) => [k, { width: r.width, height: r.height }]));
    const gap = !second
      ? 0
      : second.y === first.y
        ? second.x - first.x - first.width
        : second.y - first.y - first.height;
    // A grid wraps where the scroll view's width ends, less the same padding
    // as on the left.
    const maxRight = s.scroll.horizontal ? Infinity : s.viewport.width - first.x;
    s.flow = { left: first.x, top: first.y, gap, maxRight };
    s.dragId = id;
    s.draft = null;
    s.grab = { x: grabX, y: grabY };
    s.travel = { x: 0, y: 0 };
    s.scrollAtStart = s.scrollPos;
    scrolled.value = { x: 0, y: 0 };
    setDragId(id);
    if (s.frame === null) s.frame = requestAnimationFrame(autoScroll);
  };

  const follow = (dx: number, dy: number) => {
    s.travel = { x: dx, y: dy };
    hitTest();
  };

  const drop = (commit: boolean) => {
    if (commit && s.dragId && s.draft && s.draft.join() !== s.ids.join()) s.onCommit(s.draft);
    s.dragId = null;
    s.draft = null;
    if (s.frame !== null) cancelAnimationFrame(s.frame);
    s.frame = null;
    setDraft(null);
    setDragId(null);
  };

  const onItemLayout = (id: string, e: LayoutChangeEvent) => {
    s.rects.set(id, e.nativeEvent.layout);
  };
  const registerNode = (id: string, el: HTMLElement | null) => {
    if (el) s.nodes.set(id, el);
    else s.nodes.delete(id);
  };
  // An item's current spot in the content (e.g. to scroll to it).
  const spotOf = (id: string): Rect | undefined => {
    if (Platform.OS === "web") measureWeb();
    return s.rects.get(id);
  };

  const scrollProps = {
    scrollEventThrottle: 16,
    // Ignored mid-drag: auto-scroll sets the position itself, and these
    // arrive a frame or two late.
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!s.dragId) s.scrollPos = s.scroll.horizontal ? e.nativeEvent.contentOffset.x : e.nativeEvent.contentOffset.y;
    },
    onLayout: (e: LayoutChangeEvent) => {
      s.viewport = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height };
    },
    onContentSizeChange: (w: number, h: number) => {
      s.content = s.scroll.horizontal ? w : h;
    },
  };

  return {
    order: ids,
    dragId,
    shiftOf: (id: string) => shifts?.get(id) ?? ZERO,
    travel,
    scrolled,
    scrollProps,
    spotOf,
    pickUp,
    follow,
    drop,
    onItemLayout,
    registerNode,
  };
}

const ZERO: Point = { x: 0, y: 0 };

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
  const { travel, scrolled } = reorder;
  const isDragged = reorder.dragId === id;
  const dragging = reorder.dragId !== null;
  const shift = reorder.shiftOf(id);

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

  // The dragged item follows the finger (and the auto-scroll); the others
  // slide to their spot in the new order. After the drop the new order is
  // laid out for real, so everything snaps to zero in that same render.
  const dragStyle = useAnimatedStyle(() => {
    if (isDragged) {
      return {
        zIndex: 10,
        transform: [
          { translateX: travel.value.x + scrolled.value.x },
          { translateY: travel.value.y + scrolled.value.y },
          { scale: 1.05 },
        ],
      };
    }
    const to = (v: number) => (dragging ? withTiming(v, { duration: SLIDE_MS }) : v);
    return { zIndex: 0, transform: [{ translateX: to(shift.x) }, { translateY: to(shift.y) }, { scale: 1 }] };
  }, [isDragged, dragging, shift.x, shift.y]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  // Web on a phone: once the hold completes, the browser mustn't turn the
  // drag into a scroll (it would cancel the gesture). It hasn't started
  // scrolling yet at that point, so it still honours being told not to.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const el = node.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    reorder.registerNode(id, el);
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
      reorder.registerNode(id, null);
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
