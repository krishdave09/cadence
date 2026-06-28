// POST /functions/v1/create-checkout   { code: string }
// Re-validates the code, marks it 'pending', creates a Stripe Checkout Session
// for the one-time band-kit purchase, and returns { url } to redirect to.
// The code is only marked 'redeemed' later, by stripe-webhook, on payment.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { corsHeaders, json } from "../_shared/cors.ts";

// A 'pending' code (checkout started, not paid) frees up again after this many
// minutes so an abandoned checkout doesn't permanently burn a code. Kept in
// sync with validate-code (inlined here to keep this function self-contained).
const PENDING_TTL_MIN = 30;
function isUsable(row: { status: string; pending_since: string | null }): boolean {
  if (row.status === "available") return true;
  if (row.status === "pending" && row.pending_since) {
    return (Date.now() - new Date(row.pending_since).getTime()) / 60000 > PENDING_TTL_MIN;
  }
  return false; // redeemed | disabled
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

// Site origin to send the buyer back to after checkout.
const SITE_URL = Deno.env.get("SITE_URL") ?? "http://localhost:8080";
// Price: a Stripe Price ID (price_...) is preferred. If unset, we fall back to
// an inline price defined by PRICE_CENTS (default $299.00).
const PRICE_ID = Deno.env.get("STRIPE_PRICE_ID") ?? "";
const PRICE_CENTS = Number(Deno.env.get("PRICE_CENTS") ?? "29900");

function normalize(code: string): string {
  return code.trim().toUpperCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let code: string;
  try {
    ({ code } = await req.json());
  } catch {
    return json({ error: "bad request" }, 400);
  }
  if (!code || typeof code !== "string") return json({ error: "code required" }, 400);
  const norm = normalize(code);

  // Re-check the code right before charging.
  const { data: row, error } = await supabase
    .from("access_codes")
    .select("status, pending_since")
    .eq("code", norm)
    .maybeSingle();
  if (error) return json({ error: "server error" }, 500);
  if (!row) return json({ error: "invalid_code" }, 400);
  if (!isUsable(row)) return json({ error: "already_used" }, 400);

  const line_items = PRICE_ID
    ? [{ price: PRICE_ID, quantity: 1 }]
    : [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: PRICE_CENTS,
          product_data: {
            name: "Cadence band kit",
            description: "Wrist + ankle bands. Early-access reservation.",
          },
        },
      }];

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      // Always create a Stripe Customer for this purchase so the buyer's
      // Cadence account can be linked to it for future accessory purchases.
      customer_creation: "always",
      // Carry the code through to the webhook so we can redeem on payment.
      metadata: { access_code: norm },
      success_url: `${SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/cancelled`,
    });
  } catch (_e) {
    return json({ error: "stripe_error" }, 502);
  }

  // Soft-reserve the code so a second tab can't start a parallel checkout.
  await supabase
    .from("access_codes")
    .update({ status: "pending", pending_since: new Date().toISOString() })
    .eq("code", norm);

  return json({ url: session.url });
});
