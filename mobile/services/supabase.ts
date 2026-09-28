import "react-native-url-polyfill/auto";
import { AppState, Platform } from "react-native";
import { sessionStorage } from "./secureSessionStorage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: sessionStorage(),
    autoRefreshToken: true,
    persistSession: true,
    // PKCE: the sign-in redirect carries a one-time code that only this app
    // (holding the matching secret verifier) can exchange for a session — so
    // another app registering the same link scheme can't hijack a login.
    flowType: "pkce",
    // On web, Google redirects back to the page itself with ?code=…, which
    // supabase-js exchanges on load. Native apps receive the code through
    // the in-app browser instead (see signInWithGoogle).
    detectSessionInUrl: Platform.OS === "web",
  },
});

// Supabase's token auto-refresh timer only runs while the app is in the
// foreground — this pauses/resumes it as the app backgrounds/foregrounds.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
