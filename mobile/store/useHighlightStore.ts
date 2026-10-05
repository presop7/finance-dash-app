import { create } from "zustand";

// "Show me where": something (a floating tip) asks a screen to bring one of
// its options into view and flash it. The screen that owns that option
// watches for its target and clears it once shown.
export type HighlightTarget = "notifications";

export const useHighlightStore = create<{
  target: HighlightTarget | null;
  highlight: (target: HighlightTarget) => void;
  clear: () => void;
}>((set) => ({
  target: null,
  highlight: (target) => set({ target }),
  clear: () => set({ target: null }),
}));
