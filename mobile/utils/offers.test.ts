/// <reference types="jest" />
// Offer rules. Run: npm test
import { EMPTY_OFFERS, loggingStreak, monthsBetween, nextOffer, OfferContext } from "./offers";

const now = new Date(2026, 9, 20, 12, 0);
const ctx = (over: Partial<OfferContext> = {}): OfferContext => ({
  now,
  paid: false,
  inTrial: false,
  trialEndsAt: null,
  transactionCount: 0,
  firstTransactionDate: null,
  streak: 0,
  lastAddedAt: null,
  adding: false,
  ...over,
});

test("never for paying users, while adding, right after adding, or twice a day", () => {
  const due = ctx({ transactionCount: 20 });
  expect(nextOffer(EMPTY_OFFERS, due)?.kind).toBe("transactions");
  expect(nextOffer(EMPTY_OFFERS, { ...due, paid: true })).toBeNull();
  expect(nextOffer(EMPTY_OFFERS, { ...due, adding: true })).toBeNull();
  expect(nextOffer(EMPTY_OFFERS, { ...due, lastAddedAt: now.getTime() - 5_000 })).toBeNull();
  expect(nextOffer(EMPTY_OFFERS, { ...due, lastAddedAt: now.getTime() - 11_000 })?.kind).toBe("transactions");
  expect(nextOffer({ ...EMPTY_OFFERS, lastOfferDay: "2026-10-20" }, due)).toBeNull();
});

test("trial: every 2nd Premium use, and the day before it ends", () => {
  const trial = ctx({ inTrial: true, trialEndsAt: now.getTime() + 5 * 86400_000 });
  expect(nextOffer({ ...EMPTY_OFFERS, premiumUses: 1 }, trial)).toBeNull();
  const second = nextOffer({ ...EMPTY_OFFERS, premiumUses: 2 }, trial);
  expect(second).toMatchObject({ kind: "trialUse", patch: { premiumUsesOffered: 2 } });
  expect(nextOffer({ ...EMPTY_OFFERS, premiumUses: 2, premiumUsesOffered: 2 }, trial)).toBeNull();
  const ending = nextOffer(EMPTY_OFFERS, { ...trial, trialEndsAt: now.getTime() + 3600_000 });
  expect(ending?.kind).toBe("trialEnding");
});

test("free milestones: streak first, then transactions, days of use, months", () => {
  const all = ctx({ streak: 8, transactionCount: 45, firstTransactionDate: new Date(2026, 7, 1) });
  const state = { ...EMPTY_OFFERS, usageDays: Array.from({ length: 14 }, (_, i) => `d${i}`) };
  expect(nextOffer(state, all)).toMatchObject({ kind: "streak", patch: { streakMilestone: 7 } });
  expect(nextOffer({ ...state, streakMilestone: 7 }, all)).toMatchObject({ kind: "transactions", patch: { txMilestone: 40 } });
  expect(nextOffer({ ...state, streakMilestone: 7, txMilestone: 40 }, all)).toMatchObject({ kind: "usageDays", patch: { usageMilestone: 14 } });
  expect(nextOffer({ ...state, streakMilestone: 7, txMilestone: 40, usageMilestone: 14 }, all)).toMatchObject({ kind: "monthly", patch: { monthMilestone: 2 } });
});

test("streaks and months", () => {
  const d = (day: number) => new Date(2026, 9, day, 9);
  expect(loggingStreak([d(20), d(19), d(18), d(16)], now)).toBe(3);
  expect(loggingStreak([d(19), d(18)], now)).toBe(2); // nothing yet today
  expect(loggingStreak([d(17)], now)).toBe(0);
  expect(monthsBetween(new Date(2026, 8, 21), now)).toBe(0);
  expect(monthsBetween(new Date(2026, 8, 20), now)).toBe(1);
});
