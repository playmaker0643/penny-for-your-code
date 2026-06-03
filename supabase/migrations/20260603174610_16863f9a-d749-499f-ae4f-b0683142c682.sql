CREATE POLICY "Students self check-in today" ON public.attendance
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND date = CURRENT_DATE AND status = 'present');