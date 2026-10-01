import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
  Image,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ColorsType } from "../constants/colors";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";
import { useAuthStore } from "../store/useAuthStore";
import { useTranslation } from "react-i18next";
import { translateAuthError } from "../utils/authErrors";
import { FONT } from "../constants/typography";

type Mode = "sign-in" | "sign-up" | "reset";

const APP_ICON = require("../assets/icon.png");

// Below this, a full-width form reads fine on a phone. At or above it
// (iPad portrait and up), a full-width form looks stretched — narrow it.
const WIDE_SCREEN_BREAKPOINT = 768;

export default function AuthScreen() {
  const { signIn, signUp, signInWithGoogle, error, clearError } = useAuthStore();
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);
  const { width } = useWindowDimensions();
  const isWideScreen = width >= WIDE_SCREEN_BREAKPOINT;
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signedUpEmail, setSignedUpEmail] = useState<string | null>(null);
  // Landed here from an email link (signup confirmation, or a web Google
  // return) opened in a different browser/app than the one that started it —
  // common on iPhone, where the installed web app and Safari keep separate
  // storage, so the session this link may have set up elsewhere isn't here.
  // The confirmation itself already happened server-side regardless, so this
  // just points the user at the sign-in form instead of leaving them looking
  // at a plain, unexplained sign-in screen.
  const [confirmedFromEmail, setConfirmedFromEmail] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!new URLSearchParams(window.location.search).has("code")) return;
    setConfirmedFromEmail(true);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);


  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateAnim = useRef(new Animated.Value(0)).current;

  const canSubmit =
    email.trim().length > 0 &&
    password.length >= 6 &&
    (mode === "sign-in" || displayName.trim().length > 0) &&
    !submitting;

  // Fades/slides the swappable content out, applies the state change, then back in —
  // gives the user visible feedback that the screen actually switched modes.
  const animateSwap = (update: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(translateAnim, { toValue: -8, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      update();
      translateAnim.setValue(8);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(translateAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    clearError();
    try {
      if (mode === "sign-in") {
        await signIn(email.trim(), password);
      } else {
        const hasSession = await signUp(email.trim(), password, displayName.trim());
        if (!hasSession) {
          animateSwap(() => setSignedUpEmail(email.trim()));
        }
      }
    } catch {
      // error is surfaced via the store's `error` field
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch {
      // error is surfaced via the store's `error` field
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (next: Mode) => {
    animateSwap(() => {
      setMode(next);
      setSignedUpEmail(null);
      clearError();
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      // android.softwareKeyboardLayoutMode isn't set in app.json, so Android
      // has no native window-resize to lean on here — "height" drives the
      // push-up directly instead of assuming one exists.
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandSection}>
          <Image source={APP_ICON} style={styles.logo} accessibilityIgnoresInvertColors />
          <Text style={styles.brandTitle}>Fi-Track</Text>
        </View>

        <View style={[styles.formSection, isWideScreen && styles.formSectionWide]}>
          <Animated.View
            style={{ opacity: fadeAnim, transform: [{ translateY: translateAnim }] }}
          >
            {mode === "reset" ? (
              <ResetPassword
                styles={styles}
                Colors={Colors}
                initialEmail={email}
                onBack={() => switchMode("sign-in")}
              />
            ) : (
            <>
            <Text style={styles.modeHeading}>
              {signedUpEmail ? t("auth.almostThere") : mode === "sign-in" ? t("auth.signIn") : t("auth.signUp")}
            </Text>
            <Text style={styles.subtitle}>
              {signedUpEmail
                ? t("auth.oneMoreStep")
                : mode === "sign-in"
                  ? t("auth.signInSubtitle")
                  : t("auth.signUpSubtitle")}
            </Text>

            {signedUpEmail ? (
              <View style={styles.confirmBox}>
                <Ionicons name="mail-outline" size={22} color={Colors.income} />
                <Text style={styles.confirmText}>
                  {t("auth.checkEmail", { email: signedUpEmail })}
                </Text>
                <TouchableOpacity onPress={() => switchMode("sign-in")}>
                  <Text style={styles.switchLink}>{t("auth.backToSignIn")}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {confirmedFromEmail && (
                  <View style={styles.confirmBox}>
                    <Ionicons name="checkmark-circle-outline" size={22} color={Colors.income} />
                    <Text style={styles.confirmText}>{t("auth.confirmedFromEmail")}</Text>
                  </View>
                )}

                {mode === "sign-up" && (
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>{t("auth.nameLabel")}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={t("auth.namePlaceholder")}
                      placeholderTextColor={Colors.textMuted}
                      value={displayName}
                      onChangeText={setDisplayName}
                      autoCapitalize="words"
                      autoComplete="given-name"
                      maxLength={40}
                    />
                  </View>
                )}

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t("auth.email")}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    placeholderTextColor={Colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t("auth.password")}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t("auth.passwordPlaceholder")}
                    placeholderTextColor={Colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                  />
                </View>

                {mode === "sign-in" && (
                  <TouchableOpacity
                    style={styles.forgotLink}
                    onPress={() => switchMode("reset")}
                    hitSlop={8}
                  >
                    <Text style={styles.switchLink}>{t("auth.forgotPassword")}</Text>
                  </TouchableOpacity>
                )}

                {error && <Text style={styles.errorText}>{translateAuthError(error, t)}</Text>}

                <TouchableOpacity
                  style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={!canSubmit}
                  activeOpacity={0.8}
                >
                  {submitting ? (
                    <ActivityIndicator color={Colors.surface} />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {mode === "sign-in" ? t("auth.signIn") : t("auth.signUp")}
                    </Text>
                  )}
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>{t("auth.or")}</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  style={styles.googleButton}
                  onPress={handleGoogle}
                  disabled={submitting}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-google" size={18} color={Colors.textPrimary} />
                  <Text style={styles.googleButtonText}>{t("auth.google")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => switchMode(mode === "sign-in" ? "sign-up" : "sign-in")}
                >
                  <Text style={styles.switchLink}>
                    {mode === "sign-in" ? t("auth.toSignUp") : t("auth.toSignIn")}
                  </Text>
                </TouchableOpacity>
              </>
            )}
            </>
            )}
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// "Forgot password?": asks for the email, sends a one-time code, then takes
// the code and a new password. A correct code signs the user straight in
// (proof the inbox is theirs) with the new password set.
function ResetPassword({
  styles,
  Colors,
  initialEmail,
  onBack,
}: {
  styles: ReturnType<typeof createStyles>;
  Colors: ColorsType;
  initialEmail: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { requestPasswordReset, resetPasswordWithCode } = useAuthStore();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(translateAuthError(err instanceof Error ? err.message : String(err), t));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      await requestPasswordReset(email.trim());
      setStep("code");
    });
  // On success the user is signed in and this screen goes away.
  const setPassword = () => run(() => resetPasswordWithCode(email.trim(), code.trim(), newPassword));

  const canSend = email.trim().length > 0 && !busy;
  const canSet = code.trim().length >= 6 && newPassword.length >= 6 && !busy;

  return (
    <>
      <Text style={styles.modeHeading}>{t("auth.resetTitle")}</Text>
      <Text style={styles.subtitle}>
        {step === "email" ? t("auth.resetSubtitle") : t("auth.codeSent", { email: email.trim() })}
      </Text>

      {step === "email" ? (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t("auth.email")}</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
        </View>
      ) : (
        <>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t("auth.codeLabel")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("auth.codePlaceholder")}
              placeholderTextColor={Colors.textMuted}
              value={code}
              onChangeText={(text) => setCode(text.replace(/\D/g, ""))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={10}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t("auth.newPassword")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("auth.passwordPlaceholder")}
              placeholderTextColor={Colors.textMuted}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
            />
          </View>
        </>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        style={[styles.submitButton, !(step === "email" ? canSend : canSet) && styles.submitButtonDisabled]}
        onPress={step === "email" ? sendCode : setPassword}
        disabled={!(step === "email" ? canSend : canSet)}
        activeOpacity={0.8}
      >
        {busy ? (
          <ActivityIndicator color={Colors.surface} />
        ) : (
          <Text style={styles.submitButtonText}>
            {step === "email" ? t("auth.sendCode") : t("auth.setNewPassword")}
          </Text>
        )}
      </TouchableOpacity>

      {step === "code" && (
        <TouchableOpacity onPress={sendCode} disabled={busy} style={styles.resendLink}>
          <Text style={styles.switchLink}>{t("auth.resendCode")}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={onBack} style={styles.resendLink}>
        <Text style={styles.switchLink}>{t("auth.backToSignIn")}</Text>
      </TouchableOpacity>
    </>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  // Sized to its content (not flexed to half the screen — that pushed
  // everything below the fold on a form with this many fields) with a
  // modest, fixed clearance from the status bar.
  brandSection: {
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 20,
  },
  // Inset from the edges so it clears Android's side/bottom gesture zones
  // and stays reachable with one thumb.
  formSection: {
    paddingHorizontal: 28,
    paddingBottom: 32,
  },
  formSectionWide: {
    width: "60%",
    alignSelf: "center",
  },
  // The app's own icon, with the same rounded-square look as on the home screen.
  logo: {
    alignSelf: "center",
    width: 80,
    height: 80,
    borderRadius: 18,
    marginBottom: 12,
  },
  brandTitle: {
    fontSize: FONT.display,
    fontWeight: "600",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  modeHeading: {
    fontSize: FONT.heading,
    fontWeight: "800",
    color: Colors.primary,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  subtitle: {
    fontSize: FONT.small,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 22,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: FONT.label,
    fontWeight: "500",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  input: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: FONT.field,
    color: Colors.textPrimary,
    backgroundColor: Colors.surfaceSecondary,
  },
  errorText: {
    color: Colors.expense,
    fontSize: FONT.small,
    marginBottom: 12,
    textAlign: "center",
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: Colors.surface,
    fontSize: FONT.body,
    fontWeight: "600",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: FONT.label,
    color: Colors.textMuted,
    textTransform: "uppercase",
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingVertical: 13,
    backgroundColor: Colors.surfaceSecondary,
    marginBottom: 20,
  },
  googleButtonText: {
    color: Colors.textPrimary,
    fontSize: FONT.body,
    fontWeight: "600",
  },
  resendLink: {
    marginTop: 16,
  },
  forgotLink: {
    alignSelf: "flex-end",
    marginTop: -6,
    marginBottom: 14,
  },
  switchLink: {
    color: Colors.primary,
    fontSize: FONT.body,
    textAlign: "center",
    fontWeight: "500",
  },
  confirmBox: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 24,
  },
  confirmText: {
    fontSize: FONT.small,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 19,
  },
  });
}
