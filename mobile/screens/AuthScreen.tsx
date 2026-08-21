import { useRef, useState } from "react";
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
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { useAuthStore } from "../store/useAuthStore";

type Mode = "sign-in" | "sign-up";

// Below this, a full-width form reads fine on a phone. At or above it
// (iPad portrait and up), a full-width form looks stretched — narrow it.
const WIDE_SCREEN_BREAKPOINT = 768;

export default function AuthScreen() {
  const { signIn, signUp, error, clearError } = useAuthStore();
  const { width } = useWindowDimensions();
  const isWideScreen = width >= WIDE_SCREEN_BREAKPOINT;
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signedUpEmail, setSignedUpEmail] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateAnim = useRef(new Animated.Value(0)).current;

  const canSubmit = email.trim().length > 0 && password.length >= 6 && !submitting;

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
        const hasSession = await signUp(email.trim(), password);
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
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandSection}>
          <View style={styles.logo}>
            <Ionicons name="wallet" size={54} color={Colors.primary} />
          </View>
          <Text style={styles.brandTitle}>Finance Dash</Text>
        </View>

        <View style={[styles.formSection, isWideScreen && styles.formSectionWide]}>
          <Animated.View
            style={{ opacity: fadeAnim, transform: [{ translateY: translateAnim }] }}
          >
            <Text style={styles.modeHeading}>
              {signedUpEmail ? "Almost there" : mode === "sign-in" ? "Sign In" : "Sign Up"}
            </Text>
            <Text style={styles.subtitle}>
              {signedUpEmail
                ? "One more step to activate your account"
                : mode === "sign-in"
                  ? "Sign in to your account"
                  : "Create a new account"}
            </Text>

            {signedUpEmail ? (
              <View style={styles.confirmBox}>
                <Ionicons name="mail-outline" size={22} color={Colors.income} />
                <Text style={styles.confirmText}>
                  Check {signedUpEmail} for a confirmation link, then sign in below.
                </Text>
                <TouchableOpacity onPress={() => switchMode("sign-in")}>
                  <Text style={styles.switchLink}>Back to sign in</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Email</Text>
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
                  <Text style={styles.fieldLabel}>Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="At least 6 characters"
                    placeholderTextColor={Colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                  />
                </View>

                {error && <Text style={styles.errorText}>{error}</Text>}

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
                      {mode === "sign-in" ? "Sign In" : "Sign Up"}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => switchMode(mode === "sign-in" ? "sign-up" : "sign-in")}
                >
                  <Text style={styles.switchLink}>
                    {mode === "sign-in"
                      ? "Don't have an account? Sign up"
                      : "Already have an account? Sign in"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: "100%",
  },
  // Centered within the upper half, above the form below the midline.
  brandSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 20,
  },
  // Top-anchored within the lower half — the interactive content lives
  // below center, inset from the edges so it clears Android's side/bottom
  // gesture zones and stays reachable with one thumb.
  formSection: {
    flex: 1,
    justifyContent: "flex-start",
    paddingTop: 20,
    paddingHorizontal: 28,
    paddingBottom: 56,
  },
  formSectionWide: {
    width: "60%",
    alignSelf: "center",
  },
  logo: {
    alignSelf: "center",
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: "600",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  modeHeading: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.primary,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 32,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 11,
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
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: Colors.surfaceSecondary,
  },
  errorText: {
    color: Colors.expense,
    fontSize: 12,
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
    fontSize: 15,
    fontWeight: "600",
  },
  switchLink: {
    color: Colors.primary,
    fontSize: 13,
    textAlign: "center",
    fontWeight: "500",
  },
  confirmBox: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 24,
  },
  confirmText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 19,
  },
});
