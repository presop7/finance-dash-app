import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, TouchableOpacity } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing } from "react-native-reanimated";
// gesture-handler's ScrollView, not react-native's — this list is nested
// inside the Analytics screen's own (vertical) FlatList, and a plain nested
// ScrollView loses the scroll gesture to whichever one claims it first, the
// same problem (just vertical this time) an earlier pass into this chart
// ran into with horizontal scrolling; gesture-handler's version properly
// hands the gesture back to the outer FlatList once this list hits its own
// top/bottom edge.
import { ScrollView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { ColorsType } from "../constants/colors";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";
import { CategorySlice } from "../hooks/useCategoryBreakdown";
import CategoryDetailFields from "./CategoryDetailFields";

// One row's total height (header line + gap, bar, gap to next row) — used
// to size the fixed visible window below (VISIBLE_ROWS) so the card never
// grows past a known, fixed size no matter how many categories there are,
// keeping it in the same size ballpark as the totals/pie pages instead of
// towering over them. Categories beyond the first VISIBLE_ROWS scroll into
// view inside that fixed window rather than growing the page.
const BAR_H = 14;
const ROW_GAP = 18;
const HEADER_H = 24;
const ROW_H = HEADER_H + BAR_H + ROW_GAP;
const VISIBLE_ROWS = 4;
// Same two-phase feel as the pie's own hold (see HOLD_MS there): a short
// delay before anything happens (so a normal tap never flashes it), then
// the fill/grow itself, on its own clock.
const HOLD_DELAY_MS = 150;
const HOLD_FILL_MS = 300;
// How much taller the bar gets at full hold — grows the bar's *height*
// only, never its width, since width is what actually encodes the amount;
// changing it would misrepresent the data.
const HOLD_GROW = 0.6;

function CategoryBarRow({
  slice,
  maxAmount,
  currencyCode,
  onPress,
  onHoldCategory,
}: {
  slice: CategorySlice;
  maxAmount: number;
  currencyCode: string;
  onPress: () => void;
  onHoldCategory?: (key: string) => void;
}) {
  const Colors = useThemeColors();
  const styles = getThemedStyles(createStyles, Colors);
  const widthPct = Math.max(2, (slice.amount / maxAmount) * 100);
  const holdProgress = useSharedValue(0);

  const handlePressIn = useCallback(() => {
    holdProgress.value = withDelay(
      HOLD_DELAY_MS,
      withTiming(1, { duration: HOLD_FILL_MS, easing: Easing.out(Easing.cubic) }),
    );
  }, [holdProgress]);

  const handlePressOut = useCallback(() => {
    holdProgress.value = withTiming(0, { duration: 150 });
  }, [holdProgress]);

  // Grows the bar's height (never its width — see HOLD_GROW above),
  // re-centering it on the track's original height so it swells evenly
  // rather than just growing downward.
  const growStyle = useAnimatedStyle(() => {
    const h = BAR_H * (1 + HOLD_GROW * holdProgress.value);
    return { height: h, top: (BAR_H - h) / 2 };
  });
  // A sweep across the *whole track* (not just this bar's own width),
  // rendered after (so: on top of) the colored fill below — a plain
  // "renders underneath the fill" overlay (what HoldPressable's own
  // built-in one does) is invisible on any bar wide enough to fully cover
  // it, worst of all the biggest (100%-width) one. Sweeping the full track
  // width regardless of the bar's own proportion also keeps the hold's
  // timing feel consistent across differently-sized bars.
  const sweepStyle = useAnimatedStyle(() => ({
    width: `${holdProgress.value * 100}%`,
  }));

  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      delayLongPress={HOLD_DELAY_MS + HOLD_FILL_MS}
      onLongPress={onHoldCategory ? () => onHoldCategory(slice.key) : undefined}
    >
      <Text style={styles.rowHeader} numberOfLines={1}>
        <Text style={styles.rowLabel}>{slice.label}</Text>
        <Text style={styles.rowAmount}>
          {" "}
          · {slice.amount.toFixed(0)} {currencyCode}
        </Text>
      </Text>
      <View style={styles.track}>
        <Animated.View
          style={[styles.fill, { width: `${widthPct}%`, backgroundColor: slice.color }, growStyle]}
        />
        <Animated.View style={[styles.holdSweep, sweepStyle]} />
      </View>
    </Pressable>
  );
}

