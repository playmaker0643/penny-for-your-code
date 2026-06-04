import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { practical_id, code = "", level = 1 } = await req.json();
    const lvl = Math.min(Math.max(parseInt(level) || 1, 1), 3);
    const authHeader = req.headers.get("Authorization") || "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, service);

    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: practical } = await admin
      .from("lesson_practicals")
      .select("prompt, language, visible_tests")
      .eq("id", practical_id)
      .maybeSingle();
    if (!practical) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const tone = lvl === 1
      ? "Give ONE high-level conceptual nudge. Do NOT mention specific functions or code."
      : lvl === 2
      ? "Point to the specific concept or function family involved. No solution code."
      : "Give a small pseudocode fragment (max 4 lines), no working solution.";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: `You are a patient ${practical.language} tutor. ${tone} Never reveal the full solution. Keep under 60 words.` },
          { role: "user", content: `Problem: ${practical.prompt}\n\nStudent code so far:\n${code || "(empty)"}\n\nGive a hint at level ${lvl}.` },
        ],
      }),
    });
    if (!aiRes.ok) throw new Error(`AI ${aiRes.status}`);
    const j = await aiRes.json();
    return new Response(JSON.stringify({ hint: j.choices?.[0]?.message?.content || "", level: lvl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
