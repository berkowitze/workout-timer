# Plan 4: Monetization (Product + Technical)

## Goal

Let accounts stay free to use, but give heavy workout-creators a reason to pay,
without storing payment info ourselves and while keeping Apple Pay/Google Pay as
close to a checkbox as possible. This doc is a thinking-through pass, like
[Plan 3](03-workout-library-browser.md): options with a recommendation, not a
locked decision — flag anything below you'd steer differently.

## Relevant current state

- **Accounts are already the gate for the expensive/valuable actions.**
  `POST /workouts` (save), `POST /parse-workout` (AI natural-language → exercise
  tree), and `POST /generate-name` are all `@require_auth`
  ([backend/routes/workouts.py:32](../backend/routes/workouts.py),
  [backend/routes/ai.py](../backend/routes/ai.py)). Guests can build and run a
  workout client-side and open shared `/w/:id` links (commit `d37c1c9`), but
  can't save. So "free for accounts, paid past some usage line" is a small step
  from where the app already is, not a redesign.
- **`Workout` has no `user_id` at all.** [backend/models.py:12-18](../backend/models.py) —
  a saved workout today is just a global row, not attributed to whoever created
  it. This is a hard prerequisite for *any* per-account metering, independent of
  which pricing model gets picked: you can't count "workouts this user has
  created" without first storing who created each one. New nullable FK,
  backfilled `null` for existing rows (pre-dates accounts owning workouts).
- **There's no delete endpoint** — only `GET`/`POST /workouts` and
  `GET /workouts/<id>` exist. So "workouts a user currently has" and "workouts a
  user has ever created" are the same number today. Worth deciding whether a
  future delete feature should decrement a usage count or not (recommend: no —
  see Option A below, meter creation events, not current row count).
- **Alembic is already being introduced by Plan 1** (`backend/migrations/` is
  present but uncommitted) — any billing schema changes ride the same migration
  convention, not a new one.
- **The admin analytics dashboard (Plan 1)** is the right instrument for sizing
  a free-tier cap correctly instead of guessing — see Option C below.
- **No payment processor is wired up anywhere** — this is a from-scratch
  integration.

---

## Part 1 — Product: what to charge for

Your steer going in: accounts free, heavy creators eventually pay, open to
subscription vs. pay-per-unlock vs. "something else," not thrilled about ads,
want Apple Pay/Google Pay-easy checkout, don't want to store card data
yourselves.

### A. What draws the free/paid line? (the metering unit)

- **A1 — Lifetime cap on saved workouts** (e.g. "10 free, forever"). Once
  someone's created their 11th workout, they hit the paywall — permanently,
  not "until next month." This directly targets "people making *a lot* of
  workouts," since casual users (a handful of workouts, used for months) never
  see it.
- **A2 — Monthly-reset cap** (e.g. "3 free per month"). Generous-feeling, but
  it has a real failure mode for your stated goal: a moderately active user who
  makes 2 workouts a month *never* converts — they're satisfied on free
  forever. A lifetime cap is the standard "free trial via usage, not via time"
  pattern and converts exactly the people you said you want to charge.
