// Records notification delivery / engagement events for analytics.
// Called by the client SW bridge when a notification is clicked or dismissed,
// and (internally) by send-notification when a push is delivered or fails.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const Body = z.object({
  notification_id: z.string().uuid().nullable().optional(),
  category: z.string().max(64).optional(),
  event: z.enum(["clicked", "dismissed", "delivered", "failed", "skipped"]),
  meta: z.record(z.string(), z.any()).optional(),
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
    const { notification_id, category, event, meta } = parsed.data;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    await admin.from("notification_events").insert({
      notification_id: notification_id ?? null,
      user_id: uid,
      category: (category as any) ?? null,
      event,
      meta: meta ?? {},
    });

    // Mirror click/ignore counters into activity signals
    if (event === "clicked") {
      await admin.rpc("update_updated_at_column").catch(() => {});
      const { data: a } = await admin.from("user_activity_signals")
        .select("notifications_clicked_24h").eq("user_id", uid).maybeSingle();
      await admin.from("user_activity_signals").upsert({
        user_id: uid,
        notifications_clicked_24h: (a?.notifications_clicked_24h ?? 0) + 1,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: "user_id" });
    }
    if (event === "dismissed") {
      const { data: a } = await admin.from("user_activity_signals")
        .select("notifications_ignored_24h").eq("user_id", uid).maybeSingle();
      await admin.from("user_activity_signals").upsert({
        user_id: uid,
        notifications_ignored_24h: (a?.notifications_ignored_24h ?? 0) + 1,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: "user_id" });
    }

    return json({ ok: true });
  } catch (e) {
    console.error("track-notification-event", e);
    return json({ error: (e as Error).message }, 500);
  }
});
