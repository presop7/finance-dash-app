import { memo, useCallback, useRef, useState } from "react";
import { StyleSheet, StyleProp, ViewStyle, View } from "react-native";
import Swipeable, { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  interpolate,
  Extrapolation,
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../hooks/useThemeColors";
import { TransactionRow, CategoryDetails, Transaction } from "./TransactionList";
import { confirmAndDeleteTransaction } from "../utils/transactionActions";

type SwipeableTransactionRowProps = {
  transaction: Transaction;
  details: CategoryDetails;
  isLast?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: (transaction: Transaction) => void;
  // Enters multi-select — only ever rendered outside select mode (Analytics
  // swaps to a plain TransactionRow once select mode is on), so there's no
  // "disable swipe while selecting" case to handle here. Takes the id
  // rather than being a per-row closure so a single stable callback can be
  // shared by every row — a fresh closure per row per render defeats the
  // memo below, and this row (gesture handler + Reanimated) is expensive to
  // re-render for nothing.
  onLongPress?: (id: string) => void;
  // Swipe-left target — the same "open AddTransactionModal in edit mode"
  // transition TransactionDetailModal's own Edit button already triggers.
  onEdit?: (transaction: Transaction) => void;
};

// The action panels are purely visual now — there's no tap target, only a
// full swipe triggers anything. Dragged less than this and releasing just
// snaps back. Kept just past the action icon's own 80px box (ACTION_WIDTH)
// rather than requiring a near-edge-of-screen drag — "armed" feedback below
// (the icon growing further, a darkening overlay) kicks in at that same box
// boundary, so crossing it reads as one deliberate "you've gone far enough"
// moment instead of the visual cue and the actual trigger disagreeing.
const ACTION_WIDTH = 80;
const FULL_SWIPE_DISTANCE = ACTION_WIDTH + 20;

// progress is 0 while closed, 1 exactly at the action icon's own box width,
// and (Swipeable doesn't clamp it) keeps climbing past 1 the further you
// keep dragging beyond that box — used here as the "how armed is this"
// signal, independent of the leftThreshold/rightThreshold that decides what
// happens on release. A separate component (rather than a plain function
// called from the render-prop, like the old Animated.Value version did) is
// required here — useAnimatedStyle is a hook, so it needs an actual
// component to live in.
function ActiveSwipeActionPanel({
  color,
  icon,
  progress,
}: {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  progress: SharedValue<number>;
}) {
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(progress.value, [0, 1, 1.3], [0.5, 1, 1.3], Extrapolation.CLAMP) },
    ],
  }));
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.85, 1], [0, 0.18], Extrapolation.CLAMP),
  }));

  return (
    <View style={[styles.action, { backgroundColor: color }]}>
      <Animated.View style={[styles.armedOverlay, overlayStyle]} />
      <Animated.View style={scaleStyle}>
        <Ionicons name={icon} size={22} color="#fff" />
      </Animated.View>
    </View>
  );
}

// Every row mounts two of these (left and right), but a given row is almost
// never actually swiped — and the full panel (icon glyph, two animated-style
// worklet mappers, animated views) is by far the heaviest part of mounting a
// row, paid for every row in a list that's re-mounted wholesale on each
// filter switch. So until the row's first drag starts, a bare colored box of
// the same size stands in (Swipeable needs the panel's width up front to
// know how far it can be dragged); the real one takes over as the drag
// begins.
function SwipeActionPanel({
  active,
  color,
  icon,
  progress,
}: {
  active: boolean;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  progress: SharedValue<number>;
}) {
  if (!active) return <View style={[styles.action, { backgroundColor: color }]} />;
  return <ActiveSwipeActionPanel color={color} icon={icon} progress={progress} />;
}

