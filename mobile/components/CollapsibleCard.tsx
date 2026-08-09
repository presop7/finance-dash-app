import { ReactNode } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  GestureResponderHandlers,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { GlobalStyles } from "../constants/styles";

type CollapsibleCardProps = {
  title: string;
  subtitle?: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  dragHandlers?: GestureResponderHandlers;
  isDragging?: boolean;
  children: ReactNode;
};

export default function CollapsibleCard({
  title,
  subtitle,
  collapsed,
  onToggleCollapse,
  dragHandlers,
  isDragging,
  children,
}: CollapsibleCardProps) {
  return (
    <View style={[styles.wrapper, isDragging && styles.wrapperDragging]}>
      <View style={styles.header}>
        {/* Grip — holding either the handle icon or the title starts a drag */}
        <View style={styles.grip} {...(dragHandlers ?? {})}>
          <Ionicons
            name="reorder-three-outline"
            size={18}
            color={Colors.textMuted}
          />
          <View>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        </View>

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
      </View>

      {!collapsed && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 16,
  },
  wrapperDragging: {
    ...GlobalStyles.shadow,
    opacity: 0.9,
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
  body: {},
});
