
ALTER TYPE public.notification_category ADD VALUE IF NOT EXISTS 'lesson_reminder';
ALTER TYPE public.notification_category ADD VALUE IF NOT EXISTS 'course_reminder';
ALTER TYPE public.notification_category ADD VALUE IF NOT EXISTS 'assignment_deadline';
ALTER TYPE public.notification_category ADD VALUE IF NOT EXISTS 'quiz_reminder';
ALTER TYPE public.notification_category ADD VALUE IF NOT EXISTS 'direct_message';
ALTER TYPE public.notification_category ADD VALUE IF NOT EXISTS 'mentor_reply';
ALTER TYPE public.notification_category ADD VALUE IF NOT EXISTS 'streak_reminder';
ALTER TYPE public.notification_category ADD VALUE IF NOT EXISTS 'leaderboard_change';
ALTER TYPE public.notification_category ADD VALUE IF NOT EXISTS 'ai_recommendation';
