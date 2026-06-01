CREATE OR REPLACE FUNCTION public.start_admin_chat()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin uuid;
  _chat uuid;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT user_id INTO _admin FROM public.user_roles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  IF _admin IS NULL THEN RAISE EXCEPTION 'no admin available'; END IF;

  SELECT c.id INTO _chat
  FROM public.chats c
  JOIN public.chat_members m1 ON m1.chat_id = c.id AND m1.user_id = _uid
  JOIN public.chat_members m2 ON m2.chat_id = c.id AND m2.user_id = _admin
  WHERE c.is_group = false
  LIMIT 1;

  IF _chat IS NOT NULL THEN RETURN _chat; END IF;

  INSERT INTO public.chats (is_group, created_by) VALUES (false, _uid) RETURNING id INTO _chat;
  INSERT INTO public.chat_members (chat_id, user_id) VALUES (_chat, _uid), (_chat, _admin);
  RETURN _chat;
END; $$;

GRANT EXECUTE ON FUNCTION public.start_admin_chat() TO authenticated;