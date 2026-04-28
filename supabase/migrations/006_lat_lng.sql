-- ============================================================
-- Migration 006: Add lat/lng to listings for housing map preview
-- Run in Supabase SQL Editor
-- ============================================================

alter table listings
  add column if not exists lat numeric(9, 6),
  add column if not exists lng numeric(9, 6);
