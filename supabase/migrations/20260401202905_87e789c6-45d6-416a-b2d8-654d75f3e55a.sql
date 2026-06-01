
-- Chat system tables

-- Chats table (1-on-1 and group chats)
CREATE TABLE public.chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_group BOOLEAN NOT NULL DEFAULT false,
  group_name TEXT,
  group_avatar_url TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Chat members
CREATE TABLE public.chat_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(chat_id, user_id)
);

-- Chat messages
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  is_admin_broadcast BOOLEAN NOT NULL DEFAULT false,
  edited BOOLEAN NOT NULL DEFAULT false,
  deleted_for_everyone BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Friend requests
CREATE TABLE public.friend_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sender_id, receiver_id)
);

-- Group invitations
CREATE TABLE public.group_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL,
  invitee_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(chat_id, invitee_id)
);

-- Message read receipts
CREATE TABLE public.message_read_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Online status
CREATE TABLE public.user_presence (
  user_id UUID NOT NULL PRIMARY KEY,
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chats
CREATE POLICY "Users can view chats they're members of" ON public.chats
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_members WHERE chat_members.chat_id = chats.id AND chat_members.user_id = auth.uid()));

CREATE POLICY "Authenticated users can create chats" ON public.chats
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can delete group chats" ON public.chats
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Chat admins can update chats" ON public.chats
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_members WHERE chat_members.chat_id = chats.id AND chat_members.user_id = auth.uid() AND chat_members.is_admin = true));

-- RLS Policies for chat_members
CREATE POLICY "Members can view chat members" ON public.chat_members
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_members cm WHERE cm.chat_id = chat_members.chat_id AND cm.user_id = auth.uid()));

CREATE POLICY "Users can add members to chats" ON public.chat_members
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Chat admins can remove members" ON public.chat_members
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.chat_members cm WHERE cm.chat_id = chat_members.chat_id AND cm.user_id = auth.uid() AND cm.is_admin = true)
    OR user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- RLS Policies for chat_messages
CREATE POLICY "Members can view chat messages" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_members WHERE chat_members.chat_id = chat_messages.chat_id AND chat_members.user_id = auth.uid()));

CREATE POLICY "Members can send messages" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (SELECT 1 FROM public.chat_members WHERE chat_members.chat_id = chat_messages.chat_id AND chat_members.user_id = auth.uid())
  );

CREATE POLICY "Senders can update own messages" ON public.chat_messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id);

CREATE POLICY "Admins can insert broadcast messages" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_admin_broadcast = true);

-- RLS Policies for friend_requests
CREATE POLICY "Users can view own friend requests" ON public.friend_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send friend requests" ON public.friend_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update received friend requests" ON public.friend_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id);

-- RLS Policies for group_invitations
CREATE POLICY "Users can view own group invitations" ON public.group_invitations
  FOR SELECT TO authenticated
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

CREATE POLICY "Users can send group invitations" ON public.group_invitations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Users can update received invitations" ON public.group_invitations
  FOR UPDATE TO authenticated
  USING (auth.uid() = invitee_id);

-- RLS Policies for message_read_receipts
CREATE POLICY "Users can view read receipts for their chats" ON public.message_read_receipts
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can mark messages as read" ON public.message_read_receipts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_presence
CREATE POLICY "Anyone can view presence" ON public.user_presence
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can update own presence" ON public.user_presence
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own presence" ON public.user_presence
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime for chat messages and presence
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_invitations;
