import { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Modal from "../../components/AppModal";
import ModalCloseButton from "../../components/ModalCloseButton";
import { ColorsType } from "../../constants/colors";
import { CONTENT_MAX_WIDTH } from "../../constants/layout";
import { FONT } from "../../constants/typography";
import { WHATS_NEW, WHATS_NEW_VERSION } from "../../constants/whatsNew";
import { useThemeColors, getThemedStyles } from "../../hooks/useThemeColors";
import { useFinanceStore } from "../../store/useFinanceStore";
import { useTutorialStore } from "../../store/useTutorialStore";
import { useWhatsNewStore } from "../../store/useWhatsNewStore";
import { isDemoId } from "../../utils/demoTransactions";
import { useTranslation } from "react-i18next";

// "What's new": after an update, once per device, when the app has loaded
// (never over the tour). Accounts with nothing in them yet skip it —
// everything is new to them. Also opened from Settings → About.
export default function WhatsNewModal({ blocked = false }: { blocked?: boolean }) {
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);
  const insets = useSafeAreaInsets();
  const { open, seenVersion, hydrated, setOpen, markSeen } = useWhatsNewStore();
  const status = useFinanceStore((s) => s.status);
  const touring = useTutorialStore((s) => s.active);

  useEffect(() => {
    if (!hydrated || status !== "loaded" || touring || blocked || seenVersion === WHATS_NEW_VERSION) return;
    markSeen(WHATS_NEW_VERSION);
    const hasData = useFinanceStore.getState().transactions.some((tx) => !isDemoId(tx.id));
    if (hasData) setOpen(true);
  }, [hydrated, status, touring, blocked, seenVersion, markSeen, setOpen]);

  const close = () => setOpen(false);
  const section = (title: string, items: typeof WHATS_NEW.new) => (
    <>
      <Text style={styles.section}>{title}</Text>
      {items.map((item) => (
        <View key={item.key} style={styles.item}>
          <View style={styles.icon}>
            <Ionicons name={item.icon} size={18} color={Colors.primary} />
          </View>
          <View style={styles.itemText}>
            <Text style={styles.itemTitle}>{t(`whatsNew.items.${item.key}.title`)}</Text>
            <Text style={styles.itemBody}>{t(`whatsNew.items.${item.key}.text`)}</Text>
          </View>
        </View>
      ))}
    </>
  );

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.root}>
        <Pressable style={styles.overlay} onPress={close} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          <View style={styles.header}>
            <Ionicons name="gift-outline" size={20} color={Colors.primary} />
            <Text style={styles.title}>{t("whatsNew.title", { version: WHATS_NEW_VERSION })}</Text>
            <ModalCloseButton onPress={close} />
          </View>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {section(t("whatsNew.new"), WHATS_NEW.new)}
            {section(t("whatsNew.fixes"), WHATS_NEW.fixes)}
            <Text style={styles.feedback}>{t("whatsNew.feedback")}</Text>
            <TouchableOpacity style={styles.button} onPress={close}>
              <Text style={styles.buttonText}>{t("whatsNew.gotIt")}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    root: { flex: 1, justifyContent: "flex-end" },
    overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: {
      width: "100%",
      maxWidth: CONTENT_MAX_WIDTH,
      alignSelf: "center",
      maxHeight: "88%",
      backgroundColor: Colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    header: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16 },
    title: { flex: 1, fontSize: FONT.title, fontWeight: "700", color: Colors.textPrimary },
    body: { paddingHorizontal: 16, gap: 10 },
    section: {
      fontSize: FONT.label,
      fontWeight: "600",
      color: Colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginTop: 4,
    },
    item: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
    icon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Colors.primary + "15",
    },
    itemText: { flex: 1, gap: 2 },
    itemTitle: { fontSize: FONT.body, fontWeight: "600", color: Colors.textPrimary },
    itemBody: { fontSize: FONT.small, color: Colors.textSecondary },
    feedback: { fontSize: FONT.small, color: Colors.textMuted, fontStyle: "italic", marginTop: 6 },
    button: { padding: 14, borderRadius: 14, alignItems: "center", backgroundColor: Colors.primary, marginTop: 4, marginBottom: 8 },
    buttonText: { fontSize: FONT.body, fontWeight: "700", color: "#fff" },
  });
}
