-- Track what happens to listings when sellers mark them sold or delete them.
-- Populated by the in-app survey ("Did this sell through UMarket?").

create table if not exists listing_outcomes (
  id                  uuid primary key default gen_random_uuid(),
  listing_id          uuid references listings(id) on delete set null,
  seller_id           uuid references profiles(id) on delete set null,
  action              text not null check (action in ('sold', 'deleted')),
  sold_via_umarket    boolean,     -- true = yes, false = no, null = skipped survey
  listing_title       text,
  listing_price       numeric,
  listing_category    text,
  school_id           text,
  seller_name         text,        -- denormalized for outreach without extra joins
  seller_contact      text,        -- their phone / email / instagram / snapchat handle
  seller_contact_type text,        -- 'phone' | 'email' | 'instagram' | 'snapchat'
  created_at          timestamptz default now()
);

-- Sellers can insert their own outcomes; admins can read all
alter table listing_outcomes enable row level security;

create policy "sellers can insert own outcomes"
  on listing_outcomes for insert
  with check (auth.uid() = seller_id);

create policy "admins can read all outcomes"
  on listing_outcomes for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and is_admin = true
    )
  );
