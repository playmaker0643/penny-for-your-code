ALTER TABLE public.challenge_questions
  ADD COLUMN IF NOT EXISTS min_level integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_level integer NOT NULL DEFAULT 999,
  ADD COLUMN IF NOT EXISTS lesson_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

CREATE INDEX IF NOT EXISTS challenge_questions_level_range_idx
  ON public.challenge_questions (min_level, max_level);

GRANT SELECT (id, course_id, question_text, options, min_level, max_level, lesson_ids, created_at)
  ON public.challenge_questions TO authenticated;

CREATE OR REPLACE FUNCTION public.eligible_challenge_questions(_user uuid, _course uuid DEFAULT NULL)
RETURNS SETOF public.challenge_questions
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH lvl AS (
    SELECT COALESCE((SELECT level FROM public.user_xp WHERE user_id = _user), 1) AS user_level
  )
  SELECT q.* FROM public.challenge_questions q, lvl
   WHERE (_course IS NULL OR q.course_id = _course)
     AND lvl.user_level BETWEEN q.min_level AND q.max_level
  ORDER BY q.created_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.eligible_challenge_questions(uuid, uuid) TO authenticated;