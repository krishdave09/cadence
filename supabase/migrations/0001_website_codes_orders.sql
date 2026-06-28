-- Cadence public website — access codes + orders
-- Runs on Supabase Postgres. These tables back the coming-soon order gate.
-- They are completely separate from the FastAPI/PHI backend: no patient,
-- caregiver, clinician, or health data ever lives here.
--
-- Apply with the Supabase CLI:   supabase db push
-- or paste into the Supabase dashboard SQL editor.

-- ---------------------------------------------------------------------------
-- access_codes: one unique, single-use code per invited waitlist client.
-- "Sequential" hand-out is supported by the auto-incrementing `seq` column —
-- mint a batch, then give them out in seq order.
-- ---------------------------------------------------------------------------
create table if not exists public.access_codes (
  id            uuid primary key default gen_random_uuid(),
  seq           bigint generated always as identity,   -- hand-out order
  code          text not null unique,                  -- e.g. CAD-7Q4M-2KX9
  label         text,                                  -- optional note: who it's for
  status        text not null default 'available'
                  check (status in ('available','pending','redeemed','disabled')),
  pending_since timestamptz,                            -- set when checkout starts
  redeemed_at   timestamptz,
  redeemed_email text,
  stripe_session_id text,
  created_at    timestamptz not null default now()
);

create index if not exists access_codes_status_idx on public.access_codes (status);

-- ---------------------------------------------------------------------------
-- orders: one row per completed Stripe Checkout payment.
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  code              text references public.access_codes(code),
  stripe_session_id text not null unique,
  email             text,
  amount_total      integer,        -- cents
  currency          text,
  status            text not null default 'paid',
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security: lock everything down. Only the Edge Functions, which
-- use the service-role key, may read/write. The public anon key (shipped in
-- the website) gets NOTHING — so codes can never be enumerated from the
-- browser. With RLS enabled and no policies, anon/auth roles are denied.
-- ---------------------------------------------------------------------------
alter table public.access_codes enable row level security;
alter table public.orders        enable row level security;

-- (Intentionally no policies for anon/authenticated. service_role bypasses RLS.)
