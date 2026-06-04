
-- Eligible questions for a pair of users in a course, scoped to the LOWER lesson position
CREATE OR REPLACE FUNCTION public.pair_eligible_questions(_me uuid, _opp uuid, _course uuid)
RETURNS SETOF public.challenge_questions
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _my_pos int;
  _their_pos int;
  _lower int;
  _allowed_lessons uuid[];
BEGIN
  IF _me IS NULL OR _course IS NULL THEN RETURN; END IF;
  _my_pos := public.user_lesson_position(_me, _course);
  IF _opp IS NULL THEN
    _lower := _my_pos;
  ELSE
    _their_pos := public.user_lesson_position(_opp, _course);
    _lower := LEAST(_my_pos, _their_pos);
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _allowed_lessons
    FROM public.lessons
   WHERE course_id = _course AND order_index <= _lower;

  RETURN QUERY
    SELECT q.*
      FROM public.challenge_questions q
     WHERE q.course_id = _course
       AND (
         -- generic question (no lesson tagging) is always allowed
         q.lesson_ids IS NULL OR array_length(q.lesson_ids,1) IS NULL
         -- otherwise every referenced lesson must be within unlocked scope
         OR NOT EXISTS (
           SELECT 1 FROM unnest(q.lesson_ids) lid
            WHERE lid <> ALL(_allowed_lessons)
         )
       );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pair_eligible_questions(uuid, uuid, uuid) TO authenticated;

-- Harden request_challenge: every submitted question must be in the eligible pair set
CREATE OR REPLACE FUNCTION public.request_challenge(_receiver uuid, _course uuid, _question_ids uuid[], _override boolean DEFAULT false, _target_reg text DEFAULT NULL::text)
 RETURNS TABLE(invitation_id uuid, match_id uuid, warning text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  _bad int;
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

  SELECT EXISTS(SELECT 1 FROM public.enrollments WHERE user_id = _me AND course_id = _course)
    INTO _enrolled;
  IF NOT _enrolled THEN
    INSERT INTO public.matchmaking_audit(requester_id, target_id, target_reg, course_id, outcome, reason, override)
      VALUES (_me, _receiver, _target_reg, _course, 'blocked', 'requester_not_enrolled', _override);
    RAISE EXCEPTION 'you are not enrolled in this course';
  END IF;
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

  -- Enforce fair scope: every submitted question must be in the lower-lesson eligible set
  SELECT COUNT(*) INTO _bad
    FROM unnest(_question_ids) qid
   WHERE qid NOT IN (SELECT id FROM public.pair_eligible_questions(_me, _receiver, _course));
  IF _bad > 0 THEN
    INSERT INTO public.matchmaking_audit(requester_id, target_id, target_reg, course_id,
                                         requester_lesson, target_lesson, outcome, reason, override)
      VALUES (_me, _receiver, _target_reg, _course, _my_pos, _their_pos,
              'blocked', 'questions_out_of_scope', _override);
    RAISE EXCEPTION 'one or more questions are beyond the opponent''s unlocked lessons';
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
$function$;
