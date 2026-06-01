import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { examId, userId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get exam details
    const { data: exam } = await supabase.from("exams").select("*").eq("id", examId).single();
    if (!exam || !exam.ai_marking) {
      return new Response(JSON.stringify({ error: "AI marking not enabled" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get submission (FIFO - earliest ungraded)
    const { data: submission } = await supabase
      .from("exam_submissions")
      .select("*")
      .eq("exam_id", examId)
      .eq("user_id", userId)
      .eq("graded", false)
      .order("submitted_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!submission) {
      return new Response(JSON.stringify({ error: "No ungraded submission found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update status
    await supabase.from("exam_submissions").update({ marking_status: "grading" }).eq("id", submission.id);

    const studentWork = [
      submission.content && `Written Answer:\n${submission.content}`,
      submission.sandbox_code && `Code:\n${submission.sandbox_code}`,
      submission.file_url && `Files submitted: ${submission.file_url}`,
    ].filter(Boolean).join("\n\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a strict but fair assignment grader. Grade the student's work on a scale of 0-100.

Assignment: ${exam.title}
Instructions: ${exam.description || "N/A"}
Grading Context/Rubric: ${exam.ai_marking_context || "Grade based on correctness, completeness, and quality."}

Respond ONLY with a JSON object: {"score": <number 0-100>, "feedback": "<brief feedback>"}`,
          },
          { role: "user", content: studentWork || "No content submitted." },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      // Rate limited - mark as pending to retry later
      if (status === 429 || status === 402) {
        await supabase.from("exam_submissions").update({ marking_status: "pending" }).eq("id", submission.id);
        return new Response(JSON.stringify({ error: "AI rate limited, will retry later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${status}`);
    }

    const aiData = await response.json();
    const aiText = aiData.choices?.[0]?.message?.content || "";

    let score = 0;
    let feedback = "Unable to parse AI response";
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        score = Math.min(100, Math.max(0, parseInt(parsed.score) || 0));
        feedback = parsed.feedback || "Graded by AI";
      }
    } catch {
      feedback = aiText.slice(0, 500);
    }

    await supabase.from("exam_submissions").update({
      ai_score: score,
      ai_feedback: feedback,
      graded: true,
      graded_at: new Date().toISOString(),
      marking_status: "graded",
      score: score,
    }).eq("id", submission.id);

    return new Response(JSON.stringify({ score, feedback }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("grade-assignment error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
