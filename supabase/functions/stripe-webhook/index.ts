// POST /functions/v1/stripe-webhook
// Stripe calls this on payment events. On checkout.session.completed we mark
// the access code 'redeemed' (single-use enforced here) and record the order.
//
// IMPORTANT: deploy this function with JWT verification DISABLED, because
// Stripe calls it without a Supabase JWT:
//     supabase functions deploy stripe-webhook --no-verify-jwt
// Security comes from verifying the Stripe signature instead.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text(); // raw body required for signature check
  if (!sig) return new Response("missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, WEBHOOK_SECRET);
  } catch (_e) {
    return new Response("bad signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    const code = s.metadata?.access_code ?? null;
    const email = s.customer_details?.email ?? s.customer_email ?? null;
    const customerId = typeof s.customer === "string" ? s.customer : s.customer?.id ?? null;

    if (code) {
      await supabase
        .from("access_codes")
        .update({
          status: "redeemed",
          redeemed_at: new Date().toISOString(),
          redeemed_email: email,
          stripe_session_id: s.id,
        })
        .eq("code", code);
    }

    // Record the order (idempotent on the unique session id).
    await supabase.from("orders").upsert(
      {
        code,
        stripe_session_id: s.id,
        stripe_customer_id: customerId,
        email,
        amount_total: s.amount_total,
        currency: s.currency,
        status: "paid",
      },
      { onConflict: "stripe_session_id" },
    );
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
