import { ReactNode, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";

const HOLD_TO_REORDER_MS = 300;

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
  const holdAnim = useRef(new Animated.Value(0)).current;

  const startHoldAnim = () => {
    holdAnim.setValue(0);
    Animated.timing(holdAnim, {
      toValue: 1,
      duration: HOLD_TO_REORDER_MS,
      useNativeDriver: false,
    }).start();
  };

  const cancelHoldAnim = () => {
    Animated.timing(holdAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };

  const fillWidth = holdAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={[styles.wrapper, reorderMode && styles.wrapperShrunk]}>
      <View style={styles.header}>
        {/* Grip — hold for a beat to enter reorder mode */}
        <Pressable
          style={styles.grip}
          disabled={reorderMode}
          delayLongPress={HOLD_TO_REORDER_MS}
          onPressIn={startHoldAnim}
          onPressOut={cancelHoldAnim}
          onLongPress={() => {
            cancelHoldAnim();
            onHoldComplete?.();
          }}
        >
          <Animated.View style={[styles.holdFill, { width: fillWidth }]} />
          <Ionicons
            name="reorder-three-outline"
            size={18}
            color={Colors.textMuted}
          />
          <View>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        </Pressable>

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
  holdFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.primary + "22",
    borderRadius: 8,
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
