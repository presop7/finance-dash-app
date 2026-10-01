import { Platform } from "react-native";
import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../services/supabase";

type AuthStore = {
  session: Session | null;
  initializing: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  /** Returns true if sign-up produced an immediate session (email confirmation disabled). */
  signUp: (email: string, password: string, displayName: string) => Promise<boolean>;
  setDisplayName: (displayName: string) => Promise<void>;
  /** Emails a one-time code for resetting a forgotten password. */
  requestPasswordReset: (email: string) => Promise<void>;
  /** Signs in with the emailed code, then sets the new password. */
  resetPasswordWithCode: (email: string, code: string, newPassword: string) => Promise<void>;
  /**
   * Signed in: sets a new password. `currentPassword` is checked first when
   * the account has one (email sign-up); a Google-only account just sets one.
   */
  changePassword: (currentPassword: string | null, newPassword: string) => Promise<void>;
  /** Returns true once signed in; false if the user closed the Google window. */
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

export const useAuthStore = create<AuthStore>((set, get) => {
  supabase.auth.getSession().then(({ data }) => {
    set({ session: data.session, initializing: false });
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    set({ session });
  });

  return {
    session: null,
    initializing: true,
    error: null,

    signIn: async (email, password) => {
      set({ error: null });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        set({ error: error.message });
        throw error;
      }
    },

    signUp: async (email, password, displayName) => {
      set({ error: null });
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        // Saved on the account; the backend also copies it into users.display_name.
        options: { data: { display_name: displayName } },
      });
      if (error) {
        set({ error: error.message });
        throw error;
      }
      return data.session !== null;
    },

    signInWithGoogle: async () => {
      set({ error: null });
      const fail = (message: string) => {
        set({ error: message });
        throw new Error(message);
      };

      if (Platform.OS === "web") {
        // Full-page redirect to Google and back; supabase-js picks the code
        // up from the URL on return (detectSessionInUrl).
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: window.location.origin },
        });
        if (error) fail(error.message);
        return false;
      }

      // Loaded on tap, not at import: a dev client built before these native
      // modules were added would otherwise crash at launch.
      let Linking: typeof import("expo-linking");
      let WebBrowser: typeof import("expo-web-browser");
      try {
        [Linking, WebBrowser] = await Promise.all([
          import("expo-linking"),
          import("expo-web-browser"),
        ]);
      } catch {
        return fail("Google sign-in needs an app update");
      }

      const redirectTo = Linking.createURL("auth-callback");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data.url) return fail(error?.message ?? "Couldn't start Google sign-in");

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== "success") return false; // closed / cancelled by the user

      const params = new URL(result.url).searchParams;
      const code = params.get("code");
      if (!code) return fail(params.get("error_description") ?? "Google sign-in failed");

      // Stores the session; onAuthStateChange above then updates `session`.
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) fail(exchangeError.message);
      return true;
    },

    setDisplayName: async (displayName) => {
      // Stored on the Supabase account (not the device), so it follows the
      // user everywhere; onAuthStateChange delivers the updated session.
      const { error } = await supabase.auth.updateUser({ data: { display_name: displayName } });
      if (error) throw error;
    },

    // A code, not a link: a reset link on iPhone opens in Safari rather than
    // the installed web app, and with PKCE it can only finish in the browser
    // that asked for it — so it would fail there. Typing the code back into
    // the app works the same everywhere. Needs the Supabase "Reset password"
    // email template to show {{ .Token }}.
    requestPasswordReset: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
    },

    resetPasswordWithCode: async (email, code, newPassword) => {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
      if (error) throw error;
      // Now signed in (the code proved the inbox is theirs) — set the password.
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
    },

    changePassword: async (currentPassword, newPassword) => {
      const email = get().session?.user.email;
      if (currentPassword !== null && email) {
        // Supabase doesn't ask for the old password itself; signing in with
        // it is the check (and refreshes the session, harmlessly).
        const { error } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
        if (error) throw error;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },

    signOut: async () => {
      await supabase.auth.signOut();
    },

    clearError: () => set({ error: null }),
  };
});
