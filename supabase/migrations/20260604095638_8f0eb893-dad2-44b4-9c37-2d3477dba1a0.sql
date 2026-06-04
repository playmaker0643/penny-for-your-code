
-- 1. Per-course matchmaking config
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS match_lesson_range int NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS match_cross_course boolean NOT NULL DEFAULT false;

-- 2. Audit log
CREATE TABLE IF NOT EXISTS public.matchmaking_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  target_id uuid,
  target_reg text,
  course_id uuid,
  requester_lesson int,
  target_lesson int,
  outcome text NOT NULL,
  reason text,
  override boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.matchmaking_audit TO authenticated;
GRANT ALL ON public.matchmaking_audit TO service_role;
ALTER TABLE public.matchmaking_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own audit" ON public.matchmaking_audit;
CREATE POLICY "Users see own audit" ON public.matchmaking_audit
  FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_mm_audit_req ON public.matchmaking_audit(requester_id, created_at DESC);

-- 3. User lesson position in a course (next incomplete order_index, or last completed + 1)
CREATE OR REPLACE FUNCTION public.user_lesson_position(_user uuid, _course uuid)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH course_lessons AS (
    SELECT id, order_index FROM public.lessons WHERE course_id = _course
  ),
  completed AS (
    SELECT cl.order_index
      FROM course_lessons cl
      JOIN public.lesson_progress lp
        ON lp.lesson_id = cl.id
       AND lp.user_id = _user
       AND lp.completed = true
  )
  SELECT COALESCE(
    -- first lesson the user hasn't completed
    (SELECT MIN(cl.order_index) FROM course_lessons cl
       WHERE cl.order_index NOT IN (SELECT order_index FROM completed)),
    -- otherwise last completed + 1
    (SELECT MAX(order_index) + 1 FROM completed),
    1
  );
$$;

-- 4. Discover eligible peers (same course, in lesson range)
CREATE OR REPLACE FUNCTION public.discover_challenge_peers(_course uuid)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  registration_number text,
  country text,
  lesson_position int,
  is_online boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _my_pos int;
  _range int;
  _cross boolean;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT match_lesson_range, match_cross_course INTO _range, _cross
    FROM public.courses WHERE id = _course;
  IF _range IS NULL THEN _range := 2; END IF;
  _my_pos := public.user_lesson_position(_me, _course);

  RETURN QUERY
    SELECT p.user_id, p.full_name, p.registration_number, p.country,
           public.user_lesson_position(p.user_id, _course) AS lesson_position,
           COALESCE(pr.is_online, false) AS is_online
      FROM public.profiles p
      JOIN public.enrollments e
        ON e.user_id = p.user_id AND e.course_id = _course
      LEFT JOIN public.user_presence pr ON pr.user_id = p.user_id
     WHERE p.user_id <> _me
       AND NOT public.has_role(p.user_id, 'admin')
       AND abs(public.user_lesson_position(p.user_id, _course) - _my_pos) <= _range
     ORDER BY abs(public.user_lesson_position(p.user_id, _course) - _my_pos), p.full_name;
END;
$$;

