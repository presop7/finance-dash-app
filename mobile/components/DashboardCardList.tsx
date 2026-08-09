import { ReactNode, useEffect, useRef, useState } from "react";
import { Animated, PanResponder } from "react-native";
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
  onDragActiveChange?: (active: boolean) => void;
};

type SlotEntry = { id: string; top: number; height: number };

const DEFAULT_HEIGHT = 90;

function computeOffsets(
  order: string[],
  heights: Record<string, number>,
): SlotEntry[] {
  let acc = 0;
  return order.map((id) => {
    const height = heights[id] ?? DEFAULT_HEIGHT;
    const entry = { id, top: acc, height };
    acc += height;
    return entry;
  });
}

export default function DashboardCardList({
  cards,
  order,
  collapsed,
  onReorder,
  onToggleCollapse,
  onDragActiveChange,
}: DashboardCardListProps) {
  const [liveOrder, setLiveOrder] = useState(order);
  const orderRef = useRef(order);
  const heightsRef = useRef<Record<string, number>>({});
  const animsRef = useRef<Map<string, Animated.Value>>(new Map());
  const draggingRef = useRef<{
    id: string;
    startTop: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    orderRef.current = liveOrder;
  }, [liveOrder]);

  const knownIdsKey = cards.map((c) => c.id).join("|");

  // Sync in external order changes (e.g. persisted rehydration) but never
  // fight an in-progress drag. Also self-heals a persisted order that
  // predates a card being added/removed from `cards`, by appending any
  // missing ids and dropping any that no longer exist.
  useEffect(() => {
    if (draggingRef.current) return;
    const knownIds = knownIdsKey.split("|").filter(Boolean);
    const kept = order.filter((id) => knownIds.includes(id));
    const missing = knownIds.filter((id) => !order.includes(id));
    const reconciled = [...kept, ...missing];

    if (reconciled.join("|") !== order.join("|")) {
      onReorder(reconciled);
    } else {
      setLiveOrder(order);
    }
  }, [order, knownIdsKey]);

  const getAnim = (id: string) => {
    if (!animsRef.current.has(id)) {
      animsRef.current.set(id, new Animated.Value(0));
    }
    return animsRef.current.get(id)!;
  };

  const handleGrant = (id: string) => {
    const entry = computeOffsets(orderRef.current, heightsRef.current).find(
      (o) => o.id === id,
    )!;
    draggingRef.current = { id, startTop: entry.top, height: entry.height };
    onDragActiveChange?.(true);
  };

  const handleMove = (id: string, dy: number) => {
    const drag = draggingRef.current;
    if (!drag || drag.id !== id) return;
    getAnim(id).setValue(dy);

    const currentOrder = orderRef.current;
    const others = currentOrder.filter((oid) => oid !== id);
    const compacted = computeOffsets(others, heightsRef.current);
    const currentCenter = drag.startTop + dy + drag.height / 2;

    let targetIndex = compacted.length;
    for (let i = 0; i < compacted.length; i++) {
      if (currentCenter < compacted[i].top + compacted[i].height / 2) {
        targetIndex = i;
        break;
      }
    }

    const newOrder = [...others];
    newOrder.splice(targetIndex, 0, id);

    if (newOrder.join("|") !== currentOrder.join("|")) {
      const oldOffsets = computeOffsets(currentOrder, heightsRef.current);
      const newOffsets = computeOffsets(newOrder, heightsRef.current);
      orderRef.current = newOrder;
      setLiveOrder(newOrder);

      for (const oid of others) {
        const oldTop = oldOffsets.find((o) => o.id === oid)!.top;
        const newTop = newOffsets.find((o) => o.id === oid)!.top;
        if (oldTop !== newTop) {
          const anim = getAnim(oid);
          anim.setValue(oldTop - newTop);
          Animated.timing(anim, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }).start();
        }
      }
    }
  };

  const handleRelease = (id: string) => {
    const wasDragging = Boolean(draggingRef.current);
    draggingRef.current = null;
    onDragActiveChange?.(false);
    Animated.timing(getAnim(id), {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
    if (wasDragging) onReorder(orderRef.current);
  };

  return (
    <>
      {liveOrder.map((id) => {
        const card = cards.find((c) => c.id === id);
        if (!card) return null;
        return (
          <DraggableItem
            key={id}
            id={id}
            title={card.title}
            subtitle={card.subtitle}
            collapsed={Boolean(collapsed[id])}
            onToggleCollapse={() => onToggleCollapse(id)}
            translateY={getAnim(id)}
            onLayoutHeight={(h) => {
              heightsRef.current[id] = h;
            }}
            onGrant={() => handleGrant(id)}
            onMove={(dy) => handleMove(id, dy)}
            onRelease={() => handleRelease(id)}
          >
            {card.content}
          </DraggableItem>
        );
      })}
    </>
  );
}

type DraggableItemProps = {
  id: string;
  title: string;
  subtitle?: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  translateY: Animated.Value;
  onLayoutHeight: (height: number) => void;
  onGrant: () => void;
  onMove: (dy: number) => void;
  onRelease: () => void;
  children: ReactNode;
};

function DraggableItem({
  title,
  subtitle,
  collapsed,
  onToggleCollapse,
  translateY,
  onLayoutHeight,
  onGrant,
  onMove,
  onRelease,
  children,
}: DraggableItemProps) {
  const [isDragging, setIsDragging] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      // Only claim the gesture once the finger has actually moved — a plain
      // tap on the grip (or the chevron, which lives outside it) shouldn't
      // trigger a drag/scroll-lock flicker.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) =>
        Math.abs(gestureState.dy) > 6,
      onPanResponderGrant: () => {
        setIsDragging(true);
        onGrant();
      },
      onPanResponderMove: (_evt, gestureState) => {
        onMove(gestureState.dy);
      },
      onPanResponderRelease: () => {
        setIsDragging(false);
        onRelease();
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
        onRelease();
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  return (
    <Animated.View
      style={{ transform: [{ translateY }], zIndex: isDragging ? 10 : 0 }}
      onLayout={(e) => onLayoutHeight(e.nativeEvent.layout.height)}
    >
      <CollapsibleCard
        title={title}
        subtitle={subtitle}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        dragHandlers={panResponder.panHandlers}
        isDragging={isDragging}
      >
        {children}
      </CollapsibleCard>
    </Animated.View>
  );
}
