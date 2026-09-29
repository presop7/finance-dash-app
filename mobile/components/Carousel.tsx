import { ReactNode, useEffect, useRef, useState } from "react";
import {
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  LayoutChangeEvent,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ColorsType } from "../constants/colors";
import { isDesktopWeb } from "../utils/webPlatform";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";
import { useTranslation } from "react-i18next";

// Plain paged ScrollView rather than a FlatList — there are only ever a
// handful of pages (chart types), so virtualization buys nothing and a
// ScrollView keeps every page's own state (e.g. an armed pie wedge) alive
// while swiping between pages instead of unmounting it.
//
// Pages are mounted lazily and stay mounted once visited (never unmounted
// again) — a heavy page (a chart with its own SVG tree) shouldn't pay its
// mount/recompute cost on every parent re-render just because it's sitting
// off-screen one swipe away; that's what made switching Analytics' Expense/
// Income/All tab freeze once the pie chart was added, even while the user
// was looking at the plain totals page the whole time.
// Scrolling idle this long between two pages → glide to the nearest.
const SNAP_IDLE_MS = 140;

export default function Carousel({
  pages,
  onIndexChange,
}: {
  pages: ReactNode[];
  // Fires once a swipe settles on a new page — lets a caller outside the
  // carousel (e.g. a shared card title above it) reflect which page is
  // showing without having to own the paging state itself.
  onIndexChange?: (index: number) => void;
}) {
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  // Set while a dot-tap slide is under way: pages it passes over on the way
  // mustn't count as "landed on".
  const targetRef = useRef<number | null>(null);
  const visited = useRef(new Set([0]));
  const [, forceRender] = useState(0);
  // Each page's own measured height, so the ScrollView can be pinned to
  // whichever one is actually on screen (see the `style` below) instead of
  // defaulting to the tallest of all mounted pages — a plain horizontal
  // ScrollView sizes its cross-axis to fit every row sibling at once, so
  // without this, swiping back from a tall page (the bar chart, with many
  // categories) to a shorter one (the totals bars) left that shorter page
  // sitting inside a box still sized for the tall one: a lot of dead space
  // below its actual content.
  const [heights, setHeights] = useState<Record<number, number>>({});

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const onPageLayout = (i: number) => (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setHeights((prev) => (prev[i] === h ? prev : { ...prev, [i]: h }));
  };

  // Marks both neighbors of wherever the drag currently is, as soon as it
  // moves at all — so the next page is already mounted by the time a swipe
  // lands on it instead of popping in blank for a frame.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    const raw = e.nativeEvent.contentOffset.x / width;
    const a = Math.max(0, Math.min(pages.length - 1, Math.floor(raw)));
    const b = Math.max(0, Math.min(pages.length - 1, Math.ceil(raw)));
    let changed = false;
    if (!visited.current.has(a)) {
      visited.current.add(a);
      changed = true;
    }
    if (!visited.current.has(b)) {
      visited.current.add(b);
      changed = true;
    }
    if (changed) forceRender((n) => n + 1);

    // Landed (near enough) on a page → that's the current page. Needed on
    // the web, where scrolling with a mouse wheel / Shift+wheel / trackpad
    // never fires onMomentumScrollEnd, so the dots and title stayed put.
    const nearest = Math.round(raw);
    if (Math.abs(raw - nearest) < 0.02) {
      settleOn(nearest);
      return;
    }

    // Came to rest between two pages (a chart grabbed the finger mid-swipe,
    // a trackpad stopped short): once scrolling has been still for a
    // moment, glide to the nearest page — never left half-way.
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    snapTimerRef.current = setTimeout(() => {
      snapTimerRef.current = null;
      if (targetRef.current !== null) return; // a dot-tap slide is under way
      scrollRef.current?.scrollTo({ x: nearest * width, animated: true });
    }, SNAP_IDLE_MS);
  };

  const settleOn = (i: number) => {
    const next = Math.max(0, Math.min(pages.length - 1, i));
    if (targetRef.current !== null) {
      if (next !== targetRef.current) return;
      targetRef.current = null;
    }
    if (next === indexRef.current) return;
    indexRef.current = next;
    setIndex(next);
    onIndexChange?.(next);
  };
  // Tapping a dot jumps to its page — the way to change pages on a computer,
  // where there's no swipe. Set directly rather than waiting for
  // onMomentumScrollEnd, which a programmatic scroll doesn't fire on web.
  const scrollRef = useRef<ScrollView>(null);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    },
    [],
  );
  const goTo = (i: number) => {
    if (!visited.current.has(i)) {
      visited.current.add(i);
      forceRender((n) => n + 1);
    }
    targetRef.current = i === indexRef.current ? null : i;
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
    indexRef.current = i;
    setIndex(i);
    onIndexChange?.(i);
  };

  // Keep the shown page when the carousel's width changes (window resized
  // on a computer, phone rotated) — on the web the browser's scroll-snap
  // otherwise re-picks a page on its own.
  useEffect(() => {
    if (width > 0) scrollRef.current?.scrollTo({ x: index * width, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    // A finished swipe is always where the user ended up — even if it
    // interrupted a dot-tap slide.
    targetRef.current = null;
    settleOn(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <View onLayout={onLayout}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        // One page per swipe, however hard the flick — never skips a page
        // or stops between two.
        snapToInterval={width || undefined}
        disableIntervalMomentum
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={32}
        style={heights[index] != null ? { height: heights[index] } : undefined}
        // Without this, a horizontal ScrollView's default cross-axis
        // alignment ("stretch") pulls every page up to match the
        // ScrollView's own height — the very thing `style.height` above
        // sets *from* a page's measurement, which turns into a feedback
        // loop: one page's stretched height gets reported back as its
        // "natural" one, every other page then stretches to match it too,
        // and they all converge on whichever was tallest first. This keeps
        // each page's onLayout reporting its own real content height.
        contentContainerStyle={styles.scrollContent}
      >
        {/* Pages wait for the width: at width 0 they'd all sit at the same
            spot, and on the web the browser's scroll-snap would pick one of
            them (often not the first) to stay on once they spread out —
            showing page 2 while the dots say page 1. */}
        {width > 0 &&
          pages.map((page, i) => (
            <View key={i} style={{ width }} onLayout={onPageLayout(i)}>
              {visited.current.has(i) ? page : null}
            </View>
          ))}
      </ScrollView>

      {pages.length > 1 && (
        <View style={styles.dots}>
          {/* Computers have no swipe: arrows either side of the dots. */}
          {isDesktopWeb && (
            <Pressable
              onPress={() => goTo(index - 1)}
              disabled={index === 0}
              style={[styles.arrow, index === 0 && styles.arrowDisabled]}
              accessibilityLabel={t("common.previous")}
            >
              <Ionicons name="chevron-back" size={16} color={Colors.textSecondary} />
            </Pressable>
          )}
          {pages.map((_, i) => (
            <Pressable
              key={i}
              onPress={() => goTo(i)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Page ${i + 1} of ${pages.length}`}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
          {isDesktopWeb && (
            <Pressable
              onPress={() => goTo(index + 1)}
              disabled={index === pages.length - 1}
              style={[styles.arrow, index === pages.length - 1 && styles.arrowDisabled]}
              accessibilityLabel={t("common.next")}
            >
              <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    scrollContent: { alignItems: "flex-start" },
    arrow: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Colors.surfaceSecondary,
      marginHorizontal: 6,
    },
    arrowDisabled: { opacity: 0.35 },
    dots: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 10,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: Colors.border,
    },
    dotActive: {
      backgroundColor: Colors.primary,
      width: 18,
    },
  });
}
