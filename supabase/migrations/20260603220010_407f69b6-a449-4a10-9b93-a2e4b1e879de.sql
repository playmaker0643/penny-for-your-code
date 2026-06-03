
-- 1) Hide correct_answer column from authenticated users on questions tables.
-- Admin RPCs (admin_list_*) are SECURITY DEFINER and bypass column grants.
REVOKE SELECT (correct_answer) ON public.challenge_questions FROM authenticated;
REVOKE SELECT (correct_answer) ON public.exam_questions FROM authenticated;
REVOKE SELECT (correct_answer) ON public.lesson_questions FROM authenticated;
REVOKE SELECT (correct_answer) ON public.challenge_questions FROM anon;
REVOKE SELECT (correct_answer) ON public.exam_questions FROM anon;
REVOKE SELECT (correct_answer) ON public.lesson_questions FROM anon;

-- 2) chat_members: prevent self-join into arbitrary chats.
-- Allow inserts only when the user is the creator of the target chat
-- (covers group creation and friend-accept which both create the chat first).
DROP POLICY IF EXISTS "Users can join chats" ON public.chat_members;
DROP POLICY IF EXISTS "Users can insert themselves" ON public.chat_members;
DROP POLICY IF EXISTS "Insert self into chat" ON public.chat_members;
DROP POLICY IF EXISTS "chat_members_insert" ON public.chat_members;

CREATE POLICY "Chat creator can add members"
ON public.chat_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = chat_id AND c.created_by = auth.uid()
  )
);

-- 3) exam_submissions: prevent students from updating their own scores.
-- Drop any student UPDATE policy; grading is done by admin/edge functions
-- using the service role which bypasses RLS.
DROP POLICY IF EXISTS "Users can update own submissions" ON public.exam_submissions;
DROP POLICY IF EXISTS "Students can update own submissions" ON public.exam_submissions;
DROP POLICY IF EXISTS "Update own exam submissions" ON public.exam_submissions;
DROP POLICY IF EXISTS "exam_submissions_update" ON public.exam_submissions;

-- 4) profiles: hide sensitive personal columns from other authenticated users.
-- Keep public-facing columns (full_name, avatar_url, registration_number, etc.)
-- readable so chat/leaderboard/projects keep working. Owners and admins still
-- get full row access via SECURITY DEFINER RPCs (get_my_profile, admin_list_profiles).
REVOKE SELECT (phone, address, town, state, country, date_of_birth, first_name, second_name, other_names)
  ON public.profiles FROM authenticated;
REVOKE SELECT (phone, address, town, state, country, date_of_birth, first_name, second_name, other_names)
  ON public.profiles FROM anon;
