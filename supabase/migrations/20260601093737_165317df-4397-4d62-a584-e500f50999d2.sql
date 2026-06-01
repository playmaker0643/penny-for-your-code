-- Categories
CREATE TYPE public.notification_category AS ENUM (
  'new_lesson','challenge','security','announcement','achievement','live_class','system'
);

-- 1. Device tokens
CREATE TABLE public.notification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'web',
  user_agent text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notification_tokens_user ON public.notification_tokens(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_tokens TO authenticated;
GRANT ALL ON public.notification_tokens TO service_role;
ALTER TABLE public.notification_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tokens" ON public.notification_tokens
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id);

-- 2. Notification history
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category public.notification_category NOT NULL DEFAULT 'system',
  title text NOT NULL,
  body text,
  image_url text,
  link_url text,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id) WHERE NOT read;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'));

-- 3. Per-user category preferences
CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY,
  new_lesson boolean NOT NULL DEFAULT true,
  challenge boolean NOT NULL DEFAULT true,
  security boolean NOT NULL DEFAULT true,
  announcement boolean NOT NULL DEFAULT true,
  achievement boolean NOT NULL DEFAULT true,
  live_class boolean NOT NULL DEFAULT true,
  system boolean NOT NULL DEFAULT true,
  sound_enabled boolean NOT NULL DEFAULT true,
  vibration_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own prefs" ON public.notification_preferences
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Send log (rate limit)
CREATE TABLE public.notification_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_send_log_sender_time ON public.notification_send_log(sender_id, created_at DESC);
GRANT ALL ON public.notification_send_log TO service_role;
ALTER TABLE public.notification_send_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read send log" ON public.notification_send_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'));

-- Realtime for in-app updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;