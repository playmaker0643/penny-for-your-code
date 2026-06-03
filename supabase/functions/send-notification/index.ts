// =============================================================================
// CodeBreakers — Smart Notification Sender
// -----------------------------------------------------------------------------
// Writes per-user history rows AND pushes via FCM HTTP v1.
// Adds smart-delivery rules on top of the original sender:
//   1. respects per-category preferences
//   2. respects per-user quiet hours (in user TZ) — except high-priority cats
//   3. respects "mute_until" temporary mute
//   4. respects "high_priority_only" filter
//   5. de-duplicates identical sends within a 10-minute window
//   6. enforces a per-user per-hour cap for non-high-priority pushes
//   7. logs delivered / failed / skipped events into notification_events
// Backward compatible: existing callers see no payload change.
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREBASE_SA = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON") || "";

const RATE_LIMIT = 60;       // sends per sender per minute
const RATE_WINDOW_SEC = 60;
const PER_USER_HOURLY_CAP = 8;       // non-high-priority pushes per user / hour
const DEDUP_WINDOW_MIN = 10;

const HIGH_PRIORITY = new Set<string>([
  "security", "assignment_deadline", "mentor_reply", "direct_message", "live_class",
]);

const CategoryEnum = z.enum([
  "new_lesson", "challenge", "security", "announcement",
  "achievement", "live_class", "chat_message", "system",
  "lesson_reminder", "course_reminder", "assignment_deadline",
  "quiz_reminder", "direct_message", "mentor_reply",
  "streak_reminder", "leaderboard_change", "ai_recommendation",
]);

const Schema = z.object({
  target: z.enum(["user", "users", "all_students", "all_admins"]),
  user_id: z.string().uuid().optional(),
  user_ids: z.array(z.string().uuid()).max(5000).optional(),
  category: CategoryEnum,
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().max(500).optional(),
  image_url: z.string().url().max(2048).optional(),
  link_url: z.string().max(2048).optional(),
  actions: z.array(z.object({
    action: z.string().min(1).max(40),
    title: z.string().min(1).max(40),
  })).max(2).optional(),
  data: z.record(z.string(), z.string()).optional(),
  // Internal flag: scheduled jobs (smart-reminders) pass this so the function
  // accepts the call without a real user JWT.
  internal_token: z.string().optional(),
});

function inQuietHours(pref: any, nowUtcMs: number): boolean {
  const start = pref?.quiet_hours_start;
  const end = pref?.quiet_hours_end;
  if (start == null || end == null) return false;
  // Compute local hour in user's timezone using Intl
  let hour = new Date(nowUtcMs).getUTCHours();
  try {
    const tz = pref.timezone || "UTC";
    hour = Number(new Intl.DateTimeFormat("en-US", {
      hour: "numeric", hour12: false, timeZone: tz,
    }).format(new Date(nowUtcMs)));
  } catch { /* fall back to UTC hour */ }
  if (start === end) return false;
  return start < end
    ? hour >= start && hour < end
    : hour >= start || hour < end; // wraps midnight
}

