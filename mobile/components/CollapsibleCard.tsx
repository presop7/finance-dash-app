import { ReactNode } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import HoldPressable from "./HoldPressable";

type CollapsibleCardProps = {
  title: string;
  subtitle?: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onHoldComplete?: () => void;
  reorderMode?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  children: ReactNode;
};

export default function CollapsibleCard({
  title,
  subtitle,
  collapsed,
  onToggleCollapse,
  onHoldComplete,
  reorderMode,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  children,
}: CollapsibleCardProps) {
  return (
    <View style={[styles.wrapper, reorderMode && styles.wrapperShrunk]}>
      <View style={styles.header}>
        {/* Grip — hold for a beat to enter reorder mode */}
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

        {reorderMode ? (
          <View style={styles.reorderControls}>
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
          </View>
        ) : (
          <TouchableOpacity
            style={styles.collapseBtn}
            onPress={onToggleCollapse}
            hitSlop={8}
          >
            <Ionicons
              name={collapsed ? "chevron-down" : "chevron-up"}
              size={18}
              color={Colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>

      {!collapsed && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 16,
  },
  wrapperShrunk: {
    transform: [{ scale: 0.97 }],
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
  collapseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceSecondary,
  },
  reorderControls: {
    flexDirection: "row",
    gap: 6,
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
