import { useAuth } from "@/contexts/AuthContext";
import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Video, Phone, Swords, Send, Smile, Paperclip, Camera, Mic,
  Check, CheckCheck, Trash2, Pencil, Forward, X, Square, Play, Pause, Hash, User as UserIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import EmojiPicker from "@/components/chat/EmojiPicker";
import AttachmentMenu from "@/components/chat/AttachmentMenu";
import CodeSpaceComposer from "@/components/chat/CodeSpaceComposer";
import {
  ImageMessage, VideoMessage, FileMessage, StickerMessage, VoiceMessage,
  ChallengeMessage, PollMessage, CodeMessage,
  isImageMsg, isVideoMsg, isFileMsg, isStickerMsg, isVoiceMsg,
  isChallengeMsg, isPollMsg, isCodeMsg, isForwardedMsg, stripForwarded,
} from "@/components/chat/MessageRenderers";

const StudentChatConversation = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isDirect = !!chatId?.startsWith("dm-");
  const directUserId = isDirect && chatId ? chatId.replace("dm-", "") : null;

  const [input, setInput] = useState("");
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [previewAvatar, setPreviewAvatar] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [voiceSending, setVoiceSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttachment, setShowAttachment] = useState(false);
  const [showCodeSpace, setShowCodeSpace] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const longPressRef = useRef<any>(null);
  const sentVoiceIdsRef = useRef<Set<string>>(new Set()); // voice ids that already sent

  // Chat info
  const { data: chat } = useQuery({
    queryKey: ["chat-info", chatId],
    queryFn: async () => {
      if (isDirect && directUserId) {
        const [{ data: prof }, { data: pres }, { data: roleRow }] = await Promise.all([
          supabase.from("profiles").select("full_name, avatar_url, registration_number, country, state").eq("user_id", directUserId).maybeSingle(),
          supabase.from("user_presence").select("is_online, last_seen").eq("user_id", directUserId).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", directUserId).maybeSingle(),
        ]);
        const isAdminUser = roleRow?.role === "admin";
        return {
          id: chatId, is_group: false, isAdminChat: isAdminUser, otherUserId: directUserId,
          otherProfile: prof ? { ...prof, full_name: isAdminUser ? "Support Team" : prof.full_name, registration_number: isAdminUser ? null : prof.registration_number } : { full_name: isAdminUser ? "Support Team" : "Chat", avatar_url: null, registration_number: null },
          otherPresence: pres,
        };
      }
      const { data } = await supabase.from("chats").select("*").eq("id", chatId!).single();
      if (!data) return null;
      if (!data.is_group) {
        const { data: members } = await supabase.from("chat_members").select("user_id").eq("chat_id", chatId!).neq("user_id", user!.id);
        if (members && members.length > 0) {
          const [{ data: prof }, { data: pres }] = await Promise.all([
            supabase.from("profiles").select("full_name, avatar_url, registration_number, country, state").eq("user_id", members[0].user_id).single(),
            supabase.from("user_presence").select("is_online, last_seen").eq("user_id", members[0].user_id).single(),
          ]);
          return { ...data, otherProfile: prof, otherPresence: pres, otherUserId: members[0].user_id };
        }
      }
      return data;
    },
    enabled: !!chatId && !!user,
  });

  // Messages
  const { data: messages } = useQuery({
    queryKey: ["chat-messages", chatId],
    queryFn: async () => {
      if (isDirect && directUserId) {
        const { data } = await supabase.from("messages").select("*")
          .or(`and(sender_id.eq.${user!.id},receiver_id.eq.${directUserId}),and(sender_id.eq.${directUserId},receiver_id.eq.${user!.id})`)
          .order("created_at", { ascending: true });
        return (data || []).map((m: any) => ({ ...m, readBy: m.read ? [{ user_id: directUserId }] : [], deleted_for_everyone: false, edited: false }));
      }
      const { data } = await supabase.from("chat_messages").select("*").eq("chat_id", chatId!).order("created_at", { ascending: true });
      if (!data) return [];
      const sentIds = data.filter((m: any) => m.sender_id === user!.id).map((m: any) => m.id);
      let receipts: any[] = [];
      if (sentIds.length > 0) {
        const { data: r } = await supabase.from("message_read_receipts").select("message_id, user_id, read_at").in("message_id", sentIds);
        receipts = r || [];
      }
      return data.map((m: any) => ({ ...m, readBy: receipts.filter((r: any) => r.message_id === m.id) }));
    },
    enabled: !!chatId && !!user,
    refetchInterval: 3000,
  });

  // Mark as read
  useEffect(() => {
    if (!messages || !user || !chatId) return;
    if (isDirect) {
      const ids = messages.filter((m: any) => m.sender_id !== user.id && !m.read).map((m: any) => m.id);
      if (ids.length > 0) {
        supabase.from("messages").update({ read: true }).in("id", ids).then(() => {
          qc.invalidateQueries({ queryKey: ["chat-messages", chatId] });
          qc.invalidateQueries({ queryKey: ["student-chats"] });
        });
      }
      return;
    }
    const unread = messages.filter((m: any) => m.sender_id !== user.id && !m.readBy?.some((r: any) => r.user_id === user.id));
    if (unread.length === 0) return;
    supabase.from("message_read_receipts").upsert(unread.map((m: any) => ({ message_id: m.id, user_id: user.id })), { onConflict: "message_id,user_id" }).then(() => {
      qc.invalidateQueries({ queryKey: ["chat-messages", chatId] });
      qc.invalidateQueries({ queryKey: ["student-chats"] });
    });
  }, [messages, user, chatId, isDirect, qc]);

  // Instantly clear the unread badge in the chat list the moment the user enters this chat
  useEffect(() => {
    if (!chatId) return;
    qc.setQueryData(["student-chats", user?.id], (prev: any) => {
      if (!Array.isArray(prev)) return prev;
      return prev.map((c: any) => (c.id === chatId ? { ...c, unreadCount: 0 } : c));
    });
  }, [chatId, user?.id, qc]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Realtime
  useEffect(() => {
    if (!chatId) return;
    const ch = supabase.channel(`chat-${chatId}`)
      .on("postgres_changes", isDirect ? { event: "*", schema: "public", table: "messages" } : { event: "*", schema: "public", table: "chat_messages", filter: `chat_id=eq.${chatId}` },
        () => { qc.invalidateQueries({ queryKey: ["chat-messages", chatId] }); qc.invalidateQueries({ queryKey: ["student-chats"] }); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [chatId, qc, isDirect]);

  const sendContentMessage = async (content: string) => {
    if (isDirect && directUserId) {
      await supabase.from("messages").insert({ sender_id: user!.id, receiver_id: directUserId, content });
    } else {
      await supabase.from("chat_messages").insert({ chat_id: chatId!, sender_id: user!.id, content });
      await supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId!);
    }
    qc.invalidateQueries({ queryKey: ["chat-messages", chatId] });
    qc.invalidateQueries({ queryKey: ["student-chats"] });
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    if (editingMsgId) {
      await supabase.from("chat_messages").update({ content: text, edited: true, updated_at: new Date().toISOString() }).eq("id", editingMsgId);
      setEditingMsgId(null);
    } else {
      await sendContentMessage(text);
    }
    qc.invalidateQueries({ queryKey: ["chat-messages", chatId] });
  };

  const deleteForEveryone = async (msgId: string) => {
    if (isDirect) await supabase.from("messages").delete().eq("id", msgId);
    else await supabase.from("chat_messages").update({ deleted_for_everyone: true, content: "" }).eq("id", msgId);
    setContextMenu(null);
    qc.invalidateQueries({ queryKey: ["chat-messages", chatId] });
  };

  const deleteForMe = async (msgId: string) => {
    // Local-only: store hidden message ids in localStorage
    const key = `hidden-msgs-${user!.id}`;
    const arr: string[] = JSON.parse(localStorage.getItem(key) || "[]");
    arr.push(msgId);
    localStorage.setItem(key, JSON.stringify(arr));
    setContextMenu(null);
    qc.invalidateQueries({ queryKey: ["chat-messages", chatId] });
  };

  const hiddenIds = new Set<string>(JSON.parse(localStorage.getItem(`hidden-msgs-${user?.id}`) || "[]"));

  const startForward = (msg: any) => {
    setContextMenu(null);
    navigate("/student/chat", { state: { forwardContent: msg.content } });
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setRecordedAudio(blob);
        // Generate a unique invisible id for this recording. Same id can only send once.
        setVoiceId(`v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch { toast.error("Mic denied"); }
  };

  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };

  const sendVoiceNote = async () => {
    if (!recordedAudio || !voiceId) return;
    if (voiceSending) return;
    if (sentVoiceIdsRef.current.has(voiceId)) return; // already sent — block any future sends with same id
    sentVoiceIdsRef.current.add(voiceId);
    setVoiceSending(true);
    const blob = recordedAudio;
    // Clear UI immediately so the send button hides
    setRecordedAudio(null);
    const thisVoiceId = voiceId;
    setVoiceId(null);
    try {
      const path = `${user!.id}/voice-${thisVoiceId}.webm`;
      const { error } = await supabase.storage.from("chat-media").upload(path, blob, { contentType: "audio/webm" });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path);
      await sendContentMessage(`[voice:${pub.publicUrl}]`);
    } catch {
      toast.error("Failed to send voice note");
    } finally {
      setVoiceSending(false);
    }
  };

  const handleTouchStart = (msg: any) => { longPressRef.current = setTimeout(() => setContextMenu(msg.id), 450); };
  const handleTouchEnd = () => { if (longPressRef.current) clearTimeout(longPressRef.current); };

  const startCall = async (callType: "voice" | "video") => {
    const otherUserId = (chat as any)?.otherUserId;
    if (!user) return;
    if (chat?.is_group) {
      // Group call: not full multi-party WebRTC, but route to call page with group flag
      toast.info("Group call started");
    }
    if (!otherUserId && !chat?.is_group) { toast.error("Cannot call"); return; }
    const callMsg = callType === "video" ? "📹 Video call started" : "📞 Voice call started";
    await sendContentMessage(callMsg);
    const { data: call } = await supabase.from("calls").insert({
      caller_id: user.id, receiver_id: otherUserId || user.id, call_type: callType, chat_id: isDirect ? null : chatId,
    }).select().single();
    if (call) navigate(callType === "video" ? `/student/call/video/${call.id}` : `/student/call/voice/${call.id}`);
  };

  const groupedMessages = (messages || []).filter((m: any) => !hiddenIds.has(m.id)).reduce((acc: any[], msg: any) => {
    const dateStr = new Date(msg.created_at).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const lastGroup = acc[acc.length - 1];
    if (lastGroup && lastGroup.date === dateStr) lastGroup.messages.push(msg);
    else acc.push({ date: dateStr, messages: [msg] });
    return acc;
  }, []);

  const chatName = chat?.is_group ? (chat as any).group_name || "Group" : (chat as any)?.otherProfile?.full_name || "Chat";
  const chatAvatar = !chat?.is_group ? (chat as any)?.otherProfile?.avatar_url : null;
  const isOnline = !chat?.is_group ? (chat as any)?.otherPresence?.is_online : false;
  const isAdminChat = !!(chat as any)?.isAdminChat;
  const statusText = isOnline ? "online" : (chat as any)?.otherPresence?.last_seen
    ? `last seen ${new Date((chat as any).otherPresence.last_seen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "offline";

  // Profile full-page
  if (showProfile && !chat?.is_group) {
    const otherProfile = (chat as any)?.otherProfile;
    const regNum = otherProfile?.registration_number;
    return (
      <div className="fixed inset-0 z-[100] bg-background overflow-y-auto">
        <header className="sticky top-0 h-14 bg-card border-b border-border/50 flex items-center px-3 gap-3">
          <button onClick={() => setShowProfile(false)} className="p-2"><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="text-base font-bold font-display">Profile</h1>
        </header>
        <div className="p-4">
          <div className="cyber-card rounded-2xl p-4">
            <div className="flex items-start gap-4">
              <button onClick={() => setPreviewAvatar(true)} className="w-20 h-20 rounded-full overflow-hidden border-4 border-primary/30 shrink-0">
                {chatAvatar ? <img src={chatAvatar} alt="" className="w-full h-full object-cover" /> :
                  <div className="w-full h-full bg-primary/20 flex items-center justify-center"><UserIcon className="h-9 w-9 text-primary" /></div>}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold font-display truncate">{chatName}</p>
                {regNum && <p className="text-xs text-primary font-mono mt-1 flex items-center gap-1"><Hash className="h-3 w-3" /> {regNum}</p>}
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground font-mono">Level</p>
                <p className="text-lg font-bold text-primary">⭐</p>
                <p className={`text-[10px] font-mono ${isOnline ? "text-green-500" : "text-muted-foreground"}`}>{isOnline ? "● online" : "● offline"}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => { setShowProfile(false); startCall("voice"); }}><Phone className="h-4 w-4 mr-1" /> Call</Button>
            <Button variant="outline" className="flex-1" onClick={() => { setShowProfile(false); startCall("video"); }}><Video className="h-4 w-4 mr-1" /> Video</Button>
          </div>
        </div>
        {previewAvatar && chatAvatar && (
          <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center" onClick={() => setPreviewAvatar(false)}>
            <img src={chatAvatar} alt="" className="max-w-full max-h-full" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="h-16 bg-card border-b border-border/50 flex items-center px-2 gap-2 shrink-0 z-10">
        <button onClick={() => navigate("/student/chat")} className="p-2"><ArrowLeft className="h-5 w-5" /></button>
        <button
          onClick={() => {
            if (chat?.is_group) navigate(`/student/group/${chatId}`);
            else if (!isAdminChat) setShowProfile(true);
          }}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-border/50 shrink-0">
            {chatAvatar ? <img src={chatAvatar} alt="" className="w-full h-full object-cover" /> :
              <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">{chatName.charAt(0).toUpperCase()}</div>}
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{chatName}</p>
            <p className="text-[11px] text-primary/70 font-mono">{chat?.is_group ? "Tap for info" : statusText}</p>
          </div>
        </button>
        {!isAdminChat && (
          <div className="flex items-center gap-1">
            <button onClick={() => startCall("video")} className="p-2 text-muted-foreground"><Video className="h-5 w-5" /></button>
            <button onClick={() => startCall("voice")} className="p-2 text-muted-foreground"><Phone className="h-5 w-5" /></button>
            {!chat?.is_group && (
              <button onClick={() => {
                const otherUserId = (chat as any)?.otherUserId;
                const otherProfile = (chat as any)?.otherProfile;
                if (!user || !otherUserId) return;
                navigate("/student/challenges", { state: { fromChatOpponent: { id: otherUserId, name: otherProfile?.full_name || "Opponent", regNum: otherProfile?.registration_number || "", country: otherProfile?.country || "" } } });
              }} className="p-2 text-muted-foreground"><Swords className="h-4 w-4" /></button>
            )}
          </div>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {groupedMessages.map((group: any, gi: number) => (
          <div key={gi}>
            <div className="flex justify-center my-3">
              <span className="bg-card/80 text-muted-foreground text-[10px] font-mono px-3 py-1 rounded-lg">{group.date}</span>
            </div>
            {group.messages.map((msg: any) => {
              const isMine = msg.sender_id === user?.id;
              const isDeleted = msg.deleted_for_everyone;
              const time = new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              const content = msg.content || "";
              const forwarded = isForwardedMsg(content);
              const cleanContent = forwarded ? stripForwarded(content) : content;

              let tickIcon = null;
              if (isMine && !isDeleted) {
                const hasBeenRead = msg.readBy && msg.readBy.length > 0;
                tickIcon = hasBeenRead
                  ? <CheckCheck className="h-3 w-3 inline-block ml-1" style={{ color: "#32CD32" }} />
                  : <Check className="h-3 w-3 inline-block ml-1 text-muted-foreground" />;
              }

              if (isDeleted) return (
                <div key={msg.id} className={`flex mb-2 ${isMine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${isMine ? "bg-primary/10" : "bg-card"}`}>
                    <p className="text-xs text-muted-foreground italic">🚫 This message was deleted</p>
                  </div>
                </div>
              );

              // System messages
              if (cleanContent.startsWith("📞") || cleanContent.startsWith("📹") || cleanContent.startsWith("❌") || cleanContent.startsWith("👋")) {
                const missed = !isMine && (cleanContent.includes("Voice call") || cleanContent.includes("Video call")) && !msg.readBy?.length;
                const text = missed ? `❌ Missed ${cleanContent.includes("Video") ? "video" : "voice"} call` : cleanContent;
                return (
                  <div key={msg.id} className="flex justify-center mb-2">
                    <div className="bg-card/60 rounded-xl px-4 py-1.5 border border-border/20">
                      <p className={`text-[11px] font-mono text-center ${missed ? "text-destructive font-bold" : "text-muted-foreground"}`}>{text}</p>
                    </div>
                  </div>
                );
              }

              const renderBody = () => {
                if (isVoiceMsg(cleanContent)) return <VoiceMessage src={cleanContent.slice(7, -1)} />;
                if (isImageMsg(cleanContent)) return <ImageMessage url={cleanContent.slice(7, -1)} />;
                if (isVideoMsg(cleanContent)) return <VideoMessage url={cleanContent.slice(7, -1)} />;
                if (isFileMsg(cleanContent)) return <FileMessage raw={cleanContent} />;
                if (isStickerMsg(cleanContent)) return <StickerMessage url={cleanContent.slice(9, -1)} />;
                if (isChallengeMsg(cleanContent)) return <ChallengeMessage id={cleanContent.slice(11, -1)} isMine={isMine} />;
                if (isPollMsg(cleanContent)) return <PollMessage id={cleanContent.slice(6, -1)} />;
                if (isCodeMsg(cleanContent)) return <CodeMessage raw={cleanContent} />;
                return <p className="text-[13px] whitespace-pre-wrap break-words">{cleanContent}</p>;
              };

              return (
                <div key={msg.id} className={`flex mb-2 ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`relative max-w-[78%] rounded-2xl px-3 py-2 shadow-sm ${isMine ? "bg-primary/20 border border-primary/10" : "bg-card border border-border/30"}`}
                    onTouchStart={() => handleTouchStart(msg)}
                    onTouchEnd={handleTouchEnd}
                    onContextMenu={(e) => { e.preventDefault(); setContextMenu(msg.id); }}
                  >
                    {forwarded && <p className="text-[9px] text-muted-foreground italic mb-1 flex items-center gap-1"><Forward className="h-2.5 w-2.5" /> Forwarded</p>}
                    {renderBody()}
                    <div className="flex items-center justify-end gap-0.5 mt-0.5">
                      {msg.edited && <span className="text-[8px] text-muted-foreground/50 mr-1">edited</span>}
                      <span className="text-[9px] text-muted-foreground">{time}</span>
                      {tickIcon}
                    </div>

                    {contextMenu === msg.id && (
                      <div className="absolute top-full right-0 mt-1 bg-card border border-border/50 rounded-lg shadow-xl z-20 overflow-hidden min-w-[160px]">
                        <button onClick={() => { setEditingMsgId(msg.id); setInput(cleanContent); setContextMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted w-full">
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button onClick={() => startForward(msg)} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted w-full">
                          <Forward className="h-3 w-3" /> Forward
                        </button>
                        {isMine && (
                          <button onClick={() => deleteForEveryone(msg.id)} className="flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-muted w-full">
                            <Trash2 className="h-3 w-3" /> Delete for everyone
                          </button>
                        )}
                        <button onClick={() => deleteForMe(msg.id)} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted w-full">
                          <Trash2 className="h-3 w-3" /> Delete for me
                        </button>
                        <button onClick={() => setContextMenu(null)} className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted w-full">
                          <X className="h-3 w-3" /> Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <EmojiPicker
        isOpen={showEmoji}
        onClose={() => setShowEmoji(false)}
        onSelectEmoji={(e) => { setInput(prev => prev + e); inputRef.current?.focus(); }}
        onSelectSticker={(url) => { sendContentMessage(`[sticker:${url}]`); setShowEmoji(false); }}
      />

      <AttachmentMenu
        isOpen={showAttachment}
        onClose={() => setShowAttachment(false)}
        userId={user?.id || ""}
        otherUserId={(chat as any)?.otherUserId}
        chatId={chatId}
        isDirectConversation={isDirect}
        onSendMessage={sendContentMessage}
        onOpenCodeSpace={() => setShowCodeSpace(true)}
      />

      {showCodeSpace && (
        <CodeSpaceComposer
          onClose={() => setShowCodeSpace(false)}
          onSend={(code) => sendContentMessage(`[code:${code}]`)}
        />
      )}

      {!isAdminChat && (
        <div className="shrink-0 bg-card border-t border-border/50 px-2 py-2 flex items-end gap-2">
          <button onClick={() => { setShowEmoji(!showEmoji); setShowAttachment(false); }} className={`p-2 shrink-0 self-end ${showEmoji ? "text-primary" : "text-muted-foreground"}`}><Smile className="h-5 w-5" /></button>

          {isRecording ? (
            <div className="flex-1 flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-2xl px-3 py-2">
              <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
              <span className="text-xs text-destructive font-mono flex-1">Recording...</span>
              <button onClick={stopRecording} className="p-1 text-destructive"><Square className="h-4 w-4" /></button>
            </div>
          ) : recordedAudio ? (
            <div className="flex-1 flex items-center gap-2 bg-muted border border-border/30 rounded-2xl px-3 py-2">
              <span className="text-xs flex-1 font-mono">Voice note ready</span>
              <button onClick={() => { setRecordedAudio(null); setVoiceId(null); }} className="p-1 text-destructive"><Trash2 className="h-3 w-3" /></button>
            </div>
          ) : (
            <div className="flex-1 relative flex items-end bg-muted border border-border/30 rounded-2xl px-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 160) + "px"; // 10rem = 160px
                }}
                placeholder={editingMsgId ? "Edit message..." : "Message"}
                rows={1}
                className="flex-1 bg-transparent py-2.5 text-foreground placeholder:text-muted-foreground outline-none resize-none overflow-y-auto"
                style={{ minHeight: "36px", maxHeight: "10rem", fontSize: 16 }}
              />
              <button onClick={() => { setShowAttachment(!showAttachment); setShowEmoji(false); }} className="p-1.5 shrink-0 self-end mb-1 text-muted-foreground"><Paperclip className="h-4 w-4" /></button>
              <button
                onClick={() => navigate("/student/camera", { state: { returnTo: window.location.pathname, chatId, isDirect, otherUserId: (chat as any)?.otherUserId } })}
                className="p-1.5 text-muted-foreground shrink-0 self-end mb-1">
                <Camera className="h-4 w-4" />
              </button>
              {editingMsgId && (
                <button onClick={() => { setEditingMsgId(null); setInput(""); }} className="absolute -top-5 right-2 text-[10px] text-destructive font-mono bg-card px-1 rounded">Cancel edit</button>
              )}
            </div>
          )}

          {input.trim() ? (
            <button onClick={sendMessage} className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 self-end">
              <Send className="h-4 w-4" />
            </button>
          ) : recordedAudio ? (
            <button onClick={sendVoiceNote} disabled={voiceSending} className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 self-end disabled:opacity-50">
              <Send className="h-4 w-4" />
            </button>
          ) : !isRecording ? (
            <button onClick={startRecording} className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 self-end">
              <Mic className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default StudentChatConversation;
