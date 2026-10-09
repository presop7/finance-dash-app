import { ReactNode } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ColorsType } from "../constants/colors";
import { FONT } from "../constants/typography";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";
import { PremiumReason, usePremiumStore } from "../store/usePremiumStore";
import { useTranslation } from "react-i18next";

// Stands in for a Premium-only part of a screen (a chart, a report section):
// what it is, and a button to the Premium screen. With `children` (e.g. the
// real chart), they show blurred and untouchable behind it, as a hint.
export default function PremiumLock({ reason, text, children }: { reason: PremiumReason; text: string; children?: ReactNode }) {
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);
  const lock = (
    <View style={[styles.box, children ? styles.overlay : null]}>
      <Ionicons name="lock-closed-outline" size={22} color={Colors.primary} />
      <Text style={styles.text}>{text}</Text>
      <TouchableOpacity style={styles.button} onPress={() => usePremiumStore.getState().showPremium(reason)}>
        <Ionicons name="diamond-outline" size={14} color="#fff" />
        <Text style={styles.buttonText}>{t("premium.unlock")}</Text>
      </TouchableOpacity>
    </View>
  );
  if (!children) return lock;
  return (
    <View>
      <View style={styles.preview} pointerEvents="none" aria-hidden>
        {children}
      </View>
      {lock}
    </View>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    box: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 28, paddingHorizontal: 16 },
    overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.surface + "66" },
    // Blur: Android and web (the iPhone version is the web one); faded too.
    preview: { filter: "blur(8px)", opacity: 0.55 },
    text: { fontSize: FONT.body, color: Colors.textSecondary, textAlign: "center" },
    button: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 20,
      backgroundColor: Colors.primary,
    },
    buttonText: { fontSize: FONT.small, fontWeight: "600", color: "#fff" },
  });
}