export default function CategoryBarChart({
  slices,
  currencyCode,
  emptyLabel,
  onHoldCategory,
  onOpenCategory,
}: {
  slices: CategorySlice[];
  currencyCode: string;
  emptyLabel: string;
  // Same shape/meaning as CategoryPieChart's own prop — holding a bar filters
  // the transaction list down to just that category.
  onHoldCategory?: (key: string) => void;
  // "Open Category" button inside the tap overlay below — defaults to
  // onHoldCategory itself (same outcome, filter to this category, just
  // reached via an explicit button instead of a hold) unless the caller
  // wants it to do something else (e.g. navigate to a category manager).
  onOpenCategory?: (key: string) => void;
}) {
  const Colors = useThemeColors();
  const styles = getThemedStyles(createStyles, Colors);
  const [overlayKey, setOverlayKey] = useState<string | null>(null);

  // Closing the overlay when the underlying breakdown changes (a filter or
  // the Expense/Income/All toggle) is the bar-chart version of the same
  // rule the pie chart's own selection reset follows — the tapped category
  // may no longer even be in the new set.
  useEffect(() => setOverlayKey(null), [slices]);

  const maxAmount = useMemo(() => Math.max(1, ...slices.map((s) => s.amount)), [slices]);
  const overlaySlice = slices.find((s) => s.key === overlayKey) ?? null;
  const openCategory = onOpenCategory ?? onHoldCategory;

  if (slices.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="bar-chart-outline" size={28} color={Colors.textMuted} />
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.list}
        showsVerticalScrollIndicator={slices.length > VISIBLE_ROWS}
      >
        {slices.map((s) => (
          <CategoryBarRow
            key={s.key}
            slice={s}
            maxAmount={maxAmount}
            currencyCode={currencyCode}
            onPress={() => setOverlayKey(s.key)}
            onHoldCategory={onHoldCategory}
          />
        ))}
      </ScrollView>

      {overlaySlice && (
        // No scrim — the card stands on its own via its shadow, so it
        // doesn't dim the rest of the chart out from under it; this layer
        // exists purely so a tap anywhere outside the card dismisses it.
        <Pressable style={styles.overlayBackdrop} onPress={() => setOverlayKey(null)}>
          <Pressable style={styles.overlayCard} onPress={() => {}}>
            <TouchableOpacity style={styles.overlayClose} onPress={() => setOverlayKey(null)} hitSlop={8}>
              <Ionicons name="close" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
            <View style={[styles.overlayDot, { backgroundColor: overlaySlice.color }]} />
            <CategoryDetailFields
              label={overlaySlice.label}
              amount={overlaySlice.amount}
              currencyCode={currencyCode}
              pct={overlaySlice.pct}
              count={overlaySlice.count}
            />
            {openCategory && (
              <TouchableOpacity
                style={styles.openBtn}
                onPress={() => {
                  openCategory(overlaySlice.key);
                  setOverlayKey(null);
                }}
              >
                <Ionicons name="filter-outline" size={14} color="#fff" />
                <Text style={styles.openBtnText}>Open Category</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    root: { position: "relative", paddingHorizontal: 4 },
    // Fixed at exactly VISIBLE_ROWS worth of height — see the comment by
    // ROW_H above for why.
    list: { height: ROW_H * VISIBLE_ROWS },
    row: { marginBottom: ROW_GAP },
    rowHeader: { marginBottom: 6 },
    rowLabel: { fontSize: 13, fontWeight: "600", color: Colors.textPrimary },
    rowAmount: { fontSize: 12, color: Colors.textMuted },
    // No overflow:hidden here (unlike the track's plain-bar predecessor) —
    // the fill's own height grows past BAR_H on hold (see growStyle) and
    // needs to spill slightly above/below the track without being clipped.
    track: {
      height: BAR_H,
      borderRadius: BAR_H / 2,
      backgroundColor: Colors.surfaceSecondary,
    },
    fill: { position: "absolute", left: 0, borderRadius: BAR_H / 2 },
    // The hold-in-progress sweep — see sweepStyle for why this spans the
    // whole track rather than living inside/under the fill.
    holdSweep: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      backgroundColor: "#ffffff40",
      borderRadius: BAR_H / 2,
    },
    // No scrim — just an invisible full-size layer so a tap anywhere
    // outside the card still dismisses it; the card stands on its own
    // (see overlayCard's shadow) rather than needing a dark backdrop for
    // contrast against the bars behind it.
    overlayBackdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    overlayCard: {
      width: 190,
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderRadius: 16,
      alignItems: "center",
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      shadowColor: "#000",
      shadowOpacity: 0.35,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 12,
    },
    overlayClose: {
      position: "absolute",
      top: 8,
      right: 8,
      padding: 4,
    },
    overlayDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 6 },
    openBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 12,
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: Colors.primary,
    },
    openBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },
    emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 8 },
    emptyText: { fontSize: 13, color: Colors.textMuted },
  });
}
