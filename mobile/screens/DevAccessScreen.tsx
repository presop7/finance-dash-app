import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ColorsType } from "../constants/colors";
import { FONT } from "../constants/typography";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";
import { useFinanceStore, mapPlan } from "../store/useFinanceStore";
import { useAuthStore } from "../store/useAuthStore";
import { financeApi } from "../services/financeApi";
import { alertAsync } from "../utils/confirm";
import { currentLocale } from "../i18n";
import { useTranslation } from "react-i18next";

// The Play test version (dev link) for an account that isn't let in yet: ask
// for access (it shows in Supabase's users table as dev_access_requested_at;
// ticking dev_access there lets them in), check again, or sign out.
export default function DevAccessScreen() {
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);
  const plan = useFinanceStore((s) => s.plan);
  const signOut = useAuthStore((s) => s.signOut);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch {
      await alertAsync(t("devAccess.failedTitle"), t("devAccess.failed"));
    } finally {
      setBusy(false);
    }
  };
  const request = () =>
    run(async () => {
      const me = await financeApi.requestDevAccess();
      useFinanceStore.setState({ plan: mapPlan(me) });
    });
  const checkAgain = () => run(() => useFinanceStore.getState().hydrate());

  return (
    <View style={styles.container}>
      <Ionicons name="flask-outline" size={44} color={Colors.primary} />
      <Text style={styles.title}>{t("devAccess.title")}</Text>
      <Text style={styles.text}>{t("devAccess.text")}</Text>
      {plan.devAccessRequestedAt ? (
        <>
          <Text style={styles.requested}>
            {t("devAccess.requested", { date: new Date(plan.devAccessRequestedAt).toLocaleDateString(currentLocale()) })}
          </Text>
          <TouchableOpacity style={styles.primary} onPress={checkAgain} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t("devAccess.checkAgain")}</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity style={styles.primary} onPress={request} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t("devAccess.request")}</Text>}
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.secondary} onPress={() => signOut()}>
        <Text style={styles.secondaryText}>{t("devAccess.signOut")}</Text>
      </TouchableOpacity>
    </View>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      padding: 32,
      backgroundColor: Colors.surface,
    },
    title: { fontSize: FONT.heading, fontWeight: "700", color: Colors.textPrimary, textAlign: "center" },
    text: { fontSize: FONT.body, color: Colors.textSecondary, textAlign: "center", maxWidth: 360 },
    requested: { fontSize: FONT.small, color: Colors.income, textAlign: "center" },
    primary: {
      minWidth: 220,
      alignItems: "center",
      paddingVertical: 13,
      paddingHorizontal: 20,
      borderRadius: 12,
      backgroundColor: Colors.primary,
      marginTop: 6,
    },
    primaryText: { fontSize: FONT.body, fontWeight: "600", color: "#fff" },
    secondary: { paddingVertical: 10 },
    secondaryText: { fontSize: FONT.body, color: Colors.textMuted },
  });
}
