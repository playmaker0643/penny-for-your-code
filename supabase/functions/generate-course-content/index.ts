import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, prompt, courseTitle } = await req.json();
    if (!type || !prompt) {
      return new Response(JSON.stringify({ error: "Missing type or prompt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt =
      type === "course"
        ? `You are an instructional designer for the CodeBreakers learning platform. Given an admin's topic, draft a course outline. Respond with ONLY valid JSON (no markdown fences) matching:
{
  "title": string (concise course title),
  "category": "Easy" | "Intermediate" | "Advanced",
  "description": string (2-4 sentences explaining what students learn),
  "total_lessons_required": number (suggested lesson count, 4-12)
}`
        : `You are an instructional designer for the CodeBreakers learning platform. Draft a single lesson${courseTitle ? ` for the course "${courseTitle}"` : ""}. Respond with ONLY valid JSON (no markdown fences) matching:
{
  "title": string,
  "description": string (1-2 sentences),
  "content_html": string (rich HTML lesson body using <h2>, <p>, <ul>, <li>, <code>, <pre>. Include explanations and examples. No <html>/<body> tags.),
  "completion_time_minutes": number (5-45),
  "questions": [
    { "question_type": "fill_blank" | "syntax_correction", "question_text": string, "correct_answer": string }
  ] (2-4 items)
}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const text = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, text);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const raw = aiData.choices?.[0]?.message?.content ?? "{}";
    let draft: any;
    try {
      draft = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      draft = match ? JSON.parse(match[0]) : {};
    }

    return new Response(JSON.stringify({ draft }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-course-content error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});