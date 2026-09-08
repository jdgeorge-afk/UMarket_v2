-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 009: Sell-prompt outreach bot
--
-- 1. Adds sell_prompt_sent_at to listings (dedup guard)
-- 2. Creates get_sell_prompt_candidates() RPC — called by the edge function
-- 3. Schedules a daily pg_cron job that fires the sell-prompt edge function
--    via pg_net HTTP POST (so it can send emails via Resend)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Guard column
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS sell_prompt_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS listings_sell_prompt_idx
  ON listings (sell_prompt_sent_at)
  WHERE sold = false AND sell_prompt_sent_at IS NULL;

-- 2. RPC: returns candidates for the sell-prompt email
--    Called by the sell-prompt edge function with service_role key, so no RLS.
CREATE OR REPLACE FUNCTION get_sell_prompt_candidates()
RETURNS TABLE (
  listing_id    uuid,
  seller_id     uuid,
  title         text,
  contact_count bigint,
  price         numeric,
  is_housing    boolean
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    l.id            AS listing_id,
    l.seller_id,
    l.title,
    COUNT(cr.id)    AS contact_count,
    l.price,
    l.is_housing
  FROM listings l
  JOIN contact_requests cr ON cr.listing_id = l.id
  WHERE
    l.sold                 = false
    AND l.sell_prompt_sent_at IS NULL
    AND l.created_at       < NOW() - INTERVAL '24 hours'
  GROUP BY l.id, l.seller_id, l.title, l.price, l.is_housing
  HAVING COUNT(cr.id) >= 5;
$$;

-- 3. pg_cron job — fires the edge function daily at 10 AM UTC
--    Requires pg_net extension. Enable it in Supabase Dashboard →
--    Database → Extensions → pg_net if not already on.
--
--    Replace YOUR_PROJECT_REF with your actual Supabase project ref.
--    Replace YOUR_CRON_SECRET with the value you set in Edge Function secrets.
--
SELECT cron.schedule(
  'sell-prompt-outreach',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sell-prompt',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    body    := '{}'::jsonb
  );
  $$
);
