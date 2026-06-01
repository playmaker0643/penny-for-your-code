REVOKE EXECUTE ON FUNCTION public.find_user_by_email_or_reg(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_by_email_or_reg(text) TO service_role;