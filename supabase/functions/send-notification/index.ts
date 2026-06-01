// Send notifications: writes per-user history rows and pushes via FCM HTTP v1.
// Validates inputs with zod, enforces a simple per-sender rate limit, and
// cleans up dead tokens.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREBASE_SA = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")!;

const RATE_LIMIT = 60;       // sends per sender per minute
const RATE_WINDOW_SEC = 60;

const CategoryEnum = z.enum([
  "new_lesson", "challenge", "security", "announcement",
  "achievement", "live_class", "system",
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
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const caller = userRes?.user;
    if (!caller) return json({ error: "unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    // Authorization:
    //   • admins may send to anyone, any category
    //   • signed-in users may send ONLY a "challenge" notification to a single user
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: caller.id, _role: "admin" });

    // Rate limit
    const since = new Date(Date.now() - RATE_WINDOW_SEC * 1000).toISOString();
    const { count } = await admin
      .from("notification_send_log")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", caller.id)
      .gte("created_at", since);
    if ((count ?? 0) >= RATE_LIMIT) return json({ error: "rate_limited" }, 429);
    await admin.from("notification_send_log").insert({ sender_id: caller.id });

    // Validate
    const body = await req.json().catch(() => ({}));
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return json({ error: "invalid_payload", details: parsed.error.flatten() }, 400);
    const p = parsed.data;

    if (!isAdmin) {
      const ok = p.target === "user" && p.category === "challenge";
      if (!ok) return json({ error: "forbidden" }, 403);
    }

    // Resolve recipients
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

    // Filter by per-user preferences
    const { data: prefs } = await admin
      .from("notification_preferences").select("*").in("user_id", recipients);
    const prefMap = new Map((prefs || []).map((x: any) => [x.user_id, x]));
    const allowed = recipients.filter((uid) => {
      const pref = prefMap.get(uid);
      if (!pref) return true; // default opt-in
      return pref[p.category] !== false;
    });

    // Insert history rows (chunked)
    const baseRow = {
      category: p.category, title: p.title, body: p.body ?? null,
      image_url: p.image_url ?? null, link_url: p.link_url ?? null,
      actions: p.actions ?? [], data: p.data ?? {},
    };
    const inserts = allowed.map((uid) => ({ ...baseRow, user_id: uid }));
    let inserted: { id: string; user_id: string }[] = [];
    for (let i = 0; i < inserts.length; i += 500) {
      const slice = inserts.slice(i, i + 500);
      const { data: ins } = await admin.from("notifications").insert(slice).select("id,user_id");
      if (ins) inserted = inserted.concat(ins as any);
    }

    // Push via FCM
    const { data: tokens } = await admin
      .from("notification_tokens").select("token,user_id").in("user_id", allowed);
    const tokenList = (tokens || []) as { token: string; user_id: string }[];

    let sent = 0, failed = 0;
    const deadTokens: string[] = [];
    if (tokenList.length > 0) {
      const accessToken = await getFcmAccessToken();
      const projectId = JSON.parse(FIREBASE_SA).project_id;
      const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

      const userToNotificationId = new Map(inserted.map((r) => [r.user_id, r.id]));

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
          ...(p.data ?? {}),
        };
        const message = {
          message: {
            token,
            // No `notification` field — we render via the SW so action buttons + vibration work
            data: dataPayload,
            webpush: {
              headers: { Urgency: p.category === "security" ? "high" : "normal", TTL: "86400" },
              fcm_options: p.link_url ? { link: p.link_url } : undefined,
            },
            android: { priority: p.category === "security" ? "HIGH" : "NORMAL" },
          },
        };
        try {
          const r = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(message),
          });
          if (r.ok) { sent++; }
          else {
            failed++;
            const text = await r.text();
            if (text.includes("UNREGISTERED") || text.includes("INVALID_ARGUMENT") || r.status === 404) {
              deadTokens.push(token);
            }
          }
        } catch { failed++; }
      }));

      if (deadTokens.length > 0) {
        await admin.from("notification_tokens").delete().in("token", deadTokens);
      }
    }

    return json({
      ok: true,
      recipients: allowed.length,
      stored: inserted.length,
      pushed: sent,
      failed,
      pruned_tokens: deadTokens.length,
    });
  } catch (e) {
    console.error("send-notification error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

// ---- FCM v1 OAuth helper ----
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