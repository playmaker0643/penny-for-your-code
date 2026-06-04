
-- 1) Practicals
CREATE TABLE public.lesson_practicals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  title text NOT NULL,
  prompt text NOT NULL,
  language text NOT NULL DEFAULT 'python',
  starter_code text DEFAULT '',
  reference_solution text,
  visible_tests jsonb NOT NULL DEFAULT '[]'::jsonb,
  hidden_tests jsonb NOT NULL DEFAULT '[]'::jsonb,
  difficulty text NOT NULL DEFAULT 'easy',
  xp_reward integer NOT NULL DEFAULT 20,
  min_engagement_seconds integer NOT NULL DEFAULT 30,
  required boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lesson_practicals TO authenticated;
GRANT ALL ON public.lesson_practicals TO service_role;
ALTER TABLE public.lesson_practicals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practicals readable" ON public.lesson_practicals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage practicals" ON public.lesson_practicals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
REVOKE SELECT (hidden_tests, reference_solution) ON public.lesson_practicals FROM authenticated, anon;
CREATE INDEX idx_lesson_practicals_lesson ON public.lesson_practicals(lesson_id, order_index);
CREATE TRIGGER trg_lesson_practicals_updated BEFORE UPDATE ON public.lesson_practicals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Submissions
CREATE TABLE public.practical_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practical_id uuid NOT NULL REFERENCES public.lesson_practicals(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  code text NOT NULL,
  passed boolean NOT NULL DEFAULT false,
  score integer NOT NULL DEFAULT 0,
  visible_passed integer NOT NULL DEFAULT 0,
  hidden_passed integer NOT NULL DEFAULT 0,
  total_tests integer NOT NULL DEFAULT 0,
  feedback text,
  runtime_ms integer DEFAULT 0,
  attempt_number integer NOT NULL DEFAULT 1,
  hint_level integer NOT NULL DEFAULT 0,
  time_spent_seconds integer NOT NULL DEFAULT 0,
  plagiarism_score numeric DEFAULT 0,
  suspicious boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.practical_submissions TO authenticated;
GRANT ALL ON public.practical_submissions TO service_role;
ALTER TABLE public.practical_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own submissions" ON public.practical_submissions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users insert own submissions" ON public.practical_submissions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_submissions_user_lesson ON public.practical_submissions(user_id, lesson_id);
CREATE INDEX idx_submissions_user_practical ON public.practical_submissions(user_id, practical_id, created_at DESC);

-- 3) XP
CREATE TABLE public.user_xp (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_activity_date date,
  badges jsonb NOT NULL DEFAULT '[]'::jsonb,
  practicals_passed integer NOT NULL DEFAULT 0,
  practicals_attempted integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_xp TO authenticated;
GRANT ALL ON public.user_xp TO service_role;
ALTER TABLE public.user_xp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own xp" ON public.user_xp FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- 4) Engagement
CREATE TABLE public.lesson_engagement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  seconds_active integer NOT NULL DEFAULT 0,
  interactions integer NOT NULL DEFAULT 0,
  last_ping timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);
GRANT SELECT, INSERT, UPDATE ON public.lesson_engagement TO authenticated;
GRANT ALL ON public.lesson_engagement TO service_role;
ALTER TABLE public.lesson_engagement ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own engagement" ON public.lesson_engagement FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5) Helper: lesson practicals complete?
CREATE OR REPLACE FUNCTION public.is_lesson_practical_complete(_user uuid, _lesson uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.lesson_practicals p
    WHERE p.lesson_id = _lesson AND p.required = true
      AND NOT EXISTS (
        SELECT 1 FROM public.practical_submissions s
        WHERE s.user_id = _user AND s.practical_id = p.id AND s.passed = true
      )
  )
$$;

-- 6) Award XP RPC
CREATE OR REPLACE FUNCTION public.award_xp(_amount integer, _passed boolean)
RETURNS public.user_xp LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _row public.user_xp; _uid uuid := auth.uid(); _today date := current_date;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.user_xp(user_id, xp, last_activity_date, current_streak, longest_streak, practicals_attempted, practicals_passed)
    VALUES (_uid, GREATEST(_amount,0), _today, 1, 1, 1, CASE WHEN _passed THEN 1 ELSE 0 END)
  ON CONFLICT (user_id) DO UPDATE
    SET xp = public.user_xp.xp + GREATEST(_amount,0),
        practicals_attempted = public.user_xp.practicals_attempted + 1,
        practicals_passed = public.user_xp.practicals_passed + CASE WHEN _passed THEN 1 ELSE 0 END,
        current_streak = CASE
          WHEN public.user_xp.last_activity_date = _today THEN public.user_xp.current_streak
          WHEN public.user_xp.last_activity_date = _today - 1 THEN public.user_xp.current_streak + 1
          ELSE 1 END,
        longest_streak = GREATEST(public.user_xp.longest_streak,
          CASE
            WHEN public.user_xp.last_activity_date = _today THEN public.user_xp.current_streak
            WHEN public.user_xp.last_activity_date = _today - 1 THEN public.user_xp.current_streak + 1
            ELSE 1 END),
        last_activity_date = _today,
        level = GREATEST(1, ((public.user_xp.xp + GREATEST(_amount,0)) / 200) + 1),
        updated_at = now()
  RETURNING * INTO _row;
  RETURN _row;
END $$;
GRANT EXECUTE ON FUNCTION public.award_xp(integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_lesson_practical_complete(uuid, uuid) TO authenticated;
