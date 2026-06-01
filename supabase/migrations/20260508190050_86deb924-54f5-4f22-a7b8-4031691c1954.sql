ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS parent_call_id uuid;
ALTER TABLE public.public_projects ADD COLUMN IF NOT EXISTS allow_clone boolean NOT NULL DEFAULT true;
ALTER PUBLICATION supabase_realtime ADD TABLE public.public_projects;