import { Pressable, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import Modal from "../../components/AppModal";
import { ColorsType } from "../../constants/colors";
import { useThemeColors, getThemedStyles } from "../../hooks/useThemeColors";
import { useFinanceStore, TipId } from "../../store/useFinanceStore";
import { useTranslation } from "react-i18next";
import { FONT } from "../../constants/typography";
import FieldIcon from "../../components/FieldIcon";

// Settings → Floating tips: which of the tips that pop up over the app (see
// FloatingTips) may show on this device.
const TIPS: { id: TipId; icon: "download-outline" | "notifications-outline" }[] = [
  { id: "install", icon: "download-outline" },
  { id: "notifications", icon: "notifications-outline" },
];

export default function TipsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);
  const tips = useFinanceStore((s) => s.tips);
  const setTipEnabled = useFinanceStore((s) => s.setTipEnabled);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.dialog}>
          <Text style={styles.title}>{t("tips.title")}</Text>
          <Text style={styles.intro}>{t("tips.intro")}</Text>
          {TIPS.map(({ id, icon }) => (
            <View key={id} style={styles.row}>
              <FieldIcon name={icon} color={Colors.primary} />
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>{t(`tips.${id}`)}</Text>
                <Text style={styles.rowSubtitle}>{t(`tips.${id}Hint`)}</Text>
              </View>
              <Switch
                value={tips[id]}
                onValueChange={(on) => setTipEnabled(id, on)}
                trackColor={{ false: Colors.border, true: Colors.primary }}
              />
            </View>
          ))}
          <TouchableOpacity style={styles.button} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.buttonText}>{t("common.done")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.5)" },
    dialog: { width: "100%", maxWidth: 380, backgroundColor: Colors.surface, borderRadius: 16, padding: 20 },
    title: { fontSize: FONT.title, fontWeight: "700", color: Colors.textPrimary, marginBottom: 6 },
    intro: { fontSize: FONT.small, color: Colors.textMuted, marginBottom: 12 },
    row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
    rowInfo: { flex: 1 },
    rowTitle: { fontSize: FONT.body, fontWeight: "500", color: Colors.textPrimary },
    rowSubtitle: { fontSize: FONT.small, color: Colors.textMuted, marginTop: 2 },
    button: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 13, alignItems: "center", marginTop: 12 },
    buttonText: { color: Colors.surface, fontSize: FONT.body, fontWeight: "600" },
  });
}
