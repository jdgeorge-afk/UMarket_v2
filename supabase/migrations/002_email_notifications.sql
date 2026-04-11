-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002: Email notification system
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Expand notifications table
--    Adds message text and metadata JSONB (buyer contact info, save counts, etc.)
alter table notifications add column if not exists message  text;
alter table notifications add column if not exists metadata jsonb default '{}'::jsonb;

-- Allow edge functions (service role) to insert any notification type
-- Service role already bypasses RLS, but this makes intent explicit.
-- The old buyer-only insert policy is kept for backward compat.

-- 2. listing_views — tracks when a listing detail page is opened
create table if not exists listing_views (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(id) on delete cascade not null,
  viewer_id  uuid references profiles(id) on delete set null,  -- nullable = anonymous OK
  viewed_at  timestamptz default now() not null
);

alter table listing_views enable row level security;

-- Anyone (anon or authed) can log a view
create policy "lv_insert_anyone" on listing_views
  for insert with check (true);

-- Only the listing's seller can read view stats
create policy "lv_select_seller" on listing_views
  for select using (
    auth.uid() = (select seller_id from listings where id = listing_id)
  );

-- Index for fast weekly digest queries
create index if not exists listing_views_listing_id_idx on listing_views (listing_id);
create index if not exists listing_views_viewed_at_idx  on listing_views (viewed_at);

-- Index for favorites date range queries (weekly digest)
create index if not exists favorites_created_at_idx on favorites (created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Weekly digest cron job via pg_cron
--
-- SETUP STEPS (one-time, in Supabase Dashboard):
--   a) Database → Extensions → search "pg_cron" → Enable
--   b) Database → Extensions → search "pg_net"  → Enable
--   c) Run the cron.schedule() call below (replace YOUR_PROJECT_REF):
--
-- select cron.schedule(
--   'weekly-digest',
--   '0 8 * * 1',   -- Every Monday at 8:00 AM UTC
--   $$
--     select net.http_post(
--       url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/weekly-digest',
--       headers := jsonb_build_object(
--                    'Content-Type',  'application/json',
--                    'Authorization', 'Bearer ' || current_setting('app.service_role_key')
--                  ),
--       body    := '{}'::jsonb
--     )
--   $$
-- );
--
-- Or use Supabase Dashboard → Edge Functions → weekly-digest → Schedule tab
-- to set the cron expression: 0 8 * * 1
-- ─────────────────────────────────────────────────────────────────────────────

-- 4. Supabase Edge Function secrets to set (Dashboard → Edge Functions → Secrets):
--    RESEND_API_KEY = re_xxxxxxxxxxxxx   (from resend.com)
--
-- Also verify your sending domain "u-market.app" in Resend dashboard:
--    resend.com → Domains → Add Domain → u-market.app → follow DNS instructions
