import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAll as idbGetAll, putMany as idbPut, markRead as idbMarkRead,
  remove as idbRemove, clearAll as idbClear, type CachedNotification,
} from "@/lib/notifications/idb";
import {
  setBadge, playNotificationSound, vibrate,
  startForegroundListener,
} from "@/lib/notifications/push";

export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<CachedNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const unread = items.filter((i) => !i.read).length;

  // Initial hydrate: IndexedDB first (instant offline), then network
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const cached = await idbGetAll();
      if (!cancelled) setItems(cached.filter((c) => c.user_id === user.id));
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100);
        if (!error && data) {
          const mapped: CachedNotification[] = data.map((d: any) => ({
            id: d.id, user_id: d.user_id, category: d.category,
            title: d.title, body: d.body, image_url: d.image_url,
            link_url: d.link_url, actions: d.actions || [], data: d.data || {},
            read: d.read, created_at: d.created_at,
          }));
          if (!cancelled) setItems(mapped);
          await idbPut(mapped);
        }
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        async (payload: any) => {
          if (payload.eventType === "INSERT") {
            const n = payload.new;
            setItems((prev) => [n, ...prev]);
            await idbPut([n]);
            // Only show a popup/sound when the app is in the background
            // (tab hidden, minimized, or another tab focused). When the user
            // is actively inside the app, the notification is silently added
            // to the bell/history without interrupting them.
            const inBackground =
              typeof document !== "undefined" &&
              (document.hidden || document.visibilityState !== "visible");
            if (inBackground) {
              playNotificationSound();
              vibrate();
              toast(n.title || "New notification", {
                description: n.body || undefined,
                duration: 5000,
                action: n.link_url
                  ? { label: "Open", onClick: () => { window.location.href = n.link_url; } }
                  : undefined,
              });
              try {
                if ("Notification" in window && Notification.permission === "granted") {
                  new Notification(n.title || "Notification", {
                    body: n.body || "",
                    icon: n.image_url || "/favicon.ico",
                    tag: n.category || "system",
                    data: { link: n.link_url || "/" },
                  });
                }
              } catch {}
            }
          } else if (payload.eventType === "UPDATE") {
            const n = payload.new;
            setItems((prev) => prev.map((p) => (p.id === n.id ? n : p)));
            await idbPut([n]);
          } else if (payload.eventType === "DELETE") {
            const id = payload.old?.id;
            if (id) {
              setItems((prev) => prev.filter((p) => p.id !== id));
              await idbRemove(id);
            }
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Foreground FCM
  useEffect(() => {
    let unsub: any;
    startForegroundListener().then((fn) => { unsub = fn; });
    return () => { try { unsub?.(); } catch {} };
  }, []);

  // SW click navigation
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "NOTIFICATION_CLICK" && e.data.url) {
        window.location.href = e.data.url;
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  // Badge sync
  useEffect(() => { setBadge(unread); }, [unread]);

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, read: true } : p)));
    await idbMarkRead(id);
    await supabase.from("notifications").update({ read: true, read_at: new Date().toISOString() }).eq("id", id);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    setItems((prev) => prev.map((p) => ({ ...p, read: true })));
    await supabase.from("notifications").update({ read: true, read_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("read", false);
  }, [user]);

  const remove = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
    await idbRemove(id);
    await supabase.from("notifications").delete().eq("id", id);
  }, []);

  const clearAll = useCallback(async () => {
    if (!user) return;
    setItems([]);
    await idbClear();
    await supabase.from("notifications").delete().eq("user_id", user.id);
  }, [user]);

  return { items, unread, loading, markRead, markAllRead, remove, clearAll };
}