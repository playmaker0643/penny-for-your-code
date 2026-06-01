
-- Create a security definer function to check if user created a chat
CREATE OR REPLACE FUNCTION public.is_chat_creator(_chat_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chats
    WHERE id = _chat_id AND created_by = _user_id
  );
$$;

-- Drop and recreate the INSERT policy on chat_members to avoid recursion
DROP POLICY IF EXISTS "Users can add members to chats" ON public.chat_members;

CREATE POLICY "Users can add members to chats"
ON public.chat_members
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = user_id)
  OR is_chat_admin(chat_id, auth.uid())
  OR is_chat_creator(chat_id, auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);
