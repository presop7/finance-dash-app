import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector, ScrollView } from "react-native-gesture-handler";
import Animated, {
  SharedValue,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { ColorsType } from "../constants/colors";
import { useThemeColors, useResolvedScheme, getThemedStyles } from "../hooks/useThemeColors";
import { GlobalStyles } from "../constants/styles";
import { useFinanceStore, Transaction } from "../store/useFinanceStore";
import { FundCategory } from "../constants/fundCategories";
import { daysAgo, percentageChange } from "../utils/dateRanges";
import { formatCurrency } from "../utils/currency";
import { themedCategoryColor } from "../utils/color";
import { moveToSlot, Slots } from "../utils/reorder";
import type { AnalyticsInitialFilter } from "../screens/AnalyticsScreen";
import { useTranslation } from "react-i18next";

type FundsCardProps = {
  transactions: Transaction[];
  fundCategories: FundCategory[];
  onNavigateToAnalytics?: (filter: AnalyticsInitialFilter) => void;
};

const CARD_WIDTH = 148;
const CARD_GAP = 12;
const STEP = CARD_WIDTH + CARD_GAP;
// Same feel as HoldPressable: nothing shows for the first 150ms (a tap or a
// scroll never flashes it), then the fill runs 150ms. Once full, the card is
// "picked up": release in place to open Analytics, or move to drag it.
const HOLD_DELAY_MS = 150;
const HOLD_FILL_MS = 150;
// Finger travel (px) below which a release counts as "didn't move".
const MOVE_TOLERANCE = 10;
// First-frame guess until the real card height is measured.
const ESTIMATED_CARD_HEIGHT = 130;

export default function FundsCard({
  transactions,
  fundCategories,
  onNavigateToAnalytics,
}: FundsCardProps) {
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);
  const isDark = useResolvedScheme() === "dark";
  const currency = useFinanceStore((s) => s.settings.currency);
  const fundCardOrder = useFinanceStore((s) => s.fundCardOrder);
  const setFundCardOrder = useFinanceStore((s) => s.setFundCardOrder);

  const funds = useMemo(() => {
    const thirtyDaysAgo = daysAgo(30);

    const rank = (id: string) => {
      const i = fundCardOrder.indexOf(id);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    const ordered = [...fundCategories].sort((a, b) => rank(a.id) - rank(b.id));

    return ordered.map((fund) => {
      const fundTransactions = transactions.filter(
        (t) => t.fundCategory === fund.id,
      );

      const balance = fundTransactions.reduce(
        (sum, t) => sum + (t.type === "income" ? t.amount : -t.amount),
        0,
      );

      const balance30DaysAgo = fundTransactions
        .filter((t) => new Date(t.date).getTime() < thirtyDaysAgo.getTime())
        .reduce(
          (sum, t) => sum + (t.type === "income" ? t.amount : -t.amount),
          0,
        );

      return {
        fund,
        balance,
        trendPct: percentageChange(balance, balance30DaysAgo),
        hasHistory: balance30DaysAgo !== 0,
      };
    });
  }, [transactions, fundCategories, fundCardOrder]);

  // Cards are absolutely positioned by slot so a drag can shuffle them on the
  // UI thread without a React re-layout; the order is saved on drop.
  const slots = useSharedValue<Slots>({});
  const orderKey = funds.map((f) => f.fund.id).join("|");
  useEffect(() => {
    slots.value = Object.fromEntries(funds.map((f, i) => [f.fund.id, i]));
  }, [orderKey]);

  // Absolute children don't size their parent, so the tallest card's height
  // is measured and every card is given it (they used to stretch to match).
  const [cardHeight, setCardHeight] = useState(0);
  const onCardLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setCardHeight((prev) => Math.max(prev, h));
  };

  if (funds.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={STEP}
        decelerationRate="fast"
        contentContainerStyle={styles.scrollContent}
      >
        <View
          style={{
            width: funds.length * STEP - CARD_GAP,
            height: cardHeight || ESTIMATED_CARD_HEIGHT,
          }}
        >
          {funds.map(({ fund, balance, trendPct, hasHistory }) => {
            const isUp = trendPct >= 0;
            return (
              <DraggableFund
                key={fund.id}
                id={fund.id}
                slots={slots}
                count={funds.length}
                minHeight={cardHeight}
                style={[styles.card, GlobalStyles.shadow]}
                fillColor={fund.color + "18"}
                onLayout={onCardLayout}
                onOpen={
                  onNavigateToAnalytics
                    ? () => onNavigateToAnalytics({ fundIds: [fund.id] })
                    : undefined
                }
                onReorder={setFundCardOrder}
              >
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: fund.color + "22", borderColor: fund.color + "80" },
                  ]}
                >
                  <Ionicons
                    name={fund.icon as keyof typeof Ionicons.glyphMap}
                    size={20}
                    color={themedCategoryColor(fund.color, Colors.primary, isDark)}
                  />
                </View>

                <Text style={styles.fundName} numberOfLines={1}>
                  {fund.name}
                </Text>

                <Text style={styles.balance}>{formatCurrency(balance, currency)}</Text>

                {hasHistory && (
                  <View style={styles.trendRow}>
                    <Ionicons
                      name={isUp ? "trending-up" : "trending-down"}
                      size={12}
                      color={isUp ? Colors.income : Colors.expense}
                    />
                    <Text
                      style={[
                        styles.trendText,
                        { color: isUp ? Colors.income : Colors.expense },
                      ]}
                    >
                      {t("dashboard.trend30", { pct: Math.abs(trendPct) })}
                    </Text>
                  </View>
                )}
              </DraggableFund>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function DraggableFund({
  id,
  slots,
  count,
  minHeight,
  style,
  fillColor,
  onLayout,
  onOpen,
  onReorder,
  children,
}: {
  id: string;
  slots: SharedValue<Slots>;
  count: number;
  minHeight: number;
  style: object;
  fillColor: string;
  onLayout: (e: LayoutChangeEvent) => void;
  onOpen?: () => void;
  onReorder: (order: string[]) => void;
  children: React.ReactNode;
}) {
  const fill = useSharedValue(0);
  const dragging = useSharedValue(false);
  const dragX = useSharedValue(0);
  const startSlot = useSharedValue(0);

  const open = () => onOpen?.();

  // Pan that only activates after the hold completes: moving earlier fails
  // it, which leaves the gesture to the ScrollView (so swiping still scrolls).
  const gesture = Gesture.Pan()
    .activateAfterLongPress(HOLD_DELAY_MS + HOLD_FILL_MS)
    .onBegin(() => {
      fill.value = withDelay(HOLD_DELAY_MS, withTiming(1, { duration: HOLD_FILL_MS }));
    })
    .onStart(() => {
      startSlot.value = slots.value[id];
      dragX.value = startSlot.value * STEP;
      dragging.value = true;
    })
    .onUpdate((e) => {
      dragX.value = startSlot.value * STEP + e.translationX;
      const target = Math.min(count - 1, Math.max(0, Math.round(dragX.value / STEP)));
      if (target !== slots.value[id]) slots.value = moveToSlot(slots.value, id, target);
    })
    .onEnd((e) => {
      const moved =
        Math.abs(e.translationX) > MOVE_TOLERANCE || Math.abs(e.translationY) > MOVE_TOLERANCE;
      if (!moved) {
        runOnJS(open)();
      } else if (slots.value[id] !== startSlot.value) {
        const order = Object.keys(slots.value).sort((a, b) => slots.value[a] - slots.value[b]);
        runOnJS(onReorder)(order);
      }
    })
    .onFinalize(() => {
      dragging.value = false;
      fill.value = withTiming(0, { duration: 150 });
    });

  const cardStyle = useAnimatedStyle(() => {
    const slotX = (slots.value[id] ?? 0) * STEP;
    return {
      zIndex: dragging.value ? 10 : 0,
      transform: [
        { translateX: dragging.value ? dragX.value : withTiming(slotX, { duration: 180 }) },
        { scale: withTiming(dragging.value ? 1.05 : 1, { duration: 120 }) },
      ],
    };
  });

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    // Web: keep the browser's sideways scrolling of the card row (the
    // gesture library blocks all touch scrolling by default there).
    <GestureDetector gesture={gesture} touchAction="pan-x">
      <Animated.View
        style={[style, { position: "absolute", top: 0, left: 0, minHeight }, cardStyle]}
        onLayout={onLayout}
      >
        <Animated.View
          style={[
            { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: fillColor },
            fillStyle,
          ]}
        />
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
  wrapper: {},
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    overflow: "hidden",
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  fundName: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  balance: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  trendText: {
    fontSize: 11,
    fontWeight: "500",
  },
  });
}
