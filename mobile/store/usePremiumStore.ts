import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFinanceStore, Plan } from "./useFinanceStore";
import { EMPTY_OFFERS, OfferKind, OfferState, dayKey } from "../utils/offers";
import { OFFER_MS, TRIAL_END_OFFER_MS } from "../constants/plan";

// What a plan means right now: Premium while the trial or a paid period runs.
export function planStatus(plan: Plan, now = Date.now()) {
  const paid = plan.premiumUntil !== null && plan.premiumUntil > now;
  const inTrial = !paid && plan.trialEndsAt !== null && plan.trialEndsAt > now;
  return {
    premium: paid || inTrial,
    paid,
    inTrial,
    trialEnded: !paid && plan.trialEndsAt !== null && plan.trialEndsAt <= now,
  };
}

// Why the Premium screen opened (it says so at the top).
export type PremiumReason =
  | "general"
  | "funds"
  | "goals"
  | "reminders"
  | "charts"
  | "ranges"
  | "csv"
  | "insights"
  | "report"
  | "offer"
  | "tips"
  | "trialEnded";

type PremiumStore = OfferState & {
  modal: PremiumReason | null; // the Premium screen, when open
  openings: number; // counts openings (the screen is re-created each time)
  // The offer the Premium screen was opened for: its prices hold even after
  // the offer tip that opened it is closed (closing it clears `offer`).
  modalOffer: OfferKind | null;
  offer: OfferKind | null; // the offer tip showing now
  reportOpen: boolean; // the monthly report screen
  trialEndSeen: boolean;
  trialEndOfferUntil: number | null; // ms; the 1-hour window after the trial
  // The current milestone/trial offer and when its price ends (15 minutes):
  // kept when its tip or the Premium screen is closed, until it runs out.
  activeOffer: { kind: OfferKind; until: number } | null;
  reportTipMonth: string | null; // the month whose report tip was seen
  setReportTipMonth: (month: string) => void;
  showPremium: (reason?: PremiumReason, offer?: OfferKind | null) => void;
  hidePremium: () => void;
  setReportOpen: (open: boolean) => void;
  recordUseDay: (now: Date) => void;
  recordPremiumUse: () => void;
  applyOffer: (kind: OfferKind, patch: Partial<OfferState>) => void;
  clearOffer: () => void;
  startTrialEndOffer: () => void;
};

export const usePremiumStore = create<PremiumStore>()(
  persist(
    (set, get) => ({
      ...EMPTY_OFFERS,
      modal: null,
      openings: 0,
      modalOffer: null,
      offer: null,
      reportOpen: false,
      trialEndSeen: false,
      trialEndOfferUntil: null,
      activeOffer: null,
      reportTipMonth: null,
      setReportTipMonth: (month) => set({ reportTipMonth: month }),
      showPremium: (reason = "general", offer = null) =>
        set({ modal: reason, modalOffer: offer ?? get().offer, openings: get().openings + 1 }),
      hidePremium: () => set({ modal: null, modalOffer: null }),
      setReportOpen: (open) => set({ reportOpen: open }),
      recordUseDay: (now) => {
        const today = dayKey(now);
        const days = get().usageDays;
        if (days[days.length - 1] !== today) set({ usageDays: [...days.slice(-400), today] });
      },
      // Counted only during the trial: every 2nd use brings an offer.
      recordPremiumUse: () => {
        if (planStatus(useFinanceStore.getState().plan).inTrial) set({ premiumUses: get().premiumUses + 1 });
      },
      applyOffer: (kind, patch) => set({ ...patch, offer: kind, activeOffer: { kind, until: Date.now() + OFFER_MS } }),
      clearOffer: () => set({ offer: null }),
      startTrialEndOffer: () =>
        set({
          trialEndSeen: true,
          trialEndOfferUntil: Date.now() + TRIAL_END_OFFER_MS,
          modal: "trialEnded",
          openings: get().openings + 1,
        }),
    }),
    {
      name: "fi-track-offers",
      storage: createJSONStorage(() => AsyncStorage),
      // Only the offers' memory; open screens and the current tip don't persist.
      partialize: ({ modal: _m, offer: _o, reportOpen: _r, openings: _n, modalOffer: _f, ...rest }) =>
        Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== "function")) as Partial<PremiumStore>,
    },
  ),
);

// The current plan, live (re-renders when it changes).
export function usePlan() {
  return planStatus(useFinanceStore((s) => s.plan));
}

// For a Premium action: true if allowed (and counted as a Premium use);
// otherwise opens the Premium screen and returns false.
export function requirePremium(reason: PremiumReason): boolean {
  if (planStatus(useFinanceStore.getState().plan).premium) {
    usePremiumStore.getState().recordPremiumUse();
    return true;
  }
  usePremiumStore.getState().showPremium(reason);
  return false;
}
