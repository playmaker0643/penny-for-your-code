import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, userId } = await req.json();
    if (!message || !userId) {
      return new Response(JSON.stringify({ error: "Missing message or userId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check if student's account is locked
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_locked, locked_at, full_name")
      .eq("user_id", userId)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ reply: "I couldn't find your profile. Please contact your instructor." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (profile.account_locked && profile.locked_at) {
      const lockedAt = new Date(profile.locked_at);
      const now = new Date();
      const hoursPassed = (now.getTime() - lockedAt.getTime()) / (1000 * 60 * 60);

      if (hoursPassed >= 1) {
        // Auto-unlock after 1 hour
        await supabase
          .from("profiles")
          .update({ account_locked: false, locked_at: null })
          .eq("user_id", userId);

        return new Response(JSON.stringify({
          reply: `Good news, ${profile.full_name}! Your courses have been automatically unlocked. It has been over 1 hour since the lock was applied. You can now access your courses again. Please make sure to attend your lessons regularly to avoid future locks.`,
          unlocked: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        const minutesLeft = Math.ceil(60 - hoursPassed * 60);
        return new Response(JSON.stringify({
          reply: `Hi ${profile.full_name}, your courses are currently locked because you had 3 or more days where you were either absent or didn't take any lessons. Your courses will automatically unlock in approximately ${minutesLeft} minutes. Please be patient and use this time to review your notes. Once unlocked, make sure to attend regularly and complete your lessons to avoid being locked again.`,
          unlocked: false,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Forward message to admin as well
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (admins && admins.length > 0) {
      // Send the student's support message to all admins
      for (const admin of admins) {
        await supabase.from("messages").insert({
          sender_id: userId,
          receiver_id: admin.user_id,
          content: `[Support] ${message}`,
        });
      }
    }

    // Use AI to respond to general support queries
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({
        reply: "Your message has been forwarded to the admin. They will get back to you soon!",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are the CodeBreakers platform support assistant. You help students with their questions about the platform.

The student's name is ${profile.full_name}. Their courses are NOT locked.

**Platform Policies & Rules:**
- Students must attend lessons regularly. If a student misses 3+ days (absent or no lessons taken), their courses get locked for 1 hour automatically.
- Account locks are temporary (1 hour) and auto-unlock.
- Students have a daily limit of 5 AI questions per lesson.
- Each student gets a unique registration number (format: CBSYYxxxx).
- Students can access courses, exams, a code playground (sandbox), grades, and a feed.
- Students can chat with other students by adding friends using registration numbers.
- Group chats require invitation acceptance before joining.
- School administrators are the overriding controllers of all group chats.
- Exams may include file uploads, sandbox coding, or text submissions.
- AI-powered grading is available for some exams.
- The platform tracks attendance, lesson progress, and exam grades.

**Privacy & Terms:**
- Student data is private and only visible to the student and administrators.
- Profile information includes name, registration number, country, and contact details.
- Chat messages are stored securely and only visible to chat participants.
- Administrators can send broadcast messages that appear in student chats.

Be friendly, helpful, and concise. If you can resolve the student's issue, do so. If you can't help with something, let them know their message has been forwarded to the admin. Always try to explain what might be causing their issue and how to fix it.`,
          },
          { role: "user", content: message },
        ],
      }),
    });

    if (!aiResponse.ok) {
      return new Response(JSON.stringify({
        reply: "Your message has been forwarded to the admin. They will get back to you soon!",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || "Your message has been forwarded to the admin.";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("support-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
