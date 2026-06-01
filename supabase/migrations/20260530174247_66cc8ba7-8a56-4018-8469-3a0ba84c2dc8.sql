
-- Add missing enum values
ALTER TYPE public.challenge_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE public.challenge_question_type ADD VALUE IF NOT EXISTS 'fill_blank';
ALTER TYPE public.challenge_question_type ADD VALUE IF NOT EXISTS 'syntax_correction';

-- Add missing columns
ALTER TABLE public.lesson_questions ADD COLUMN IF NOT EXISTS question_type public.challenge_question_type NOT NULL DEFAULT 'multiple_choice';
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text';
ALTER TABLE public.challenge_matches ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Lock down SECURITY DEFINER helpers used internally by RLS
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
REVOKE EXECUTE ON FUNCTION public.is_chat_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_chat_member(uuid, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.find_user_by_email_or_reg(text) FROM PUBLIC, anon;
