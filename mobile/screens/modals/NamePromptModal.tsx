import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ColorsType } from "../../constants/colors";
import { useThemeColors, getThemedStyles } from "../../hooks/useThemeColors";
import { useAuthStore } from "../../store/useAuthStore";
import { useFinanceStore } from "../../store/useFinanceStore";
import { accountName, nameFromEmail } from "../../utils/greeting";
import { useTranslation } from "react-i18next";

// Shown once to accounts that have no name yet — email sign-ups from before
// the sign-up form asked for one. Google accounts already carry a name, and
// new email sign-ups give one, so neither sees this. Saving stores it on the
// account, which also makes this stop showing (on every device).
export default function NamePromptModal() {
  const user = useAuthStore((s) => s.session?.user);
  const setDisplayName = useAuthStore((s) => s.setDisplayName);
  const localName = useFinanceStore((s) => s.displayNameOverride);
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);

  // Pre-filled with the name the app already uses, so keeping it is one tap.
  const [name, setName] = useState(() => localName || nameFromEmail(user?.email) || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = Boolean(user) && !accountName(user);
  const canSave = name.trim().length > 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await setDisplayName(name.trim());
    } catch {
      setError(t("namePrompt.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    // No close/back dismissal on purpose: the pre-filled name makes saving
    // effortless, and a dismissed prompt would just come back next launch.
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.dialog}>
          <Text style={styles.title}>{t("auth.nameLabel")}</Text>
          <Text style={styles.subtitle}>{t("namePrompt.subtitle")}</Text>

          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t("auth.namePlaceholder")}
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="words"
            autoComplete="given-name"
            maxLength={40}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={save}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, !canSave && styles.buttonDisabled]}
            onPress={save}
            disabled={!canSave}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={Colors.surface} />
            ) : (
              <Text style={styles.buttonText}>{t("common.save")}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 18,
  },
  input: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.surfaceSecondary,
  },
  error: {
    color: Colors.expense,
    fontSize: 12,
    textAlign: "center",
    marginTop: 10,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: Colors.surface,
    fontSize: 15,
    fontWeight: "600",
  },
  });
}
