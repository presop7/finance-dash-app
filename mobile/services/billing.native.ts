import { Linking, Platform } from "react-native";
import {
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  isUserCancelledError,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases,
  type ProductSubscription,
  type Purchase,
} from "expo-iap";
import {
  BuyResult,
  OFFER_PLANS,
  OFFER_TAGS,
  OfferPrice,
  PLAY_PACKAGE,
  PlanId,
  PlanSource,
  PRODUCT_IDS,
  StorePlan,
  StorePlans,
} from "../constants/billing";
import { financeApi } from "./financeApi";
import { useFinanceStore } from "../store/useFinanceStore";

// Phone apps: Premium through Google Play / the App Store. Every purchase is
// checked by our server with the store before it counts; the store's later
// changes (renewals, failed payments) reach the server directly.
export const billingAvailable = true;
export const canRestore = true;
export const billingStore: PlanSource = Platform.OS === "ios" ? "apple" : "google";

let connection: Promise<unknown> | null = null;
const connect = () =>
  (connection ??= initConnection().catch((e) => {
    connection = null;
    throw e;
  }));

const ALL_TAGS = Object.values(OFFER_TAGS);

function planFrom(product: ProductSubscription, plan: PlanId, tag: string | null): StorePlan {
  if (product.platform !== "android") {
    const amount = product.price ?? 0;
    return { plan, price: product.displayPrice, amount, listPrice: null, listAmount: amount, offer: null };
  }
  const offers = product.subscriptionOffers ?? [];
  const isOurs = (o: (typeof offers)[number]) => (o.offerTagsAndroid ?? []).some((t) => ALL_TAGS.includes(t));
  const phases = (o?: (typeof offers)[number]) => o?.pricingPhasesAndroid?.pricingPhaseList ?? [];
  const base = offers.find((o) => !isOurs(o)) ?? offers[0];
  const recurring = phases(base)[phases(base).length - 1];
  const listAmount = recurring ? Number(recurring.priceAmountMicros) / 1e6 : (product.price ?? 0);
  const listPrice = recurring?.formattedPrice ?? product.displayPrice;
  const deal = tag ? offers.find((o) => o.offerTagsAndroid?.includes(tag)) : undefined;
  const first = phases(deal)[0];
  if (deal?.offerTokenAndroid && first) {
    return {
      plan,
      price: first.formattedPrice,
      amount: Number(first.priceAmountMicros) / 1e6,
      listPrice,
      listAmount,
      offer: deal.offerTokenAndroid,
    };
  }
  return { plan, price: listPrice, amount: listAmount, listPrice: null, listAmount, offer: base?.offerTokenAndroid ?? null };
}

// The plans with this user's prices, or null when the store has none (not
// set up yet, no connection).
export async function loadPlans(offer: OfferPrice | null): Promise<StorePlans | null> {
  try {
    await connect();
    const products = (await fetchProducts({ skus: Object.values(PRODUCT_IDS), type: "subs" })) as ProductSubscription[];
    const plans = {} as StorePlans;
    for (const plan of ["monthly", "yearly"] as PlanId[]) {
      const product = products.find((p) => p.id === PRODUCT_IDS[plan]);
      if (!product) return null;
      plans[plan] = planFrom(product, plan, offer && OFFER_PLANS[offer].includes(plan) ? OFFER_TAGS[offer] : null);
    }
    return plans;
  } catch {
    return null;
  }
}

// A purchase from the store: checked by our server, then finished (Google
// refunds purchases not acknowledged within 3 days; the server acknowledges
// too). Not finished if the check fails: the store offers it again next start.
async function confirm(purchase: Purchase): Promise<void> {
  if (!purchase.purchaseToken) throw new Error("no purchase token");
  if (billingStore === "apple") await financeApi.verifyApplePurchase(purchase.purchaseToken);
  else await financeApi.verifyGooglePurchase(purchase.purchaseToken, purchase.productId);
  await finishTransaction({ purchase, isConsumable: false });
}

// The purchase the Premium screen is waiting for.
let waiting: { sku: string; resolve: (r: BuyResult) => void; reject: (e: unknown) => void } | null = null;

async function handle(purchase: Purchase) {
  const waiter = waiting?.sku === purchase.productId ? waiting : null;
  if (waiter) waiting = null;
  try {
    if (purchase.purchaseState === "pending") {
      waiter?.resolve("pending"); // e.g. paid in cash at a shop: comes later
      return;
    }
    await confirm(purchase);
    await useFinanceStore.getState().hydrate();
    waiter?.resolve("premium");
  } catch (e) {
    waiter?.reject(e);
  }
}

// Signed in: listen for purchases, and confirm any the store still holds
// unconfirmed (bought while offline, the app closed mid-way...).
let started = false;
export function startBilling() {
  if (started) return;
  started = true;
  connect()
    .then(() => {
      purchaseUpdatedListener((purchase) => void handle(purchase));
      purchaseErrorListener((error) => {
        const waiter = waiting;
        waiting = null;
        if (!waiter) return;
        if (isUserCancelledError(error)) waiter.resolve("cancelled");
        else waiter.reject(error);
      });
      return getAvailablePurchases();
    })
    .then((purchases) => {
      for (const p of purchases ?? []) void handle(p);
    })
    .catch(() => {
      started = false;
    });
}

export async function buy(plan: StorePlan): Promise<BuyResult> {
  startBilling();
  await connect();
  const sku = PRODUCT_IDS[plan.plan];
  // Ties the purchase to this account: the server refuses it for another one.
  const accountId = useFinanceStore.getState().plan.accountId ?? undefined;
  const result = new Promise<BuyResult>((resolve, reject) => {
    waiting = { sku, resolve, reject };
  });
  await requestPurchase({
    type: "subs",
    request: {
      apple: { sku, appAccountToken: accountId },
      google: {
        skus: [sku],
        obfuscatedAccountId: accountId,
        subscriptionOffers: plan.offer ? [{ sku, offerToken: plan.offer }] : [],
      },
    },
  });
  return result;
}

// "Restore purchases": confirms every subscription this store account holds.
export async function restore(): Promise<number> {
  await connect();
  await restorePurchases().catch(() => {});
  const purchases = await getAvailablePurchases();
  let restored = 0;
  for (const p of purchases) {
    if (!Object.values(PRODUCT_IDS).includes(p.productId)) continue;
    try {
      await confirm(p);
      restored += 1;
    } catch {
      // another account's purchase, or the server unreachable
    }
  }
  await useFinanceStore.getState().hydrate();
  return restored;
}

// The store's own subscriptions page (change plan, payment method, cancel).
export async function manage(): Promise<void> {
  await Linking.openURL(
    billingStore === "apple"
      ? "https://apps.apple.com/account/subscriptions"
      : `https://play.google.com/store/account/subscriptions?package=${PLAY_PACKAGE}`,
  );
}
