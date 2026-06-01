-- Restore EXECUTE on SECURITY DEFINER helper functions to authenticated.
-- These functions are used inside RLS policies; without EXECUTE for the
-- calling role, every policy referencing them fails with "permission denied".
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_chat_member(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.find_user_by_email_or_reg(text) TO authenticated;