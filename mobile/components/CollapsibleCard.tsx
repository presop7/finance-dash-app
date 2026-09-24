import { ReactNode } from "react";
import { Animated, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ColorsType } from "../constants/colors";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";
import HoldPressable from "./HoldPressable";
import BorderPressButton from "./BorderPressButton";

type CollapsibleCardProps = {
  title: string;
  subtitle?: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onHoldComplete?: () => void;
  // Whether this card can be dragged into reorder mode at all. Some screens
  // (Analytics' Summary card) reuse CollapsibleCard purely for its
  // collapse/expand behavior, outside any reorderable list — the
  // hold-to-reorder affordance (grip icon, hold-fill animation) would be
  // misleading there since holding it does nothing. Defaults to true to
  // match every existing (actually reorderable) usage.
  reorderable?: boolean;
  reorderMode?: boolean;
  // Shared 0->1 value owned by the parent list: 0 = normal, 1 = fully in
  // reorder mode. Drives this card's shrink and its header controls
  // crossfading in lockstep with the reorder panel appearing/disappearing.
  reorderProgress?: Animated.Value;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  children: ReactNode;
};

const STATIC_ZERO = new Animated.Value(0);

export default function CollapsibleCard({
  title,
  subtitle,
  collapsed,
  onToggleCollapse,
  onHoldComplete,
  reorderable = true,
  reorderMode,
  reorderProgress = STATIC_ZERO,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  children,
}: CollapsibleCardProps) {
  const Colors = useThemeColors();
  const styles = getThemedStyles(createStyles, Colors);
  const scale = reorderProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] });
  const collapseBtnOpacity = reorderProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale }] }]}>
      <View style={styles.header}>
        {/* Grip — hold for a beat to enter reorder mode */}
        {reorderable ? (
          <HoldPressable
            style={styles.grip}
            disabled={reorderMode}
            onHoldComplete={() => onHoldComplete?.()}
          >
            <Ionicons
              name="reorder-three-outline"
              size={18}
              color={Colors.textMuted}
            />
            <View>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
          </HoldPressable>
        ) : (
          <View style={styles.grip}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        )}

        {/* Both control sets stay mounted and crossfade via reorderProgress,
            stacked in a fixed-size slot so neither pop of layout occurs. */}
        <View style={styles.controlsSlot}>
          <Animated.View
            style={[styles.controlsOverlay, { opacity: reorderProgress }]}
            pointerEvents={reorderMode ? "auto" : "none"}
          >
            <TouchableOpacity
              style={[styles.moveBtn, !canMoveUp && styles.moveBtnDisabled]}
              onPress={onMoveUp}
              disabled={!canMoveUp}
              hitSlop={6}
            >
              <Ionicons
                name="chevron-up"
                size={18}
                color={canMoveUp ? Colors.textPrimary : Colors.textMuted}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.moveBtn, !canMoveDown && styles.moveBtnDisabled]}
              onPress={onMoveDown}
              disabled={!canMoveDown}
              hitSlop={6}
            >
              <Ionicons
                name="chevron-down"
                size={18}
                color={canMoveDown ? Colors.textPrimary : Colors.textMuted}
              />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View
            style={[styles.controlsOverlay, { opacity: collapseBtnOpacity }]}
            pointerEvents={reorderMode ? "none" : "auto"}
          >
            <BorderPressButton
              style={styles.collapseBtn}
              onPress={onToggleCollapse}
              hitSlop={8}
            >
              <Ionicons
                name={collapsed ? "chevron-down" : "chevron-up"}
                size={18}
                color={Colors.textMuted}
              />
            </BorderPressButton>
          </Animated.View>
        </View>
      </View>

      {!collapsed && <View style={styles.body}>{children}</View>}
    </Animated.View>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
  wrapper: {
    marginTop: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  grip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginLeft: -6,
    borderRadius: 8,
    overflow: "hidden",
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  // Fixed size big enough for either control set (two 28px buttons + 6 gap),
  // right-aligned, so the crossfade never causes a layout jump.
  controlsSlot: {
    width: 70,
    height: 28,
  },
  controlsOverlay: {
    position: "absolute",
    right: 0,
    top: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  collapseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceSecondary,
  },
  moveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  moveBtnDisabled: {
    opacity: 0.4,
  },
  body: {},
  });
}
