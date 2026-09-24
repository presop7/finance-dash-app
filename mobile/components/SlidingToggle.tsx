import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { ColorsType } from "../constants/colors";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const SEGMENT_W = 92;
const SEGMENT_H = 30;
const PAD = 3;
const TRACK_H = SEGMENT_H + PAD * 2;
const STROKE = 2;

type Option<T extends string> = { key: T; label: string };

type SlidingToggleProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (key: T) => void;
  // While true, a highlight chases around the toggle's border — shown while
  // whatever this toggle switches (a filtered list, say) is still working,
  // so the wait reads as "loading" instead of "frozen".
  loading?: boolean;
};

// Everything animated here (the sliding pill, the chasing border, the fade)
// is driven by Reanimated on the UI thread, deliberately: this is shown
// exactly while the JS thread is busy rendering the thing being switched,
// which is when a JS-driven animation would stall.
export default function SlidingToggle<T extends string>({
  options,
  value,
  onChange,
  loading = false,
}: SlidingToggleProps<T>) {
  const Colors = useThemeColors();
  const styles = getThemedStyles(createStyles, Colors);

  const trackW = SEGMENT_W * options.length + PAD * 2;
  const rectW = trackW - STROKE;
  const rectH = TRACK_H - STROKE;
  // Perimeter of a stadium (rect with fully-rounded ends).
  const perimeter = 2 * (rectW - rectH) + Math.PI * rectH;
  const segment = perimeter * 0.28;

  const index = Math.max(
    0,
    options.findIndex((o) => o.key === value),
  );

  const slideX = useSharedValue(index * SEGMENT_W);
  const dashOffset = useSharedValue(0);
  const borderOpacity = useSharedValue(0);

  useEffect(() => {
    slideX.value = withTiming(index * SEGMENT_W, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    if (loading) {
      cancelAnimation(dashOffset);
      dashOffset.value = 0;
      borderOpacity.value = withTiming(1, { duration: 120 });
      dashOffset.value = withRepeat(
        withTiming(-perimeter, { duration: 1000, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      // Fade out first and only then stop the loop, so it doesn't freeze
      // visibly mid-lap.
      borderOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) cancelAnimation(dashOffset);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }));
  const borderStyle = useAnimatedStyle(() => ({ opacity: borderOpacity.value }));
  const rectProps = useAnimatedProps(() => ({ strokeDashoffset: dashOffset.value }));

  return (
    <View style={[styles.track, { width: trackW }]}>
      <Animated.View style={[styles.pill, pillStyle]} />

      {options.map((option) => (
        <Pressable key={option.key} style={styles.option} onPress={() => onChange(option.key)}>
          <Text style={[styles.text, option.key === value && styles.textActive]}>
            {option.label}
          </Text>
        </Pressable>
      ))}

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, borderStyle]}>
        <Svg width={trackW} height={TRACK_H}>
          <AnimatedRect
            x={STROKE / 2}
            y={STROKE / 2}
            width={rectW}
            height={rectH}
            rx={rectH / 2}
            fill="none"
            stroke={Colors.primary}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={[segment, perimeter - segment]}
            animatedProps={rectProps}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    track: {
      flexDirection: "row",
      alignSelf: "center",
      height: TRACK_H,
      padding: PAD,
      borderRadius: TRACK_H / 2,
      backgroundColor: Colors.surfaceSecondary,
      marginBottom: 8,
    },
    pill: {
      position: "absolute",
      left: PAD,
      top: PAD,
      width: SEGMENT_W,
      height: SEGMENT_H,
      borderRadius: SEGMENT_H / 2,
      backgroundColor: Colors.primary,
    },
    option: {
      width: SEGMENT_W,
      height: SEGMENT_H,
      alignItems: "center",
      justifyContent: "center",
    },
    text: { fontSize: 12, fontWeight: "600", color: Colors.textMuted },
    textActive: { color: "#fff" },
  });
}
