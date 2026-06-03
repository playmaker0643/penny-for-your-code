
-- Fix challenge_matches: prevent players from manipulating scores
DROP POLICY IF EXISTS "Players update matches" ON public.challenge_matches;
CREATE POLICY "Players update match progress" ON public.challenge_matches
  FOR UPDATE TO authenticated
  USING (auth.uid() = player_one_id OR auth.uid() = player_two_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = player_one_id OR auth.uid() = player_two_id OR public.has_role(auth.uid(),'admin'));
REVOKE UPDATE ON public.challenge_matches FROM authenticated, anon;
GRANT UPDATE (player_one_current_index, player_two_current_index) ON public.challenge_matches TO authenticated;

-- Fix exam_submissions: students cannot update score columns. Remove student UPDATE entirely.
DROP POLICY IF EXISTS "Users update own submissions" ON public.exam_submissions;
CREATE POLICY "Admins update submissions" ON public.exam_submissions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Fix chat_members: remove self-join branch
DROP POLICY IF EXISTS "Insert chat members" ON public.chat_members;
CREATE POLICY "Admins insert chat members" ON public.chat_members
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Fix exam_questions & lesson_questions: hide correct_answer column from students
REVOKE SELECT (correct_answer) ON public.exam_questions FROM authenticated, anon;
REVOKE SELECT (correct_answer) ON public.lesson_questions FROM authenticated, anon;
