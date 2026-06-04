
-- ============================================================
-- 1. Reaffirm column-level revokes on answer-key tables
-- ============================================================
REVOKE SELECT ON public.lesson_questions FROM authenticated, anon;
GRANT SELECT (id, lesson_id, question_type, question_text, options, order_index, created_at)
  ON public.lesson_questions TO authenticated;

REVOKE SELECT ON public.exam_questions FROM authenticated, anon;
GRANT SELECT (id, exam_id, part, question_text, options, order_index, created_at)
  ON public.exam_questions TO authenticated;

REVOKE SELECT ON public.challenge_questions FROM authenticated, anon;
GRANT SELECT (id, course_id, question_type, question_text, options, created_at, min_level, max_level, lesson_ids)
  ON public.challenge_questions TO authenticated;

-- ============================================================
-- 2. Hide hidden_tests and reference_solution on lesson_practicals
-- ============================================================
REVOKE SELECT ON public.lesson_practicals FROM authenticated, anon;
GRANT SELECT (id, lesson_id, title, prompt, language, starter_code,
              visible_tests, difficulty, xp_reward, min_engagement_seconds,
              required, order_index, created_at, updated_at)
  ON public.lesson_practicals TO authenticated;

-- ============================================================
-- 3. Restrict sensitive profile fields to owner + admin
-- ============================================================
REVOKE SELECT ON public.profiles FROM authenticated, anon;
GRANT SELECT (id, user_id, full_name, first_name, second_name, other_names,
              registration_number, avatar_url, country, account_locked,
              created_at, updated_at)
  ON public.profiles TO authenticated;
-- phone, date_of_birth, address, town, state, locked_at are now hidden
-- Owner/admin reach them via public.get_my_profile() and admin_list_profiles()

-- Make sure admin_list_profiles returns the *full* row regardless of column grants
-- (SECURITY DEFINER already bypasses column privileges — no change needed)

-- ============================================================
-- 4. Lock down challenge_invitations INSERT
-- ============================================================
DROP POLICY IF EXISTS "Sender creates invitation" ON public.challenge_invitations;
REVOKE INSERT ON public.challenge_invitations FROM authenticated, anon;
-- All invitation inserts now go through SECURITY DEFINER RPCs:
--   public.request_challenge(...)
--   public.create_quick_invite(...)

CREATE OR REPLACE FUNCTION public.create_quick_invite(_receiver uuid, _chat_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _inv uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _receiver IS NULL OR _receiver = _me THEN
    RAISE EXCEPTION 'invalid receiver';
  END IF;
  IF public.has_role(_receiver, 'admin') THEN
    RAISE EXCEPTION 'cannot challenge admin';
  END IF;
  IF _chat_id IS NOT NULL AND NOT public.is_chat_member(_chat_id, _me) THEN
    RAISE EXCEPTION 'not a chat member';
  END IF;

  INSERT INTO public.challenge_invitations(sender_id, receiver_id, chat_id, status)
    VALUES (_me, _receiver, _chat_id, 'pending')
    RETURNING id INTO _inv;
  RETURN _inv;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_quick_invite(uuid, uuid) TO authenticated;

-- ============================================================
-- 5. Lock down challenge_matches UPDATE to progress columns only
-- ============================================================
REVOKE UPDATE ON public.challenge_matches FROM authenticated, anon;
GRANT UPDATE (player_one_current_index, player_two_current_index)
  ON public.challenge_matches TO authenticated;

-- Server-validated score submission
CREATE OR REPLACE FUNCTION public.submit_match_answer(
  _match_id uuid, _qid uuid, _answer text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _m public.challenge_matches;
  _correct boolean;
  _am_p1 boolean;
  _expected_idx int;
  _new_score int;
  _new_idx int;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO _m FROM public.challenge_matches WHERE id = _match_id;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'match not found'; END IF;
  IF _me <> _m.player_one_id AND _me <> _m.player_two_id THEN
    RAISE EXCEPTION 'not a player in this match';
  END IF;
  IF _m.status NOT IN ('active','pending') THEN
    RAISE EXCEPTION 'match not active';
  END IF;
  IF NOT (_qid = ANY(_m.question_ids)) THEN
    RAISE EXCEPTION 'question not part of this match';
  END IF;

  _am_p1 := (_me = _m.player_one_id);
  _expected_idx := CASE WHEN _am_p1 THEN _m.player_one_current_index ELSE _m.player_two_current_index END;

  -- Only allow scoring the current question (prevent skipping/double-counting)
  IF _m.question_ids[_expected_idx + 1] <> _qid THEN
    RAISE EXCEPTION 'out of turn question';
  END IF;

  SELECT public.check_challenge_answer(_qid, _answer) INTO _correct;

  IF _am_p1 THEN
    _new_score := _m.player_one_score + CASE WHEN _correct THEN 1 ELSE 0 END;
    _new_idx := _m.player_one_current_index + 1;
    UPDATE public.challenge_matches
       SET player_one_score = _new_score,
           player_one_current_index = _new_idx
     WHERE id = _match_id;
  ELSE
    _new_score := _m.player_two_score + CASE WHEN _correct THEN 1 ELSE 0 END;
    _new_idx := _m.player_two_current_index + 1;
    UPDATE public.challenge_matches
       SET player_two_score = _new_score,
           player_two_current_index = _new_idx
     WHERE id = _match_id;
  END IF;

  RETURN jsonb_build_object(
    'correct', _correct,
    'my_score', _new_score,
    'my_index', _new_idx
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_match_answer(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.finalize_match(_match_id uuid)
RETURNS public.challenge_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _m public.challenge_matches;
  _winner uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO _m FROM public.challenge_matches WHERE id = _match_id;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'match not found'; END IF;
  IF _me <> _m.player_one_id AND _me <> _m.player_two_id THEN
    RAISE EXCEPTION 'not a player';
  END IF;
  IF _m.status = 'completed' THEN
    RETURN _m;
  END IF;

  IF _m.player_one_score > _m.player_two_score THEN _winner := _m.player_one_id;
  ELSIF _m.player_two_score > _m.player_one_score THEN _winner := _m.player_two_id;
  ELSE _winner := NULL;
  END IF;

  UPDATE public.challenge_matches
     SET status = 'completed', completed_at = now(), winner_id = _winner
   WHERE id = _match_id
   RETURNING * INTO _m;
  RETURN _m;
END;
$$;
GRANT EXECUTE ON FUNCTION public.finalize_match(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_match(_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _m public.challenge_matches;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO _m FROM public.challenge_matches WHERE id = _match_id;
  IF _m.id IS NULL THEN RETURN; END IF;
  IF _me <> _m.player_one_id AND _me <> _m.player_two_id THEN
    RAISE EXCEPTION 'not a player';
  END IF;
  IF _m.status = 'completed' THEN RETURN; END IF;

  UPDATE public.challenge_matches SET status = 'cancelled' WHERE id = _match_id;
  IF _m.invitation_id IS NOT NULL THEN
    UPDATE public.challenge_invitations SET status = 'cancelled' WHERE id = _m.invitation_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.cancel_match(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_match(_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _m public.challenge_matches;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO _m FROM public.challenge_matches WHERE id = _match_id;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'match not found'; END IF;
  IF _me <> _m.player_one_id AND _me <> _m.player_two_id THEN
    RAISE EXCEPTION 'not a player';
  END IF;
  UPDATE public.challenge_matches
     SET status = 'active', accepted_at = COALESCE(accepted_at, now())
   WHERE id = _match_id AND status <> 'completed';
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_match(uuid) TO authenticated;
