import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useExitHint } from "../hooks/useBackNavigation";
import { FONT } from "../constants/typography";

// Web's "press back again to exit" — the Android app uses its system toast.
export default function BackExitHint() {
  const visible = useExitHint((s) => s.visible);
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Text style={styles.pill}>{t("app.pressBackAgain")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 96, alignItems: "center" },
  pill: {
    backgroundColor: "rgba(20,20,24,0.9)",
    color: "#fff",
    fontSize: FONT.body,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    overflow: "hidden",
  },
});
