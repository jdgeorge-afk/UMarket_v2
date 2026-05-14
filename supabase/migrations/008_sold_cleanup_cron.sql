-- Migration 008: Nightly cleanup of sold listings using pg_cron + pg_net
-- Run this in Supabase Dashboard → SQL Editor
--
-- This replaces the edge-function approach (004_cleanup_cron.sql) with a
-- pure-SQL job that needs no CLI deployment.
--
-- BEFORE RUNNING:
--   Replace YOUR_SERVICE_ROLE_KEY with the key from
--   Supabase Dashboard → Settings → API → service_role secret

-- Enable required extensions (safe to run even if already enabled)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove any old cleanup schedules to avoid duplicates
select cron.unschedule('cleanup-old-listings')
  where exists (select 1 from cron.job where jobname = 'cleanup-old-listings');

select cron.unschedule('cleanup-sold-listings')
  where exists (select 1 from cron.job where jobname = 'cleanup-sold-listings');

-- ── Job 1: Delete sold listings older than 7 days ────────────────────────────
select cron.schedule(
  'cleanup-sold-listings',
  '0 4 * * *',   -- every day at 4am UTC
  $$
    delete from listings
    where sold = true
      and sold_at < now() - interval '7 days';
  $$
);

-- ── Job 2: Delete unsold listings older than 8 months ────────────────────────
select cron.schedule(
  'cleanup-old-listings',
  '0 4 * * *',   -- same window, runs right after
  $$
    delete from listings
    where sold = false
      and created_at < now() - interval '8 months';
  $$
);
