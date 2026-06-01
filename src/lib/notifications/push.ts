import { getToken, onMessage } from "firebase/messaging";
import { getMessagingSafe, VAPID_KEY } from "@/lib/firebase";
import { supabase } from "@/integrations/supabase/client";

const TOKEN_CACHE_KEY = "cb_fcm_token";

function isPreviewIframe() {
  try {
    if (window.self !== window.top) return true;
  } catch { return true; }
  const h = window.location.hostname;
  return h.includes("id-preview--") || h.includes("lovableproject.com");
}

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    !isPreviewIframe()
  );
}

export function notificationPermission(): NotificationPermission {
  if (typeof Notification === "undefined") return "denied";
  return Notification.permission;
}

export async function registerSwAndSubscribe(userId: string): Promise<{
  ok: boolean; reason?: string; token?: string;
}> {
  if (!pushSupported()) {
    return { ok: false, reason: "Push not supported in this environment (preview iframe or unsupported browser)." };
  }
  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return { ok: false, reason: "Permission denied" };

  // Register SW
  let registration: ServiceWorkerRegistration;
  try {
    registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    await navigator.serviceWorker.ready;
  } catch (e: any) {
    return { ok: false, reason: "Service worker registration failed: " + e.message };
  }

  const messaging = await getMessagingSafe();
  if (!messaging) return { ok: false, reason: "FCM not supported on this browser" };

  let token: string | undefined;
  // Retry up to 3 times for flaky network (Opera Mini-ish low bandwidth)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });
      if (token) break;
    } catch (e) {
      if (attempt === 2) return { ok: false, reason: "Could not obtain push token" };
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  if (!token) return { ok: false, reason: "Empty token" };

  if (localStorage.getItem(TOKEN_CACHE_KEY) !== token) {
    const { error } = await supabase.from("notification_tokens").upsert(
      {
        user_id: userId,
        token,
        platform: "web",
        user_agent: navigator.userAgent.slice(0, 255),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "token" }
    );
    if (error) return { ok: false, reason: error.message };
    localStorage.setItem(TOKEN_CACHE_KEY, token);
  }

  return { ok: true, token };
}

/**
 * Foreground listener — shows a Notification while the tab is focused
 * (FCM does not auto-display in that case).
 */
export async function startForegroundListener(onIncoming?: (payload: any) => void) {
  const messaging = await getMessagingSafe();
  if (!messaging) return () => {};
  const unsub = onMessage(messaging, (payload) => {
    onIncoming?.(payload);
    try {
      const d = payload.data || {};
      const title = (d as any).title || payload.notification?.title || "Notification";
      const body = (d as any).body || payload.notification?.body || "";
      const tag = (d as any).tag || (d as any).category || "system";
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, {
          body,
          icon: (d as any).image || "/favicon.ico",
          tag,
          data: { link: (d as any).link || "/" },
        });
      }
    } catch {}
  });
  return unsub;
}

export async function setBadge(count: number) {
  try {
    const nav = navigator as any;
    if (count > 0 && nav.setAppBadge) await nav.setAppBadge(count);
    else if (nav.clearAppBadge) await nav.clearAppBadge();
  } catch {}
}

export function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.start(); o.stop(ctx.currentTime + 0.26);
  } catch {}
}

export function vibrate(pattern: number[] = [120, 60, 120]) {
  try { if ("vibrate" in navigator) navigator.vibrate(pattern); } catch {}
}