import { ReactNode, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
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

export default function DashboardCardList({
  cards,
  order,
  collapsed,
  onReorder,
  onToggleCollapse,
}: DashboardCardListProps) {
  const [reorderMode, setReorderMode] = useState(false);
  const [draftOrder, setDraftOrder] = useState(order);

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
    setReorderMode(true);
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
    setReorderMode(false);
  };

  const discardReorder = () => {
    setReorderMode(false);
  };

  const displayOrder = reorderMode ? draftOrder : order;

  const cardList = displayOrder.map((id, index) => {
    const card = cards.find((c) => c.id === id);
    if (!card) return null;
    return (
      <CollapsibleCard
        key={id}
        title={card.title}
        subtitle={card.subtitle}
        collapsed={Boolean(collapsed[id])}
        onToggleCollapse={() => onToggleCollapse(id)}
        onHoldComplete={enterReorderMode}
        reorderMode={reorderMode}
        onMoveUp={() => moveCard(id, -1)}
        onMoveDown={() => moveCard(id, 1)}
        canMoveUp={index > 0}
        canMoveDown={index < displayOrder.length - 1}
      >
        {card.content}
      </CollapsibleCard>
    );
  });

  if (!reorderMode) return <>{cardList}</>;

  return (
    <View style={styles.reorderPanel}>
      <View style={styles.reorderHeader}>
        <TouchableOpacity style={styles.discardBtn} onPress={discardReorder}>
          <Ionicons name="close-circle" size={18} color={Colors.expense} />
          <Text style={styles.discardText}>Discard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={confirmReorder}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.income} />
          <Text style={styles.saveText}>Save Order</Text>
        </TouchableOpacity>
      </View>
      {cardList}
    </View>
  );
}

const styles = StyleSheet.create({
  reorderPanel: {
    marginTop: 16,
    marginHorizontal: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSecondary,
  },
  reorderHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
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
