import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../services/supabase";

type AuthStore = {
  session: Session | null;
  initializing: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  /** Returns true if sign-up produced an immediate session (email confirmation disabled). */
  signUp: (email: string, password: string) => Promise<boolean>;
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

    signUp: async (email, password) => {
      set({ error: null });
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        set({ error: error.message });
        throw error;
      }
      return data.session !== null;
    },

    signOut: async () => {
      await supabase.auth.signOut();
    },

    clearError: () => set({ error: null }),
  };
});
