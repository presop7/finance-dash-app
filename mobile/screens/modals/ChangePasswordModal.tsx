import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Modal from "../../components/AppModal";
import { ColorsType } from "../../constants/colors";
import { FIELD_INPUT } from "../../constants/styles";
import { useThemeColors, getThemedStyles } from "../../hooks/useThemeColors";
import { useAuthStore } from "../../store/useAuthStore";
import { alertAsync } from "../../utils/confirm";
import { translateAuthError } from "../../utils/authErrors";
import { useTranslation } from "react-i18next";

// Settings -> Account -> Change Password. An email account confirms its
// current password first; a Google-only account has none, so it just sets
// one (and can then also sign in with email + password).
export default function ChangePasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);
  const user = useAuthStore((s) => s.session?.user);
  const changePassword = useAuthStore((s) => s.changePassword);
  const hasPassword = Boolean(user?.app_metadata?.providers?.includes("email") ?? user?.app_metadata?.provider === "email");

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setCurrent("");
    setNext("");
    setRepeat("");
    setError(null);
    onClose();
  };

  const canSave = (!hasPassword || current.length > 0) && next.length >= 6 && repeat.length > 0 && !busy;

  const save = async () => {
    if (next !== repeat) {
      setError(t("password.mismatch"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await changePassword(hasPassword ? current : null, next);
      close();
      await alertAsync(t("password.changed"), t("password.changedInfo"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Here the only credential checked is the current password.
      setError(message === "Invalid login credentials" ? t("password.wrongCurrent") : translateAuthError(message, t));
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, value: string, onChange: (v: string) => void, autoComplete: "current-password" | "new-password") => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        secureTextEntry
        autoCapitalize="none"
        autoComplete={autoComplete}
        placeholder={autoComplete === "new-password" ? t("auth.passwordPlaceholder") : undefined}
        placeholderTextColor={Colors.textMuted}
      />
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={styles.dialog}>
          <Text style={styles.title}>{hasPassword ? t("settings.changePassword") : t("settings.setPassword")}</Text>
          {hasPassword && field(t("password.current"), current, setCurrent, "current-password")}
          {field(t("auth.newPassword"), next, setNext, "new-password")}
          {field(t("password.repeat"), repeat, setRepeat, "new-password")}
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity
            style={[styles.button, !canSave && styles.buttonDisabled]}
            onPress={save}
            disabled={!canSave}
            activeOpacity={0.8}
          >
            {busy ? <ActivityIndicator color={Colors.surface} /> : <Text style={styles.buttonText}>{t("common.save")}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancel} onPress={close}>
            <Text style={styles.cancelText}>{t("common.cancel")}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.5)" },
    dialog: { width: "100%", maxWidth: 380, backgroundColor: Colors.surface, borderRadius: 16, padding: 20 },
    title: { fontSize: 18, fontWeight: "700", color: Colors.textPrimary, marginBottom: 16 },
    field: { marginBottom: 12 },
    label: {
      fontSize: 11,
      fontWeight: "500",
      color: Colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginBottom: 6,
    },
    input: {
      ...FIELD_INPUT,
      flex: 0,
      paddingHorizontal: 12,
      color: Colors.textPrimary,
      backgroundColor: Colors.surfaceSecondary,
      borderWidth: 0.5,
      borderColor: Colors.border,
      borderRadius: 10,
    },
    error: { color: Colors.expense, fontSize: 13, marginBottom: 8 },
    button: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 13, alignItems: "center", marginTop: 4 },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: Colors.surface, fontSize: 15, fontWeight: "600" },
    cancel: { paddingVertical: 12, alignItems: "center" },
    cancelText: { fontSize: 15, color: Colors.textSecondary },
  });
}
