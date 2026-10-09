import { useEffect } from "react";
import { AppState } from "react-native";
import { useFinanceStore } from "../store/useFinanceStore";
import { planStatus, usePremiumStore } from "../store/usePremiumStore";
import { AFTER_ADD_MS, loggingStreak, nextOffer } from "../utils/offers";
import { isDemoId } from "../utils/demoTransactions";

// Decides, on each app open (and as Premium features are used), whether to
// show the trial-end screen or an offer tip — see utils/offers for the rules.
// `adding`: the new-transaction form is open (never interrupt that).
export function useOffersEngine(adding: boolean) {
  const premiumUses = usePremiumStore((s) => s.premiumUses);
  const serverLoaded = usePremiumStore((s) => s.serverLoaded);
  const status = useFinanceStore((s) => s.status);
  const plan = useFinanceStore((s) => s.plan);
  const offersOn = useFinanceStore((s) => s.tips.offers);
  // A milestone counts the moment it's reached: re-checked as transactions
  // change, and once more right after the 10-second pause that follows adding.
  const transactionCount = useFinanceStore((s) => s.transactions.length);
  const lastAddedAt = useFinanceStore((s) => s.lastAddedAt);

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
      // Once, when the trial is running: it started, and until when (only
      // after the account's memory is in, so other devices don't repeat it).
      if (s.inTrial && store.serverLoaded && !store.trialWelcomeSeen) {
        usePremiumStore.setState({ trialWelcomeSeen: true });
        store.showPremium("trialStarted");
        return;
      }
      if (store.offer || !offersOn) return;
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
    const wait = lastAddedAt === null ? -1 : lastAddedAt + AFTER_ADD_MS - Date.now();
    const timer = wait > 0 ? setTimeout(evaluate, wait + 100) : undefined;
    return () => {
      sub.remove();
      clearTimeout(timer);
    };
  }, [premiumUses, serverLoaded, status, plan, adding, offersOn, transactionCount, lastAddedAt]);
}
