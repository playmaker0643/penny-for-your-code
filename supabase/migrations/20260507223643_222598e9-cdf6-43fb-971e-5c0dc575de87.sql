
-- Archive chats
CREATE TABLE IF NOT EXISTS public.archived_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  chat_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, chat_id)
);
ALTER TABLE public.archived_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own archives" ON public.archived_chats FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Polls
CREATE TABLE IF NOT EXISTS public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID,
  message_id UUID,
  creator_id UUID NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view polls" ON public.polls FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create polls" ON public.polls FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  option_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id)
);
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view votes" ON public.poll_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users vote" ON public.poll_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users change vote" ON public.poll_votes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users remove vote" ON public.poll_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Stickers
CREATE TABLE IF NOT EXISTS public.stickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stickers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own + defaults" ON public.stickers FOR SELECT TO authenticated USING (is_default = true OR auth.uid() = user_id);
CREATE POLICY "Create own stickers" ON public.stickers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own stickers" ON public.stickers FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Sticker bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('stickers', 'stickers', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Stickers public read" ON storage.objects FOR SELECT USING (bucket_id = 'stickers');
CREATE POLICY "Stickers user upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stickers' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Stickers user delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'stickers' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Welcome message trigger: send a Support Team message to new users
CREATE OR REPLACE FUNCTION public.send_welcome_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT user_id INTO admin_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF admin_id IS NOT NULL AND admin_id <> NEW.user_id THEN
    INSERT INTO public.messages (sender_id, receiver_id, content)
    VALUES (admin_id, NEW.user_id, '🎉 Congratulations and welcome to CodeBreakers! We''re excited to have you join our coding community. Start exploring courses, complete lessons, and challenge other students. If you need any help, the Support Team is always here for you. Happy coding! 💻🚀');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS welcome_new_profile ON public.profiles;
CREATE TRIGGER welcome_new_profile AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.send_welcome_message();
