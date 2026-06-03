// Lightweight activity tracker for the smart notification system.
// Clients ping this on focus / route change (debounced to ~1/min).
// Updates per-user activity signals used for smart reminder timing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const Body = z.object({
  event: z.enum(["pulse", "lesson_completed", "notification_clicked", "notification_ignored"]).default("pulse"),
  hour: z.number().int().min(0).max(23).optional(),
  timezone: z.string().max(64).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) return json({ error: "unauthorized" }, 401);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "invalid", details: parsed.error.flatten() }, 400);
    const { event, hour, timezone } = parsed.data;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Read existing
    const { data: existing } = await admin
      .from("user_activity_signals").select("*").eq("user_id", uid).maybeSingle();

    const now = new Date();
    const hist: number[] = (existing?.active_hour_histogram as number[] | undefined) ?? new Array(24).fill(0);
    if (typeof hour === "number") hist[hour] = (hist[hour] || 0) + 1;

    // Streak math (UTC day boundaries — good enough for daily streaks)
    let streak = existing?.current_streak_days ?? 0;
    let lastStreak: string | null = existing?.last_streak_at ?? null;
    if (event === "lesson_completed" || event === "pulse") {
      const today = now.toISOString().slice(0, 10);
      if (lastStreak !== today) {
        const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
        streak = lastStreak === yesterday ? streak + 1 : 1;
        lastStreak = today;
      }
    }

    const patch: Record<string, unknown> = {
      user_id: uid,
      last_active_at: now.toISOString(),
      active_hour_histogram: hist,
      current_streak_days: streak,
      last_streak_at: lastStreak,
      updated_at: now.toISOString(),
    };
    if (timezone) patch.timezone = timezone;
    if (event === "lesson_completed") {
      patch.lessons_completed_24h = (existing?.lessons_completed_24h ?? 0) + 1;
    }
    if (event === "notification_clicked") {
      patch.notifications_clicked_24h = (existing?.notifications_clicked_24h ?? 0) + 1;
    }
    if (event === "notification_ignored") {
      patch.notifications_ignored_24h = (existing?.notifications_ignored_24h ?? 0) + 1;
    }

    await admin.from("user_activity_signals").upsert(patch, { onConflict: "user_id" });

    // Also persist preferred timezone to notification_preferences (best effort)
    if (timezone) {
      await admin.from("notification_preferences").upsert(
        { user_id: uid, timezone, updated_at: now.toISOString() } as any,
        { onConflict: "user_id" },
      );
    }

    return json({ ok: true, streak });
  } catch (e) {
    console.error("track-activity", e);
    return json({ error: (e as Error).message }, 500);
  }
});
