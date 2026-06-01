ALTER TABLE public.challenge_invitations
ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.challenge_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL UNIQUE REFERENCES public.challenge_invitations(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  player_one_id uuid NOT NULL,
  player_two_id uuid NOT NULL,
  question_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  player_one_score integer NOT NULL DEFAULT 0,
  player_two_score integer NOT NULL DEFAULT 0,
  player_one_current_index integer NOT NULL DEFAULT 0,
  player_two_current_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  winner_id uuid,
  accepted_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.challenge_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view own challenge matches"
ON public.challenge_matches
FOR SELECT
TO authenticated
USING (
  auth.uid() = player_one_id
  OR auth.uid() = player_two_id
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Participants can create challenge matches"
ON public.challenge_matches
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = player_one_id
  OR auth.uid() = player_two_id
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Participants can update own challenge matches"
ON public.challenge_matches
FOR UPDATE
TO authenticated
USING (
  auth.uid() = player_one_id
  OR auth.uid() = player_two_id
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  auth.uid() = player_one_id
  OR auth.uid() = player_two_id
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete challenge matches"
ON public.challenge_matches
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_challenge_invitations_course_id
ON public.challenge_invitations(course_id);

CREATE INDEX IF NOT EXISTS idx_challenge_matches_invitation_id
ON public.challenge_matches(invitation_id);

CREATE INDEX IF NOT EXISTS idx_challenge_matches_player_one_id
ON public.challenge_matches(player_one_id);

CREATE INDEX IF NOT EXISTS idx_challenge_matches_player_two_id
ON public.challenge_matches(player_two_id);

CREATE INDEX IF NOT EXISTS idx_challenge_matches_status
ON public.challenge_matches(status);

DROP TRIGGER IF EXISTS update_challenge_matches_updated_at ON public.challenge_matches;
CREATE TRIGGER update_challenge_matches_updated_at
BEFORE UPDATE ON public.challenge_matches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();