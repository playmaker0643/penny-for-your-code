-- Returns an arbitrary admin's user_id (or NULL if none exist).
-- SECURITY DEFINER so signed-in students can find an admin even though
-- the user_roles RLS only exposes their own row.
CREATE OR REPLACE FUNCTION public.get_one_admin()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.user_roles WHERE role = 'admin' ORDER BY created_at LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.get_one_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_one_admin() TO authenticated;