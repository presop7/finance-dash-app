import { ComponentProps, ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ColorsType } from "../constants/colors";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";
import { useTranslation } from "react-i18next";
import { FONT } from "../constants/typography";

// One floating tip (see FloatingTips): icon, bold title + text, an optional
// action button, and ✕ to close it until the app is next opened.
export default function TipCard({
  icon,
  title,
  text,
  action,
  onAction,
  onClose,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  text: ReactNode;
  action?: string;
  onAction?: () => void;
  onClose: () => void;
}) {
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);
  return (
    <View style={styles.tip}>
      <Ionicons name={icon} size={20} color={Colors.primary} />
      <Text style={styles.text}>
        <Text style={styles.bold}>{title} </Text>
        {text}
      </Text>
      {action && onAction && (
        <TouchableOpacity style={styles.button} onPress={onAction} activeOpacity={0.8}>
          <Text style={styles.buttonText}>{action}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel={t("common.close")}>
        <Ionicons name="close" size={18} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    tip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: 14,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.primary,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    text: { flex: 1, fontSize: FONT.small, lineHeight: 18, color: Colors.textSecondary },
    bold: { fontWeight: "700", color: Colors.textPrimary },
    button: {
      backgroundColor: Colors.primary,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    buttonText: { color: Colors.surface, fontSize: FONT.body, fontWeight: "600" },
  });
}
