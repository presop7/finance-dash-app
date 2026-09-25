import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, G, Path, Text as SvgText, Line } from "react-native-svg";
import Animated, {
  SharedValue,
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
  cancelAnimation,
} from "react-native-reanimated";
import { ColorsType } from "../constants/colors";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";
import { CategorySlice } from "../hooks/useCategoryBreakdown";
import HoldPressable from "./HoldPressable";
import CategoryDetailFields from "./CategoryDetailFields";
import { perfTag } from "../utils/perfWatchdog";
import { pushLog } from "../utils/perfLogSink";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Donut, not a full pie — the hole is what gives the tap callout (and the
// default running total) somewhere to sit without ever covering a wedge.
const OUTER_R = 54;
const INNER_R = 30;
// How far the armed (tap-selected) wedge's own outer edge grows.
const ENLARGE_R = OUTER_R * 1.2;
// How far a wedge grows while being held — bigger than ENLARGE_R so the
// hold's own growth stays visible even on a wedge that's already armed
// (holding one already-selected wedge shouldn't look like nothing's
// happening just because it was already at ENLARGE_R).
const HOLD_ENLARGE_R = OUTER_R * 1.45;
// A wedge also widens sideways (its start/end angle spread apart, evenly
// around its own middle) as it grows — growing radius alone is hard to
// notice on a thin sliver, since almost the entire wedge already sits
// inside OUTER_R either way. Degrees each edge moves at full growth (so the
// total span grows by double this). Hold widens further than a plain
// select, same reasoning as HOLD_ENLARGE_R above.
const SELECT_EXTRA_ANGLE = 4;
const HOLD_EXTRA_ANGLE = 11;
// The *whole ring's* hole grows together with an armed wedge (every wedge
// shares one inner radius) — needed so the callout has room to show a full
// name/amount/percent without truncating. Stays under OUTER_R so the
// unselected wedges still show a sliver of ring rather than vanishing.
const INNER_R_EXPANDED = 46;
// Slices below this share of the total don't get their own label around the
// ring — still fully visible as a wedge, just named only on tap (via the
// center callout) rather than crowding the ring with a name for every
// sliver.
const LABEL_PCT_THRESHOLD = 3;
// Wedges reveal a chunk of this many at a time (see the staggered-mount
// effect in the main component below) rather than all at once — creating
// every wedge's native SVG view in one synchronous commit is what made even
// a single Expense<->Income switch (which shares no categories, so every
// wedge is new) freeze; spreading that same total work over several frames
// trades one big freeze for several much smaller, not really noticeable ones.
const CHUNK_SIZE = 6;
// How long holding a wedge takes to trigger the "filter to this category"
// action (see onHoldCategory) — also the duration of the grow animation
// that gives that hold visible feedback, so the two finish together.
const HOLD_MS = 450;
// Two label columns flanking the ring, wide enough for a short category
// name + its amount on two lines each.
const LABEL_COL = 112;
const ROW_H = 24;
const V_PAD = 14;

// Both "worklet"-tagged so they can run on the UI thread: they're called
// from inside useAnimatedProps below, and Reanimated's Babel plugin only
// auto-workletizes the function passed straight to the hook — any helper
// that one calls needs the directive itself, or the UI thread ends up
// trying to remote-call back into JS for it and throws.
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  "worklet";
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// A plain pie slice, center -> outer arc -> back to center. The donut hole
// is no longer cut into each wedge individually — it used to be (an arc at
// a shared inner radius, same idea as the outer one), but that meant EVERY
// wedge's whole path had to be rebuilt on EVERY frame of the hole-grow
// animation, since they all read that one shared radius — ~20-30 arc-path
// rebuilds a frame just to animate one wedge, which is what made the
// enlarge animation jagged. A single circle (see the AnimatedCircle mask in
// the main component) now sits on top of the wedges and covers the center
// instead — cheap to animate (one numeric radius, no path string), and it
// decouples "the hole is growing" from "every wedge needs a new path".
function wedgePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  "worklet";
  // A slice spanning a full 360° has identical start/end points on its own
  // — and per the SVG spec, an arc command whose endpoints coincide is
  // treated as if it were omitted entirely, so a lone (100%) category
  // rendered a perfectly invisible "circle". Clipping just short of a full
  // turn keeps the endpoints distinct (an imperceptible sliver) instead.
  const clampedEnd = endAngle - startAngle >= 359.99 ? startAngle + 359.99 : endAngle;
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, clampedEnd);
  const largeArc = clampedEnd - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

