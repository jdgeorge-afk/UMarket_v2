-- ============================================================
-- Migration 005: Allow buyers to delete their own contact_requests
-- Run in Supabase SQL Editor
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'contact_requests'
    and policyname  = 'cr_delete_buyer'
  ) then
    create policy "cr_delete_buyer" on contact_requests
      for delete using (auth.uid() = buyer_id);
  end if;
end $$;
