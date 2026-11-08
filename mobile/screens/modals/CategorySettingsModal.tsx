import { Pressable, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import Modal from "../../components/AppModal";
import { ColorsType } from "../../constants/colors";
import { useThemeColors, getThemedStyles } from "../../hooks/useThemeColors";
import { useFinanceStore } from "../../store/useFinanceStore";
import { useTranslation } from "react-i18next";
import { FONT } from "../../constants/typography";
import FieldIcon from "../../components/FieldIcon";

// Settings → Category settings: how categories and funds behave on this
// device. One row per setting; add more rows here as they come.
export default function CategorySettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);
  const autoOrder = useFinanceStore((s) => s.autoOrderByLastUsed);
  const setAutoOrder = useFinanceStore((s) => s.setAutoOrderByLastUsed);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.dialog}>
          <Text style={styles.title}>{t("categorySettings.title")}</Text>
          <View style={styles.row}>
            <FieldIcon name="time-outline" color={Colors.primary} />
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>{t("categorySettings.autoOrder")}</Text>
              <Text style={styles.rowSubtitle}>{t("categorySettings.autoOrderHint")}</Text>
            </View>
            <Switch
              value={autoOrder}
              onValueChange={setAutoOrder}
              trackColor={{ false: Colors.border, true: Colors.primary }}
            />
          </View>
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
    row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
    rowInfo: { flex: 1 },
    rowTitle: { fontSize: FONT.body, fontWeight: "500", color: Colors.textPrimary },
    rowSubtitle: { fontSize: FONT.small, color: Colors.textMuted, marginTop: 2 },
    button: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 13, alignItems: "center", marginTop: 12 },
    buttonText: { color: Colors.surface, fontSize: FONT.body, fontWeight: "600" },
  });
}
