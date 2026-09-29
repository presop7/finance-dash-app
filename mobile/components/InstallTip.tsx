import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ColorsType } from "../constants/colors";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";
import { isAppleMobileWeb, isPhoneBrowserTab } from "../utils/webPlatform";
import { useTranslation } from "react-i18next";

const DISMISSED_KEY = "fitrack.installTipDismissed";

// Remembered per browser; storage can be unavailable (private mode) — then
// the tip just shows again next time, which is harmless.
const wasDismissed = () => {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
};

// Web version opened in a phone's browser tab: suggests installing it to the
// home screen, where it opens full screen like an app. Never shown in the
// phone apps, the installed home-screen app, or on a computer.
export default function InstallTip() {
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(() => isPhoneBrowserTab && !wasDismissed());
  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
  };

  return (
    <View style={[styles.tip, { top: insets.top + 8 }]}>
      <Ionicons name="download-outline" size={20} color={Colors.primary} />
      <Text style={styles.text}>
        <Text style={styles.bold}>{t("installTip.title")} </Text>
        {isAppleMobileWeb
          ? t("installTip.iphone")
          : t("installTip.android")}
      </Text>
      <TouchableOpacity onPress={dismiss} hitSlop={10} accessibilityLabel={t("common.close")}>
        <Ionicons name="close" size={18} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    tip: {
      position: "absolute",
      left: 12,
      right: 12,
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
    text: { flex: 1, fontSize: 13, lineHeight: 18, color: Colors.textSecondary },
    bold: { fontWeight: "700", color: Colors.textPrimary },
  });
}
