import { ReactNode, useRef, useState } from "react";
import { View, ScrollView, StyleSheet, LayoutChangeEvent, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { ColorsType } from "../constants/colors";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";

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
  const styles = getThemedStyles(createStyles, Colors);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
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
  };
  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    const next = Math.max(0, Math.min(pages.length - 1, Math.round(e.nativeEvent.contentOffset.x / width)));
    setIndex(next);
    onIndexChange?.(next);
  };

  return (
    <View onLayout={onLayout}>
      <ScrollView
        horizontal
        pagingEnabled
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
        {pages.map((page, i) => (
          <View key={i} style={{ width }} onLayout={onPageLayout(i)}>
            {visited.current.has(i) ? page : null}
          </View>
        ))}
      </ScrollView>

      {pages.length > 1 && (
        <View style={styles.dots}>
          {pages.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    scrollContent: { alignItems: "flex-start" },
    dots: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 6,
      marginTop: 10,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: Colors.border,
    },
    dotActive: {
      backgroundColor: Colors.primary,
      width: 16,
    },
  });
}
