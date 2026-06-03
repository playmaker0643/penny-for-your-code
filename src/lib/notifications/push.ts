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
    console.warn("[push] not supported (preview iframe or missing APIs)");
    return { ok: false, reason: "Push not supported in this environment (preview iframe or unsupported browser)." };
  }
  let permission = Notification.permission;
  console.log("[push] current permission:", permission);
  if (permission === "default") {
    permission = await Notification.requestPermission();
    console.log("[push] requested permission, now:", permission);
  }
  if (permission !== "granted") return { ok: false, reason: "Permission denied" };

  // Register the FCM service worker (handles background pushes).
  let registration: ServiceWorkerRegistration;
  try {
    registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    await navigator.serviceWorker.ready;
    console.log("[push] SW registered, scope:", registration.scope);
    // Pick up any newer worker version without forcing a reload.
    registration.update().catch(() => {});
  } catch (e: any) {
    console.error("[push] SW registration failed:", e);
    return { ok: false, reason: "Service worker registration failed: " + e.message };
  }

  // Try to obtain an FCM push token for background delivery. If unavailable
  // (browser/FCM/VAPID issues), we still consider enabling a success because
  // in-app realtime toasts + foreground Notification API work without it.
  let token: string | undefined;
  try {
    const messaging = await getMessagingSafe();
    if (messaging) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration,
          });
          if (token) break;
        } catch (err) {
          console.warn("[push] getToken attempt", attempt + 1, "failed:", err);
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        }
      }
    }
  } catch (e) {
    console.warn("[push] messaging unavailable:", e);
  }

  if (token) {
    console.log("[push] FCM token acquired:", token.slice(0, 12) + "…");
    if (localStorage.getItem(TOKEN_CACHE_KEY) !== token) {
      try {
        await supabase.from("notification_tokens").upsert(
          {
            user_id: userId,
            token,
            platform: "web",
            user_agent: navigator.userAgent.slice(0, 255),
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: "token" }
        );
        localStorage.setItem(TOKEN_CACHE_KEY, token);
        console.log("[push] token stored on server");
      } catch (e) {
        console.warn("[push] failed to store token:", e);
      }
    }
  } else {
    console.warn("[push] no FCM token obtained (foreground notifications still work)");
  }

  // Permission is granted and SW is registered — notifications will work
  // in-app even without a background push token.
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
      // Only popup when app is in background. Foreground (tab visible) stays
      // silent — the bell/history still updates via realtime.
      const inBackground =
        typeof document !== "undefined" &&
        (document.hidden || document.visibilityState !== "visible");
      if (!inBackground) return;
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