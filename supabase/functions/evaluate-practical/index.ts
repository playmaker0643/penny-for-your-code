import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestCase { input?: string; expected?: string; description?: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { practical_id, code, time_spent_seconds = 0, hint_level = 0 } = await req.json();
    if (!practical_id || typeof code !== "string") {
      return new Response(JSON.stringify({ error: "missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (code.length > 20000) {
      return new Response(JSON.stringify({ error: "code too long" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, service);

    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Load practical (admin client to fetch hidden_tests/reference_solution)
    const { data: practical, error: pErr } = await admin
      .from("lesson_practicals")
      .select("*")
      .eq("id", practical_id)
      .maybeSingle();
    if (pErr || !practical) {
      return new Response(JSON.stringify({ error: "practical not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Anti-skip engagement check
    if (time_spent_seconds < (practical.min_engagement_seconds || 0)) {
      return new Response(JSON.stringify({
        error: "engagement_required",
        message: `Please spend at least ${practical.min_engagement_seconds}s working on this challenge before submitting.`,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Look up previous attempts for plagiarism/suspicion detection
    const { data: prev } = await admin
      .from("practical_submissions")
      .select("id, code, created_at")
      .eq("user_id", user.id)
      .eq("practical_id", practical_id)
      .order("created_at", { ascending: false })
      .limit(5);
    const attemptNumber = (prev?.length || 0) + 1;
    const duplicateOfPrior = (prev || []).some((p) => p.code.trim() === code.trim());

    // Call Lovable AI to evaluate
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const visible: TestCase[] = practical.visible_tests || [];
    const hidden: TestCase[] = practical.hidden_tests || [];
    const allTests = [...visible.map(t => ({ ...t, hidden: false })), ...hidden.map(t => ({ ...t, hidden: true }))];

    const sys = `You are an automated code judge. Given a student's ${practical.language} submission, a problem prompt, and a list of test cases, mentally execute the code against each test and report results.

You MUST respond with strict JSON only matching:
{
 "results": [{"index":0,"passed":true,"actual":"...","reason":"short reason"}],
 "syntax_ok": true,
 "logic_summary": "1-2 sentence overview",
 "score": 0-100,
 "errors": "compiler/runtime errors or empty string",
 "suggestion": "concise hint without revealing the solution"
}
Be strict. If output differs at all (whitespace, case unless trivially equivalent), mark as failed. Never reveal the full solution.`;

    const user_msg = `LANGUAGE: ${practical.language}
PROMPT:
${practical.prompt}

REFERENCE_SOLUTION (do not reveal):
${practical.reference_solution || "(none)"}

SUBMITTED CODE:
\`\`\`
${code}
\`\`\`

TEST CASES (run each):
${JSON.stringify(allTests, null, 2)}

Return JSON only.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: user_msg }],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429 || aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "ai_unavailable", status: aiRes.status }), { status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI error ${aiRes.status}`);
    }
    const aiJson = await aiRes.json();
    let parsed: any = {};
    try { parsed = JSON.parse(aiJson.choices?.[0]?.message?.content || "{}"); } catch { parsed = {}; }
    const results: any[] = parsed.results || [];
    const total = allTests.length;
    const visiblePassed = results.slice(0, visible.length).filter((r) => r?.passed).length;
    const hiddenPassed = results.slice(visible.length).filter((r) => r?.passed).length;
    const allPassed = total > 0 && (visiblePassed + hiddenPassed) === total;
    const score = total > 0 ? Math.round(((visiblePassed + hiddenPassed) / total) * 100) : (parsed.score || 0);

    // Suspicion heuristics
    const suspicious = duplicateOfPrior || (time_spent_seconds < 5 && code.length > 200);

    // Persist submission as the user (RLS enforces user_id)
    const { data: sub, error: sErr } = await userClient
      .from("practical_submissions")
      .insert({
        user_id: user.id,
        practical_id,
        lesson_id: practical.lesson_id,
        code,
        passed: allPassed,
        score,
        visible_passed: visiblePassed,
        hidden_passed: hiddenPassed,
        total_tests: total,
        feedback: parsed.logic_summary || parsed.errors || null,
        attempt_number: attemptNumber,
        hint_level,
        time_spent_seconds,
        suspicious,
      })
      .select()
      .single();
    if (sErr) throw sErr;

    // Award XP only on first pass
    if (allPassed) {
      const { data: priorPass } = await admin
        .from("practical_submissions")
        .select("id")
        .eq("user_id", user.id)
        .eq("practical_id", practical_id)
        .eq("passed", true)
        .neq("id", sub.id)
        .limit(1);
      if (!priorPass || priorPass.length === 0) {
        await userClient.rpc("award_xp", { _amount: practical.xp_reward, _passed: true });
      }
    } else {
      await userClient.rpc("award_xp", { _amount: 0, _passed: false });
    }

    // Visible results only — hide hidden details
    const visibleResults = results.slice(0, visible.length).map((r, i) => ({
      index: i, passed: !!r?.passed, actual: r?.actual ?? "", reason: r?.reason ?? "",
    }));

    return new Response(JSON.stringify({
      passed: allPassed,
      score,
      visible_passed: visiblePassed,
      hidden_passed: hiddenPassed,
      hidden_total: hidden.length,
      total_tests: total,
      results: visibleResults,
      syntax_ok: parsed.syntax_ok !== false,
      errors: parsed.errors || "",
      suggestion: parsed.suggestion || "",
      summary: parsed.logic_summary || "",
      attempt_number: attemptNumber,
      suspicious,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("evaluate-practical error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
