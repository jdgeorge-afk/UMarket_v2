-- ============================================================
-- UMarket Database Schema
-- Run this entire file in the Supabase SQL Editor (one paste).
-- ============================================================

-- Enable UUID generation (needed for gen_random_uuid())
create extension if not exists pgcrypto;

-- ============================================================
-- TABLES
-- ============================================================

-- profiles: one row per user, auto-created by trigger below
create table if not exists profiles (
  id            uuid primary key references auth.users on delete cascade,
  name          text,
  school        text,
  grade         text,           -- e.g. 'Freshman', 'Senior', 'Grad'
  score         numeric(3,1) default 5.0,
  transactions  int default 0,
  sold_count    int default 0,
  contact       text,           -- the actual value (phone number, email, IG handle)
  contact_type  text,           -- 'phone' | 'email' | 'instagram'
  verified      boolean default false,
  created_at    timestamptz default now()
);

-- listings: items for sale, housing posts, and "looking for" requests
create table if not exists listings (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  price         numeric(10,2),      -- null for "looking for" listings
  category      text not null,      -- 'textbooks','furniture','housing', etc.
  condition     text,               -- 'New','Like New','Good','Fair','Poor'
  description   text,
  location      text,
  images        text[] default '{}',-- array of Supabase Storage public URLs
  seller_id     uuid references profiles(id) on delete cascade,
  school_id     text not null,      -- school slug: 'utah', 'tcu', etc.
  boosted       boolean default false,
  is_housing    boolean default false,
  is_looking    boolean default false,
  -- housing-specific fields
  beds          int,
  avail         text,               -- e.g. 'Aug 2025'
  size          text,               -- e.g. '1BR/1BA'
  -- looking-for field
  budget        numeric(10,2),
  sold          boolean default false,
  created_at    timestamptz default now()
);

-- favorites: users saving listings they like
create table if not exists favorites (
  user_id       uuid references profiles(id) on delete cascade,
  listing_id    uuid references listings(id) on delete cascade,
  created_at    timestamptz default now(),
  primary key (user_id, listing_id)
);

-- reports: flagged listings
create table if not exists reports (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references listings(id) on delete cascade,
  reporter_id   uuid references profiles(id) on delete cascade,
  reason        text not null,
  note          text,
  created_at    timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles  enable row level security;
alter table listings  enable row level security;
alter table favorites enable row level security;
alter table reports   enable row level security;

-- profiles: anyone can read; only the owner can write their own row
create policy "profiles_select_all"    on profiles for select using (true);
create policy "profiles_insert_own"    on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own"    on profiles for update using (auth.uid() = id);
create policy "profiles_delete_own"    on profiles for delete using (auth.uid() = id);

-- listings: anyone can read; only the seller can insert / update / delete
create policy "listings_select_all"    on listings for select using (true);
create policy "listings_insert_own"    on listings for insert with check (auth.uid() = seller_id);
create policy "listings_update_own"    on listings for update using (auth.uid() = seller_id);
create policy "listings_delete_own"    on listings for delete using (auth.uid() = seller_id);

-- favorites: only the owner can see or change their favorites
create policy "favorites_all_own"      on favorites for all using (auth.uid() = user_id);

-- reports: any authenticated user can insert; no one can read via API
create policy "reports_insert_auth"    on reports for insert with check (auth.uid() = reporter_id);

-- ============================================================
-- TRIGGER: auto-create a profile row when a new user signs up
-- ============================================================
-- This fires immediately after Supabase creates the auth.users row,
-- so by the time the app receives the auth confirmation the profile exists.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer   -- runs with superuser privileges so it can insert into profiles
set search_path = public
as $$
begin
  insert into profiles (id, name, verified)
  values (
    new.id,
    new.raw_user_meta_data ->> 'name',  -- passed from signUp({ options: { data: { name } } })
    new.email like '%.edu'              -- auto-verify .edu email addresses
  );
  return new;
end;
$$;

-- Drop the trigger first so re-running this file is safe
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- STORAGE BUCKET (reminder — do this manually in the dashboard)
-- ============================================================
-- 1. Go to Storage in your Supabase dashboard
-- 2. Click "New bucket"
-- 3. Name: listing-images
-- 4. Toggle "Public bucket" ON
-- 5. Click "Create bucket"
--
-- The INSERT below is shown for reference but may conflict with
-- existing data if run twice. Use the dashboard UI instead.
-- insert into storage.buckets (id, name, public)
-- values ('listing-images', 'listing-images', true)
-- on conflict (id) do nothing;
