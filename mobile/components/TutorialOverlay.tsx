import { ReactNode, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ColorsType } from "../constants/colors";
import { TUTORIAL_STEPS, TutorialStep } from "../constants/tutorialSteps";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";
import { canGoBack, getTutorialTarget, useTutorialStore } from "../store/useTutorialStore";

type Rect = { x: number; y: number; width: number; height: number };

const PAD = 8; // breathing room around the lit spot
const GAP = 14; // between the lit spot and the explanation box
const MEASURE_MS = 250; // re-measure often: spots move (scrolling, sheets sliding in)
const GIVE_UP_MS = 2500; // spot never showed up: fall back to a centered box
const ESTIMATED_BOX_HEIGHT = 220; // until the box's real height is measured
const DIM = "rgba(0,0,0,0.7)";
const MOVE = { duration: 280, easing: Easing.out(Easing.cubic) };

// Draws the current tour step when it belongs to this `host`. Everything is
// dimmed and untouchable except the lit spot — and even that is locked
// unless the step is waiting for the user to tap it.
export default function TutorialOverlay({ host }: { host: TutorialStep["host"] }) {
  const step = useTutorialStore((s) => (s.active ? TUTORIAL_STEPS[s.index] : null));
  if (!step || step.host !== host) return null;
  return <StepOverlay step={step} blockGestures={host === "app"} />;
}

