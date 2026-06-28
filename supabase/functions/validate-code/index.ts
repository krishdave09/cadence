// POST /functions/v1/validate-code   { code: string }
// Returns { valid: true } if the code exists and has not been redeemed.
// Does NOT redeem the code — redemption only happens on confirmed payment.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 1. Hardcode CORS headers so we don't rely on external files breaking
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 2. Helper function to ensure EVERY response gets CORS headers
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

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
  // Handle CORS Preflight check from the browser
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Enforce POST
  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  // Safely parse the body
  let code: string;
  try {
    const body = await req.json();
    code = body.code;
  } catch {
    return jsonResponse({ valid: false, error: "bad request" }, 400);
  }

  if (!code || typeof code !== "string") {
    return jsonResponse({ valid: false, error: "code required" }, 400);
  }

  // Query Supabase securely
  const { data, error } = await supabase
    .from("access_codes")
    .select("status, pending_since")
    .eq("code", normalize(code))
    .maybeSingle();

  if (error) {
    console.error("Supabase Error:", error);
    return jsonResponse({ valid: false, error: "server error" }, 500);
  }

  if (!data) return jsonResponse({ valid: false, reason: "not_found" });
  if (!isUsable(data)) return jsonResponse({ valid: false, reason: "already_used" });

  // Code is valid!
  return jsonResponse({ valid: true });
});
