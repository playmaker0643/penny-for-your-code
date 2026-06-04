
-- lesson_questions: hide correct_answer from clients
REVOKE SELECT ON public.lesson_questions FROM authenticated, anon;
GRANT SELECT (id, lesson_id, question_type, question_text, options, order_index, created_at)
  ON public.lesson_questions TO authenticated;

-- exam_questions: hide correct_answer from clients
REVOKE SELECT ON public.exam_questions FROM authenticated, anon;
GRANT SELECT (id, exam_id, part, question_text, options, order_index, created_at)
  ON public.exam_questions TO authenticated;

-- Server-side grader for lesson quizzes (no answer leakage)
CREATE OR REPLACE FUNCTION public.check_lesson_answer(_qid uuid, _answer text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(btrim(correct_answer)) = lower(btrim(_answer))
    FROM public.lesson_questions WHERE id = _qid
$$;

GRANT EXECUTE ON FUNCTION public.check_lesson_answer(uuid, text) TO authenticated;
