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
  avatar_url    text,           -- public URL of uploaded profile photo
  is_admin      boolean default false, -- grants access to admin dashboard
  verified      boolean default false,
  created_at    timestamptz default now()
);

-- Migrations: run these if profiles table already exists
-- alter table profiles add column if not exists avatar_url text;
-- alter table profiles add column if not exists is_admin boolean default false;

-- listings: items for sale, housing posts, and "looking for" requests
create table if not exists listings (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  price           numeric(10,2),      -- null for "looking for" listings
  category        text not null,      -- 'textbooks','furniture','housing', etc.
  condition       text,               -- 'New','Like New','Good','Fair','Poor'
  description     text,
  location        text,
  images          text[] default '{}',-- array of Supabase Storage public URLs
  seller_id       uuid references profiles(id) on delete cascade,
  school_id       text not null,      -- school slug: 'utah', 'tcu', etc.
  boosted         boolean default false,
  boost_expires_at timestamptz,       -- when the active boost ends
  is_housing      boolean default false,
  is_looking      boolean default false,
  -- housing-specific fields
  beds            int,
  avail           text,               -- e.g. 'Aug 2025'
  size            text,               -- e.g. '1BR/1BA'
  -- looking-for field
  budget          numeric(10,2),
  sold            boolean default false,
  created_at      timestamptz default now()
);

-- Migration: run these if tables already exist
-- alter table listings add column if not exists boost_expires_at timestamptz;

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

-- boosts: seller-submitted boost requests; admin approves when payment received
create table if not exists boosts (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references listings(id) on delete cascade,
  seller_id     uuid references profiles(id) on delete cascade,
  days          int not null,               -- days of boost requested
  total_price   numeric(10,2) not null,     -- days * 3
  status        text default 'pending',     -- 'pending' | 'active' | 'rejected'
  note          text,                       -- optional note from seller
  admin_note    text,                       -- admin's internal note
  created_at    timestamptz default now(),
  activated_at  timestamptz,
  expires_at    timestamptz
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles  enable row level security;
alter table listings  enable row level security;
alter table favorites enable row level security;
alter table reports   enable row level security;
alter table boosts    enable row level security;

-- profiles: anyone can read; only the owner (or admin) can write
create policy "profiles_select_all"    on profiles for select using (true);
create policy "profiles_insert_own"    on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own"    on profiles for update using (auth.uid() = id);
create policy "profiles_update_admin"  on profiles for update using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
create policy "profiles_delete_own"    on profiles for delete using (auth.uid() = id);

-- listings: anyone can read; seller or admin can update; only seller can insert/delete
create policy "listings_select_all"    on listings for select using (true);
create policy "listings_insert_own"    on listings for insert with check (auth.uid() = seller_id);
create policy "listings_update_own"    on listings for update using (auth.uid() = seller_id);
create policy "listings_update_admin"  on listings for update using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
create policy "listings_delete_own"    on listings for delete using (auth.uid() = seller_id);

-- favorites: only the owner can see or change their favorites
create policy "favorites_all_own"      on favorites for all using (auth.uid() = user_id);

-- reports: authenticated users can insert; admins can read all
create policy "reports_insert_auth"    on reports for insert with check (auth.uid() = reporter_id);
create policy "reports_select_admin"   on reports for select using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);

-- boosts: sellers can insert/read their own; admins can read and update all
create policy "boosts_insert_own"      on boosts for insert with check (auth.uid() = seller_id);
create policy "boosts_select_own"      on boosts for select using (auth.uid() = seller_id);
create policy "boosts_select_admin"    on boosts for select using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
create policy "boosts_update_admin"    on boosts for update using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);

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
  )
  on conflict (id) do nothing;          -- safe to re-run / retry
  return new;
exception when others then
  -- Never let a profile-creation failure block the auth user from being created
  return new;
end;
$$;

-- Drop the trigger first so re-running this file is safe
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- STORAGE BUCKETS (reminder — do this manually in the dashboard)
-- ============================================================
-- Bucket 1: listing-images
-- 1. Go to Storage in your Supabase dashboard
-- 2. Click "New bucket", Name: listing-images, toggle Public ON
--
-- Bucket 2: avatars (for profile photos)
-- 1. Click "New bucket", Name: avatars, toggle Public ON
--
-- The INSERT below is shown for reference but may conflict with
-- existing data if run twice. Use the dashboard UI instead.
-- insert into storage.buckets (id, name, public)
-- values ('listing-images', 'listing-images', true)
-- on conflict (id) do nothing;