type Wedge = CategorySlice & {
  startAngle: number;
  endAngle: number;
  midAngle: number;
  // Which reveal batch this wedge belongs to — see CHUNK_SIZE.
  chunkIndex: number;
};

function layoutWedges(slices: CategorySlice[]): Wedge[] {
  let angle = 0;
  return slices.map((s, i) => {
    const span = (s.pct / 100) * 360;
    const startAngle = angle;
    const endAngle = angle + span;
    angle = endAngle;
    return {
      ...s,
      startAngle,
      endAngle,
      midAngle: (startAngle + endAngle) / 2,
      chunkIndex: Math.floor(i / CHUNK_SIZE),
    };
  });
}

type LabelEntry = {
  wedge: Wedge;
  side: "left" | "right";
  edge: { x: number; y: number };
  textX: number;
  labelY: number;
};

// One leader length: how far out from the ring a label sits, along its own
// wedge's angle.
const LABEL_R = OUTER_R + 30;

// Places each labeled slice's name+amount out along its own wedge's actual
// angle (both x and y from that angle, not a fixed left/right column) —
// nudged apart vertically only when two would otherwise land close enough
// to overlap. Keeping each label near where its wedge actually points,
// rather than routing every line through a shared bend point toward a
// common column, is what keeps the leader lines from fanning out and
// crossing each other once there's more than a couple of them. `cx` here is
// relative (the ring's own center at 0), so the caller can measure the
// extent this produces before picking a final canvas height/center.
function layoutLabels(wedges: Wedge[]): LabelEntry[] {
  const bySide: Record<"left" | "right", { wedge: Wedge; x: number; y: number }[]> = { left: [], right: [] };
  for (const w of wedges) {
    const rad = ((w.midAngle - 90) * Math.PI) / 180;
    const side: "left" | "right" = Math.cos(rad) >= 0 ? "right" : "left";
    bySide[side].push({ wedge: w, x: LABEL_R * Math.cos(rad), y: LABEL_R * Math.sin(rad) });
  }

  const entries: LabelEntry[] = [];
  (["left", "right"] as const).forEach((side) => {
    const list = bySide[side].sort((a, b) => a.y - b.y);
    for (let i = 1; i < list.length; i++) {
      if (list[i].y - list[i - 1].y < ROW_H) list[i].y = list[i - 1].y + ROW_H;
    }
    for (const { wedge, x, y } of list) {
      const edge = polarToCartesian(0, 0, OUTER_R, wedge.midAngle);
      entries.push({ wedge, side, edge, textX: x, labelY: y });
    }
  });
  return entries;
}

function truncate(label: string, max: number): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

// Stands in for a not-yet-revealed chunk of wedges — one flat, static,
// non-interactive Path spanning that whole chunk's combined angle instead
// of each wedge's own real (colorful, tappable) one, so the ring is never
// visibly incomplete while chunks are still streaming in.
function ChunkPlaceholder({ chunk, color }: { chunk: Wedge[]; color: string }) {
  const d = useMemo(
    () => wedgePath(0, 0, OUTER_R, chunk[0].startAngle, chunk[chunk.length - 1].endAngle),
    [chunk],
  );
  return <Path d={d} fill={color} />;
}

