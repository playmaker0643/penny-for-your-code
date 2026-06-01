
-- Add total_lessons_required to courses
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS total_lessons_required integer;

-- Add content_html to lessons
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS content_html text;

-- Add AI tracking columns to lesson_progress
ALTER TABLE public.lesson_progress ADD COLUMN IF NOT EXISTS ai_questions_used integer NOT NULL DEFAULT 0;
ALTER TABLE public.lesson_progress ADD COLUMN IF NOT EXISTS ai_questions_date date;

-- Add permission columns to exams
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS allow_file_upload boolean NOT NULL DEFAULT false;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS allow_sandbox boolean NOT NULL DEFAULT false;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS ai_marking boolean NOT NULL DEFAULT false;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS ai_marking_context text;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS file_upload_description text;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS sandbox_prompt text;

-- Add AI grading columns to exam_submissions
ALTER TABLE public.exam_submissions ADD COLUMN IF NOT EXISTS sandbox_code text;
ALTER TABLE public.exam_submissions ADD COLUMN IF NOT EXISTS ai_score integer;
ALTER TABLE public.exam_submissions ADD COLUMN IF NOT EXISTS ai_feedback text;
ALTER TABLE public.exam_submissions ADD COLUMN IF NOT EXISTS marking_status text NOT NULL DEFAULT 'pending';

-- Create lesson_questions table
CREATE TABLE public.lesson_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  question_type text NOT NULL DEFAULT 'fill_blank',
  question_text text NOT NULL,
  correct_answer text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.lesson_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage lesson questions" ON public.lesson_questions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can view lesson questions" ON public.lesson_questions FOR SELECT TO authenticated USING (true);

-- Create lesson_question_attempts table
CREATE TABLE public.lesson_question_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.lesson_questions(id) ON DELETE CASCADE,
  answer text,
  correct boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.lesson_question_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own attempts" ON public.lesson_question_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own attempts" ON public.lesson_question_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all attempts" ON public.lesson_question_attempts FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Create submissions storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('submissions', 'submissions', false) ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can upload their own files
CREATE POLICY "Users can upload submission files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'submissions' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own submission files" ON storage.objects FOR SELECT USING (bucket_id = 'submissions' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Admins can view all submission files" ON storage.objects FOR SELECT USING (bucket_id = 'submissions' AND has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for lesson_progress
ALTER PUBLICATION supabase_realtime ADD TABLE public.lesson_progress;
