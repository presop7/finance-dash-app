import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

// The monthly report screen: open or not, and the month whose "your report
// is ready" tip was already seen (kept, so it comes once a month).
type ReportStore = {
  open: boolean;
  tipMonth: string | null;
  setOpen: (open: boolean) => void;
  setTipMonth: (month: string) => void;
};

export const useReportStore = create<ReportStore>()(
  persist(
    (set) => ({
      open: false,
      tipMonth: null,
      setOpen: (open) => set({ open }),
      setTipMonth: (month) => set({ tipMonth: month }),
    }),
    {
      name: "fi-track-report",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ tipMonth }) => ({ tipMonth }),
    },
  ),
);
