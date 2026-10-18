import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

// The "What's new" sheet: open or not, and the last version it was shown
// for on this device.
type WhatsNewStore = {
  open: boolean;
  seenVersion: string | null;
  hydrated: boolean; // the saved version has been read back
  setOpen: (open: boolean) => void;
  markSeen: (version: string) => void;
};

export const useWhatsNewStore = create<WhatsNewStore>()(
  persist(
    (set) => ({
      open: false,
      seenVersion: null,
      hydrated: false,
      setOpen: (open) => set({ open }),
      markSeen: (version) => set({ seenVersion: version }),
    }),
    {
      name: "fi-track-whats-new",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ seenVersion }) => ({ seenVersion }),
      onRehydrateStorage: () => () => useWhatsNewStore.setState({ hydrated: true }),
    },
  ),
);