- **A3 — Meter the AI-assist, not creation itself.** `ConfigurationMode`
  already has two ways to build a workout: manual add-exercise (free-form
  drag/drop, zero marginal cost — just a DB row) and `POST /parse-workout`
  (an LLM call on `gpt-5.4-nano`, a real if small marginal cost). A creative
  alternative: **manual building stays unlimited and free forever**, and the
  paywall sits specifically on natural-language AI parsing (e.g. "5 free
  AI-parses, then pay"). This ties the paywall to the feature that actually
  costs you something and that people are paying for *convenience*, and it
  means "free" never feels crippled — it's always a fully-functional app, just
  more manual past a point.
- **Recommendation: A1 as the primary gate, with A3 as a genuinely strong
  complementary angle** — e.g. unlimited manual creation always free, generous
  lifetime cap on *saved* workouts overall, separate smaller cap on AI-parses.
  Doesn't have to be either/or.

### B. Mechanism: how people actually pay past the line

- **B1 — Flat subscription, unlimited.** ~$4–6/mo (or a cheaper effective
  monthly rate if paid annually, e.g. $30–40/yr) removes the cap entirely.
  Simple to explain, predictable recurring revenue. Real risk for a
  workout-creation tool specifically: "subscription surfing" — someone
  subscribes for one month, batch-creates 20 workouts, cancels. An annual-only
  or annual-discounted option softens this; a monthly-only option doesn't.
- **B2 — One-time credit packs.** E.g. $2.99 for +10 more workout slots (or
  +10 AI-parses under A3), no expiration, no recurring charge. Lower
  commitment, matches the actually-kind-of-bursty way people build workout
  routines (make a bunch, then just *use* them for months). Downside: small
  one-time charges take a proportionally bigger hit from processor fees than a
  subscription does (see Part 1C), and each purchase is a fresh decision
  instead of a "set and forget."
- **B3 — Hybrid (recommended).** Generous lifetime free cap (A1) → past that,
  offer *both* an unlimited subscription **and** a one-time top-up pack.
  Subscription-averse users still have a way to pay you something; subscription
  -friendly users get the "never think about it again" option. This is the
  well-worn consumer-app pattern (Notion, Descript, etc.) precisely because it
  stops forcing an all-or-nothing choice at the paywall moment.
- **B4 — "Founding member" lifetime deal.** A one-time price (e.g. $19.99)
  for unlimited-forever, offered only to your first N paying users or for a
  limited window. Common indie-app tactic to get early revenue + goodwill
  before you're confident in ongoing subscription retention. Optional add-on
  to B3, not a replacement.
- **B5 — Ads.** Included for completeness since you raised it, but
  deprioritized per your own steer — and it fits the UX badly regardless: you
  don't want an ad interrupting a rest timer mid-workout, which is the app's
  core moment. If you ever revisit it, a passive/native placement (e.g. a
  sponsor credit on the workout-complete screen) would be far less disruptive
  than a banner/interstitial.
- **v2 idea, not v1:** a higher-priced **Pro/Coach tier** (~$15–20/mo) for
  anyone building workouts for other people (personal trainers etc.) — a
  meaningfully different, higher-willingness-to-pay segment. Plan 1's admin
  dashboard is exactly the tool that would surface whether this segment
  actually exists in your user base before you build for it.

### C. Is the amount of money coming in "reasonable"?

Two separate questions hide in this: (1) does the free tier cost you much to
run, and (2) will the paid tier bring in a sensible amount.

**(1) Free-tier cost is genuinely low.** The only per-workout marginal cost is
the optional LLM call for AI-parsing (`gpt-5.4-nano`, chosen for cost — commit
`ab8996b`) or naming (`gpt-4o-mini`) — both small, cheap-tier models, and a
manually-built workout costs essentially nothing beyond a Postgres row. This
means the free cap isn't really about protecting you from cost — it's a
monetization lever, not a defensive one. You can afford to be generous with it
without real financial risk. (Check current per-call cost on your OpenAI
billing dashboard rather than trust a specific number here — I don't want to
guess a figure that may be stale.)

**(2) Sizing the cap and the price.** Rough funnel framing, not a prediction:
`active accounts × (% who ever hit the free cap) × (% of those who convert once
they hit it) × price`. Usage-based paywalls (vs. time-limited trials) tend to
convert a *higher* share of the people who actually hit them — often
10–30% — because by definition those people have already proven they value the
product enough to use it a lot. The unknown you don't have yet is the first
term: how many workouts does a typical account actually create? **Plan 1's
admin dashboard is the right tool to answer that before finalizing a number** —
e.g. set the lifetime cap around the current ~80th-percentile
workouts-per-account, so it's generous to your typical user and only bites your
actual power users, which is the group you said you want to monetize.

**Existing users need a grandfathering decision.** This app already has real
accounts and real saved workouts (per your commit history). Retroactively
capping existing users at, say, "10 free" when someone already has 30 saved
workouts is likely to feel like a bait-and-switch. Recommend: grandfather
current workout counts (don't lock anyone out of workouts they already made),
and/or give existing accounts a one-time "thanks for being early" bonus (extra
free slots, or a discount code) rather than applying the cap retroactively with
no acknowledgment.

**Fee drag matters more at small dollar amounts.** Card processing is
typically a percentage plus a small fixed fee per transaction (confirm current
rates at stripe.com/pricing rather than trust a number here, since it can
change) — the fixed component eats a much bigger share of a $2.99 one-time
charge than a $5/mo subscription. Practical implication: don't sell very
small one-time packs (e.g. $0.99) — the fee alone makes them barely worth
processing.

---

## Part 2 — Technical: how payments actually work

The short version, matching what you said you want: use a payment processor
(Stripe) so **you never see or store a raw card number, CVV, or bank
account** — Stripe's hosted UI collects it, your backend only ever stores
Stripe's *reference IDs* (a customer ID, a subscription ID). This also sidesteps
the compliance burden (PCI-DSS) almost entirely, since that burden falls on
whoever actually touches card data — which, done this way, is Stripe, not you.

### Why Stripe (with one honest alternative)

Stripe is the standard default for a solo/indie web app: best docs, native
Apple Pay/Google Pay support, and it composes well with a Flask + React stack.
One real alternative worth a deliberate choice rather than defaulting past:
**Paddle or Lemon Squeezy** act as "merchant of record" — they additionally
handle sales-tax/VAT collection and remittance across countries for you, at a
higher per-transaction fee than Stripe's base rate. A $5/mo subscription sold
internationally does have real tax obligations that are easy to miss; Stripe
Tax is available but is an extra piece you configure, not automatic like it is
with Paddle/Lemon Squeezy. Flagged as an open question below rather than
assumed.

### The two ways to integrate Stripe

- **Stripe Checkout (hosted page) — recommended starting point.** Your
  backend makes one API call to create a "Checkout Session," redirects the
  browser to a Stripe-hosted payment page, Stripe collects payment (card,
  **Apple Pay, Google Pay, and Stripe Link all appear automatically** — zero
  extra code from you), then redirects back to your app and separately notifies
  your backend via webhook. You write almost no payment UI.
- **Stripe Elements (embedded components)** — Stripe's JS widgets embedded
  directly in your own page instead of a redirect, still tokenizes everything
  client-side. More design control (feels native to your app), more
  integration work (`@stripe/stripe-js` + `@stripe/react-stripe-js` in
  `frontend/package.json`). Treat as a v2 polish upgrade once Checkout is
  proven, not the v1 build.

**Apple Pay / Google Pay aren't a separate integration.** They're payment
methods Stripe Checkout enables automatically once your domain is registered
with Stripe (a one-time, mostly-automatic verification step for a
Checkout-hosted page). Because this is a web app, you don't need an Apple
Developer or Google Pay merchant account yourself — that requirement only
kicks in for a native iOS/Android app calling PassKit/Google Pay SDKs directly,
which doesn't apply here.

**Subscriptions and one-time packs both come from the same primitives.** You
define a Stripe "Product" (e.g. "Workout Timer Pro") with a recurring "Price"
($5/mo) and, separately, one-time "Prices" for top-up packs. A Checkout
Session just points at a Price ID with `mode: "subscription"` or
`mode: "payment"`. Stripe handles recurring billing, retrying failed cards,
and prorations for you.

**Webhooks are the source of truth, not the redirect.** Add one endpoint,
`POST /api/stripe/webhook`. Stripe calls it server-to-server on events like
`checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.payment_failed`, each cryptographically
signed so you can verify it's really Stripe. This — not "the user got
redirected back to a success page" — is what your database should actually
trust, since a client-side redirect can be closed early or spoofed.

**The Customer Portal replaces a billing settings page you'd otherwise have to
build.** Stripe hosts a page where a subscriber can update their card, view
invoices, or cancel — you just generate a link to it. For someone who's never
built billing before, this is the single biggest "things you don't have to
write yourself" item on the list.

### Backend sketch

- `backend/requirements.txt`: add `stripe`.
- New env vars, same pattern as `OPENAI_API_KEY`/`GOOGLE_CLIENT_ID` today:
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` IDs.
- New `backend/routes/billing.py`, three routes:
  - `POST /api/billing/checkout` (`@require_auth`) — creates a Checkout
    Session for either the subscription Price or a top-up Price, tagged with
    the caller's internal user id (Stripe's `client_reference_id`/metadata),
    returns the redirect URL.
  - `POST /api/billing/portal` (`@require_auth`) — creates a Customer Portal
    session for an existing subscriber.
  - `POST /api/billing/webhook` (no auth — verified by Stripe's signature
    instead) — updates the DB on the events above.
- Schema (one more Alembic migration, same convention Plan 1 introduces):
  `Workout.user_id` (nullable FK — the real prerequisite, see above), plus
  either columns on `User` (`stripe_customer_id`, `plan`) or a small
  `Subscription` table (`status`, `current_period_end`, `stripe_subscription_id`),
  and, if you go with top-up packs, a `workout_credits` int on `User`
  incremented by the webhook on a successful one-time purchase.
- Gate logic in `create_workout`
  ([backend/routes/workouts.py:32](../backend/routes/workouts.py)): before
  inserting, check `(workouts created by this user) < free_cap OR
  user.plan == "subscribed" OR user.workout_credits > 0`, decrementing a
  credit when that's the path used.

### Frontend sketch

- An "Upgrade" prompt (e.g. surfaced right when a free user hits the cap on
  save) that calls `POST /api/billing/checkout` and does
  `window.location.href = session.url` — Checkout needs no SDK on your end,
  just a redirect to the URL Stripe returns. Only add the `stripe` npm package
  later, if/when moving to embedded Elements.

---

## Open questions for you

1. Metering unit: lifetime cap on total saved workouts (A1), or specifically
   meter AI-parsing while manual building stays unlimited (A3), or both?
2. Mechanism: subscription-only, credits-only, or the subscription-or-topup
   hybrid (B3)?
3. Rough price point(s) you'd want to start with, even as a guess — it drives
   the cap-sizing conversation in Part 1C.
4. Stripe vs. Paddle/Lemon Squeezy — worth 20 minutes deciding deliberately
   given the international-tax angle, rather than defaulting to Stripe.
5. What happens to existing accounts' existing workouts when this ships —
   grandfather current counts, one-time bonus, or something else?

## Suggested sequencing

1. `Workout.user_id` migration + backfill (prerequisite regardless of pricing
   model — nothing below can be metered per-account without it).
2. Let Plan 1's admin dashboard run for a bit to get real
   workouts-per-account distribution data before locking the cap number.
3. Stripe account + Products/Prices set up (subscription + top-up, if doing
   both); `backend/routes/billing.py` + webhook + schema migration.
4. Gate `create_workout` (and/or `parse-workout`, if going with A3) on the
   chosen check.
5. Frontend upgrade prompt + redirect-to-Checkout flow.
6. Customer Portal link somewhere reachable (account menu) for subscribers to
   self-manage/cancel.
7. v2 candidates, not v1: embedded Stripe Elements, founding-member lifetime
   deal, Pro/Coach tier, Stripe Tax / international VAT handling.
