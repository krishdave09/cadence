// POST /functions/v1/validate-code   { code: string }
// Returns { valid: true } if the code exists and has not been redeemed.
// Does NOT redeem the code — redemption only happens on confirmed payment
// (see stripe-webhook). This endpoint just gates the "unlock order page" step.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// A 'pending' code (checkout started but not paid) is reusable again after this
// many minutes, so an abandoned checkout doesn't permanently burn a code.
const PENDING_TTL_MIN = 30;

function normalize(code: string): string {
  return code.trim().toUpperCase();
}

export function isUsable(row: { status: string; pending_since: string | null }): boolean {
  if (row.status === "available") return true;
  if (row.status === "pending" && row.pending_since) {
    const ageMin = (Date.now() - new Date(row.pending_since).getTime()) / 60000;
    return ageMin > PENDING_TTL_MIN;
  }
  return false; // redeemed | disabled
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let code: string;
  try {
    ({ code } = await req.json());
  } catch {
    return json({ valid: false, error: "bad request" }, 400);
  }
  if (!code || typeof code !== "string") {
    return json({ valid: false, error: "code required" }, 400);
  }

  const { data, error } = await supabase
    .from("access_codes")
    .select("status, pending_since")
    .eq("code", normalize(code))
    .maybeSingle();

  if (error) return json({ valid: false, error: "server error" }, 500);
  if (!data) return json({ valid: false, reason: "not_found" });
  if (!isUsable(data)) return json({ valid: false, reason: "already_used" });

  return json({ valid: true });
});