-- 5. Request challenge: validates everything, creates invitation + match atomically
CREATE OR REPLACE FUNCTION public.request_challenge(
  _receiver uuid,
  _course uuid,
  _question_ids uuid[],
  _override boolean DEFAULT false,
  _target_reg text DEFAULT NULL
)
RETURNS TABLE (invitation_id uuid, match_id uuid, warning text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _range int;
  _my_pos int;
  _their_pos int;
  _enrolled boolean;
  _diff int;
  _inv uuid;
  _match uuid;
  _warn text := NULL;
  _is_admin_receiver boolean;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _receiver IS NULL OR _receiver = _me THEN
    INSERT INTO public.matchmaking_audit(requester_id, target_id, target_reg, course_id, outcome, reason, override)
      VALUES (_me, _receiver, _target_reg, _course, 'blocked', 'invalid_target', _override);
    RAISE EXCEPTION 'invalid target';
  END IF;
  IF _course IS NULL THEN
    INSERT INTO public.matchmaking_audit(requester_id, target_id, target_reg, course_id, outcome, reason, override)
      VALUES (_me, _receiver, _target_reg, _course, 'blocked', 'no_course', _override);
    RAISE EXCEPTION 'course required';
  END IF;
  IF _question_ids IS NULL OR array_length(_question_ids,1) < 1 THEN
    RAISE EXCEPTION 'no questions';
  END IF;

  SELECT public.has_role(_receiver,'admin') INTO _is_admin_receiver;
  IF _is_admin_receiver THEN
    INSERT INTO public.matchmaking_audit(requester_id, target_id, target_reg, course_id, outcome, reason, override)
      VALUES (_me, _receiver, _target_reg, _course, 'blocked', 'target_is_admin', _override);
    RAISE EXCEPTION 'cannot challenge admin';
  END IF;

  -- both must be enrolled (requester)
  SELECT EXISTS(SELECT 1 FROM public.enrollments WHERE user_id = _me AND course_id = _course)
    INTO _enrolled;
  IF NOT _enrolled THEN
    INSERT INTO public.matchmaking_audit(requester_id, target_id, target_reg, course_id, outcome, reason, override)
      VALUES (_me, _receiver, _target_reg, _course, 'blocked', 'requester_not_enrolled', _override);
    RAISE EXCEPTION 'you are not enrolled in this course';
  END IF;
  -- target enrolment (skippable only with cross_course flag on course)
  IF NOT EXISTS(SELECT 1 FROM public.enrollments WHERE user_id = _receiver AND course_id = _course) THEN
    IF NOT EXISTS(SELECT 1 FROM public.courses WHERE id = _course AND match_cross_course = true) THEN
      INSERT INTO public.matchmaking_audit(requester_id, target_id, target_reg, course_id, outcome, reason, override)
        VALUES (_me, _receiver, _target_reg, _course, 'blocked', 'target_not_enrolled', _override);
      RAISE EXCEPTION 'opponent is not enrolled in this course';
    END IF;
  END IF;

  SELECT COALESCE(match_lesson_range, 2) INTO _range FROM public.courses WHERE id = _course;
  _my_pos := public.user_lesson_position(_me, _course);
  _their_pos := public.user_lesson_position(_receiver, _course);
  _diff := abs(_my_pos - _their_pos);

  IF _diff > _range THEN
    IF _override THEN
      _warn := format('Progression gap of %s lessons — opponent is %s', _diff,
        CASE WHEN _their_pos > _my_pos THEN 'ahead of you' ELSE 'behind you' END);
    ELSE
      INSERT INTO public.matchmaking_audit(requester_id, target_id, target_reg, course_id,
                                           requester_lesson, target_lesson, outcome, reason, override)
        VALUES (_me, _receiver, _target_reg, _course, _my_pos, _their_pos, 'blocked', 'out_of_range', false);
      RAISE EXCEPTION 'opponent is outside the allowed lesson range (±%)', _range;
    END IF;
  END IF;

  INSERT INTO public.challenge_invitations(sender_id, receiver_id, course_id, status)
    VALUES (_me, _receiver, _course, 'pending')
    RETURNING id INTO _inv;

  INSERT INTO public.challenge_matches(invitation_id, course_id, player_one_id, player_two_id, question_ids, status)
    VALUES (_inv, _course, _me, _receiver, _question_ids, 'pending')
    RETURNING id INTO _match;

  INSERT INTO public.matchmaking_audit(requester_id, target_id, target_reg, course_id,
                                       requester_lesson, target_lesson, outcome, reason, override)
    VALUES (_me, _receiver, _target_reg, _course, _my_pos, _their_pos,
            'accepted', CASE WHEN _override AND _diff > _range THEN 'manual_override' ELSE NULL END, _override);

  invitation_id := _inv;
  match_id := _match;
  warning := _warn;
  RETURN NEXT;
END;
$$;

-- 6. Lock down direct invitation creation — must go through request_challenge
REVOKE INSERT ON public.challenge_invitations FROM authenticated, anon;

-- Allow only service_role + the SECURITY DEFINER function to insert
-- (function runs as definer, so this is fine).
