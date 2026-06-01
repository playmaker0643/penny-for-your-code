
-- Update registration number format to CBS25XXXX
CREATE OR REPLACE FUNCTION public.generate_registration_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  next_num INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(registration_number FROM 6) AS INT)), 0) + 1
  INTO next_num FROM public.profiles WHERE registration_number IS NOT NULL AND registration_number LIKE 'CBS25%';
  
  -- If no CBS25 numbers exist yet, check old CB- format count to continue sequence
  IF next_num = 1 THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(registration_number FROM 4) AS INT)), 0) + 1
    INTO next_num FROM public.profiles WHERE registration_number IS NOT NULL AND registration_number LIKE 'CB-%';
  END IF;
  
  NEW.registration_number := 'CBS25' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

-- Add completion time to lessons
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS completion_time_minutes integer DEFAULT NULL;
