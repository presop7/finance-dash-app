import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ColorsType } from "../constants/colors";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";
import { isAppleMobileWeb, isPhoneBrowserTab } from "../utils/webPlatform";
import { useTranslation } from "react-i18next";
import { FONT } from "../constants/typography";

// Android browsers (Chrome, Brave, Samsung Internet, Edge) offer their own
// install prompt to a site that asks for it. The event fires early — often
// before this component mounts — so it's caught here, at import, and kept.
type InstallPromptEvent = Event & { prompt: () => Promise<void> };
let installPrompt: InstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();
if (isPhoneBrowserTab) {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // shown from our tip's button instead
    installPrompt = event as InstallPromptEvent;
    promptListeners.forEach((fn) => fn());
  });
}

// Web version opened in a phone's browser tab: suggests installing it to the
// home screen, where it opens full screen like an app. Shown on every visit
// (closing it hides it until the app is next opened) — never in the phone
// apps, the installed home-screen app, or on a computer.
export default function InstallTip() {
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(isPhoneBrowserTab);
  const [canPrompt, setCanPrompt] = useState(installPrompt !== null);

  useEffect(() => {
    const update = () => setCanPrompt(installPrompt !== null);
    promptListeners.add(update);
    return () => {
      promptListeners.delete(update);
    };
  }, []);

  if (!visible) return null;

  const install = async () => {
    const event = installPrompt;
    if (!event) return;
    installPrompt = null; // a prompt can only be shown once
    setCanPrompt(false);
    await event.prompt().catch(() => {});
  };

  return (
    <View style={[styles.tip, { top: insets.top + 8 }]}>
      <Ionicons name="download-outline" size={20} color={Colors.primary} />
      <Text style={styles.text}>
        <Text style={styles.bold}>{t("installTip.title")} </Text>
        {canPrompt ? t("installTip.oneTap") : isAppleMobileWeb ? t("installTip.iphone") : t("installTip.android")}
      </Text>
      {canPrompt && (
        <TouchableOpacity style={styles.installButton} onPress={install} activeOpacity={0.8}>
          <Text style={styles.installText}>{t("installTip.install")}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={() => setVisible(false)} hitSlop={10} accessibilityLabel={t("common.close")}>
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
    text: { flex: 1, fontSize: FONT.small, lineHeight: 18, color: Colors.textSecondary },
    bold: { fontWeight: "700", color: Colors.textPrimary },
    installButton: {
      backgroundColor: Colors.primary,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    installText: { color: Colors.surface, fontSize: FONT.body, fontWeight: "600" },
  });
}
