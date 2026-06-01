
CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  call_type text NOT NULL DEFAULT 'voice',
  status text NOT NULL DEFAULT 'ringing',
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  chat_id uuid REFERENCES public.chats(id)
);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calls" ON public.calls
  FOR SELECT TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create calls" ON public.calls
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Users can update own calls" ON public.calls
  FOR UPDATE TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;

CREATE TABLE public.challenge_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  chat_id uuid REFERENCES public.chats(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.challenge_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own challenge invitations" ON public.challenge_invitations
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send challenge invitations" ON public.challenge_invitations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update received challenge invitations" ON public.challenge_invitations
  FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id);