function StepOverlay({ step, blockGestures }: { step: TutorialStep; blockGestures: boolean }) {
  const Colors = useThemeColors();
  const styles = getThemedStyles(createStyles, Colors);
  const insets = useSafeAreaInsets();
  const index = useTutorialStore((s) => s.index);
  const replay = useTutorialStore((s) => s.replay);
  const next = useTutorialStore((s) => s.next);
  const back = useTutorialStore((s) => s.back);
  const finish = useTutorialStore((s) => s.finish);

  const { t } = useTranslation();
  const rootRef = useRef<View>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [rect, setRect] = useState<Rect | null>(null);
  const [missing, setMissing] = useState(false);

  // Find the step's spot, scroll it into view once, then keep measuring it.
  // The previous spot stays lit until the new one is found, then the light
  // glides over — no dark flash between steps.
  useEffect(() => {
    setMissing(false);
    if (!step.target) {
      setRect(null);
      return;
    }
    const ids = Array.isArray(step.target) ? step.target : [step.target];
    let cancelled = false;
    let scrolled = false;
    const startedAt = Date.now();

    const measureOne = (view: View, ox: number, oy: number) =>
      new Promise<Rect | null>((resolve) =>
        view.measureInWindow((x, y, width, height) =>
          resolve(width && height ? { x: x - ox, y: y - oy, width, height } : null),
        ),
      );

    const measure = () => {
      const found = ids.map(getTutorialTarget).filter((t) => t !== undefined);
      if (found.length === 0) {
        if (Date.now() - startedAt > GIVE_UP_MS) setMissing(true);
        return;
      }
      if (!scrolled) {
        scrolled = true;
        found[0].scroll?.(found[0].view);
      }
      rootRef.current?.measureInWindow(async (ox, oy) => {
        const rects = (await Promise.all(found.map((t) => measureOne(t.view, ox, oy)))).filter(
          (r): r is Rect => r !== null,
        );
        if (cancelled || rects.length === 0) return;
        // One lit area covering every spot of the step.
        const x = Math.min(...rects.map((r) => r.x));
        const y = Math.min(...rects.map((r) => r.y));
        const width = Math.max(...rects.map((r) => r.x + r.width)) - x;
        const height = Math.max(...rects.map((r) => r.y + r.height)) - y;
        setMissing(false);
        setRect((prev) =>
          prev &&
          Math.abs(prev.x - x) < 1 &&
          Math.abs(prev.y - y) < 1 &&
          Math.abs(prev.width - width) < 1 &&
          Math.abs(prev.height - height) < 1
            ? prev
            : { x, y, width, height },
        );
      });
    };

    measure();
    const timer = setInterval(measure, MEASURE_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [step.id]);

  // The lit spot glides from one step's spot to the next.
  const hx = useSharedValue(0);
  const hy = useSharedValue(0);
  const hw = useSharedValue(0);
  const hh = useSharedValue(0);
  const placed = useRef(false);
  useEffect(() => {
    if (!rect) return;
    const target = {
      x: rect.x - PAD,
      y: rect.y - PAD,
      w: rect.width + PAD * 2,
      h: rect.height + PAD * 2,
    };
    if (!placed.current) {
      hx.value = target.x;
      hy.value = target.y;
      hw.value = target.w;
      hh.value = target.h;
      placed.current = true;
    } else {
      hx.value = withTiming(target.x, MOVE);
      hy.value = withTiming(target.y, MOVE);
      hw.value = withTiming(target.w, MOVE);
      hh.value = withTiming(target.h, MOVE);
    }
  }, [rect]);

  // Soft pulse on the ring so the eye goes straight to it.
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.04, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1,
    );
  }, []);

  const fade = useSharedValue(0);
  useEffect(() => {
    fade.value = 0;
    fade.value = withTiming(1, { duration: 220 });
  }, [step.id]);

  const topDim = useAnimatedStyle(() => ({ top: 0, left: 0, right: 0, height: Math.max(0, hy.value) }));
  const bottomDim = useAnimatedStyle(() => ({ top: hy.value + hh.value, left: 0, right: 0, bottom: 0 }));
  const leftDim = useAnimatedStyle(() => ({
    top: hy.value,
    height: hh.value,
    left: 0,
    width: Math.max(0, hx.value),
  }));
  const rightDim = useAnimatedStyle(() => ({
    top: hy.value,
    height: hh.value,
    left: hx.value + hw.value,
    right: 0,
  }));
  const holeStyle = useAnimatedStyle(() => ({
    top: hy.value,
    left: hx.value,
    width: hw.value,
    height: hh.value,
  }));
  const ringStyle = useAnimatedStyle(() => ({
    top: hy.value,
    left: hx.value,
    width: hw.value,
    height: hh.value,
    transform: [{ scale: pulse.value }],
  }));
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const hasHole = Boolean(step.target && rect && !missing);
  const isLast = index === TUTORIAL_STEPS.length - 1;
  // A "tap the lit spot" step whose spot can't be found gets a Next button
  // instead, so the tour can never get stuck.
  const showNext = !step.waitFor || missing;

  // The explanation box must always sit fully inside the safe area — below
  // the Skip button and above the phone's own gesture bar / buttons.
  const safeTop = insets.top + 52;
  const safeBottom = size.height - insets.bottom - 16;
  const [boxHeight, setBoxHeight] = useState(0);
  const boxPosition: ViewStyle = (() => {
    const h = boxHeight || ESTIMATED_BOX_HEIGHT;
    const clampTop = (top: number) => Math.max(safeTop, Math.min(top, safeBottom - h));
    if (!hasHole || !rect) return { top: clampTop(size.height * 0.3) };
    const belowTop = rect.y + rect.height + PAD + GAP;
    const aboveTop = rect.y - PAD - GAP - h;
    const fitsBelow = belowTop + h <= safeBottom;
    const fitsAbove = aboveTop >= safeTop;
    if (fitsBelow && fitsAbove) {
      // Both fit: the side with more room.
      return { top: safeBottom - belowTop >= rect.y - safeTop ? belowTop : aboveTop };
    }
    if (fitsBelow) return { top: belowTop };
    if (fitsAbove) return { top: aboveTop };
    // A tall spot leaves no room on either side: keep the box on screen and
    // let it cover part of the spot, on the side with more space.
    return { top: clampTop(safeBottom - belowTop >= rect.y - safeTop ? belowTop : aboveTop) };
  })();

  const block = (style: object, key: string) => (
    <Blocker key={key} style={style} gestures={blockGestures} />
  );

  return (
    <View
      ref={rootRef}
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={(e) => setSize(e.nativeEvent.layout)}
    >
      <Animated.View style={[StyleSheet.absoluteFill, fadeStyle]} pointerEvents="box-none">
        {hasHole ? (
          <>
            {block([styles.dim, topDim], "top")}
            {block([styles.dim, bottomDim], "bottom")}
            {block([styles.dim, leftDim], "left")}
            {block([styles.dim, rightDim], "right")}
            {/* Explanation-only steps lock the lit spot too, unless it's
                there to be tried out. */}
            {!step.waitFor && !step.tryIt && block([styles.abs, holeStyle], "hole")}
            <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
          </>
        ) : (
          block([StyleSheet.absoluteFill, styles.dimFill], "all")
        )}

        <View
          style={[styles.box, boxPosition, { maxHeight: Math.max(160, safeBottom - safeTop) }]}
          onLayout={(e) => setBoxHeight(e.nativeEvent.layout.height)}
        >
          <Text style={styles.title}>{t(`tour.${step.id}.title`)}</Text>
          {/* Long text on a small screen (or with large system text)
              scrolls, so Next below always stays on screen. */}
          <ScrollView style={styles.textScroll} showsVerticalScrollIndicator={false} bounces={false}>
            <Text style={styles.text}>{t(`tour.${step.id}.text`)}</Text>
            {step.tryIt && hasHole && (
              <Text style={styles.tryIt}>{t("tour.tryIt")}</Text>
            )}
          </ScrollView>
          <View style={styles.footer}>
            <Text style={styles.counter}>
              {index + 1} / {TUTORIAL_STEPS.length}
            </Text>
            <View style={styles.buttons}>
            {canGoBack(index) && (
              <TouchableOpacity style={styles.backBtn} onPress={back} activeOpacity={0.7}>
                <Text style={styles.backText}>{t("common.back")}</Text>
              </TouchableOpacity>
            )}
            {showNext ? (
              <TouchableOpacity style={styles.nextBtn} onPress={next} activeOpacity={0.8}>
                <Text style={styles.nextText}>
                  {index === 0 ? t("tour.letsGo") : isLast ? t("tour.finish") : t("common.next")}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.hint}>{t("tour.tapSpot")}</Text>
            )}
            </View>
          </View>
        </View>

        {(step.skippable || replay) && !isLast && (
          <TouchableOpacity
            style={[styles.skip, { top: insets.top + 10 }]}
            onPress={finish}
            activeOpacity={0.7}
            hitSlop={8}
          >
            <Text style={styles.skipText}>{t("tour.skip")}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

// An untouchable patch of the dimmed screen. It claims plain touches, and on
// the main app also claims gesture-handler gestures (swipes, drags) so
// nothing underneath can start either.
function Blocker({ style, gestures }: { style: object; gestures: boolean }): ReactNode {
  const view = <Animated.View style={style} onStartShouldSetResponder={() => true} />;
  if (!gestures) return view;
  return <GestureDetector gesture={Gesture.Tap()}>{view}</GestureDetector>;
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    abs: { position: "absolute" },
    dim: { position: "absolute", backgroundColor: DIM },
    dimFill: { backgroundColor: DIM },
    ring: {
      position: "absolute",
      borderRadius: 14,
      borderWidth: 2,
      borderColor: "#fff",
    },
    box: {
      position: "absolute",
      left: 16,
      right: 16,
      backgroundColor: Colors.surface,
      borderRadius: 16,
      padding: 16,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: Colors.textPrimary,
      marginBottom: 6,
    },
    textScroll: { flexShrink: 1 },
    text: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.textSecondary,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 14,
    },
    counter: { fontSize: 12, color: Colors.textMuted },
    tryIt: { fontSize: 13, fontWeight: "600", color: Colors.primary, marginTop: 10 },
    hint: { fontSize: 12, fontStyle: "italic", color: Colors.primary },
    nextBtn: {
      backgroundColor: Colors.primary,
      borderRadius: 10,
      paddingHorizontal: 18,
      paddingVertical: 9,
    },
    nextText: { color: "#fff", fontSize: 14, fontWeight: "600" },
    buttons: { flexDirection: "row", alignItems: "center", gap: 8 },
    backBtn: {
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    backText: { color: Colors.textSecondary, fontSize: 14, fontWeight: "600" },
    skip: {
      position: "absolute",
      left: 12,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 16,
      backgroundColor: "rgba(255,255,255,0.18)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.5)",
    },
    skipText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  });
}
