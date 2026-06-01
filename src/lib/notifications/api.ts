import { supabase } from "@/integrations/supabase/client";
import type { NotificationCategory } from "./categories";

export interface SendNotificationInput {
  target: "user" | "users" | "all_students" | "all_admins";
  user_id?: string;
  user_ids?: string[];
  category: NotificationCategory;
  title: string;
  body?: string;
  image_url?: string;
  link_url?: string;
  actions?: { action: string; title: string }[];
  data?: Record<string, string>;
}

/**
 * Calls the send-notification edge function with simple retry for
 * offline / flaky connections (Opera Mini-style).
 */
export async function sendNotification(input: SendNotificationInput) {
  let lastErr: any;
  for (let i = 0; i < 3; i++) {
    try {
      const { data, error } = await supabase.functions.invoke("send-notification", { body: input });
      if (error) throw error;
      return data;
    } catch (e) {
      lastErr = e;
      if (i < 2) await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  // Best-effort queue for offline retry
  try {
    const queue = JSON.parse(localStorage.getItem("cb_notif_queue") || "[]");
    queue.push({ input, ts: Date.now() });
    localStorage.setItem("cb_notif_queue", JSON.stringify(queue.slice(-50)));
  } catch {}
  throw lastErr;
}

/** Flush queued sends — call on app load when online. */
export async function flushQueuedSends() {
  try {
    const queue = JSON.parse(localStorage.getItem("cb_notif_queue") || "[]");
    if (!queue.length || !navigator.onLine) return;
    const remaining: any[] = [];
    for (const item of queue) {
      try {
        const { error } = await supabase.functions.invoke("send-notification", { body: item.input });
        if (error) remaining.push(item);
      } catch { remaining.push(item); }
    }
    localStorage.setItem("cb_notif_queue", JSON.stringify(remaining));
  } catch {}
}