// Revolut-style swipe actions on an Analytics transaction row: swiping left
// triggers delete (shown with the trash icon, renderLeftActions), swiping
// right triggers edit (pencil icon, renderRightActions) — matches the
// common swipe-left-to-delete convention (iOS Mail, etc). Note the panel
// shown under a given swipe and the handler wired to that swipe's
// direction in onSwipeableWillOpen below are set independently — verified
// on-device rather than assumed from RNGH's docs, since the two didn't
// actually line up the way the docs suggest. Neither panel is tappable —
// only completing the swipe triggers the action.
//
// This is built on Swipeable's own leftThreshold/rightThreshold +
// onSwipeableWillOpen rather than hand-watching a "how far dragged"
// animated value directly — that was tried first against the classic
// (non-Reanimated) Swipeable and never fired reliably, since the value
// passed into renderLeftActions/renderRightActions there is a natively-
// driven interpolation chained twice over, and RN's Animated.Value.
// addListener is known to be unreliable on composed/derived native-driven
// values like that. leftThreshold/rightThreshold are Swipeable's own first-
// class, documented mechanism for exactly this "dragged far enough"
// question, and that part carries over unchanged now that this uses the
// Reanimated version of Swipeable (migrated to get off the deprecated
// classic one, and to let the Analytics multi-select auto-scroll be driven
// by the same reanimated dependency for smoother scrolling).
function SwipeableTransactionRow({
  transaction,
  details,
  isLast,
  style,
  onPress,
  onLongPress,
  onEdit,
}: SwipeableTransactionRowProps) {
  const swipeableRef = useRef<SwipeableMethods>(null);
  const Colors = useThemeColors();
  const handleLongPress = useCallback(
    () => onLongPress?.(transaction.id),
    [onLongPress, transaction.id],
  );

  const handleDelete = async () => {
    swipeableRef.current?.close();
    await confirmAndDeleteTransaction(transaction, details.label);
  };

  const handleEdit = () => {
    swipeableRef.current?.close();
    onEdit?.(transaction);
  };

  // Flips once, on this row's first drag, and stays — see SwipeActionPanel.
  const [panelsActive, setPanelsActive] = useState(false);
  const activatePanels = useCallback(() => setPanelsActive(true), []);

  const renderLeftActions = (progress: SharedValue<number>) => (
    <SwipeActionPanel
      active={panelsActive}
      color={Colors.expense}
      icon="trash-outline"
      progress={progress}
    />
  );

  const renderRightActions = (progress: SharedValue<number>) => (
    <SwipeActionPanel
      active={panelsActive}
      color={Colors.primary}
      icon="create-outline"
      progress={progress}
    />
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableOpenStartDrag={activatePanels}
      // Below this, releasing always springs back closed — nothing settles
      // "open" short of a genuine full swipe.
      leftThreshold={FULL_SWIPE_DISTANCE}
      rightThreshold={FULL_SWIPE_DISTANCE}
      // Fires the instant Swipeable decides the release crossed the
      // threshold and starts animating open — acting here (rather than
      // onSwipeableOpen, which only fires once that animation has finished
      // playing out) keeps the trigger feeling immediate instead of
      // noticeably settling open first.
      onSwipeableWillOpen={(direction) => {
        if (direction === "left") handleEdit();
        else handleDelete();
      }}
    >
      {/* Forces the sliding content onto its own hardware layer on Android —
          without it, the Animated-driven translateX here can composite with
          a sub-pixel offset against the action panel's background, showing
          as a 1px sliver of that color along one edge while dragging. */}
      <View renderToHardwareTextureAndroid collapsable={false}>
        <TransactionRow
          transaction={transaction}
          details={details}
          onPress={onPress}
          onLongPress={onLongPress ? handleLongPress : undefined}
          isLast={isLast}
          style={style}
        />
      </View>
    </Swipeable>
  );
}

// Every prop is a stable reference from its callers (store objects, shared
// callbacks, module-level styles), so the default shallow comparison is what
// lets an unrelated Analytics state change (filter toggle, opening the
// filters modal) skip re-rendering every mounted swipe row.
export default memo(SwipeableTransactionRow);

const styles = StyleSheet.create({
  action: {
    width: ACTION_WIDTH,
    justifyContent: "center",
    alignItems: "center",
  },
  // Darkens on top of the action's own color once armed — a plain black
  // overlay works over either the expense or primary background without
  // needing a second color to maintain per action. Opacity itself is
  // animated (see overlayStyle above), fading in as progress crosses the box.
  armedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
  },
});
