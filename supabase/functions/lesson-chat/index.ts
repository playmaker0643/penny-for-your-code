import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, lessonTitle, lessonContent, userId, lessonId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Check daily limit
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date().toISOString().split("T")[0];
    const { data: progressRow } = await supabase
      .from("lesson_progress")
      .select("id, ai_questions_used, ai_questions_date")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .maybeSingle();

    let currentUsed = 0;
    if (progressRow) {
      if (progressRow.ai_questions_date === today) {
        currentUsed = progressRow.ai_questions_used || 0;
      }
      if (currentUsed >= 5) {
        return new Response(JSON.stringify({ error: "Daily AI question limit reached (5/5)" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

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
            content: `You are a helpful tutor assistant for the lesson "${lessonTitle}". Here is the lesson content for context:\n\n${lessonContent}\n\nHelp the student understand the material. Keep answers concise and educational.`,
          },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limited, try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${status}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "I couldn't generate a response.";

    // Update usage count
    if (progressRow) {
      await supabase.from("lesson_progress").update({
        ai_questions_used: (progressRow.ai_questions_date === today ? currentUsed : 0) + 1,
        ai_questions_date: today,
      }).eq("id", progressRow.id);
    } else {
      await supabase.from("lesson_progress").insert({
        user_id: userId,
        lesson_id: lessonId,
        ai_questions_used: 1,
        ai_questions_date: today,
      });
    }

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("lesson-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
