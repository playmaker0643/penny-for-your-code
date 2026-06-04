
-- 1) lesson_practicals: switch from table-level SELECT to per-column SELECT
REVOKE SELECT ON public.lesson_practicals FROM authenticated, anon;
GRANT SELECT (id, lesson_id, title, prompt, language, starter_code, visible_tests,
              difficulty, xp_reward, min_engagement_seconds, required, order_index,
              created_at, updated_at)
  ON public.lesson_practicals TO authenticated;

-- 2) profiles: remove broad anon access (logged-out users have no business reading profiles)
REVOKE ALL ON public.profiles FROM anon;
