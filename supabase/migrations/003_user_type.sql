-- ============================================================
-- Migration 003: user_type and school_ids on profiles
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add columns
alter table profiles
  add column if not exists user_type  text    default 'student',
  add column if not exists school_ids text[]  default '{}';

-- 2. Update the auto-create trigger so new sign-ups store user_type + school_ids
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_ids text[];
begin
  -- school_ids is stored in auth metadata as a JSON array e.g. ["utah","tcu"]
  begin
    select array(
      select jsonb_array_elements_text(
        (new.raw_user_meta_data -> 'school_ids')::jsonb
      )
    ) into v_school_ids;
  exception when others then
    v_school_ids := '{}';
  end;

  insert into profiles (id, name, verified, user_type, school_ids)
  values (
    new.id,
    new.raw_user_meta_data ->> 'name',
    new.email like '%.edu',
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'user_type'), ''), 'student'),
    coalesce(v_school_ids, '{}')
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  return new;
end;
$$;

-- Re-attach trigger (safe to re-run)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
