
-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'student');
CREATE TYPE public.call_type AS ENUM ('video', 'voice');
CREATE TYPE public.call_status AS ENUM ('pending', 'active', 'ended', 'missed');
CREATE TYPE public.friend_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE public.challenge_status AS ENUM ('pending', 'active', 'completed', 'cancelled', 'rejected', 'accepted');
CREATE TYPE public.cert_status AS ENUM ('waiting', 'awarded', 'revoked');
CREATE TYPE public.marking_status AS ENUM ('pending', 'queued', 'grading', 'graded');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent');
CREATE TYPE public.exam_type AS ENUM ('exam', 'assignment');
CREATE TYPE public.challenge_question_type AS ENUM ('multiple_choice', 'short_answer', 'fill_blank', 'syntax_correction');

-- ============================================================
-- UTILITY FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  first_name text,
  second_name text,
  other_names text,
  registration_number text UNIQUE,
  avatar_url text,
  phone text,
  country text,
  state text,
  town text,
  address text,
  date_of_birth date,
  account_locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USER ROLES
-- ============================================================
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, registration_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, ''),
    NEW.raw_user_meta_data->>'registration_number'
  )
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- USER PRESENCE
-- ============================================================
CREATE TABLE public.user_presence (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_online boolean NOT NULL DEFAULT false,
  last_seen timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_presence TO authenticated;
GRANT ALL ON public.user_presence TO service_role;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Presence readable" ON public.user_presence FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users upsert own presence" ON public.user_presence FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own presence" ON public.user_presence FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- COURSES & LESSONS
-- ============================================================
CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text,
  thumbnail_url text,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  total_lessons_required integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_courses_published ON public.courses(is_published, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Courses readable by authenticated" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage courses" ON public.courses FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  video_url text,
  content text,
  content_html text,
  order_index integer NOT NULL DEFAULT 0,
  completion_time_minutes integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lessons_course ON public.lessons(course_id, order_index);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lessons readable" ON public.lessons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage lessons" ON public.lessons FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  ai_questions_used integer NOT NULL DEFAULT 0,
  ai_questions_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);
CREATE INDEX idx_lesson_progress_user ON public.lesson_progress(user_id, completed);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_progress TO authenticated;
GRANT ALL ON public.lesson_progress TO service_role;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own progress" ON public.lesson_progress FOR ALL TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')) WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);
CREATE INDEX idx_enrollments_user ON public.enrollments(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrollments TO authenticated;
GRANT ALL ON public.enrollments TO service_role;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own enrollments" ON public.enrollments FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users enroll themselves" ON public.enrollments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage enrollments" ON public.enrollments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.lesson_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  question_type public.challenge_question_type NOT NULL DEFAULT 'multiple_choice',
  question_text text NOT NULL,
  correct_answer text NOT NULL,
  options text[],
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lesson_questions_lesson ON public.lesson_questions(lesson_id, order_index);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_questions TO authenticated;
GRANT ALL ON public.lesson_questions TO service_role;
ALTER TABLE public.lesson_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lesson questions readable" ON public.lesson_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage lesson questions" ON public.lesson_questions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.lesson_question_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.lesson_questions(id) ON DELETE CASCADE,
  answer text,
  correct boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lqa_user_lesson ON public.lesson_question_attempts(user_id, lesson_id);
GRANT SELECT, INSERT ON public.lesson_question_attempts TO authenticated;
GRANT ALL ON public.lesson_question_attempts TO service_role;
ALTER TABLE public.lesson_question_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own attempts" ON public.lesson_question_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own attempts" ON public.lesson_question_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- EXAMS
-- ============================================================
CREATE TABLE public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  exam_type public.exam_type NOT NULL DEFAULT 'exam',
  max_score integer NOT NULL DEFAULT 100,
  is_published boolean NOT NULL DEFAULT false,
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_type text NOT NULL DEFAULT 'all',
  target_lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  target_reg_numbers text[],
  ai_marking boolean NOT NULL DEFAULT false,
  ai_marking_context text,
  allow_sandbox boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_exams_course ON public.exams(course_id, is_published);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT ALL ON public.exams TO service_role;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Exams readable" ON public.exams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage exams" ON public.exams FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  part text NOT NULL DEFAULT 'obj',
  question_text text NOT NULL,
  options text[],
  correct_answer text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_eq_exam ON public.exam_questions(exam_id, order_index);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_questions TO authenticated;
GRANT ALL ON public.exam_questions TO service_role;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Exam questions readable" ON public.exam_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage exam questions" ON public.exam_questions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.exam_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  obj_score numeric,
  essay_score numeric,
  code_score numeric,
  score numeric,
  ai_score numeric,
  ai_feedback text,
  obj_answers jsonb,
  essay_answers jsonb,
  code_answer text,
  content text,
  sandbox_code text,
  file_url text,
  marking_status public.marking_status NOT NULL DEFAULT 'pending',
  graded boolean NOT NULL DEFAULT false,
  graded_at timestamptz,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(exam_id, user_id)
);
CREATE INDEX idx_exam_subs_user ON public.exam_submissions(user_id, graded);
GRANT SELECT, INSERT, UPDATE ON public.exam_submissions TO authenticated;
GRANT ALL ON public.exam_submissions TO service_role;
ALTER TABLE public.exam_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own submissions" ON public.exam_submissions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own submissions" ON public.exam_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own submissions" ON public.exam_submissions FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- CHATS
-- ============================================================
CREATE TABLE public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group boolean NOT NULL DEFAULT false,
  group_name text,
  group_avatar_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chats_updated ON public.chats(updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chats TO authenticated;
GRANT ALL ON public.chats TO service_role;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chat_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(chat_id, user_id)
);
CREATE INDEX idx_chat_members_user ON public.chat_members(user_id);
CREATE INDEX idx_chat_members_chat ON public.chat_members(chat_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_members TO authenticated;
GRANT ALL ON public.chat_members TO service_role;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_chat_member(_chat_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_members WHERE chat_id = _chat_id AND user_id = _user_id)
$$;

CREATE POLICY "Members read their chats" ON public.chats FOR SELECT TO authenticated USING (public.is_chat_member(id, auth.uid()) OR created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create chats" ON public.chats FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator/admin updates chat" ON public.chats FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Creator/admin deletes chat" ON public.chats FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members read membership" ON public.chat_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_chat_member(chat_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Insert chat members" ON public.chat_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Leave chat" ON public.chat_members FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Update membership" ON public.chat_members FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text,
  message_type text NOT NULL DEFAULT 'text',
  edited boolean NOT NULL DEFAULT false,
  deleted_for_everyone boolean NOT NULL DEFAULT false,
  is_admin_broadcast boolean NOT NULL DEFAULT false,
  updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_messages_chat ON public.chat_messages(chat_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read messages" ON public.chat_messages FOR SELECT TO authenticated USING (public.is_chat_member(chat_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Members send messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id AND (public.is_chat_member(chat_id, auth.uid()) OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Sender updates own message" ON public.chat_messages FOR UPDATE TO authenticated USING (auth.uid() = sender_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sender deletes own message" ON public.chat_messages FOR DELETE TO authenticated USING (auth.uid() = sender_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.message_read_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.message_read_receipts TO authenticated;
GRANT ALL ON public.message_read_receipts TO service_role;
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read receipts visible" ON public.message_read_receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users upsert own receipts" ON public.message_read_receipts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own receipts" ON public.message_read_receipts FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_receiver ON public.messages(receiver_id, created_at DESC);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own DMs" ON public.messages FOR SELECT TO authenticated USING (auth.uid() IN (sender_id, receiver_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users send DMs" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users update own DMs" ON public.messages FOR UPDATE TO authenticated USING (auth.uid() IN (sender_id, receiver_id));
CREATE POLICY "Users delete own DMs" ON public.messages FOR DELETE TO authenticated USING (auth.uid() = sender_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  options text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.polls TO authenticated;
GRANT ALL ON public.polls TO service_role;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Polls visible to chat members" ON public.polls FOR SELECT TO authenticated USING (chat_id IS NULL OR public.is_chat_member(chat_id, auth.uid()) OR sender_id = auth.uid() OR creator_id = auth.uid());
CREATE POLICY "Users create polls" ON public.polls FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id OR auth.uid() = creator_id);

CREATE TABLE public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_votes TO authenticated;
GRANT ALL ON public.poll_votes TO service_role;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Poll votes readable" ON public.poll_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users vote own" ON public.poll_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own vote" ON public.poll_votes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own vote" ON public.poll_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.stickers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stickers_user ON public.stickers(user_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.stickers TO authenticated;
GRANT ALL ON public.stickers TO service_role;
ALTER TABLE public.stickers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own stickers" ON public.stickers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.archived_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, chat_id)
);
GRANT SELECT, INSERT, DELETE ON public.archived_chats TO authenticated;
GRANT ALL ON public.archived_chats TO service_role;
ALTER TABLE public.archived_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own archives" ON public.archived_chats FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.group_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_group_inv_invitee ON public.group_invitations(invitee_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_invitations TO authenticated;
GRANT ALL ON public.group_invitations TO service_role;
ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Inviter/invitee read invitations" ON public.group_invitations FOR SELECT TO authenticated USING (auth.uid() IN (inviter_id, invitee_id));
CREATE POLICY "Inviter creates invitation" ON public.group_invitations FOR INSERT TO authenticated WITH CHECK (auth.uid() = inviter_id);
CREATE POLICY "Invitee updates status" ON public.group_invitations FOR UPDATE TO authenticated USING (auth.uid() IN (inviter_id, invitee_id));

-- ============================================================
-- CALLS
-- ============================================================
CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_type public.call_type NOT NULL DEFAULT 'video',
  status public.call_status NOT NULL DEFAULT 'pending',
  chat_id uuid REFERENCES public.chats(id) ON DELETE SET NULL,
  parent_call_id uuid REFERENCES public.calls(id) ON DELETE SET NULL,
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_calls_receiver ON public.calls(receiver_id, created_at DESC);
CREATE INDEX idx_calls_caller ON public.calls(caller_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read calls" ON public.calls FOR SELECT TO authenticated USING (auth.uid() IN (caller_id, receiver_id));
CREATE POLICY "Caller creates call" ON public.calls FOR INSERT TO authenticated WITH CHECK (auth.uid() = caller_id);
CREATE POLICY "Participants update call" ON public.calls FOR UPDATE TO authenticated USING (auth.uid() IN (caller_id, receiver_id));

-- ============================================================
-- POSTS / FEED
-- ============================================================
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text,
  content_html text,
  image_url text,
  video_url text,
  link_url text,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_posts_published ON public.posts(is_published, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Posts readable" ON public.posts FOR SELECT TO authenticated USING (is_published OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage posts" ON public.posts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.post_likes TO authenticated;
GRANT ALL ON public.post_likes TO service_role;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes readable" ON public.post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users like" ON public.post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unlike" ON public.post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_post_comments_post ON public.post_comments(post_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments readable" ON public.post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users comment" ON public.post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users edit own comment" ON public.post_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users/admins delete comment" ON public.post_comments FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- CHALLENGES
-- ============================================================
CREATE TABLE public.challenge_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  question_type public.challenge_question_type NOT NULL DEFAULT 'multiple_choice',
  question_text text NOT NULL,
  correct_answer text NOT NULL,
  options text[],
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chq_course ON public.challenge_questions(course_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_questions TO authenticated;
GRANT ALL ON public.challenge_questions TO service_role;
ALTER TABLE public.challenge_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Challenge questions readable" ON public.challenge_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage challenge questions" ON public.challenge_questions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.challenge_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  chat_id uuid REFERENCES public.chats(id) ON DELETE SET NULL,
  status public.challenge_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ci_receiver ON public.challenge_invitations(receiver_id, status);
GRANT SELECT, INSERT, UPDATE ON public.challenge_invitations TO authenticated;
GRANT ALL ON public.challenge_invitations TO service_role;
ALTER TABLE public.challenge_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read invitations" ON public.challenge_invitations FOR SELECT TO authenticated USING (auth.uid() IN (sender_id, receiver_id));
CREATE POLICY "Sender creates invitation" ON public.challenge_invitations FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Participants update invitation" ON public.challenge_invitations FOR UPDATE TO authenticated USING (auth.uid() IN (sender_id, receiver_id));

CREATE TABLE public.challenge_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid REFERENCES public.challenge_invitations(id) ON DELETE SET NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  player_one_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_two_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_ids uuid[] NOT NULL DEFAULT '{}',
  player_one_score integer NOT NULL DEFAULT 0,
  player_two_score integer NOT NULL DEFAULT 0,
  player_one_current_index integer NOT NULL DEFAULT 0,
  player_two_current_index integer NOT NULL DEFAULT 0,
  status public.challenge_status NOT NULL DEFAULT 'active',
  winner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cm_p1 ON public.challenge_matches(player_one_id);
CREATE INDEX idx_cm_p2 ON public.challenge_matches(player_two_id);
GRANT SELECT, INSERT, UPDATE ON public.challenge_matches TO authenticated;
GRANT ALL ON public.challenge_matches TO service_role;
ALTER TABLE public.challenge_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players read matches" ON public.challenge_matches FOR SELECT TO authenticated USING (auth.uid() IN (player_one_id, player_two_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Players insert matches" ON public.challenge_matches FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (player_one_id, player_two_id));
CREATE POLICY "Players update matches" ON public.challenge_matches FOR UPDATE TO authenticated USING (auth.uid() IN (player_one_id, player_two_id));

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE public.public_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_public boolean NOT NULL DEFAULT true,
  allow_clone boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pp_public ON public.public_projects(is_public, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_projects TO authenticated;
GRANT SELECT ON public.public_projects TO anon;
GRANT ALL ON public.public_projects TO service_role;
ALTER TABLE public.public_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public projects readable" ON public.public_projects FOR SELECT USING (is_public OR auth.uid() = user_id);
CREATE POLICY "Owners insert projects" ON public.public_projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update projects" ON public.public_projects FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners delete projects" ON public.public_projects FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_pp_updated_at BEFORE UPDATE ON public.public_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.student_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  file_url text,
  public_project_id uuid REFERENCES public.public_projects(id) ON DELETE SET NULL,
  mark numeric,
  feedback text,
  graded boolean NOT NULL DEFAULT false,
  graded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sp_user ON public.student_projects(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_projects TO authenticated;
GRANT ALL ON public.student_projects TO service_role;
ALTER TABLE public.student_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own student projects" ON public.student_projects FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own student projects" ON public.student_projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own student projects" ON public.student_projects FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users delete own student projects" ON public.student_projects FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.project_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.public_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.project_likes TO authenticated;
GRANT ALL ON public.project_likes TO service_role;
ALTER TABLE public.project_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project likes readable" ON public.project_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users like projects" ON public.project_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unlike projects" ON public.project_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.project_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.public_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pc_project ON public.project_comments(project_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_comments TO authenticated;
GRANT ALL ON public.project_comments TO service_role;
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project comments readable" ON public.project_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users comment on projects" ON public.project_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users edit own project comment" ON public.project_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own project comment" ON public.project_comments FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.sandbox_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled',
  language text,
  code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sandbox_user ON public.sandbox_projects(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sandbox_projects TO authenticated;
GRANT ALL ON public.sandbox_projects TO service_role;
ALTER TABLE public.sandbox_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sandbox" ON public.sandbox_projects FOR ALL TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- CERTIFICATES & ATTENDANCE
-- ============================================================
CREATE TABLE public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  certificate_no text UNIQUE,
  status public.cert_status NOT NULL DEFAULT 'waiting',
  awarded_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);
GRANT SELECT, INSERT, UPDATE ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own certificates" ON public.certificates FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage certificates" ON public.certificates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  date date NOT NULL,
  status public.attendance_status NOT NULL DEFAULT 'present',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id, date)
);
CREATE INDEX idx_attendance_user_date ON public.attendance(user_id, date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own attendance" ON public.attendance FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage attendance" ON public.attendance FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- FRIEND REQUESTS
-- ============================================================
CREATE TABLE public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.friend_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fr_receiver ON public.friend_requests(receiver_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_requests TO authenticated;
GRANT ALL ON public.friend_requests TO service_role;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read friend requests" ON public.friend_requests FOR SELECT TO authenticated USING (auth.uid() IN (sender_id, receiver_id));
CREATE POLICY "Users send friend requests" ON public.friend_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Participants update friend requests" ON public.friend_requests FOR UPDATE TO authenticated USING (auth.uid() IN (sender_id, receiver_id));
CREATE POLICY "Participants delete friend requests" ON public.friend_requests FOR DELETE TO authenticated USING (auth.uid() IN (sender_id, receiver_id));

-- ============================================================
-- RPC: find user by email or reg number
-- ============================================================
CREATE OR REPLACE FUNCTION public.find_user_by_email_or_reg(_input text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid;
BEGIN
  SELECT user_id INTO _uid FROM public.profiles WHERE registration_number = _input LIMIT 1;
  IF _uid IS NOT NULL THEN RETURN _uid; END IF;
  SELECT id INTO _uid FROM auth.users WHERE email = _input LIMIT 1;
  RETURN _uid;
END; $$;
GRANT EXECUTE ON FUNCTION public.find_user_by_email_or_reg(text) TO authenticated;

-- ============================================================
-- REALTIME PUBLICATION
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_invitations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.public_projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lesson_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_invitations;

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.calls REPLICA IDENTITY FULL;
ALTER TABLE public.challenge_invitations REPLICA IDENTITY FULL;
ALTER TABLE public.challenge_matches REPLICA IDENTITY FULL;
ALTER TABLE public.public_projects REPLICA IDENTITY FULL;

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars', 'avatars', true),
  ('chat-media', 'chat-media', true),
  ('stickers', 'stickers', true),
  ('post-media', 'post-media', true),
  ('student-projects', 'student-projects', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public buckets readable" ON storage.objects FOR SELECT USING (bucket_id IN ('avatars', 'chat-media', 'stickers', 'post-media'));

CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated upload chat media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-media');
CREATE POLICY "Authenticated delete own chat media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'chat-media' AND owner = auth.uid());

CREATE POLICY "Users upload own sticker" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'stickers' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own sticker" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'stickers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins upload post media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'post-media' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update post media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'post-media' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete post media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'post-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read own student-project files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'student-projects' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Users upload own student-project files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'student-projects' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own student-project files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'student-projects' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own student-project files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'student-projects' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));
