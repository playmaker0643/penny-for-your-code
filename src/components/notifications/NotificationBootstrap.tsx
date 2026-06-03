import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  pushSupported, notificationPermission, registerSwAndSubscribe,
} from "@/lib/notifications/push";
import { flushQueuedSends } from "@/lib/notifications/api";
import { pulseActivity, trackNotificationEvent } from "@/lib/notifications/activity";

/**
 * Silent bootstrap: re-subscribes already-permitted users on each session,
 * flushes the offline send-queue, sends activity pulses, and bridges SW
 * click/dismiss messages into the analytics pipeline.
 */
export function NotificationBootstrap() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    if (pushSupported() && notificationPermission() === "granted") {
      registerSwAndSubscribe(user.id).catch(() => {});
    }
    flushQueuedSends();
    pulseActivity({ event: "pulse" });

    const onOnline = () => flushQueuedSends();
    const onFocus = () => pulseActivity({ event: "pulse" });
    const onVisible = () => { if (!document.hidden) pulseActivity({ event: "pulse" }); };

    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    // Bridge SW → analytics
    const handler = (e: MessageEvent) => {
      const d: any = e.data || {};
      if (d.type === "NOTIFICATION_CLICK") {
        trackNotificationEvent({
          notification_id: d.notificationId || null,
          category: d.category || null,
          event: "clicked",
        });
      } else if (d.type === "NOTIFICATION_DISMISS") {
        trackNotificationEvent({
          notification_id: d.notificationId || null,
          category: d.category || null,
          event: "dismissed",
        });
      }
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handler);
    }

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handler);
      }
    };
  }, [user]);
  return null;
}