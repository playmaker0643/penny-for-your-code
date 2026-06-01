drop policy if exists "Group admins can update members" on public.chat_members;
create policy "Group admins can update members"
on public.chat_members
for update
to authenticated
using (
  public.is_chat_admin(chat_id, auth.uid())
  or has_role(auth.uid(), 'admin'::app_role)
)
with check (
  public.is_chat_admin(chat_id, auth.uid())
  or has_role(auth.uid(), 'admin'::app_role)
);

drop policy if exists "Senders can update own sent messages" on public.messages;
create policy "Senders can update own sent messages"
on public.messages
for update
to authenticated
using (auth.uid() = sender_id)
with check (auth.uid() = sender_id);

drop policy if exists "Senders can delete own sent messages" on public.messages;
create policy "Senders can delete own sent messages"
on public.messages
for delete
to authenticated
using (auth.uid() = sender_id);

drop policy if exists "Chat admins can delete group invitations" on public.group_invitations;
create policy "Chat admins can delete group invitations"
on public.group_invitations
for delete
to authenticated
using (
  public.is_chat_admin(chat_id, auth.uid())
  or has_role(auth.uid(), 'admin'::app_role)
);

drop policy if exists "Members can delete own messages or admins can moderate" on public.chat_messages;
create policy "Members can delete own messages or admins can moderate"
on public.chat_messages
for delete
to authenticated
using (
  auth.uid() = sender_id
  or public.is_chat_admin(chat_id, auth.uid())
  or has_role(auth.uid(), 'admin'::app_role)
);