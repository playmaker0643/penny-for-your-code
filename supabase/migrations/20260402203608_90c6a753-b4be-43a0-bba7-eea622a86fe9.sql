
-- Allow chat creators to SELECT their own chats (fixes group creation .select().single() after insert)
CREATE POLICY "Creators can view own chats" ON public.chats
FOR SELECT TO authenticated
USING (auth.uid() = created_by);
