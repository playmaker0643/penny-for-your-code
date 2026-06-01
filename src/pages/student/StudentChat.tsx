import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Users, MessageSquare, Archive, Trash2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";

const StudentChat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendInput, setFriendInput] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [longPressOn, setLongPressOn] = useState<string | null>(null);

  // Forward mode: select multiple chats then send
  const forwardContent: string | undefined = (location.state as any)?.forwardContent;
  const [forwardSelections, setForwardSelections] = useState<Set<string>>(new Set());

  const longPressRef = useRef<any>(null);

  // Update presence
  useEffect(() => {
    if (!user) return;
    const updatePresence = async () => {
      await supabase.from("user_presence").upsert({ user_id: user.id, is_online: true, last_seen: new Date().toISOString() });
    };
    updatePresence();
    const interval = setInterval(updatePresence, 30000);
    return () => {
      clearInterval(interval);
      supabase.from("user_presence").upsert({ user_id: user.id, is_online: false, last_seen: new Date().toISOString() });
    };
  }, [user]);

  // Archived chat ids
  const { data: archived = [] } = useQuery({
    queryKey: ["archived-chats", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("archived_chats").select("chat_id").eq("user_id", user!.id);
      return (data || []).map((r: any) => r.chat_id as string);
    },
    enabled: !!user,
  });

  // Fetch chats (same as before)
  const { data: allChats, isLoading } = useQuery({
    queryKey: ["student-chats", user?.id],
    queryFn: async () => {
      const [{ data: memberships }, { data: directMessages }] = await Promise.all([
        supabase.from("chat_members").select("chat_id").eq("user_id", user!.id),
        supabase.from("messages").select("*").or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`).order("created_at", { ascending: false }),
      ]);

      let enriched: any[] = [];

      if (memberships && memberships.length > 0) {
        const chatIds = memberships.map((m: any) => m.chat_id);
        const { data: chatData } = await supabase.from("chats").select("*").in("id", chatIds).order("updated_at", { ascending: false });
        enriched = await Promise.all((chatData || []).map(async (chat: any) => {
          const { data: lastMsg } = await supabase.from("chat_messages").select("content, created_at, sender_id, deleted_for_everyone").eq("chat_id", chat.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
          const { data: members } = await supabase.from("chat_members").select("user_id").eq("chat_id", chat.id).neq("user_id", user!.id);
          let otherProfile = null, otherPresence = null, otherUserId = null;
          if (!chat.is_group && members && members.length > 0) {
            otherUserId = members[0].user_id;
            const [{ data: prof }, { data: pres }] = await Promise.all([
              supabase.from("profiles").select("full_name, avatar_url, registration_number").eq("user_id", members[0].user_id).maybeSingle(),
              supabase.from("user_presence").select("is_online, last_seen").eq("user_id", members[0].user_id).maybeSingle(),
            ]);
            otherProfile = prof; otherPresence = pres;
          }
          const { data: allMsgs } = await supabase.from("chat_messages").select("id").eq("chat_id", chat.id).neq("sender_id", user!.id).eq("deleted_for_everyone", false);
          let unreadCount = 0;
          if (allMsgs && allMsgs.length > 0) {
            const { data: receipts } = await supabase.from("message_read_receipts").select("message_id").eq("user_id", user!.id).in("message_id", allMsgs.map((m: any) => m.id));
            const readIds = new Set((receipts || []).map((r: any) => r.message_id));
            unreadCount = allMsgs.filter((m: any) => !readIds.has(m.id)).length;
          }
          return { ...chat, otherUserId, lastMessage: lastMsg, otherProfile, otherPresence, unreadCount, sortDate: lastMsg?.created_at || chat.updated_at };
        }));
      }

      const existingDirectIds = new Set(enriched.filter((c: any) => !c.is_group && c.otherUserId).map((c: any) => c.otherUserId));
      const directMap = new Map<string, any>();
      for (const msg of directMessages || []) {
        const otherUserId = msg.sender_id === user!.id ? msg.receiver_id : msg.sender_id;
        if (!otherUserId || otherUserId === user!.id || existingDirectIds.has(otherUserId)) continue;
        const existing = directMap.get(otherUserId);
        if (!existing) directMap.set(otherUserId, { id: `dm-${otherUserId}`, is_group: false, otherUserId, lastMessage: msg, unreadCount: msg.receiver_id === user!.id && !msg.read ? 1 : 0, sortDate: msg.created_at });
        else if (msg.receiver_id === user!.id && !msg.read) existing.unreadCount += 1;
      }
      const directUserIds = Array.from(directMap.keys());
      if (directUserIds.length > 0) {
        const [{ data: profiles }, { data: presence }, { data: roles }] = await Promise.all([
          supabase.from("profiles").select("user_id, full_name, avatar_url, registration_number").in("user_id", directUserIds),
          supabase.from("user_presence").select("user_id, is_online, last_seen").in("user_id", directUserIds),
          supabase.from("user_roles").select("user_id, role").in("user_id", directUserIds),
        ]);
        const pm = new Map((profiles || []).map((p: any) => [p.user_id, p]));
        const prm = new Map((presence || []).map((p: any) => [p.user_id, p]));
        const rm = new Map((roles || []).map((r: any) => [r.user_id, r.role]));
        directMap.forEach((chat, otherUserId) => {
          const profile = pm.get(otherUserId);
          const isAdmin = rm.get(otherUserId) === "admin";
          chat.otherProfile = profile ? { ...profile, full_name: isAdmin ? "Support Team" : profile.full_name, registration_number: isAdmin ? null : profile.registration_number } : { full_name: isAdmin ? "Support Team" : "User", avatar_url: null, registration_number: null };
          chat.otherPresence = prm.get(otherUserId) || null;
        });
      }
      return [...enriched, ...Array.from(directMap.values())].sort((a: any, b: any) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

  const chats = (allChats || []).filter((c: any) => !archived.includes(c.id));
  const archivedChats = (allChats || []).filter((c: any) => archived.includes(c.id));

  // Friend requests + group invites
  const { data: pendingRequests } = useQuery({
    queryKey: ["friend-requests-pending", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("friend_requests").select("*").eq("receiver_id", user!.id).eq("status", "pending");
      if (!data) return [];
      return Promise.all(data.map(async (req: any) => {
        const { data: prof } = await supabase.from("profiles").select("full_name, avatar_url, registration_number").eq("user_id", req.sender_id).single();
        return { ...req, senderProfile: prof };
      }));
    },
    enabled: !!user,
  });

  const acceptFriendRequest = useMutation({
    mutationFn: async (id: string) => {
      const req = pendingRequests?.find((r: any) => r.id === id);
      if (!req) return;
      await supabase.from("friend_requests").update({ status: "accepted" }).eq("id", id);
      const { data: chat } = await supabase.from("chats").insert({ created_by: user!.id, is_group: false }).select().single();
      if (chat) await supabase.from("chat_members").insert([{ chat_id: chat.id, user_id: user!.id }, { chat_id: chat.id, user_id: req.sender_id }]);
    },
    onSuccess: () => {
      toast.success("Friend added!");
      queryClient.invalidateQueries({ queryKey: ["student-chats"] });
      queryClient.invalidateQueries({ queryKey: ["friend-requests-pending"] });
    },
  });

  const declineFriendRequest = useMutation({
    mutationFn: async (id: string) => { await supabase.from("friend_requests").update({ status: "rejected" }).eq("id", id); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["friend-requests-pending"] }),
  });

  const sendFriendRequest = useMutation({
    mutationFn: async (input: string) => {
      const { data: result } = await supabase.rpc("find_user_by_email_or_reg", { _input: input.trim() });
      const targetUserId = result as string | null;
      if (!targetUserId) throw new Error("User not found");
      if (targetUserId === user!.id) throw new Error("You can't add yourself");
      const { data: existing } = await supabase.from("friend_requests").select("id, status").or(`and(sender_id.eq.${user!.id},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${user!.id})`).limit(1);
      if (existing && existing.length > 0) {
        if (existing[0].status === "accepted") throw new Error("Already friends");
        if (existing[0].status === "pending") throw new Error("Request already sent");
      }
      await supabase.from("friend_requests").insert({ sender_id: user!.id, receiver_id: targetUserId });
      await supabase.from("messages").insert({ sender_id: user!.id, receiver_id: targetUserId, content: "👋 Friend request sent!" });
    },
    onSuccess: () => { toast.success("Friend request sent!"); setFriendInput(""); setShowAddFriend(false); queryClient.invalidateQueries({ queryKey: ["friend-requests-pending"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const archiveChat = async (id: string) => {
    await supabase.from("archived_chats").insert({ user_id: user!.id, chat_id: id });
    queryClient.invalidateQueries({ queryKey: ["archived-chats"] });
    setLongPressOn(null);
    toast.success("Archived");
  };
  const unarchiveChat = async (id: string) => {
    await supabase.from("archived_chats").delete().eq("user_id", user!.id).eq("chat_id", id);
    queryClient.invalidateQueries({ queryKey: ["archived-chats"] });
    toast.success("Unarchived");
  };
  const deleteChat = async (chat: any) => {
    if (!confirm("Delete this conversation?")) { setLongPressOn(null); return; }
    if (chat.is_group) {
      await supabase.from("chat_members").delete().eq("chat_id", chat.id).eq("user_id", user!.id);
    } else if (String(chat.id).startsWith("dm-")) {
      const otherId = chat.id.replace("dm-", "");
      await supabase.from("messages").delete().or(`and(sender_id.eq.${user!.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user!.id})`);
      await supabase.from("friend_requests").delete().or(`and(sender_id.eq.${user!.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user!.id})`);
    } else {
      await supabase.from("chat_members").delete().eq("chat_id", chat.id).eq("user_id", user!.id);
    }
    queryClient.invalidateQueries({ queryKey: ["student-chats"] });
    setLongPressOn(null);
    toast.success("Deleted");
  };

  const handleTouchStart = (chat: any) => {
    longPressRef.current = setTimeout(() => setLongPressOn(chat.id), 450);
  };
  const handleTouchEnd = () => { if (longPressRef.current) clearTimeout(longPressRef.current); };

  const handleChatClick = async (chat: any) => {
    if (forwardContent) {
      const next = new Set(forwardSelections);
      if (next.has(chat.id)) next.delete(chat.id); else next.add(chat.id);
      setForwardSelections(next);
      return;
    }
    navigate(`/student/chat/${chat.id}`);
  };

  const sendForward = async () => {
    if (!forwardContent || forwardSelections.size === 0) return;
    const content = forwardContent.startsWith("[forwarded]") ? forwardContent : `[forwarded] ${forwardContent}`;
    for (const id of forwardSelections) {
      const chat = (allChats || []).find((c: any) => c.id === id);
      if (!chat) continue;
      if (String(chat.id).startsWith("dm-")) {
        const otherId = chat.id.replace("dm-", "");
        await supabase.from("messages").insert({ sender_id: user!.id, receiver_id: otherId, content });
      } else {
        await supabase.from("chat_messages").insert({ chat_id: chat.id, sender_id: user!.id, content });
        await supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", chat.id);
      }
    }
    toast.success(`Forwarded to ${forwardSelections.size} chat${forwardSelections.size === 1 ? "" : "s"}`);
    setForwardSelections(new Set());
    navigate("/student/chat", { replace: true });
  };

  const renderChatRow = (chat: any) => {
    const name = chat.is_group ? chat.group_name || "Group" : chat.otherProfile?.full_name || "User";
    const avatar = chat.is_group ? null : chat.otherProfile?.avatar_url;
    const regNum = !chat.is_group ? chat.otherProfile?.registration_number : null;
    const isOnline = chat.otherPresence?.is_online;
    const lastMsg = chat.lastMessage;
    const lastText = lastMsg?.deleted_for_everyone ? "🚫 Message deleted" : (lastMsg?.content || "").replace(/^\[(image|video|file|sticker|poll|challenge|code|voice):.*\]$/, (_: any, t: string) => `📎 ${t}`);

    const isSelected = forwardSelections.has(chat.id);

    return (
      <div key={chat.id} className="relative">
        <button
          onClick={() => handleChatClick(chat)}
          onTouchStart={() => !forwardContent && handleTouchStart(chat)}
          onTouchEnd={handleTouchEnd}
          onContextMenu={(e) => { e.preventDefault(); setLongPressOn(chat.id); }}
          className={`w-full cyber-card rounded-xl p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left ${isSelected ? "ring-2 ring-primary" : ""}`}
        >
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-border/50">
              {avatar ? <img src={avatar} alt={name} className="w-full h-full object-cover" /> :
                <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                  {chat.is_group ? <Users className="h-5 w-5" /> : name.charAt(0).toUpperCase()}
                </div>}
            </div>
            {!chat.is_group && <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card ${isOnline ? "bg-green-500" : "bg-muted-foreground/40"}`} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground truncate">{name}</p>
              {lastMsg && <span className="text-[10px] text-muted-foreground font-mono shrink-0">{new Date(lastMsg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
            </div>
            <p className="text-xs text-muted-foreground truncate">{regNum || (chat.is_group ? "Group chat" : "")}</p>
            <div className="flex items-center justify-between mt-0.5">
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{lastText}</p>
              {chat.unreadCount > 0 && (
                <span className="min-w-[20px] h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1 shrink-0">
                  {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                </span>
              )}
            </div>
          </div>
        </button>

        {longPressOn === chat.id && !forwardContent && (
          <div className="absolute right-2 top-12 z-20 bg-card border border-border/50 rounded-lg shadow-xl overflow-hidden min-w-[160px]">
            {archived.includes(chat.id) ? (
              <button onClick={() => unarchiveChat(chat.id)} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted w-full">
                <Archive className="h-3 w-3" /> Unarchive
              </button>
            ) : (
              <button onClick={() => archiveChat(chat.id)} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted w-full">
                <Archive className="h-3 w-3" /> Move to archive
              </button>
            )}
            <button onClick={() => deleteChat(chat)} className="flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-muted w-full">
              <Trash2 className="h-3 w-3" /> Delete friend
            </button>
            <button onClick={() => setLongPressOn(null)} className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted w-full">Cancel</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-140px)]" onClick={() => longPressOn && setLongPressOn(null)}>
        {forwardContent ? (
          <div className="flex items-center justify-between mb-4 sticky top-0 bg-background z-10 py-2">
            <button onClick={() => navigate(-1)} className="p-2"><ArrowLeft className="h-5 w-5" /></button>
            <h1 className="text-base font-bold font-display">Forward to {forwardSelections.size} selected</h1>
            <Button size="sm" onClick={sendForward} disabled={forwardSelections.size === 0} className="bg-primary text-primary-foreground">Send</Button>
          </div>
        ) : (
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold font-display text-foreground">Chat</h1>
          </div>
        )}

        {/* Pending friend requests */}
        {!forwardContent && pendingRequests && pendingRequests.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-xs font-mono text-muted-foreground uppercase">Friend Requests</p>
            {pendingRequests.map((req: any) => (
              <div key={req.id} className="cyber-card rounded-xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {req.senderProfile?.full_name?.charAt(0) || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{req.senderProfile?.full_name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{req.senderProfile?.registration_number}</p>
                </div>
                <Button size="sm" className="h-7 text-xs bg-primary text-primary-foreground" onClick={() => acceptFriendRequest.mutate(req.id)}>Accept</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => declineFriendRequest.mutate(req.id)}>✕</Button>
              </div>
            ))}
          </div>
        )}

        {/* Archive section pinned top */}
        {!forwardContent && archivedChats.length > 0 && (
          <button onClick={() => setShowArchive(!showArchive)} className="cyber-card rounded-xl p-3 flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"><Archive className="h-5 w-5 text-muted-foreground" /></div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold">Archived</p>
              <p className="text-[10px] text-muted-foreground font-mono">{archivedChats.length} conversations</p>
            </div>
          </button>
        )}

        {showArchive && (
          <div className="mb-3 space-y-1 pl-2 border-l-2 border-primary/30">
            {archivedChats.map(renderChatRow)}
          </div>
        )}

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto space-y-1">
          {isLoading ? (
            <p className="text-center text-muted-foreground font-mono py-12 animate-pulse">Loading...</p>
          ) : chats && chats.length > 0 ? (
            chats.map(renderChatRow)
          ) : (
            <div className="flex flex-col items-center justify-center py-20">
              <MessageSquare className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground font-mono text-sm">No chats yet</p>
            </div>
          )}
        </div>

        {!forwardContent && (
          <button onClick={() => setShowAddMenu(true)} className="fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center">
            <UserPlus className="h-6 w-6" />
          </button>
        )}

        <Dialog open={showAddMenu} onOpenChange={setShowAddMenu}>
          <DialogContent className="bg-card border-border/50 max-w-sm">
            <DialogHeader><DialogTitle>New Chat</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <button onClick={() => { setShowAddMenu(false); setShowAddFriend(true); }} className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted">
                <UserPlus className="h-5 w-5 text-primary" />
                <div className="text-left"><p className="text-sm font-semibold">Add Friend</p><p className="text-xs text-muted-foreground">By registration number or email</p></div>
              </button>
              <button onClick={() => { setShowAddMenu(false); navigate("/student/chat/create-group"); }} className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted">
                <Users className="h-5 w-5 text-secondary" />
                <div className="text-left"><p className="text-sm font-semibold">Create Group</p><p className="text-xs text-muted-foreground">Start a group chat</p></div>
              </button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showAddFriend} onOpenChange={setShowAddFriend}>
          <DialogContent className="bg-card border-border/50 max-w-sm">
            <DialogHeader><DialogTitle>Add Friend</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <Input value={friendInput} onChange={(e) => setFriendInput(e.target.value)} placeholder="CBS260001 or user@email.com" className="bg-muted border-border/50" />
              <Button onClick={() => sendFriendRequest.mutate(friendInput)} disabled={!friendInput.trim() || sendFriendRequest.isPending} className="w-full bg-primary text-primary-foreground font-mono font-bold">
                {sendFriendRequest.isPending ? "SENDING..." : "SEND REQUEST"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default StudentChat;
