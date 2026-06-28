# Cadence coming-soon site — deploy & setup

A static coming-soon page (`website/`) plus a Supabase backend (`../supabase/`)
that gates a $299 one-time Stripe order behind **per-client, single-use access
codes**. The rest of the site is a public teaser; the waitlist posts to Formspree.

```
website/            ← deploy this folder as the static site
  index.html
  config.js         ← PUBLIC keys you fill in (safe in browser)
  assets/product.jpg
../supabase/
  migrations/0001_website_codes_orders.sql
  functions/validate-code | create-checkout | stripe-webhook
  scripts/mint-codes.mjs
```

## How the flow works
1. Visitor opens the site → public coming-soon teaser + waitlist (Formspree).
2. Invited client clicks **have a code?** → enters their code.
3. `validate-code` checks Supabase: exists & not used → unlocks the order card.
4. **continue to secure checkout** → `create-checkout` makes a Stripe Checkout
   Session ($299, one-time), marks the code `pending`, redirects to Stripe.
5. On payment, Stripe calls `stripe-webhook` → code marked `redeemed`
   (single-use enforced), order recorded. Buyer returns to `?order=success`.

Codes never touch the browser: Row Level Security blocks the anon key from
reading `access_codes`; only the Edge Functions (service-role) can.

---

## One-time setup

### 1. Create the Supabase project
- supabase.com → New project. Note the **Project URL**, **anon key**
  (Project Settings → API), and **service_role key** (same page, keep secret).

### 2. Apply the schema
Easiest: Supabase dashboard → SQL Editor → paste
`../supabase/migrations/0001_website_codes_orders.sql` → Run.
(Or with the CLI: `supabase link` then `supabase db push`.)

### 3. Install the Supabase CLI & deploy the functions
```bash
brew install supabase/tap/supabase     # or see supabase.com/docs/guides/cli
supabase login
supabase link --project-ref YOUR-PROJECT-REF
cd cadence-main
supabase functions deploy validate-code
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook --no-verify-jwt   # Stripe sends no JWT
```

### 4. Set the Edge Function secrets (server-side only — never in the website)
```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_xxx \
  STRIPE_WEBHOOK_SECRET=whsec_xxx \
  SITE_URL=https://your-domain.com \
  ALLOWED_ORIGIN=https://your-domain.com \
  PRICE_CENTS=29900
# Optional: use a Stripe Price instead of the inline $299
#   STRIPE_PRICE_ID=price_xxx
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

### 5. Wire the Stripe webhook
Stripe dashboard → Developers → Webhooks → Add endpoint:
- URL: `https://YOUR-PROJECT-REF.supabase.co/functions/v1/stripe-webhook`
- Event: `checkout.session.completed`
- Copy the **Signing secret** (`whsec_...`) into `STRIPE_WEBHOOK_SECRET` (step 4).

Start in **Stripe test mode** (test keys + a test webhook). Flip to live keys
when ready.

### 6. Fill the website's public config
Edit `website/config.js`:
```js
FUNCTIONS_URL: "https://YOUR-PROJECT-REF.supabase.co/functions/v1",
SUPABASE_ANON_KEY: "<anon key>",
PRICE_DISPLAY: "$299",
PRODUCT_IMAGE: "assets/product.jpg",
```

### 7. Mint access codes (hand out in `seq` order)
```bash
cd cadence-main/supabase/scripts
npm init -y && npm i @supabase/supabase-js
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service_role key> \
  node mint-codes.mjs 25 march-batch > codes.csv
```
`codes.csv` lists `seq,code,label`. Give them out one at a time; each works once.

### 8. Deploy the static site (free tiers)
**Cloudflare Pages** (free): connect the repo, set build output dir to
`cadence-main/website`, no build command. **Or Vercel** (free Hobby):
```bash
npm i -g vercel
cd cadence-main/website && vercel        # then `vercel --prod`
```
Point your custom domain at it, and make sure that domain matches `SITE_URL`
and `ALLOWED_ORIGIN` in step 4.

---

## Test checklist (Stripe test mode)
- [ ] Waitlist email arrives in Formspree.
- [ ] A real code unlocks the order card; a fake code is rejected.
- [ ] Checkout completes with test card `4242 4242 4242 4242`, any future date/CVC.
- [ ] After payment, the code shows `redeemed` in Supabase and reusing it fails.
- [ ] `?order=success` banner shows on return.
