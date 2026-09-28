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
  /** Returns true once signed in; false if the user closed the Google window. */
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

export const useAuthStore = create<AuthStore>((set) => {
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

    signOut: async () => {
      await supabase.auth.signOut();
    },

    clearError: () => set({ error: null }),
  };
});
