create or replace function public.is_chat_member(_chat_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_members
    where chat_id = _chat_id
      and user_id = _user_id
  );
$$;

create or replace function public.is_chat_admin(_chat_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_members
    where chat_id = _chat_id
      and user_id = _user_id
      and is_admin = true
  );
$$;

revoke all on function public.is_chat_member(uuid, uuid) from public;
revoke all on function public.is_chat_admin(uuid, uuid) from public;
grant execute on function public.is_chat_member(uuid, uuid) to authenticated;
grant execute on function public.is_chat_admin(uuid, uuid) to authenticated;

drop policy if exists "Users can view chats they're members of" on public.chats;
create policy "Users can view chats they're members of"
on public.chats
for select
to authenticated
using (
  public.is_chat_member(id, auth.uid())
);

drop policy if exists "Chat admins can update chats" on public.chats;
create policy "Chat admins can update chats"
on public.chats
for update
to authenticated
using (
  public.is_chat_admin(id, auth.uid())
  or has_role(auth.uid(), 'admin'::app_role)
)
with check (
  public.is_chat_admin(id, auth.uid())
  or has_role(auth.uid(), 'admin'::app_role)
);

drop policy if exists "Members can view chat members" on public.chat_members;
create policy "Members can view chat members"
on public.chat_members
for select
to authenticated
using (
  public.is_chat_member(chat_id, auth.uid())
  or has_role(auth.uid(), 'admin'::app_role)
);

drop policy if exists "Users can add members to chats" on public.chat_members;
create policy "Users can add members to chats"
on public.chat_members
for insert
to authenticated
with check (
  auth.uid() = user_id
  or public.is_chat_admin(chat_id, auth.uid())
  or exists (
    select 1
    from public.chats c
    where c.id = chat_members.chat_id
      and c.created_by = auth.uid()
  )
  or has_role(auth.uid(), 'admin'::app_role)
);

drop policy if exists "Chat admins can remove members" on public.chat_members;
create policy "Chat admins can remove members"
on public.chat_members
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_chat_admin(chat_id, auth.uid())
  or has_role(auth.uid(), 'admin'::app_role)
);

drop policy if exists "Members can view chat messages" on public.chat_messages;
create policy "Members can view chat messages"
on public.chat_messages
for select
to authenticated
using (
  public.is_chat_member(chat_id, auth.uid())
  or has_role(auth.uid(), 'admin'::app_role)
);

drop policy if exists "Members can send messages" on public.chat_messages;
create policy "Members can send messages"
on public.chat_messages
for insert
to authenticated
with check (
  auth.uid() = sender_id
  and (
    public.is_chat_member(chat_id, auth.uid())
    or has_role(auth.uid(), 'admin'::app_role)
  )
);