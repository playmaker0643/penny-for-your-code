import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { title, files, tags } = await req.json();
    if (!title || typeof title !== "string") {
      return new Response(JSON.stringify({ error: "title required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Detect tech stack from file extensions + tiny code preview
    const exts = new Set<string>();
    let preview = "";
    if (Array.isArray(files)) {
      for (const f of files.slice(0, 8)) {
        const ext = String(f.path || "").split(".").pop()?.toLowerCase();
        if (ext) exts.add(ext);
        if (preview.length < 1200 && typeof f.content === "string") {
          preview += `\n--- ${f.path} ---\n${f.content.slice(0, 400)}`;
        }
      }
    }
    const techHints = [...exts].map((e) => ({
      html: "HTML", css: "CSS", js: "JavaScript", ts: "TypeScript",
      jsx: "React", tsx: "React + TypeScript", py: "Python", json: "JSON",
    } as Record<string, string>)[e]).filter(Boolean).join(", ");

    const userPrompt = `Project title: "${title}"
${tags ? `Tags: ${tags}` : ""}
Detected technologies: ${techHints || "unknown"}
Code preview:${preview || " (none)"}

Write a single concise project description (1–2 sentences, max 220 chars) suitable for a developer-portfolio listing. No emojis. No markdown. No quotes around the description. Plain text only.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You write crisp, professional project descriptions for developer portfolios." },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!r.ok) {
      const status = r.status;
      const msg = status === 429 ? "Rate limited" : status === 402 ? "AI credits exhausted" : "AI generation failed";
      return new Response(JSON.stringify({ error: msg }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await r.json();
    const description = String(data?.choices?.[0]?.message?.content ?? "").trim().replace(/^["']|["']$/g, "").slice(0, 240);
    return new Response(JSON.stringify({ description }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
