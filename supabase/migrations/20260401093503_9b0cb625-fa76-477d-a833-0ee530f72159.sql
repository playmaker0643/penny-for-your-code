
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS second_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS other_names text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address text;

CREATE OR REPLACE FUNCTION public.generate_registration_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  next_num INT;
  year_prefix TEXT;
BEGIN
  year_prefix := 'CBS' || TO_CHAR(NOW(), 'YY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(registration_number FROM 6) AS INT)), 0) + 1
  INTO next_num FROM public.profiles 
  WHERE registration_number IS NOT NULL 
  AND registration_number LIKE year_prefix || '%';
  
  NEW.registration_number := year_prefix || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, first_name, second_name, other_names, phone, date_of_birth, country, state, town, address, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'second_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'other_names', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    CASE WHEN NEW.raw_user_meta_data->>'date_of_birth' IS NOT NULL AND NEW.raw_user_meta_data->>'date_of_birth' != '' 
         THEN (NEW.raw_user_meta_data->>'date_of_birth')::date 
         ELSE NULL END,
    COALESCE(NEW.raw_user_meta_data->>'country', ''),
    COALESCE(NEW.raw_user_meta_data->>'state', ''),
    COALESCE(NEW.raw_user_meta_data->>'town', ''),
    COALESCE(NEW.raw_user_meta_data->>'address', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$function$;
