-- ============= profiles: hide sensitive columns from other users =============
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, user_id, full_name, avatar_url, registration_number, account_locked, locked_at, created_at, updated_at)
  ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT * FROM public.profiles WHERE user_id = auth.uid()
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_profiles()
RETURNS SETOF public.profiles
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT * FROM public.profiles WHERE public.has_role(auth.uid(), 'admin')
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_profiles() TO authenticated;

-- ============= exam_questions: hide correct_answer =============
REVOKE SELECT ON public.exam_questions FROM authenticated;
GRANT SELECT (id, exam_id, question_text, options, order_index, part, created_at)
  ON public.exam_questions TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_exam_questions(_exam_id uuid)
RETURNS SETOF public.exam_questions
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT * FROM public.exam_questions
   WHERE exam_id = _exam_id AND public.has_role(auth.uid(), 'admin')
   ORDER BY order_index
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_exam_questions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_exam_questions(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.grade_exam_obj_answers(_exam_id uuid, _answers jsonb)
RETURNS integer
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.exam_questions q
   WHERE q.exam_id = _exam_id
     AND q.part = 'obj'
     AND q.correct_answer IS NOT NULL
     AND lower(btrim(q.correct_answer)) = lower(btrim(_answers->>q.id::text))
$$;
REVOKE EXECUTE ON FUNCTION public.grade_exam_obj_answers(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grade_exam_obj_answers(uuid, jsonb) TO authenticated;

-- ============= challenge_questions: hide correct_answer =============
REVOKE SELECT ON public.challenge_questions FROM authenticated;
GRANT SELECT (id, course_id, question_text, options, question_type, created_at)
  ON public.challenge_questions TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_challenge_questions(_course_id uuid)
RETURNS SETOF public.challenge_questions
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT * FROM public.challenge_questions
   WHERE (_course_id IS NULL OR course_id = _course_id)
     AND public.has_role(auth.uid(), 'admin')
   ORDER BY created_at DESC
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_challenge_questions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_challenge_questions(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_challenge_answer(_qid uuid, _answer text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT lower(btrim(correct_answer)) = lower(btrim(_answer))
    FROM public.challenge_questions WHERE id = _qid
$$;
REVOKE EXECUTE ON FUNCTION public.check_challenge_answer(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_challenge_answer(uuid, text) TO authenticated;

-- ============= message_read_receipts: restrict visibility =============
DROP POLICY IF EXISTS "Read receipts visible" ON public.message_read_receipts;
CREATE POLICY "Read receipts visible to participants"
ON public.message_read_receipts FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.chat_messages m
     WHERE m.id = message_read_receipts.message_id
       AND public.is_chat_member(m.chat_id, auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.messages dm
     WHERE dm.id = message_read_receipts.message_id
       AND (dm.sender_id = auth.uid() OR dm.receiver_id = auth.uid())
  )
);

-- ============= chat-media bucket: restrict to owner folder =============
DROP POLICY IF EXISTS "Authenticated upload chat media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete own chat media" ON storage.objects;

CREATE POLICY "Chat media: owner upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Chat media: owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Chat media: owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text);