
-- Preferences: per-category toggles for new categories + smart-delivery settings
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS lesson_reminder boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS course_reminder boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS assignment_deadline boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS quiz_reminder boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS direct_message boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS mentor_reply boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS streak_reminder boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS leaderboard_change boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_recommendation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS quiet_hours_start smallint,
  ADD COLUMN IF NOT EXISTS quiet_hours_end smallint,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS mute_until timestamptz,
  ADD COLUMN IF NOT EXISTS high_priority_only boolean NOT NULL DEFAULT false;

-- Activity signals
CREATE TABLE IF NOT EXISTS public.user_activity_signals (
  user_id uuid PRIMARY KEY,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  active_hour_histogram integer[] NOT NULL DEFAULT ARRAY[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  lessons_completed_24h integer NOT NULL DEFAULT 0,
  notifications_sent_24h integer NOT NULL DEFAULT 0,
  notifications_clicked_24h integer NOT NULL DEFAULT 0,
  notifications_ignored_24h integer NOT NULL DEFAULT 0,
  current_streak_days integer NOT NULL DEFAULT 0,
  last_streak_at date,
  last_reengagement_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_activity_signals TO authenticated;
GRANT ALL ON public.user_activity_signals TO service_role;
ALTER TABLE public.user_activity_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own activity" ON public.user_activity_signals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users upsert own activity" ON public.user_activity_signals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own activity" ON public.user_activity_signals FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Dedup ring (short-lived)
CREATE TABLE IF NOT EXISTS public.notification_dedup (
  hash text PRIMARY KEY,
  user_id uuid NOT NULL,
  category public.notification_category NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.notification_dedup TO service_role;
ALTER TABLE public.notification_dedup ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_notif_dedup_created ON public.notification_dedup(created_at);

-- Delivery / engagement events
CREATE TABLE IF NOT EXISTS public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid,
  user_id uuid NOT NULL,
  category public.notification_category,
  event text NOT NULL CHECK (event IN ('delivered','failed','clicked','dismissed','skipped','grouped')),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.notification_events TO authenticated;
GRANT ALL ON public.notification_events TO service_role;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own events" ON public.notification_events FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "users insert own events" ON public.notification_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_notif_events_user_created ON public.notification_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_events_cat_created ON public.notification_events(category, created_at DESC);

-- Analytics function (admin-only) — aggregates last 7d and 30d CTR/fail per category
CREATE OR REPLACE FUNCTION public.get_notification_analytics(_days integer DEFAULT 7)
RETURNS TABLE(category text, delivered bigint, failed bigint, clicked bigint, dismissed bigint, ctr numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE(category::text,'(none)') AS category,
    COUNT(*) FILTER (WHERE event='delivered') AS delivered,
    COUNT(*) FILTER (WHERE event='failed')    AS failed,
    COUNT(*) FILTER (WHERE event='clicked')   AS clicked,
    COUNT(*) FILTER (WHERE event='dismissed') AS dismissed,
    ROUND(
      CASE WHEN COUNT(*) FILTER (WHERE event='delivered') > 0
           THEN COUNT(*) FILTER (WHERE event='clicked')::numeric
                / COUNT(*) FILTER (WHERE event='delivered')::numeric
           ELSE 0 END
    ,3) AS ctr
  FROM public.notification_events
  WHERE created_at > now() - make_interval(days => GREATEST(_days,1))
    AND public.has_role(auth.uid(),'admin')
  GROUP BY 1
  ORDER BY delivered DESC
$$;
REVOKE EXECUTE ON FUNCTION public.get_notification_analytics(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_notification_analytics(integer) TO authenticated;
