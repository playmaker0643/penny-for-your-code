
-- Restrict sensitive profile columns to owner/admin only via column-level revoke
REVOKE SELECT (phone, date_of_birth, address, town, state, locked_at) ON public.profiles FROM authenticated;
REVOKE SELECT (phone, date_of_birth, address, town, state, locked_at) ON public.profiles FROM anon;

-- Restrict challenge_matches direct writes to only the index columns
REVOKE UPDATE ON public.challenge_matches FROM authenticated;
GRANT UPDATE (player_one_current_index, player_two_current_index) ON public.challenge_matches TO authenticated;
REVOKE INSERT ON public.challenge_matches FROM authenticated;

-- Remove permissive policies that allowed clients to update arbitrary columns or insert matches directly
DROP POLICY IF EXISTS "Players update match progress" ON public.challenge_matches;
DROP POLICY IF EXISTS "Players insert matches" ON public.challenge_matches;

-- Recreate a narrow update policy (column-level grants above further restrict to two columns)
CREATE POLICY "Players update own match progress index"
  ON public.challenge_matches
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = player_one_id OR auth.uid() = player_two_id)
  WITH CHECK (auth.uid() = player_one_id OR auth.uid() = player_two_id);
