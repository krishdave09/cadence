// Public website configuration. These values are PUBLIC by design and safe to
// ship in the browser:
//   - The Supabase anon key is meant for client use; Row Level Security keeps
//     the access_codes table unreadable from the browser.
//   - All secret keys (Stripe secret, service role, webhook secret) live ONLY
//     in Supabase Edge Function secrets, never here.
//
// Fill these in after you create your Supabase project
// (dashboard → Project Settings → API).
window.CADENCE_CONFIG = {
  // Supabase Edge Functions base (project: nomgiftvoegzoelhrzqz).
  FUNCTIONS_URL: "https://nomgiftvoegzoelhrzqz.supabase.co/functions/v1",
  // Supabase publishable (anon) key — public, safe in the browser. RLS keeps
  // the access_codes table unreadable from here.
  SUPABASE_ANON_KEY: "sb_publishable_BfVKpBmH9l3SQOUEXXuBSQ_uknDBYZ5",
  // Stripe publishable key (test mode). NOT used by the current redirect-to-
  // Checkout flow (the server-side Edge Function holds the secret key); kept
  // here only if you later switch to embedded Stripe.js / Payment Elements.
  STRIPE_PUBLISHABLE_KEY: "pk_test_51Tn5ATAVOlP1Lz7nVXD790j0c7BkffczgIZstHfy58gxlADrmRKHNqhXLqThk63SwPXIkRVQgZ54aN2YIEIsLtuR00AsvfK1ZY",
  // Display price shown on the order card. The real charge is set in Stripe /
  // the create-checkout function (PRICE_CENTS or STRIPE_PRICE_ID).
  PRICE_DISPLAY: "$299",
  // Product image. Drop your real band photo at website/assets/product.png
  // (or change this path). Leave as-is to use the bundled placeholder.
  PRODUCT_IMAGE: "assets/product.jpg",
};
