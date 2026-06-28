// POST /functions/v1/order-status   { session_id: string }
// Returns the commerce status of a completed Stripe Checkout session so the
// post-payment page can confirm payment and pre-fill / link the new account.
// Returns ONLY commerce fields (paid, email, stripe_customer_id) — never PHI.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let session_id: string;
  try {
    ({ session_id } = await req.json());
  } catch {
    return json({ error: "bad request" }, 400);
  }
  if (!session_id || typeof session_id !== "string") {
    return json({ error: "session_id required" }, 400);
  }

  const { data: row, error } = await supabase
    .from("orders")
    .select("status, email, stripe_customer_id")
    .eq("stripe_session_id", session_id)
    .maybeSingle();
  if (error) return json({ error: "server error" }, 500);

  // The webhook may not have landed yet right after redirect; report not-paid
  // rather than erroring so the page can poll.
  if (!row) return json({ paid: false });

  return json({
    paid: row.status === "paid",
    email: row.email ?? null,
    stripe_customer_id: row.stripe_customer_id ?? null,
  });
});
