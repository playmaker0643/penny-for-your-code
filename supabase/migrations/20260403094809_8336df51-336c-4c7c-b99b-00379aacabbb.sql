
CREATE TABLE public.challenge_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice',
  question_text TEXT NOT NULL,
  options JSONB DEFAULT '[]',
  correct_answer TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.challenge_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage challenge questions" ON public.challenge_questions
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can view challenge questions" ON public.challenge_questions
FOR SELECT TO authenticated
USING (true);
