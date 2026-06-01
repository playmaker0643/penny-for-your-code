
-- Fix permissive chat_members insert policy
DROP POLICY "Users can add members to chats" ON public.chat_members;
CREATE POLICY "Users can add members to chats" ON public.chat_members
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.chat_members cm WHERE cm.chat_id = chat_members.chat_id AND cm.user_id = auth.uid() AND cm.is_admin = true)
    OR EXISTS (SELECT 1 FROM public.chats c WHERE c.id = chat_members.chat_id AND c.created_by = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Fix permissive read receipts select policy
DROP POLICY "Users can view read receipts for their chats" ON public.message_read_receipts;
CREATE POLICY "Users can view read receipts for their chats" ON public.message_read_receipts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_messages cm
      JOIN public.chat_members cmem ON cmem.chat_id = cm.chat_id
      WHERE cm.id = message_read_receipts.message_id AND cmem.user_id = auth.uid()
    )
  );
