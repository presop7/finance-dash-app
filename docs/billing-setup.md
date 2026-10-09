# Billing setup

The code is ready for three payment routes. Each one stays off until its
keys are set, so nothing charges anyone before that. All three end in the
same place: the account's `premium_until`. A purchase from any route
unlocks Premium everywhere.

Backend URLs below use the dev backend `https://fi-track-app-dev.onrender.com`.
For the live version, use the live backend URL instead.

| Route | Who pays there | Who handles tax |
|---|---|---|
| Google Play | Android app | Google |
| App Store | iPhone app (later) | Apple |
| Paddle | Web version | Paddle (it's the seller) |

---

## 1. Google Play

You need: a Play Console developer account, and the app uploaded at least to
**Internal testing**. Products can't be loaded until a build with billing is
on a testing track.

### a) Payments profile
Play Console → **Settings → Payments profile**: use the company's details,
including its VAT number and bank account. Then add the **W-8BEN-E** form
(US tax treaty) in the same profile.

### b) Subscriptions
Play Console → your app → **Monetize with Play → Products → Subscriptions →
Create subscription**. Create two, with exactly these product IDs:

| Product ID | Base plan | Renews | Price |
|---|---|---|---|
| `fitrack_premium_monthly` | `base` | Monthly | €3.99 |
| `fitrack_premium_yearly` | `base` | Yearly | €37.99 |

Let Google convert the price to other countries' currencies. Activate both
base plans.

In each base plan, set the **Grace period** (7 days recommended) and
**Account hold** (30 days). Google retries failed payments during those;
the app keeps Premium during grace and tells the user to fix their payment.

### c) Offers (the app's special prices)
On each base plan, **Add offer**. Set eligibility to **Developer
determined**, so the app decides when an offer applies. Each offer needs the
**tag** below; that's how the app finds it.

| On product | Tag | Phase | Matches the app's offer |
|---|---|---|---|
| `fitrack_premium_yearly` | `trial` | €29.99 for the first year | In-trial offers |
| `fitrack_premium_yearly` | `milestone` | €29.99 for the first year | Milestone offers |
| `fitrack_premium_yearly` | `trial-end` | €23.99 for the first year | 1-hour offer after the trial |
| `fitrack_premium_monthly` | `trial-end` | €1.99 for the first month | 1-hour offer after the trial |

An offer that isn't created yet simply isn't shown: the app shows the normal
price.

### d) Service account (lets the server check purchases)
1. In **Google Cloud Console**, in a project linked to Play Console: enable
   the **Google Play Android Developer API**.
2. Go to **IAM → Service accounts → Create**, name it `fitrack-billing`.
3. On the service account: **Keys → Add key → JSON**. A file downloads.
4. Play Console → **Users and permissions → Invite new users**: enter the
   service account's email address. Give it app access with **View financial
   data** and **Manage orders and subscriptions**.
5. On Render, for the backend, add the environment variable
   `GOOGLE_SERVICE_ACCOUNT_JSON` = the entire JSON file's content.
   - Keep it on one line.
   - This is a secret: never put it in git or in chat.

Permissions can take up to 24 hours to start working.

### e) Real-time notifications (renewals, failed payments, cancellations)
1. Google Cloud Console → **Pub/Sub → Topics → Create topic** `play-billing`.
2. On the topic: **Permissions → Add principal**
   `google-play-developer-notifications@system.gserviceaccount.com` with the
   role **Pub/Sub Publisher**.
3. **Create subscription** on the topic:
   - Delivery type: **Push**.
   - Endpoint: `https://fi-track-app-dev.onrender.com/billing/google/rtdn?token=YOUR_RANDOM_TOKEN`
4. Choose any long random string as the token. Put the same string in
   Render as `GOOGLE_RTDN_TOKEN`.
5. Play Console → **Monetize with Play → Monetization setup → Real-time
   developer notifications**:
   - Topic: `projects/<project-id>/topics/play-billing`.
   - Press **Send test notification**. The backend answers it without logging
     anything.

### f) Testing
- Play Console → **Setup → License testing**: add your Google accounts.
  Their purchases are free test purchases, and renewals come every few
  minutes.
- Build a new app version with EAS (the billing library needs a native
  build) and upload it to Internal testing. Then buy from the Premium screen.
- If it works: Premium turns on, Settings shows it, and Supabase has a row in
  `subscriptions` with source `google`.

---

## 2. Paddle (web version)

Paddle sells to the buyer and handles VAT, sales tax, invoices, card storage
and failed-payment retries. You get a payout to the company account.

### a) Account
1. Create a sandbox account first at `sandbox-vendors.paddle.com` (free,
   fake cards).
2. Then the live account at `vendors.paddle.com`. Paddle reviews the business
   and the website. It needs to see:
   - prices,
   - terms,
   - the privacy policy,
   - a refund policy.

### b) Catalog
**Catalog → Products → New product** "Fi-Track Premium" (tax category:
*Standard digital goods*). Add two prices:
- Monthly: €3.99, billing period 1 month.
- Yearly: €37.99, billing period 1 year.

Copy their IDs (`pri_...`).

**Catalog → Discounts**:
- "Trial": €8.00 off, restricted to the yearly price, recurring for 1 billing
  period. That makes €29.99 for the first year.
- "Milestone": the same as "Trial".
- "Trial end": restricted to both prices, 1 billing period. Two discounts
  with fixed amounts would match exactly (€2.00 off monthly, €14.00 off
  yearly). If it has to be one discount, use a percentage, which gives
  roughly the same prices.

Copy their IDs (`dsc_...`).

### c) Keys and webhook
- **Developer tools → Authentication**:
  - A **client-side token**. It's public and goes into the web app.
  - An **API key** with permission for customer portal sessions. It's
    secret and goes into the backend.
- **Developer tools → Notifications → New destination**:
  - URL: `https://fi-track-app-dev.onrender.com/billing/paddle/webhook`
  - Events: all **subscription.*** events.
  - Copy its **secret key**.
- **Checkout → Checkout settings**: set the default payment link to the web
  app's URL, and approve the web app's domain.

### d) Render
Backend service (secrets):

| Variable | Value |
|---|---|
| `PADDLE_WEBHOOK_SECRET` | The webhook's secret key |
| `PADDLE_API_KEY` | The API key |
| `PADDLE_SANDBOX` | `true` while testing, `false` for live |

Web (static site), public values (redeploy after setting):

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_PADDLE_ENV` | `sandbox` (or `production`) |
| `EXPO_PUBLIC_PADDLE_CLIENT_TOKEN` | The client-side token |
| `EXPO_PUBLIC_PADDLE_PRICE_MONTHLY` | `pri_...` |
| `EXPO_PUBLIC_PADDLE_PRICE_YEARLY` | `pri_...` |
| `EXPO_PUBLIC_PADDLE_DISCOUNT_TRIAL` | `dsc_...` (optional) |
| `EXPO_PUBLIC_PADDLE_DISCOUNT_MILESTONE` | `dsc_...` (optional) |
| `EXPO_PUBLIC_PADDLE_DISCOUNT_TRIAL_END` | `dsc_...` (optional) |

Test with Paddle's test card `4242 4242 4242 4242`, any future date, any
CVC.

### If Paddle doesn't approve or doesn't suit
- **Lemon Squeezy** or **FastSpring**: also sellers that handle tax
  themselves, so it's the same model as Paddle. The backend would need a
  second webhook handler next to Paddle's (small: it's the same idea).
- **No web payments**: leave the Paddle variables unset and set
  `PLAY_STORE_URL` in `mobile/constants/appLinks.ts`. The web Premium button
  then sends people to the Android app. No tax work for you.
- **Stripe with Stripe Tax**: Stripe calculates the tax, but you are the
  seller. You'd file the EU's OSS VAT return and any other countries'
  registrations yourself. That's the most work.

---

## 3. App Store (when you're ready)

The code is already in the app (the same library as Google Play). What's
left is all in Apple's systems:

1. Apple Developer Program ($99/year), enrolled as the company (it needs a
   D-U-N-S number, which is free).
2. App Store Connect → **Agreements, Tax and Banking**: sign the Paid Apps
   agreement and add the company's bank and tax details (W-8BEN-E).
3. Apply for the **App Store Small Business Program**: a 15% fee instead of
   30%.
4. Your app → **Subscriptions → Subscription group** "Premium", with two
   subscriptions using the same product IDs: `fitrack_premium_monthly` and
   `fitrack_premium_yearly`. Prices €3.99 and €37.99.
   - The app's special offers aren't available on the App Store yet: Apple's
     promotional offers need a signing key on the server, which can be added
     later. iPhone users see the normal price.
5. Your app → **App Information → App Store Server Notifications**: Version
   2, with both the production and sandbox URLs set to
   `https://fi-track-app-dev.onrender.com/billing/apple/notifications`
   (the live backend for production).
6. The backend's `APPLE_BUNDLE_ID` already defaults to `com.presop7.fitrack`.
7. Testing: create sandbox testers in App Store Connect, build with EAS for
   iOS, and install through TestFlight.

Apple's review checks that the Premium screen has **Restore purchases** (it
has) and links to the terms and privacy policy.

---

## How it works (for reference)
- Every purchase is checked on the server with Google, Apple or Paddle before
  it counts. The app's word alone is never trusted.
- Purchases are tied to the account. A purchase made for one account can't
  be claimed by another.
- Renewals, failed payments (grace period, hold), cancellations and refunds
  reach the server from the store or Paddle. Premium follows them.
- During a payment problem, the app shows a "Payment problem" notice with a
  button to fix it.
- **Settings/Premium → Manage subscription** opens the place where it was
  bought: Google Play, the App Store, or Paddle's own page.
