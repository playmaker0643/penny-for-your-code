
-- ============ PUBLIC PROJECTS (Code editor) ============
CREATE TABLE public.public_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  files JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT true,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.public_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view public projects" ON public.public_projects FOR SELECT TO authenticated USING (is_public = true OR auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Users can create their own projects" ON public.public_projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own projects" ON public.public_projects FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own projects" ON public.public_projects FOR DELETE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));

CREATE TABLE public.project_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);
ALTER TABLE public.project_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated can view project likes" ON public.project_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can like" ON public.project_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike own" ON public.project_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated can view project comments" ON public.project_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can comment" ON public.project_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.project_comments FOR DELETE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));

CREATE TABLE public.project_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL,
  followed_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_id, followed_user_id)
);
ALTER TABLE public.project_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated view follows" ON public.project_follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users follow" ON public.project_follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users unfollow own" ON public.project_follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- ============ CERTIFICATES ============
CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  course_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  awarded_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  certificate_no TEXT NOT NULL DEFAULT ('CERT-' || upper(substr(gen_random_uuid()::text,1,8))),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own certificates" ON public.certificates FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage certificates" ON public.certificates FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Users insert waiting cert" ON public.certificates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'waiting');

-- ============ EXAMS rebuild ============
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS parts JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT 'all';
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS target_lesson_id UUID;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS target_reg_numbers TEXT[];

CREATE TABLE public.exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL,
  part TEXT NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB DEFAULT '[]'::jsonb,
  correct_answer TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage exam questions" ON public.exam_questions FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Authenticated view exam questions" ON public.exam_questions FOR SELECT TO authenticated USING (true);

ALTER TABLE public.exam_submissions ADD COLUMN IF NOT EXISTS obj_score INTEGER;
ALTER TABLE public.exam_submissions ADD COLUMN IF NOT EXISTS essay_score INTEGER;
ALTER TABLE public.exam_submissions ADD COLUMN IF NOT EXISTS code_score INTEGER;
ALTER TABLE public.exam_submissions ADD COLUMN IF NOT EXISTS obj_answers JSONB;
ALTER TABLE public.exam_submissions ADD COLUMN IF NOT EXISTS essay_answers JSONB;
ALTER TABLE public.exam_submissions ADD COLUMN IF NOT EXISTS code_answer TEXT;

-- ============ POSTS engagement ============
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS link_url TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS content_html TEXT;

CREATE TABLE public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All view post likes" ON public.post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users like posts" ON public.post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unlike own" ON public.post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  parent_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All view post comments" ON public.post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users comment posts" ON public.post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own comments or admin" ON public.post_comments FOR DELETE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));

-- ============ STUDENT PROJECTS (submissions for grading) ============
CREATE TABLE public.student_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  course_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  file_url TEXT,
  public_project_id UUID,
  mark INTEGER,
  feedback TEXT,
  graded BOOLEAN NOT NULL DEFAULT false,
  graded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.student_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own projects" ON public.student_projects FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Users submit own projects" ON public.student_projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins grade projects" ON public.student_projects FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Owner can update before grade" ON public.student_projects FOR UPDATE TO authenticated USING (auth.uid() = user_id AND graded = false);

-- Storage bucket for student project zips
INSERT INTO storage.buckets (id, name, public) VALUES ('student-projects', 'student-projects', false) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Users upload own project zips" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'student-projects' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users view own project zips" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'student-projects' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(),'admin')));

-- Storage bucket for post images
INSERT INTO storage.buckets (id, name, public) VALUES ('post-media', 'post-media', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Anyone view post media" ON storage.objects FOR SELECT USING (bucket_id = 'post-media');
CREATE POLICY "Admins upload post media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'post-media' AND has_role(auth.uid(),'admin'));
