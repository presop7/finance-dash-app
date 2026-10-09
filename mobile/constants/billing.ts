// Paid Premium: what the stores and Paddle are set up with (see
// docs/billing-setup.md). services/billing.native.ts buys through Google Play
// / the App Store, services/billing.ts through Paddle on the web.

export type PlanId = "monthly" | "yearly";
// Which offer price applies (the Premium screen works it out).
export type OfferPrice = "trial" | "milestone" | "trialEnd";

// The same product ids in Google Play (a subscription each, one base plan)
// and in App Store Connect (one subscription group).
export const PRODUCT_IDS: Record<PlanId, string> = {
  monthly: "fitrack_premium_monthly",
  yearly: "fitrack_premium_yearly",
};
export const PLAY_PACKAGE = "com.presop7.fitrack";

// Which plans an offer lowers (as OFFER_PRICES in plan.ts). On Google Play
// each is an offer on that plan's base plan carrying this tag; in Paddle a
// discount (its id in EXPO_PUBLIC_PADDLE_DISCOUNT_*) limited to those prices.
// The App Store has none yet (its offers need a signing key): base price.
export const OFFER_PLANS: Record<OfferPrice, PlanId[]> = {
  trial: ["yearly"],
  milestone: ["yearly"],
  trialEnd: ["monthly", "yearly"],
};
export const OFFER_TAGS: Record<OfferPrice, string> = { trial: "trial", milestone: "milestone", trialEnd: "trial-end" };

// A plan as the store/Paddle prices it for this user (their currency, tax).
export type StorePlan = {
  plan: PlanId;
  price: string; // what they pay now, formatted
  amount: number;
  listPrice: string | null; // the usual price, when an offer lowers it
  listAmount: number;
  offer: string | null; // Play offer token / Paddle discount id
};
export type StorePlans = Record<PlanId, StorePlan>;
// "pending": paid, but the confirmation hasn't reached us yet (or the store
// is still processing, e.g. a cash payment).
export type BuyResult = "premium" | "pending" | "cancelled";
export type PlanSource = "google" | "apple" | "paddle";

// A store price with another amount in it (same currency and style):
// "12,99 лв." with 1.08 → "1,08 лв.".
export function withAmount(formatted: string, amount: number): string {
  return formatted.replace(/\d[\d\s.,\u00a0\u202f]*\d|\d/, (num) => {
    const comma = /,\d{1,2}$/.test(num);
    const fixed = amount.toFixed(2);
    return comma ? fixed.replace(".", ",") : fixed;
  });
}
