import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  pushSupported, notificationPermission, registerSwAndSubscribe,
} from "@/lib/notifications/push";
import { flushQueuedSends } from "@/lib/notifications/api";

/**
 * Silent bootstrap: re-subscribes already-permitted users on each session
 * and flushes any send-queue from offline use.
 */
export function NotificationBootstrap() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    if (pushSupported() && notificationPermission() === "granted") {
      registerSwAndSubscribe(user.id).catch(() => {});
    }
    flushQueuedSends();
    const onOnline = () => flushQueuedSends();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [user]);
  return null;
}