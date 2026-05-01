-- ============================================================
-- Migration 007: Add sold_at timestamp to listings
-- Lets the nightly cleanup job delete sold listings after 3 days.
-- Run in Supabase SQL Editor
-- ============================================================

alter table listings
  add column if not exists sold_at timestamptz;

-- Back-fill existing sold rows with their updated_at as an approximation
-- (they'll be cleaned up after 3 days from whenever this migration runs)
update listings
  set sold_at = updated_at
  where sold = true and sold_at is null;
