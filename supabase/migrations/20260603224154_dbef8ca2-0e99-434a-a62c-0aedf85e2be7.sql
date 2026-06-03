ALTER TYPE public.notification_category ADD VALUE IF NOT EXISTS 'chat_message';
ALTER TABLE public.notification_preferences ADD COLUMN IF NOT EXISTS chat_message boolean NOT NULL DEFAULT true;