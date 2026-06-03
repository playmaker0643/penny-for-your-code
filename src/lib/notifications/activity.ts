// Activity & event tracking helpers for the smart notification system.
import { supabase } from "@/integrations/supabase/client";

let lastPulse = 0;
const PULSE_DEBOUNCE_MS = 60_000;

export async function pulseActivity(opts: { event?: "pulse" | "lesson_completed" | "notification_clicked" | "notification_ignored" } = {}) {
  const now = Date.now();
  if (opts.event !== "lesson_completed" && now - lastPulse < PULSE_DEBOUNCE_MS) return;
  lastPulse = now;
  try {
    await supabase.functions.invoke("track-activity", {
      body: {
        event: opts.event ?? "pulse",
        hour: new Date().getHours(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      },
    });
  } catch (e) {
    console.debug("[activity] pulse failed (offline?)", e);
  }
}

export async function trackNotificationEvent(input: {
  notification_id?: string | null;
  category?: string | null;
  event: "clicked" | "dismissed";
  meta?: Record<string, unknown>;
}) {
  try {
    await supabase.functions.invoke("track-notification-event", { body: input });
  } catch (e) {
    console.debug("[activity] event track failed", e);
  }
}
