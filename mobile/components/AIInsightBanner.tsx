import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";

type AIInsightBannerProps = {
  message: string;
  onPress?: () => void;
};

export default function AIInsightBanner({
  message,
  onPress,
}: AIInsightBannerProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Icon */}
      <View style={styles.iconContainer}>
        <Ionicons name="sparkles" size={16} color={Colors.primary} />
      </View>

      {/* Message */}
      <View style={styles.textContainer}>
        <Text style={styles.label}>AI Insight</Text>
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
      </View>

      {/* Arrow */}
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    gap: 10,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#E0E7FF",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.primary,
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  message: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
});