async function djb2Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  const arr = Array.from(new Uint8Array(buf));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return json({ error: "invalid_payload", details: parsed.error.flatten() }, 400);
    const p = parsed.data;

    const admin = createClient(supabaseUrl, serviceKey);

    // ---- Auth ---------------------------------------------------------------
    // Either a logged-in user (admin or self-challenge) OR an internal token
    // matching SUPABASE_SERVICE_ROLE_KEY (used by the scheduled smart-reminders
    // function to fan out without per-user JWTs).
    let callerId: string | null = null;
    let isAdmin = false;
    let isInternal = false;
    if (p.internal_token && p.internal_token === serviceKey) {
      isInternal = true;
    } else {
      const auth = req.headers.get("Authorization") || "";
      if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: auth } },
      });
      const { data: userRes } = await userClient.auth.getUser();
      const caller = userRes?.user;
      if (!caller) return json({ error: "unauthorized" }, 401);
      callerId = caller.id;
      const { data: adminCheck } = await admin.rpc("has_role", { _user_id: caller.id, _role: "admin" });
      isAdmin = !!adminCheck;
    }

    // ---- Sender rate limit (skipped for internal scheduler) -----------------
    if (callerId) {
      const since = new Date(Date.now() - RATE_WINDOW_SEC * 1000).toISOString();
      const { count } = await admin
        .from("notification_send_log")
        .select("id", { count: "exact", head: true })
        .eq("sender_id", callerId)
        .gte("created_at", since);
      if ((count ?? 0) >= RATE_LIMIT) return json({ error: "rate_limited" }, 429);
      await admin.from("notification_send_log").insert({ sender_id: callerId });
    }

    // ---- Authorization ------------------------------------------------------
    if (!isInternal && !isAdmin) {
      const ok = p.target === "user" && p.category === "challenge";
      if (!ok) return json({ error: "forbidden" }, 403);
    }

    // ---- Resolve recipients -------------------------------------------------
    let recipients: string[] = [];
    if (p.target === "user" && p.user_id) recipients = [p.user_id];
    else if (p.target === "users" && p.user_ids) recipients = [...new Set(p.user_ids)];
    else if (p.target === "all_students") {
      const { data } = await admin.from("user_roles").select("user_id").eq("role", "student");
      recipients = (data || []).map((r: any) => r.user_id);
    } else if (p.target === "all_admins") {
      const { data } = await admin.from("user_roles").select("user_id").eq("role", "admin");
      recipients = (data || []).map((r: any) => r.user_id);
    }
    if (recipients.length === 0) return json({ error: "no_recipients" }, 400);

    // ---- Pull preferences in one shot ---------------------------------------
    const { data: prefs } = await admin
      .from("notification_preferences").select("*").in("user_id", recipients);
    const prefMap = new Map<string, any>((prefs || []).map((x: any) => [x.user_id, x]));

    const nowMs = Date.now();
    const isHigh = HIGH_PRIORITY.has(p.category);

    // ---- Smart filter: preferences / mute / quiet / hp-only -----------------
    const skipped: { user_id: string; reason: string }[] = [];
    const filteredByPref = recipients.filter((uid) => {
      const pref = prefMap.get(uid);
      if (!pref) return true; // default opt-in
      if (pref[p.category] === false) { skipped.push({ user_id: uid, reason: "category_disabled" }); return false; }
      if (pref.mute_until && new Date(pref.mute_until).getTime() > nowMs) {
        skipped.push({ user_id: uid, reason: "muted" }); return false;
      }
      if (pref.high_priority_only && !isHigh) {
        skipped.push({ user_id: uid, reason: "low_priority_filtered" }); return false;
      }
      if (!isHigh && inQuietHours(pref, nowMs)) {
        skipped.push({ user_id: uid, reason: "quiet_hours" }); return false;
      }
      return true;
    });

    // ---- Dedup: hash(user, category, title, body) within 10 min -------------
    const hourAgo = new Date(nowMs - DEDUP_WINDOW_MIN * 60_000).toISOString();
    await admin.from("notification_dedup").delete().lt("created_at", hourAgo);
    const dedupHashes = await Promise.all(filteredByPref.map(async (uid) => ({
      uid,
      hash: await djb2Hex(`${uid}|${p.category}|${p.title}|${p.body ?? ""}`),
    })));
    const existing = await admin.from("notification_dedup")
      .select("hash").in("hash", dedupHashes.map((d) => d.hash));
    const existingHashes = new Set((existing.data || []).map((r: any) => r.hash));
    const allowed: string[] = [];
    const toCacheHashes: { hash: string; user_id: string; category: string }[] = [];
    for (const { uid, hash } of dedupHashes) {
      if (existingHashes.has(hash)) skipped.push({ user_id: uid, reason: "duplicate" });
      else { allowed.push(uid); toCacheHashes.push({ hash, user_id: uid, category: p.category }); }
    }

    // ---- Per-user hourly cap for non-high-priority --------------------------
    let capped: string[] = allowed;
    if (!isHigh && allowed.length > 0) {
      const oneHourAgo = new Date(nowMs - 3600_000).toISOString();
      const { data: recent } = await admin.from("notifications")
        .select("user_id").in("user_id", allowed).gte("created_at", oneHourAgo);
      const counts = new Map<string, number>();
      for (const r of (recent || []) as { user_id: string }[]) {
        counts.set(r.user_id, (counts.get(r.user_id) || 0) + 1);
      }
      capped = allowed.filter((uid) => {
        if ((counts.get(uid) || 0) >= PER_USER_HOURLY_CAP) {
          skipped.push({ user_id: uid, reason: "hourly_cap" });
          return false;
        }
        return true;
      });
    }

    if (capped.length === 0) {
      // Log skipped events for analytics
      if (skipped.length > 0) {
        await admin.from("notification_events").insert(
          skipped.map((s) => ({ user_id: s.user_id, category: p.category as any, event: "skipped", meta: { reason: s.reason } })),
        );
      }
      return json({ ok: true, recipients: 0, stored: 0, pushed: 0, failed: 0, skipped: skipped.length });
    }

    // Persist dedup keys for caps that actually got through
    if (toCacheHashes.length > 0) {
      const allowSet = new Set(capped);
      const insertHashes = toCacheHashes.filter((h) => allowSet.has(h.user_id));
      if (insertHashes.length > 0) {
        await admin.from("notification_dedup").upsert(insertHashes, { onConflict: "hash" });
      }
    }

    // ---- Insert history rows (chunked) --------------------------------------
    const baseRow = {
      category: p.category, title: p.title, body: p.body ?? null,
      image_url: p.image_url ?? null, link_url: p.link_url ?? null,
      actions: p.actions ?? [], data: p.data ?? {},
    };
    const inserts = capped.map((uid) => ({ ...baseRow, user_id: uid }));
    let inserted: { id: string; user_id: string }[] = [];
    for (let i = 0; i < inserts.length; i += 500) {
      const slice = inserts.slice(i, i + 500);
      const { data: ins } = await admin.from("notifications").insert(slice).select("id,user_id");
      if (ins) inserted = inserted.concat(ins as any);
    }

    // ---- Push via FCM -------------------------------------------------------
    const { data: tokens } = await admin
      .from("notification_tokens").select("token,user_id").in("user_id", capped);
    const tokenList = (tokens || []) as { token: string; user_id: string }[];

    let sent = 0, failed = 0;
    const deadTokens: string[] = [];
    let pushError: string | null = null;
    if (tokenList.length > 0 && !FIREBASE_SA) {
      pushError = "FIREBASE_SERVICE_ACCOUNT_JSON secret not configured — history stored, push skipped";
      console.warn("[send-notification]", pushError);
    }
    const userToNotificationId = new Map(inserted.map((r) => [r.user_id, r.id]));
    const deliveryEvents: any[] = [];

    if (tokenList.length > 0 && FIREBASE_SA) {
      let accessToken: string;
      let projectId: string;
      try {
        accessToken = await getFcmAccessToken();
        projectId = JSON.parse(FIREBASE_SA).project_id;
      } catch (e) {
        pushError = "FCM auth failed: " + (e as Error).message;
        console.error("[send-notification]", pushError);
        return json({
          ok: true, recipients: capped.length, stored: inserted.length,
          pushed: 0, failed: tokenList.length, pruned_tokens: 0, push_error: pushError,
          skipped: skipped.length,
        });
      }
      const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

      await Promise.all(tokenList.map(async ({ token, user_id }) => {
        const dataPayload: Record<string, string> = {
          title: p.title,
          body: p.body ?? "",
          category: p.category,
          link: p.link_url ?? "/",
          image: p.image_url ?? "",
          tag: `${p.category}:${user_id}`,
          notificationId: userToNotificationId.get(user_id) ?? "",
          actions: JSON.stringify(p.actions ?? []),
          requireInteraction: isHigh ? "1" : "0",
          ...(p.data ?? {}),
        };
        const message = {
          message: {
            token,
            data: dataPayload,
            webpush: {
              headers: { Urgency: isHigh ? "high" : "normal", TTL: "86400" },
              fcm_options: p.link_url ? { link: p.link_url } : undefined,
            },
            android: { priority: isHigh ? "HIGH" : "NORMAL" },
          },
        };
        try {
          const r = await fetch(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify(message),
          });
          if (r.ok) {
            sent++;
            deliveryEvents.push({ user_id, notification_id: userToNotificationId.get(user_id) ?? null,
              category: p.category, event: "delivered", meta: { token: token.slice(0, 12) } });
          } else {
            failed++;
            const text = await r.text();
            deliveryEvents.push({ user_id, notification_id: userToNotificationId.get(user_id) ?? null,
              category: p.category, event: "failed", meta: { status: r.status, error: text.slice(0, 200) } });
            if (text.includes("UNREGISTERED") || text.includes("INVALID_ARGUMENT") || r.status === 404) {
              deadTokens.push(token);
            }
          }
        } catch (e) {
          failed++;
          deliveryEvents.push({ user_id, category: p.category, event: "failed",
            meta: { error: (e as Error).message.slice(0, 200) } });
        }
      }));

      if (deadTokens.length > 0) {
        await admin.from("notification_tokens").delete().in("token", deadTokens);
      }
    }

    // ---- Analytics events ---------------------------------------------------
    if (skipped.length > 0) {
      deliveryEvents.push(...skipped.map((s) => ({
        user_id: s.user_id, category: p.category as any,
        event: "skipped", meta: { reason: s.reason },
      })));
    }
    if (deliveryEvents.length > 0) {
      await admin.from("notification_events").insert(deliveryEvents);
    }

    return json({
      ok: true,
      recipients: capped.length,
      stored: inserted.length,
      pushed: sent,
      failed,
      skipped: skipped.length,
      pruned_tokens: deadTokens.length,
      push_error: pushError ?? undefined,
    });
  } catch (e) {
    console.error("send-notification error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

// ---- FCM v1 OAuth helper -----------------------------------------------------
let cachedToken: { token: string; exp: number } | null = null;
async function getFcmAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp > now + 60) return cachedToken.token;

  const sa = JSON.parse(FIREBASE_SA);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const enc = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsigned = `${enc(header)}.${enc(claim)}`;
  const sig = await signRs256(unsigned, sa.private_key);
  const jwt = `${unsigned}.${sig}`;

  const tokRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!tokRes.ok) throw new Error("oauth_failed: " + (await tokRes.text()));
  const data = await tokRes.json();
  cachedToken = { token: data.access_token, exp: now + (data.expires_in ?? 3600) };
  return cachedToken.token;
}

async function signRs256(input: string, pem: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(input));
  return arrayBufferToBase64Url(sig);
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function arrayBufferToBase64Url(buf: ArrayBuffer): string {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
