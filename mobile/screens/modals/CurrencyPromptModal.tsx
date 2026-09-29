import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ColorsType } from "../../constants/colors";
import { CURRENCIES } from "../../constants/currencies";
import { useThemeColors, getThemedStyles } from "../../hooks/useThemeColors";
import { useFinanceStore } from "../../store/useFinanceStore";
import { useTutorialStore } from "../../store/useTutorialStore";
import { useTranslation } from "react-i18next";

// Asked once, after the tour, when a new account's currency couldn't be
// worked out from where the phone is (see detectCurrency). Changeable any
// time in Settings.
export default function CurrencyPromptModal() {
  const ask = useTutorialStore((s) => s.askCurrency && !s.active);
  const setAsk = useTutorialStore((s) => s.setAskCurrency);
  const current = useFinanceStore((s) => s.settings.currency);
  const updateSettings = useFinanceStore((s) => s.updateSettings);
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);
  const [picked, setPicked] = useState(current);

  const confirm = () => {
    setAsk(false);
    if (picked !== current) updateSettings({ currency: picked }).catch(() => {});
  };

  return (
    <Modal visible={ask} transparent animationType="fade" onRequestClose={confirm}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{t("currencyPrompt.title")}</Text>
          <Text style={styles.subtitle}>{t("currencyPrompt.subtitle")}</Text>
          <ScrollView style={styles.list}>
            {CURRENCIES.map((c) => (
              <TouchableOpacity
                key={c.code}
                style={[styles.item, c.code === picked && styles.itemActive]}
                onPress={() => setPicked(c.code)}
              >
                <Text style={[styles.itemText, c.code === picked && styles.itemTextActive]}>
                  {c.code} — {t(`currencies.${c.code}`, { defaultValue: c.label })}
                </Text>
                {c.code === picked && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.button} onPress={confirm} activeOpacity={0.8}>
            <Text style={styles.buttonText}>{t("common.done")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: "center",
      padding: 28,
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    dialog: {
      maxHeight: "80%",
      width: "100%",
      maxWidth: 420,
      alignSelf: "center",
      backgroundColor: Colors.surface,
      borderRadius: 16,
      padding: 20,
    },
    title: { fontSize: 18, fontWeight: "700", color: Colors.textPrimary, textAlign: "center" },
    subtitle: {
      fontSize: 13,
      color: Colors.textSecondary,
      textAlign: "center",
      marginTop: 6,
      marginBottom: 14,
    },
    list: { flexGrow: 0 },
    item: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: 10,
    },
    itemActive: { backgroundColor: Colors.primary + "18" },
    itemText: { fontSize: 14, color: Colors.textSecondary },
    itemTextActive: { color: Colors.primary, fontWeight: "600" },
    button: {
      backgroundColor: Colors.primary,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: "center",
      marginTop: 14,
    },
    buttonText: { color: Colors.surface, fontSize: 15, fontWeight: "600" },
  });
}
