import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const FALLBACK = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth gate — only signed-in users may fetch TURN credentials
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appName = Deno.env.get("METERED_APP_NAME");
    const apiKey = Deno.env.get("METERED_TURN_API_KEY");

    if (!appName || !apiKey) {
      return new Response(JSON.stringify({ iceServers: FALLBACK, source: "stun-only" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error("Metered TURN fetch failed:", res.status, await res.text());
      return new Response(JSON.stringify({ iceServers: FALLBACK, source: "stun-fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const turnServers = await res.json();
    // Combine STUN + Metered TURN for best reliability
    const iceServers = [...FALLBACK, ...turnServers];
    return new Response(JSON.stringify({ iceServers, source: "metered" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("get-ice-servers error:", e);
    return new Response(JSON.stringify({ iceServers: FALLBACK, source: "stun-error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
