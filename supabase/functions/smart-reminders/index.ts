// =============================================================================
// CodeBreakers — Smart Reminders Scheduler
// -----------------------------------------------------------------------------
// Invoked every 15 min by pg_cron. Scans domain tables and fans out smart
// reminders through send-notification (which applies quiet-hours / dedup /
// rate-cap on top). Designed to be safe to run frequently — each rule has
// throttling via the dedup hash baked into send-notification.
//
// Rules implemented:
//   • lesson_reminder: lessons started but not completed and untouched > 24h
//   • course_reminder: enrolled courses with zero progress in last 3 days
//   • streak_reminder: users with a streak who haven't been active today
//                      after 18:00 their local time
//   • ai_recommendation: 5-day inactive users get a comeback ping (max 1/5 days)
//
// Assignment / quiz reminders are stubbed — exams table has no deadline column
// yet, so they're handled when admins set up dated exams in future.
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function fanout(input: {
  user_id: string; category: string; title: string; body?: string;
  link_url?: string;
}) {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SERVICE_KEY },
      body: JSON.stringify({
        target: "user",
        user_id: input.user_id,
        category: input.category,
        title: input.title,
        body: input.body,
        link_url: input.link_url,
        internal_token: SERVICE_KEY,
      }),
    });
    if (!r.ok) console.warn("[smart-reminders] fanout failed", input.category, await r.text());
  } catch (e) {
    console.warn("[smart-reminders] fanout error", e);
  }
}

async function ruleUnfinishedLessons() {
  // Pick at most 200 stalled-lesson rows
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data } = await admin.from("lesson_progress")
    .select("user_id, lesson_id, created_at, completed, completed_at")
    .eq("completed", false)
    .lt("created_at", cutoff)
    .limit(200);
  const byUser = new Map<string, number>();
  for (const r of (data || []) as any[]) {
    byUser.set(r.user_id, (byUser.get(r.user_id) || 0) + 1);
  }
  for (const [user_id, n] of byUser) {
    await fanout({
      user_id, category: "lesson_reminder",
      title: n > 1 ? `You have ${n} unfinished lessons` : "Pick up where you left off",
      body: "Tap to resume your learning.",
      link_url: "/student/lessons",
    });
  }
}

async function ruleCourseReminder() {
  // Enrolled courses where the user hasn't completed any lesson_progress in last 3 days
  const cutoff = new Date(Date.now() - 3 * 86400_000).toISOString();
  const { data: enrolls } = await admin.from("enrollments")
    .select("user_id, course_id").limit(500);
  const seen = new Set<string>();
  for (const e of (enrolls || []) as any[]) {
    if (seen.has(e.user_id)) continue;
    const { count } = await admin.from("lesson_progress")
      .select("id", { count: "exact", head: true })
      .eq("user_id", e.user_id).gte("completed_at", cutoff);
    if ((count ?? 0) === 0) {
      seen.add(e.user_id);
      await fanout({
        user_id: e.user_id, category: "course_reminder",
        title: "Your course is waiting",
        body: "It's been a few days — keep your momentum going.",
        link_url: "/student/courses",
      });
    }
  }
}

async function ruleStreakReminder() {
  // Users with streak ≥ 2 and last_streak_at not today → ping after 18:00 local
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await admin.from("user_activity_signals")
    .select("user_id, current_streak_days, last_streak_at, timezone")
    .gte("current_streak_days", 2)
    .neq("last_streak_at", today)
    .limit(500);
  for (const r of (data || []) as any[]) {
    let hour = new Date().getUTCHours();
    try {
      hour = Number(new Intl.DateTimeFormat("en-US", {
        hour: "numeric", hour12: false, timeZone: r.timezone || "UTC",
      }).format(new Date()));
    } catch {}
    if (hour < 18) continue;
    await fanout({
      user_id: r.user_id, category: "streak_reminder",
      title: `🔥 Don't break your ${r.current_streak_days}-day streak`,
      body: "Complete a lesson today to keep your streak alive.",
      link_url: "/student/dashboard",
    });
  }
}

async function ruleReengagement() {
  const inactive = new Date(Date.now() - 5 * 86400_000).toISOString();
  const reSent = new Date(Date.now() - 5 * 86400_000).toISOString();
  const { data } = await admin.from("user_activity_signals")
    .select("user_id, last_active_at, last_reengagement_at")
    .lt("last_active_at", inactive)
    .or(`last_reengagement_at.is.null,last_reengagement_at.lt.${reSent}`)
    .limit(200);
  for (const r of (data || []) as any[]) {
    await fanout({
      user_id: r.user_id, category: "ai_recommendation",
      title: "We picked a lesson for you",
      body: "Here's a quick recommendation to get you back on track.",
      link_url: "/student/lessons",
    });
    await admin.from("user_activity_signals")
      .update({ last_reengagement_at: new Date().toISOString() })
      .eq("user_id", r.user_id);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const out = { lessons: 0, courses: 0, streaks: 0, reengagement: 0 };
    await ruleUnfinishedLessons().then(() => out.lessons++).catch((e) => console.error("lessons", e));
    await ruleCourseReminder().then(() => out.courses++).catch((e) => console.error("courses", e));
    await ruleStreakReminder().then(() => out.streaks++).catch((e) => console.error("streak", e));
    await ruleReengagement().then(() => out.reengagement++).catch((e) => console.error("reengage", e));
    return new Response(JSON.stringify({ ok: true, ran: out }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
