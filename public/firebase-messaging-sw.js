/* Firebase Cloud Messaging service worker — background notifications.
 * Kept tiny on purpose for low-bandwidth devices.
 */
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

const CATEGORY_ICONS = {
  new_lesson: "/favicon.ico",
  challenge: "/favicon.ico",
  security: "/favicon.ico",
  announcement: "/favicon.ico",
  achievement: "/favicon.ico",
  live_class: "/favicon.ico",
  system: "/favicon.ico",
};

messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  const title = d.title || "Notification";
  const category = d.category || "system";
  const actions = safeJSON(d.actions, []);
  const options = {
    body: d.body || "",
    icon: d.image || CATEGORY_ICONS[category] || "/favicon.ico",
    badge: "/favicon.ico",
    image: d.image || undefined,
    tag: d.tag || category,
    renotify: true,
    requireInteraction: category === "security",
    vibrate: d.vibrate === "0" ? [] : [120, 60, 120],
    data: {
      link: d.link || "/",
      notificationId: d.notificationId || null,
      category,
    },
    actions: actions.slice(0, 2).map((a) => ({ action: a.action, title: a.title })),
  };
  self.registration.showNotification(title, options);
  updateBadge();
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let url = data.link || "/";
  if (event.action === "dismiss") return;
  if (event.action && event.action.startsWith("http")) url = event.action;

  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of allClients) {
      if ("focus" in c) {
        c.postMessage({ type: "NOTIFICATION_CLICK", url, data });
        try { await c.navigate(url); } catch {}
        return c.focus();
      }
    }
    if (clients.openWindow) return clients.openWindow(url);
  })());
});

async function updateBadge() {
  try {
    if ("setAppBadge" in self.navigator) {
      // We don't know exact unread count here — bump by 1
      await self.navigator.setAppBadge();
    }
  } catch {}
}

function safeJSON(s, fallback) {
  try { return typeof s === "string" ? JSON.parse(s) : (s || fallback); } catch { return fallback; }
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));