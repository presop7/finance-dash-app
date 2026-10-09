// Which Premium offer (if any) to show now. Pure: the offers store keeps the
// state, this decides. Rules:
//   - At most one offer a calendar day, from every trigger together.
//   - Never while adding a transaction or in the 10 seconds after one.
//   - Nothing for paying users.
//   - During the trial: after every 2nd use of a Premium feature, and a
//     heads-up the day before it ends.
//   - Free users: milestones — logging streaks (7, then 30 days), every 15
//     transactions, every 7 days of use, each month since the first one.
//     When several are due the same day, the most valuable goes first; the
//     others wait for another day.
// The trial-end screen (with its 1-hour offer) isn't a pop-up offer: it comes
// once, at the first open after the trial, whatever else happened that day.

export type OfferKind = "trialUse" | "trialEnding" | "streak" | "transactions" | "usageDays" | "monthly";

export type OfferState = {
  lastOfferDay: string | null; // YYYY-MM-DD
  premiumUses: number; // Premium features used during the trial
  premiumUsesOffered: number; // premiumUses when the last trial offer came
  trialEndingShown: boolean;
  streakMilestone: number; // 0, 7 or 30 offered
  txMilestone: number; // last multiple of 20 offered
  usageMilestone: number; // last multiple of 7 days offered
  monthMilestone: number; // months since the first transaction, offered
  usageDays: string[]; // days the app was opened
};

export type OfferContext = {
  now: Date;
  paid: boolean;
  inTrial: boolean;
  trialEndsAt: number | null;
  transactionCount: number;
  firstTransactionDate: Date | null;
  streak: number; // consecutive days with a transaction, up to today
  lastAddedAt: number | null;
  adding: boolean;
};

export const EMPTY_OFFERS: OfferState = {
  lastOfferDay: null,
  premiumUses: 0,
  premiumUsesOffered: 0,
  trialEndingShown: false,
  streakMilestone: 0,
  txMilestone: 0,
  usageMilestone: 0,
  monthMilestone: 0,
  usageDays: [],
};

export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const DAY = 24 * 60 * 60 * 1000;
// A transactions milestone every this many transactions (15, 30, 45...).
export const TX_STEP = 15;
export const AFTER_ADD_MS = 10 * 1000;

export function nextOffer(
  s: OfferState,
  c: OfferContext,
): { kind: OfferKind; patch: Partial<OfferState> } | null {
  const now = c.now.getTime();
  if (c.paid || c.adding) return null;
  if (c.lastAddedAt !== null && now - c.lastAddedAt < AFTER_ADD_MS) return null;
  const today = dayKey(c.now);
  if (s.lastOfferDay === today) return null;
  const offer = (kind: OfferKind, patch: Partial<OfferState> = {}) => ({ kind, patch: { ...patch, lastOfferDay: today } });

  if (c.inTrial) {
    if (!s.trialEndingShown && c.trialEndsAt !== null && c.trialEndsAt - now < DAY) {
      return offer("trialEnding", { trialEndingShown: true });
    }
    if (s.premiumUses >= 2 && s.premiumUses % 2 === 0 && s.premiumUses !== s.premiumUsesOffered) {
      return offer("trialUse", { premiumUsesOffered: s.premiumUses });
    }
    return null;
  }

  // Free user: milestones, most valuable first.
  if (c.streak >= 30 && s.streakMilestone < 30) return offer("streak", { streakMilestone: 30 });
  if (c.streak >= 7 && s.streakMilestone < 7) return offer("streak", { streakMilestone: 7 });
  const tx = Math.floor(c.transactionCount / TX_STEP) * TX_STEP;
  if (tx >= TX_STEP && tx > s.txMilestone) return offer("transactions", { txMilestone: tx });
  const days = Math.floor(s.usageDays.length / 7) * 7;
  if (days >= 7 && days > s.usageMilestone) return offer("usageDays", { usageMilestone: days });
  if (c.firstTransactionDate) {
    const months = monthsBetween(c.firstTransactionDate, c.now);
    if (months >= 1 && months > s.monthMilestone) return offer("monthly", { monthMilestone: months });
  }
  return null;
}

// Whole months from `from` to `to` (an anniversary counts on its day).
export function monthsBetween(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

// Consecutive days, ending today (or yesterday, if nothing yet today), with
// at least one transaction dated on them.
export function loggingStreak(dates: Date[], now: Date): number {
  const days = new Set(dates.map(dayKey));
  const cursor = new Date(now);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// Two copies of the offers memory (this device's and the account's on the
// server) made one, so nothing offered on one device comes again on another:
// counters and milestones take the higher, flags stay set once set, dates the
// later, days of use together, a running offer the one that ends later.
// Only `base`'s keys are kept.
export function mergeMemory<T extends Record<string, unknown>>(base: T, other: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(other)) {
    if (!(k in base) || v === null || v === undefined) continue;
    const mine = out[k];
    if (mine === null || mine === undefined) out[k] = v;
    else if (Array.isArray(mine) && Array.isArray(v)) out[k] = [...new Set([...mine, ...v])].sort().slice(-400);
    else if (typeof mine === "number" && typeof v === "number") out[k] = Math.max(mine, v);
    else if (typeof mine === "boolean") out[k] = mine || v === true;
    else if (typeof mine === "string" && typeof v === "string") out[k] = v > mine ? v : mine;
    else if (typeof mine === "object" && typeof v === "object" && "until" in v && "until" in mine)
      out[k] = (v as { until: number }).until > (mine as { until: number }).until ? v : mine;
  }
  return out as T;
}
