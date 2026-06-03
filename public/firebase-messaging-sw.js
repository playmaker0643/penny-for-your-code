/* ============================================================================
 * CODEBREAKERS — Firebase Cloud Messaging Service Worker
 * ----------------------------------------------------------------------------
 * Lifecycle:
 *   install   → skipWaiting() so updates take effect on next nav
 *   activate  → clients.claim() so existing tabs get the new SW immediately
 *   push      → raw Web Push fallback (in case the FCM SDK isn't invoked)
 *   message   → FCM SDK delivers background payloads here via onBackgroundMessage
 *   notificationclick → focuses/opens an app window at the deep link
 *
 * This worker runs independently of the page. The browser keeps it alive
 * (and wakes it on push) even when the PWA is closed, as long as the
 * browser process / OS push service is running.
 * ========================================================================= */

importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyC5oXVQI26DzreGmvLrxxsu_v2ywUMI4BI",
  authDomain: "elearning-codebreakers.firebaseapp.com",
  projectId: "elearning-codebreakers",
  storageBucket: "elearning-codebreakers.firebasestorage.app",
  messagingSenderId: "846950310805",
  appId: "1:846950310805:web:093f504a1c7a50b70d4c9c",
});

const messaging = firebase.messaging();
const APP_ICON = "/icon-512.png";

const CATEGORY_ICONS = {
  new_lesson: APP_ICON,
  challenge: APP_ICON,
  announcement: APP_ICON,
  achievement: APP_ICON,
  live_class: APP_ICON,
  system: APP_ICON,
  message: APP_ICON,
  quiz: APP_ICON,
};

/* ---------- Dedup ring (in-memory, per SW instance) ----------------------- */
const recentTags = new Map(); // tag -> ts
function isDuplicate(tag, windowMs = 4000) {
  const now = Date.now();
  for (const [k, t] of recentTags) if (now - t > windowMs) recentTags.delete(k);
  if (!tag) return false;
  if (recentTags.has(tag)) return true;
  recentTags.set(tag, now);
  return false;
}

function safeJSON(s, fallback) {
  try { return typeof s === "string" ? JSON.parse(s) : (s || fallback); } catch { return fallback; }
}

async function showFromPayload(d) {
  const title = d.title || "Notification";
  const category = d.category || "system";
  const tag = d.tag || `${category}:${d.notificationId || Date.now()}`;
  if (isDuplicate(tag)) {
    console.log("[fcm-sw] duplicate notification suppressed:", tag);
    return;
  }
  const actions = safeJSON(d.actions, []);
  const options = {
    body: d.body || "",
    icon: d.image || CATEGORY_ICONS[category] || APP_ICON,
    badge: APP_ICON,
    image: d.image || undefined,
    tag,
    renotify: true,
    requireInteraction: d.requireInteraction === "1",
    vibrate: d.vibrate === "0" ? [] : [120, 60, 120],
    data: {
      link: d.link || "/",
      notificationId: d.notificationId || null,
      category,
    },
    actions: actions.slice(0, 2).map((a) => ({ action: a.action, title: a.title })),
  };
  console.log("[fcm-sw] showing notification:", title, options);
  await self.registration.showNotification(title, options);
  try { if ("setAppBadge" in self.navigator) await self.navigator.setAppBadge(); } catch {}
}

/* ---------- FCM SDK path (data-only messages route here) ------------------ */
messaging.onBackgroundMessage((payload) => {
  console.log("[fcm-sw] onBackgroundMessage:", payload);
  return showFromPayload(payload.data || {});
});

/* ---------- Raw Web Push fallback (browser delivers push directly) -------- */
self.addEventListener("push", (event) => {
  console.log("[fcm-sw] push event received");
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch {
    try { payload = { data: { title: event.data.text() } }; } catch {}
  }
  // FCM places fields under .data; standard web-push apps put them at root.
  const d = payload.data || payload.notification || payload || {};
  event.waitUntil(showFromPayload(d));
});

/* ---------- Click handling: focus existing tab or open new one ------------ */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let url = data.link || "/";
  const dismissed = event.action === "dismiss";

  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const eventMsg = {
      type: dismissed ? "NOTIFICATION_DISMISS" : "NOTIFICATION_CLICK",
      url,
      data,
      notificationId: data.notificationId || null,
      category: data.category || null,
    };
    // Broadcast to any open client so it can POST to track-notification-event
    for (const c of all) c.postMessage(eventMsg);
    if (dismissed) return;
    if (event.action && event.action.startsWith("http")) url = event.action;
    for (const c of all) {
      if ("focus" in c) {
        try { await c.navigate(url); } catch {}
        return c.focus();
      }
    }
    if (clients.openWindow) return clients.openWindow(url);
  })());
});

/* ---------- Dismiss without click (Chrome fires this) --------------------- */
self.addEventListener("notificationclose", (event) => {
  const data = event.notification.data || {};
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) c.postMessage({
      type: "NOTIFICATION_DISMISS",
      notificationId: data.notificationId || null,
      category: data.category || null,
    });
  })());
});

self.addEventListener("install", () => {
  console.log("[fcm-sw] install");
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  console.log("[fcm-sw] activate");
  e.waitUntil(self.clients.claim());
});
