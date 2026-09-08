-- Returns the true auth user count — only callable by admin users.
CREATE OR REPLACE FUNCTION get_auth_user_count()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COUNT(*)
  FROM auth.users
  WHERE EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_admin = true
  );
$$;