function PieWedge({
  wedge,
  isSelected,
  scale,
  holdKey,
  holdProgress,
  onPress,
  onHold,
  onHoldStart,
  onHoldEnd,
}: {
  wedge: Wedge;
  isSelected: boolean;
  scale: SharedValue<number>;
  holdKey: SharedValue<string>;
  holdProgress: SharedValue<number>;
  onPress: (wedge: Wedge) => void;
  onHold?: (wedge: Wedge) => void;
  // Plain (React-state-driving) JS callbacks, separate from the
  // holdKey/holdProgress shared values above — those drive the UI-thread
  // grow animation, these bring the growing wedge to the front of paint
  // order (see paintOrder below) so widening sideways doesn't disappear
  // under a neighboring wedge that's still drawn on top of it.
  onHoldStart?: (wedge: Wedge) => void;
  onHoldEnd?: () => void;
}) {
  // The vast majority of frames during any given wedge's animation, every
  // OTHER wedge is sitting still — this is what it's still sitting at, computed
  // once (on the JS thread) whenever the wedge's own angles actually change,
  // rather than every animation frame.
  const restPath = useMemo(
    () => wedgePath(0, 0, OUTER_R, wedge.startAngle, wedge.endAngle),
    [wedge.startAngle, wedge.endAngle],
  );

  const animatedProps = useAnimatedProps(() => {
    // Whichever of "armed" (tap-select) and "mid-hold" is currently making
    // this wedge bigger wins outright — radius *and* angle both come from
    // that same one, rather than mixing e.g. hold's radius with select's
    // angle, which could land on a combination neither animation actually
    // passes through.
    const selectProgress = isSelected ? scale.value : 0;
    const holdProgressVal = holdKey.value === wedge.key ? holdProgress.value : 0;
    // Skip the trig/path-string work entirely when this wedge isn't the one
    // growing (see restPath above) — cheap for the ~20-30 wedges that
    // aren't, every single frame of whichever one is.
    if (selectProgress === 0 && holdProgressVal === 0) {
      return { d: restPath };
    }
    const selectR = OUTER_R + (ENLARGE_R - OUTER_R) * selectProgress;
    const holdR = OUTER_R + (HOLD_ENLARGE_R - OUTER_R) * holdProgressVal;
    const useHold = holdR > selectR;
    const r = useHold ? holdR : selectR;
    const extraAngle = useHold
      ? HOLD_EXTRA_ANGLE * holdProgressVal
      : SELECT_EXTRA_ANGLE * selectProgress;
    return { d: wedgePath(0, 0, r, wedge.startAngle - extraAngle, wedge.endAngle + extraAngle) };
  }, [isSelected, wedge.startAngle, wedge.endAngle, restPath]);

  const handlePressIn = useCallback(() => {
    if (!onHold) return;
    perfTag(`wedge-hold-start:${wedge.key}`);
    holdKey.value = wedge.key;
    holdProgress.value = withTiming(1, { duration: HOLD_MS, easing: Easing.out(Easing.cubic) });
    onHoldStart?.(wedge);
  }, [onHold, holdKey, holdProgress, wedge, onHoldStart]);

  const handlePressOut = useCallback(() => {
    // Only this wedge's own hold (not e.g. a different wedge's) resets —
    // otherwise releasing wedge B right after tapping into wedge A would
    // wipe out an unrelated, already-settled state.
    if (holdKey.value !== wedge.key) return;
    holdProgress.value = withTiming(0, { duration: 150 });
    onHoldEnd?.();
  }, [holdKey, holdProgress, wedge.key, onHoldEnd]);

  return (
    <AnimatedPath
      animatedProps={animatedProps}
      fill={wedge.color}
      onPress={() => onPress(wedge)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      // Matches the growth animation's own duration, so the wedge finishes
      // growing right as the hold actually fires — a mismatch either way
      // would read as the action firing early or the growth stalling.
      delayLongPress={HOLD_MS}
      // Same semantics as RN's own Touchables: once this fires, the
      // matching onPress on release is suppressed automatically — no need
      // to hand-roll a "was this a hold" flag.
      onLongPress={
        onHold
          ? () => {
              perfTag(`wedge-hold-fired:${wedge.key}`);
              onHold(wedge);
            }
          : undefined
      }
    />
  );
}

export default function CategoryPieChart({
  slices,
  total,
  currencyCode,
  emptyLabel,
  onHoldCategory,
}: {
  slices: CategorySlice[];
  total: number;
  currencyCode: string;
  // Holding a wedge (rather than a short tap, which arms/enlarges it) asks
  // the caller to filter the transaction list down to just this category —
  // the slice's own key (e.g. "expense:<id>"), same format the breakdown
  // hook builds it from, so the caller can split out the type and id.
  onHoldCategory?: (key: string) => void;
  emptyLabel: string;
}) {
  const Colors = useThemeColors();
  const styles = getThemedStyles(createStyles, Colors);

  // TEMPORARY diagnostic (see utils/perfWatchdog.ts) — this component fully
  // remounts whenever the category set changes (see the `key` its caller
  // passes), so its mount cost *is* the cost of that remount. Logged
  // straight (not gated behind the probe's begin()) since a remount can
  // happen outside any explicit probe window too.
  const mountStartRef = useRef(performance.now());
  useEffect(() => {
    const ms = Math.round(performance.now() - mountStartRef.current);
    const msg = `[perf] CategoryPieChart mount: ${slices.length} slices, ${ms}ms`;
    perfTag(`pie-mounted(${slices.length} slices, ${ms}ms)`);
    console.log(msg);
    pushLog(msg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [displaySlice, setDisplaySlice] = useState<Wedge | null>(null);
  const scale = useSharedValue(0);
  const midAngleShared = useSharedValue(0);
  // Which wedge (by key) is currently mid-hold, and how far along its grow
  // feedback is — see PieWedge's handlePressIn/handlePressOut.
  const holdKey = useSharedValue("");
  const holdProgress = useSharedValue(0);
  // React-state twin of holdKey, used only to reorder paintOrder below (see
  // PieWedge's onHoldStart/onHoldEnd) — the shared value alone can't do
  // that, since changing it doesn't re-run this component's JS-thread render.
  const [heldKey, setHeldKey] = useState<string | null>(null);

  // Closing a wedge normally animates scale back to 0 (see dismiss/select
  // below) — but when the underlying breakdown itself changes (the user
  // switches the Expense/Income/All tab or a filter while a wedge is
  // armed), there's no such call in between, so scale/selectedKey were
  // being left however they were: still armed, pointing at an angle that
  // may no longer belong to the same category at all. That's what left a
  // stray connector line stuck on screen after switching.
  //
  // cancelAnimation matters here, not just the plain `.value = 0` reset:
  // this component used to force a full unmount/remount on every category-
  // set change specifically to dodge a native crash (IllegalStateException:
  // addViewAt — a Fabric child-index mismatch) from a wedge's enlarge/
  // collapse animation still having an in-flight animated-prop commit on
  // the UI thread the same frame the JS side changed how many SVG children
  // there are. That worked, but at real cost: measured at up to ~450ms per
  // toggle tap, almost entirely the native cost of tearing down and
  // rebuilding every wedge — even for e.g. Expense -> All, which actually
  // shares most of its categories and could've kept most wedges mounted.
  // cancelAnimation stops the *actual* race instead of avoiding it by
  // rebuilding everything: no animation can still be mid-flight when
  // children change if it's forcibly stopped, synchronously, before they
  // do. React's own by-key reconciliation (wedge.key) then only touches the
  // categories that actually changed.
  useEffect(() => {
    cancelAnimation(scale);
    cancelAnimation(holdProgress);
    setSelectedKey(null);
    setDisplaySlice(null);
    setHeldKey(null);
    scale.value = 0;
    holdProgress.value = 0;
    holdKey.value = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slices]);

  // Everything here depends only on `slices` — kept in its own memo,
  // separate from paintOrder below (which reorders for the currently
  // armed/held wedge), so tapping/holding a wedge doesn't recompute the
  // whole layout, just the ordering.
  const { wedges, chunks, labels, cx, cy, width, height } = useMemo(() => {
    const wedges = layoutWedges(slices);
    const width = LABEL_COL * 2 + OUTER_R * 2 + 8;
    const cx = LABEL_COL + OUTER_R + 4;

    // Labeled slices only (see LABEL_PCT_THRESHOLD) — laid out relative to
    // a ring centered at (0, 0) first, so the extent they actually need can
    // be measured before picking a final canvas height/center.
    const labeledWedges = wedges.filter((w) => w.pct >= LABEL_PCT_THRESHOLD);
    const relLabels = layoutLabels(labeledWedges);
    const labelYs = relLabels.map((e) => e.labelY);
    const minY = Math.min(-OUTER_R, ...labelYs);
    const maxY = Math.max(OUTER_R, ...labelYs) + 10; // +10: room for the amount line below the label
    const height = maxY - minY + V_PAD * 2;
    const cy = V_PAD - minY;

    const labels = relLabels.map((e) => ({
      ...e,
      edge: { x: e.edge.x + cx, y: e.edge.y + cy },
      textX: e.textX + cx,
      labelY: e.labelY + cy,
    }));
    const chunks: Wedge[][] = [];
    for (let i = 0; i < wedges.length; i += CHUNK_SIZE) chunks.push(wedges.slice(i, i + CHUNK_SIZE));
    return { wedges, chunks, labels, cx, cy, width, height };
  }, [slices]);

  // How many chunks (see CHUNK_SIZE) are actually rendered as real wedges so
  // far — starts at 1 (the first chunk shows immediately, no reason to
  // delay it) and climbs a chunk per frame until the whole ring is real.
  // Chunks not yet reached render as a single flat ChunkPlaceholder instead
  // (see the JSX below), so the ring is always visually complete even
  // mid-reveal, just not yet colorful/interactive in the later chunks.
  const [revealedChunks, setRevealedChunks] = useState(1);
  useEffect(() => {
    setRevealedChunks(1);
    if (chunks.length <= 1) return;
    let cancelled = false;
    let count = 1;
    const step = () => {
      if (cancelled) return;
      count += 1;
      setRevealedChunks(count);
      if (count < chunks.length) requestAnimationFrame(step);
    };
    const id = requestAnimationFrame(step);
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [chunks]);

  const paintOrder = useMemo(() => {
    // Whichever wedge is growing (armed or mid-hold) paints last/on top, so
    // widening sideways (see PieWedge) doesn't get drawn underneath a
    // neighboring wedge that's still at its normal size.
    const front = (key: string) => (key === selectedKey ? 1 : 0) + (key === heldKey ? 1 : 0);
    return [...wedges].sort((a, b) => front(a.key) - front(b.key));
  }, [wedges, selectedKey, heldKey]);

  const select = useCallback(
    (wedge: Wedge) => {
      if (selectedKey === wedge.key) {
        scale.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }, (finished) => {
          if (finished) runOnJS(setDisplaySlice)(null);
        });
        setSelectedKey(null);
        return;
      }
      midAngleShared.value = wedge.midAngle;
      setSelectedKey(wedge.key);
      setDisplaySlice(wedge);
      scale.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
    },
    [selectedKey, scale, midAngleShared],
  );

  const dismiss = useCallback(() => {
    if (!selectedKey) return;
    scale.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(setDisplaySlice)(null);
    });
    setSelectedKey(null);
  }, [selectedKey, scale]);

  // Hole grows from INNER_R to INNER_R_EXPANDED together with the armed
  // wedge, so the callout has room to show its full name/amount/percent
  // instead of truncating — sized and repositioned every frame so it always
  // stays centered on the ring.
  const holeStyle = useAnimatedStyle(() => {
    const r = INNER_R + (INNER_R_EXPANDED - INNER_R) * scale.value;
    return { width: r * 2, height: r * 2, borderRadius: r, left: cx - r, top: cy - r };
  });
  const totalStyle = useAnimatedStyle(() => ({ opacity: 1 - scale.value }));
  const calloutStyle = useAnimatedStyle(() => ({ opacity: scale.value }));

  // The donut hole itself — one circle, filled to match the surrounding
  // background, drawn on top of the wedges (see wedgePath above for why
  // this replaced cutting an inner arc into every wedge individually). A
  // Circle's `r` is a plain numeric prop, so this is cheap to animate every
  // frame regardless of how many wedges there are.
  const maskProps = useAnimatedProps(() => ({
    r: INNER_R + (INNER_R_EXPANDED - INNER_R) * scale.value,
  }));

  // Connector from the hole's edge out to the armed wedge's own (growing)
  // outer edge, at the wedge's angle — it lengthens together with the
  // wedge's enlarge animation since both read the same `scale`.
  const lineProps = useAnimatedProps(() => {
    const outerR = OUTER_R + (ENLARGE_R - OUTER_R) * scale.value;
    const innerR = INNER_R + (INNER_R_EXPANDED - INNER_R) * scale.value;
    const inner = polarToCartesian(cx, cy, innerR + 2, midAngleShared.value);
    const outer = polarToCartesian(cx, cy, outerR, midAngleShared.value);
    return { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, opacity: scale.value * 0.9 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cx, cy]);

  if (slices.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="pie-chart-outline" size={28} color={Colors.textMuted} />
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <Pressable onPress={dismiss} style={{ width, height, alignSelf: "center" }}>
      <Svg width={width} height={height}>
        <G transform={`translate(${cx}, ${cy})`}>
          {chunks.map((chunk, i) =>
            i < revealedChunks ? null : (
              <ChunkPlaceholder key={`chunk-${i}`} chunk={chunk} color={Colors.border} />
            ),
          )}
          {paintOrder
            .filter((w) => w.chunkIndex < revealedChunks)
            .map((w) => (
              <PieWedge
                key={w.key}
                wedge={w}
                isSelected={w.key === selectedKey}
                scale={scale}
                holdKey={holdKey}
                holdProgress={holdProgress}
                onPress={select}
                onHold={onHoldCategory ? (wedge) => onHoldCategory(wedge.key) : undefined}
                onHoldStart={onHoldCategory ? (wedge) => setHeldKey(wedge.key) : undefined}
                onHoldEnd={onHoldCategory ? () => setHeldKey(null) : undefined}
              />
            ))}
          <AnimatedCircle cx={0} cy={0} animatedProps={maskProps} fill={Colors.surface} />
        </G>

        {labels
          .filter((e) => e.wedge.chunkIndex < revealedChunks)
          .map((e) => (
          <Path
            key={`line-${e.wedge.key}`}
            d={`M ${e.edge.x} ${e.edge.y} L ${e.side === "right" ? e.textX - 4 : e.textX + 4} ${e.labelY}`}
            stroke={e.wedge.color}
            strokeWidth={1}
            fill="none"
            opacity={0.8}
          />
        ))}
        {labels
          .filter((e) => e.wedge.chunkIndex < revealedChunks)
          .map((e) => (
          <Fragment key={`text-${e.wedge.key}`}>
            <SvgText
              x={e.textX}
              y={e.labelY - 3}
              fontSize={10}
              fontWeight="600"
              fill={Colors.textPrimary}
              textAnchor={e.side === "right" ? "start" : "end"}
            >
              {truncate(e.wedge.label, 14)}
            </SvgText>
            <SvgText
              x={e.textX}
              y={e.labelY + 9}
              fontSize={9}
              fill={Colors.textMuted}
              textAnchor={e.side === "right" ? "start" : "end"}
            >
              {e.wedge.amount.toFixed(0)} {currencyCode}
            </SvgText>
          </Fragment>
        ))}

        <AnimatedLine animatedProps={lineProps} stroke={Colors.textPrimary} strokeWidth={1.5} />
      </Svg>

      {/* Both crossfade in place over the donut hole (which grows to fit
          whichever one is currently showing — see holeStyle), driven by the
          same `scale` — the running total by default, the tapped slice's
          detail once one's armed. */}
      <Animated.View style={[styles.hole, holeStyle, totalStyle]} pointerEvents="none">
        <Text style={styles.holeLabel}>Total</Text>
        <Text style={styles.holeAmount} numberOfLines={1} adjustsFontSizeToFit>
          {total.toFixed(0)} {currencyCode}
        </Text>
      </Animated.View>

      {displaySlice && (
        <Animated.View
          style={[styles.hole, holeStyle, calloutStyle]}
          // Only interactive at all once there's actually a hold action to
          // offer — otherwise (no onHoldCategory) this stays pointerEvents
          // "none" like before, so a tap on the center still falls through
          // to the outer Pressable's dismiss.
          pointerEvents={onHoldCategory ? "auto" : "none"}
        >
          {onHoldCategory ? (
            // Same hold gesture as a wedge itself (see PieWedge) — holding
            // the callout that's already showing this category is the
            // "filter to it" shortcut without needing to find/re-hold the
            // (possibly tiny) wedge again.
            <HoldPressable
              style={styles.calloutTouchable}
              onPress={dismiss}
              onHoldComplete={() => onHoldCategory(displaySlice.key)}
              fillColor={Colors.primary + "22"}
            >
              <CategoryDetailFields
                label={displaySlice.label}
                amount={displaySlice.amount}
                currencyCode={currencyCode}
                pct={displaySlice.pct}
                count={displaySlice.count}
              />
            </HoldPressable>
          ) : (
            <CategoryDetailFields
              label={displaySlice.label}
              amount={displaySlice.amount}
              currencyCode={currencyCode}
              pct={displaySlice.pct}
              count={displaySlice.count}
            />
          )}
        </Animated.View>
      )}
    </Pressable>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    // Size/position (width, height, borderRadius, left, top) come from the
    // animated holeStyle instead — it grows with the same focus animation
    // as the ring itself, so they can't be fixed here.
    hole: {
      position: "absolute",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    // Fills the (already circular, via holeStyle) hole — HoldPressable's
    // own sweep fill clips to this, so a static border radius here is fine
    // even though the hole's true size is animated: displaySlice only
    // exists once that animation has settled at full size anyway.
    calloutTouchable: {
      width: "100%",
      height: "100%",
      borderRadius: INNER_R_EXPANDED,
      alignItems: "center",
      justifyContent: "center",
    },
    holeLabel: { width: "100%", fontSize: 9, fontWeight: "600", color: Colors.textMuted, textTransform: "uppercase", textAlign: "center" },
    holeAmount: { width: "100%", fontSize: 11, fontWeight: "700", color: Colors.textPrimary, marginTop: 2, textAlign: "center" },
    emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 8 },
    emptyText: { fontSize: 13, color: Colors.textMuted },
  });
}
