-- ============================================================
-- Migration 004: Schedule nightly cleanup of listings older than 8 months
-- Run in Supabase SQL Editor
--
-- BEFORE RUNNING: replace the two placeholders below:
--   YOUR_PROJECT_REF   → your Supabase project ref (e.g. abcdefghijklmno)
--   YOUR_SERVICE_ROLE_KEY → found in Project Settings → API → service_role key
-- ============================================================

-- Enable required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove old schedule if re-running
select cron.unschedule('cleanup-old-listings') where exists (
  select 1 from cron.job where jobname = 'cleanup-old-listings'
);

-- Schedule the edge function to run every day at 4:00 AM UTC
select cron.schedule(
  'cleanup-old-listings',
  '0 4 * * *',
  $$
  select net.http_post(
    url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-old-listings',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body    := '{}'::jsonb
  );
  $$
);
