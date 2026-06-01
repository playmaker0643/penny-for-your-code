
CREATE OR REPLACE FUNCTION public.find_user_by_email_or_reg(_input text)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_id uuid;
BEGIN
  -- Try registration number first
  SELECT user_id INTO found_id FROM public.profiles
  WHERE registration_number = _input;
  IF found_id IS NOT NULL THEN RETURN found_id; END IF;

  -- Try email from auth.users
  SELECT id INTO found_id FROM auth.users
  WHERE email = lower(_input);
  RETURN found_id;
END;
$$;
