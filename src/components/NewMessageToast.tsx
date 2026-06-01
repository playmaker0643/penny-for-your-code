import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { playNotificationSound } from "@/lib/notificationSound";
import { MessageCircle } from "lucide-react";

interface ToastItem {
  id: string;
  senderId: string;
  senderName: string;
  avatar: string | null;
  preview: string;
  chatHref: string;
}

const NewMessageToast = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [toast, setToast] = useState<ToastItem | null>(null);
  const dismissTimerRef = useRef<any>(null);
  const longPressRef = useRef<any>(null);
  const dragRef = useRef<{ startX: number; dx: number } | null>(null);

  // Cache for sender profile lookups
  const profileCacheRef = useRef<Map<string, { name: string; avatar: string | null }>>(new Map());

  const fetchProfile = async (uid: string) => {
    const cached = profileCacheRef.current.get(uid);
    if (cached) return cached;
    const [{ data: prof }, { data: roleRow }] = await Promise.all([
      supabase.from("profiles").select("full_name, avatar_url").eq("user_id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle(),
    ]);
    const isAdmin = roleRow?.role === "admin";
    const result = {
      name: isAdmin ? "Support Team" : (prof?.full_name || "Someone"),
      avatar: prof?.avatar_url || null,
    };
    profileCacheRef.current.set(uid, result);
    return result;
  };

  const showToast = (item: ToastItem) => {
    if (location.pathname.includes("/student/chat/")) return;
    setToast(item);
    playNotificationSound();
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => setToast(null), 4000);
  };

  // Direct messages
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`new-direct-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${user.id}` },
        async (payload: any) => {
          const msg = payload.new;
          if (msg.sender_id === user.id) return;
          const prof = await fetchProfile(msg.sender_id);
          showToast({
            id: msg.id,
            senderId: msg.sender_id,
            senderName: prof.name,
            avatar: prof.avatar,
            preview: msg.content || "New message",
            chatHref: `/student/chat/dm-${msg.sender_id}`,
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, location.pathname]);

  // Group messages — only for chats user is a member of
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`new-group-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        async (payload: any) => {
          const msg = payload.new;
          if (msg.sender_id === user.id) return;
          const { data: member } = await supabase.from("chat_members").select("chat_id").eq("chat_id", msg.chat_id).eq("user_id", user.id).maybeSingle();
          if (!member) return;
          const prof = await fetchProfile(msg.sender_id);
          showToast({
            id: msg.id,
            senderId: msg.sender_id,
            senderName: prof.name,
            avatar: prof.avatar,
            preview: msg.content || "New message",
            chatHref: `/student/chat/${msg.chat_id}`,
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, location.pathname]);

  if (!toast) return null;

  return (
    <div
      className="fixed top-2 left-1/2 -translate-x-1/2 z-[200] w-[92vw] max-w-md"
      style={{ transform: `translate(calc(-50% + ${dragRef.current?.dx || 0}px), 0)`, transition: "transform 0.15s" }}
      onTouchStart={(e) => {
        dragRef.current = { startX: e.touches[0].clientX, dx: 0 };
        longPressRef.current = setTimeout(() => {
          if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
        }, 400);
      }}
      onTouchMove={(e) => {
        if (!dragRef.current) return;
        dragRef.current.dx = e.touches[0].clientX - dragRef.current.startX;
        (e.currentTarget as HTMLElement).style.transform = `translate(calc(-50% + ${dragRef.current.dx}px), 0)`;
      }}
      onTouchEnd={() => {
        if (longPressRef.current) clearTimeout(longPressRef.current);
        if (dragRef.current && Math.abs(dragRef.current.dx) > 80) setToast(null);
        dragRef.current = null;
      }}
      onClick={() => {
        const href = toast.chatHref;
        setToast(null);
        navigate(href);
      }}
    >
      <div className="bg-card border border-primary/40 rounded-2xl shadow-2xl p-3 flex items-center gap-3 cursor-pointer animate-in slide-in-from-top-4">
        <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-primary/30 shrink-0">
          {toast.avatar ? (
            <img src={toast.avatar} alt={toast.senderName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-primary/20 flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{toast.senderName}</p>
          <p className="text-xs text-muted-foreground truncate">{toast.preview.slice(0, 80)}</p>
        </div>
      </div>
    </div>
  );
};

export default NewMessageToast;
