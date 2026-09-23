import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Animated, LayoutChangeEvent, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ColorsType } from "../constants/colors";
import { useThemeColors } from "../hooks/useThemeColors";
import CollapsibleCard from "./CollapsibleCard";

export type DashboardCardDef = {
  id: string;
  title: string;
  subtitle?: string;
  content: ReactNode;
};

type DashboardCardListProps = {
  cards: DashboardCardDef[];
  order: string[];
  collapsed: Record<string, boolean>;
  onReorder: (order: string[]) => void;
  onToggleCollapse: (id: string) => void;
};

const TRANSITION_MS = 220;

export default function DashboardCardList({
  cards,
  order,
  collapsed,
  onReorder,
  onToggleCollapse,
}: DashboardCardListProps) {
  const [reorderMode, setReorderMode] = useState(false);
  const [draftOrder, setDraftOrder] = useState(order);
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  // Layout props (margin/padding/border/radius) can only ever animate on
  // the JS thread, forcing a native relayout every single frame — even
  // isolated on their own value, that's still visibly choppy. So the panel's
  // geometry snaps to its target instantly (one relayout) at the same
  // moment this starts, and fadeAnim — native-driven, so it stays smooth
  // regardless of JS thread load — carries all the actual motion (header
  // opacity, card scale/control crossfade), masking the snap.
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // FLIP-style reorder animation: each card's last-measured Y position, and
  // a per-card translateY it animates from (its old position, relative to
  // its new one) back to 0 whenever a move changes where it lands.
  const cardPositions = useRef(new Map<string, number>()).current;
  const cardAnims = useRef(new Map<string, Animated.Value>()).current;
  const getCardAnim = (id: string) => {
    let anim = cardAnims.get(id);
    if (!anim) {
      anim = new Animated.Value(0);
      cardAnims.set(id, anim);
    }
    return anim;
  };
  const handleCardLayout = (id: string) => (e: LayoutChangeEvent) => {
    const newY = e.nativeEvent.layout.y;
    const prevY = cardPositions.get(id);
    cardPositions.set(id, newY);
    if (prevY === undefined || prevY === newY) return;
    const anim = getCardAnim(id);
    anim.setValue(prevY - newY);
    Animated.timing(anim, { toValue: 0, duration: TRANSITION_MS, useNativeDriver: true }).start();
  };

  const knownIdsKey = cards.map((c) => c.id).join("|");

  // Self-heal a persisted order that predates a card being added/removed
  // from `cards` (append missing ids, drop stale ones). Skipped while
  // actively reordering.
  useEffect(() => {
    if (reorderMode) return;
    const knownIds = knownIdsKey.split("|").filter(Boolean);
    const kept = order.filter((id) => knownIds.includes(id));
    const missing = knownIds.filter((id) => !order.includes(id));
    const reconciled = [...kept, ...missing];

    if (reconciled.join("|") !== order.join("|")) {
      onReorder(reconciled);
    }
  }, [order, knownIdsKey, reorderMode]);

  const enterReorderMode = () => {
    setDraftOrder(order);
    // reorderMode flips true immediately so the header/panel chrome mounts
    // right away, at progress 0, and animates in from there.
    setReorderMode(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: TRANSITION_MS, useNativeDriver: true }).start();
  };

  // Animates back to 0 first, then unmounts the reorder chrome — so it fades
  // out instead of vanishing the instant the button is tapped. The panel's
  // geometry stays at its reorder-mode size throughout (reorderMode is still
  // true until this completes) and only snaps back once this finishes, by
  // which point it's already invisible.
  const leaveReorderMode = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: TRANSITION_MS, useNativeDriver: true }).start(() =>
      setReorderMode(false),
    );
  };

  const moveCard = (id: string, direction: -1 | 1) => {
    setDraftOrder((prev) => {
      const idx = prev.indexOf(id);
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return next;
    });
  };

  const confirmReorder = () => {
    onReorder(draftOrder);
    leaveReorderMode();
  };

  const discardReorder = () => {
    leaveReorderMode();
  };

  const displayOrder = reorderMode ? draftOrder : order;

  const cardList = displayOrder.map((id, index) => {
    const card = cards.find((c) => c.id === id);
    if (!card) return null;
    return (
      <Animated.View
        key={id}
        onLayout={handleCardLayout(id)}
        style={{ transform: [{ translateY: getCardAnim(id) }] }}
      >
        <CollapsibleCard
          title={card.title}
          subtitle={card.subtitle}
          collapsed={Boolean(collapsed[id])}
          onToggleCollapse={() => onToggleCollapse(id)}
          onHoldComplete={enterReorderMode}
          reorderMode={reorderMode}
          reorderProgress={fadeAnim}
          onMoveUp={() => moveCard(id, -1)}
          onMoveDown={() => moveCard(id, 1)}
          canMoveUp={index > 0}
          canMoveDown={index < displayOrder.length - 1}
        >
          {card.content}
        </CollapsibleCard>
      </Animated.View>
    );
  });

  return (
    <Animated.View style={[styles.panel, reorderMode && styles.panelActive]}>
      {reorderMode && (
        <Animated.View style={[styles.reorderHeader, { opacity: fadeAnim }]}>
          <TouchableOpacity style={styles.discardBtn} onPress={discardReorder}>
            <Ionicons name="close-circle" size={18} color={Colors.expense} />
            <Text style={styles.discardText}>Discard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={confirmReorder}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.income} />
            <Text style={styles.saveText}>Save Order</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
      {cardList}
    </Animated.View>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
  panel: {
    borderColor: Colors.primary,
  },
  panelActive: {
    marginTop: 16,
    marginHorizontal: 16,
    padding: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSecondary,
  },
  reorderHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
    marginBottom: 8,
  },
  discardBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  discardText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.expense,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  saveText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.income,
  },
  });
}
