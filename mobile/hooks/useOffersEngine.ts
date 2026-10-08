import { useEffect } from "react";
import { AppState } from "react-native";
import { useFinanceStore } from "../store/useFinanceStore";
import { planStatus, usePremiumStore } from "../store/usePremiumStore";
import { loggingStreak, nextOffer } from "../utils/offers";
import { isDemoId } from "../utils/demoTransactions";

// Decides, on each app open (and as Premium features are used), whether to
// show the trial-end screen or an offer tip — see utils/offers for the rules.
// `adding`: the new-transaction form is open (never interrupt that).
export function useOffersEngine(adding: boolean) {
  const premiumUses = usePremiumStore((s) => s.premiumUses);
  const status = useFinanceStore((s) => s.status);
  const plan = useFinanceStore((s) => s.plan);

  useEffect(() => {
    const evaluate = () => {
      const store = usePremiumStore.getState();
      const finance = useFinanceStore.getState();
      if (finance.status !== "loaded" && finance.status !== "refreshing") return;
      const now = new Date();
      store.recordUseDay(now);
      const s = planStatus(finance.plan, now.getTime());

      // Once, at the first open after the trial: what it gave, what goes,
      // and the 1-hour offer.
      if (s.trialEnded && !store.trialEndSeen) {
        store.startTrialEndOffer();
        return;
      }
      if (store.offer) return;
      const real = finance.transactions.filter((t) => !isDemoId(t.id));
      const dates = real.map((t) => new Date(t.date));
      const first = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
      const pick = nextOffer(store, {
        now,
        paid: s.paid,
        inTrial: s.inTrial,
        trialEndsAt: finance.plan.trialEndsAt,
        transactionCount: real.length,
        firstTransactionDate: first,
        streak: loggingStreak(dates, now),
        lastAddedAt: finance.lastAddedAt,
        adding,
      });
      if (pick) store.applyOffer(pick.kind, pick.patch);
    };
    evaluate();
    const sub = AppState.addEventListener("change", (state) => state === "active" && evaluate());
    return () => sub.remove();
  }, [premiumUses, status, plan, adding]);
}
