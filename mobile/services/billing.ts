import { BuyResult, OFFER_PLANS, OfferPrice, PlanId, PlanSource, StorePlan, StorePlans } from "../constants/billing";
import { financeApi } from "./financeApi";
import { useFinanceStore } from "../store/useFinanceStore";
import { useAuthStore } from "../store/useAuthStore";

// Web version: Premium through Paddle, which sells it (and handles VAT,
// invoices, card storage and failed-payment retries). Its signed webhooks tell
// our server; the app only opens Paddle's checkout and waits for the result.
// Off until EXPO_PUBLIC_PADDLE_* are set (see docs/billing-setup.md).
const TOKEN = process.env.EXPO_PUBLIC_PADDLE_CLIENT_TOKEN;
const SANDBOX = process.env.EXPO_PUBLIC_PADDLE_ENV !== "production";
const PRICE_IDS: Record<PlanId, string | undefined> = {
  monthly: process.env.EXPO_PUBLIC_PADDLE_PRICE_MONTHLY,
  yearly: process.env.EXPO_PUBLIC_PADDLE_PRICE_YEARLY,
};
const DISCOUNT_IDS: Record<OfferPrice, string | undefined> = {
  trial: process.env.EXPO_PUBLIC_PADDLE_DISCOUNT_TRIAL,
  milestone: process.env.EXPO_PUBLIC_PADDLE_DISCOUNT_MILESTONE,
  trialEnd: process.env.EXPO_PUBLIC_PADDLE_DISCOUNT_TRIAL_END,
};

export const billingAvailable = Boolean(TOKEN && PRICE_IDS.monthly && PRICE_IDS.yearly);
export const canRestore = false;
export const billingStore: PlanSource = "paddle";

type PaddleEvent = { name?: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PaddleJs = any;
let paddle: Promise<PaddleJs> | null = null;
let onEvent: ((e: PaddleEvent) => void) | null = null;

function load(): Promise<PaddleJs> {
  return (paddle ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const P = (window as any).Paddle;
      if (SANDBOX) P.Environment.set("sandbox");
      P.Initialize({ token: TOKEN, eventCallback: (e: PaddleEvent) => onEvent?.(e) });
      resolve(P);
    };
    script.onerror = () => {
      paddle = null;
      reject(new Error("Paddle didn't load"));
    };
    document.head.appendChild(script);
  }));
}

export function startBilling() {}

// Prices as Paddle shows them to this visitor (their currency, tax included).
export async function loadPlans(offer: OfferPrice | null): Promise<StorePlans | null> {
  if (!billingAvailable) return null;
  try {
    const P = await load();
    const preview = async (priceId: string, discountId?: string) => {
      const result = await P.PricePreview({ items: [{ priceId, quantity: 1 }], ...(discountId ? { discountId } : {}) });
      const line = result.data.details.lineItems[0];
      return { price: line.formattedTotals.total as string, amount: Number(line.totals.total) / 100 };
    };
    const plans = {} as StorePlans;
    for (const plan of ["monthly", "yearly"] as PlanId[]) {
      const list = await preview(PRICE_IDS[plan]!);
      const discountId = offer && OFFER_PLANS[offer].includes(plan) ? DISCOUNT_IDS[offer] : undefined;
      const deal = discountId ? await preview(PRICE_IDS[plan]!, discountId) : null;
      plans[plan] = deal
        ? { plan, price: deal.price, amount: deal.amount, listPrice: list.price, listAmount: list.amount, offer: discountId! }
        : { plan, price: list.price, amount: list.amount, listPrice: null, listAmount: list.amount, offer: null };
    }
    return plans;
  } catch {
    return null;
  }
}

// Paddle's checkout over the page; after payment, waits (up to ~20 s) for
// the webhook to make the account Premium.
export async function buy(plan: StorePlan): Promise<BuyResult> {
  const P = await load();
  const email = useAuthStore.getState().session?.user.email;
  const accountId = useFinanceStore.getState().plan.accountId;
  return new Promise((resolve) => {
    let paid = false;
    onEvent = (e) => {
      if (e.name === "checkout.completed") {
        paid = true;
        P.Checkout.close();
      } else if (e.name === "checkout.closed") {
        onEvent = null;
        if (!paid) resolve("cancelled");
        else void waitForPremium().then((ok) => resolve(ok ? "premium" : "pending"));
      }
    };
    P.Checkout.open({
      items: [{ priceId: PRICE_IDS[plan.plan], quantity: 1 }],
      ...(plan.offer ? { discountId: plan.offer } : {}),
      ...(email ? { customer: { email } } : {}),
      customData: { user_id: accountId },
      settings: { displayMode: "overlay", variant: "one-page" },
    });
  });
}

async function waitForPremium(): Promise<boolean> {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    await useFinanceStore.getState().hydrate();
    const until = useFinanceStore.getState().plan.premiumUntil;
    if (until !== null && until > Date.now()) return true;
  }
  return false;
}

export async function restore(): Promise<number> {
  return 0;
}

// Paddle's page for this subscription (card, invoices, cancel).
export async function manage(): Promise<void> {
  const { url } = await financeApi.paddlePortal();
  window.location.href = url;
}
