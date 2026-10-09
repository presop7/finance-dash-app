// Free vs Premium: the limits and the prices. The server enforces the limits
// it can see (funds, goals — backend/plan.py); the app enforces the rest and
// shows all of them up front.

export const FREE = {
  funds: 2, // "Unassigned" isn't counted
  goals: 1,
  // Reminders and trackers: per type; category limits get 2.
  remindersPerType: 1,
  categoryLimits: 2,
  trackers: 2, // loans and lends together
} as const;

// Analytics date ranges free users get (everything else is Premium).
export const FREE_RANGES = ["thisMonth", "lastMonth", "all"] as const;

// List prices (EUR, incl. VAT) and the offers built on them. Never below the
// floor: €1.99 for a first month, €23.99 a year (= €2.00 a month).
export const PRICES = { monthly: 3.99, yearly: 37.99 } as const;
export const OFFER_PRICES = {
  trial: { yearly: 29.99 }, // during the trial, after using Premium
  trialEnd: { monthly: 1.99, yearly: 23.99 }, // the 1-hour window when the trial ends
  milestone: { yearly: 29.99 }, // free users' milestones
} as const;
export const TRIAL_END_OFFER_MS = 60 * 60 * 1000;
// Every other offer (milestones, trial offers) holds its price this long.
export const OFFER_MS = 15 * 60 * 1000;
