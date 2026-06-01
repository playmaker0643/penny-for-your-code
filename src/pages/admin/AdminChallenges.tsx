import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Plus, Trash2, Swords, ArrowLeft, Bot, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type QuestionType = "multiple_choice" | "fill_blank" | "syntax_correction";

const AdminChallenges = () => {
  const queryClient = useQueryClient();
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showAIForm, setShowAIForm] = useState(false);
  const [qType, setQType] = useState<QuestionType>("multiple_choice");
  const [qText, setQText] = useState("");
  const [qAnswer, setQAnswer] = useState("");
  const [qOptions, setQOptions] = useState(["", "", "", ""]);
  const [correctOptionIndex, setCorrectOptionIndex] = useState(0);

  // AI generation state
  const [aiCount, setAiCount] = useState(10);
  const [aiType, setAiType] = useState<QuestionType>("multiple_choice");
  const [aiGenerating, setAiGenerating] = useState(false);

  const { data: courses } = useQuery({
    queryKey: ["admin-courses-list"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, title").order("title");
      return data || [];
    },
  });

  const { data: questions, isLoading } = useQuery({
    queryKey: ["challenge-questions", selectedCourseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("challenge_questions")
        .select("*")
        .eq("course_id", selectedCourseId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!selectedCourseId,
  });

  const addQuestion = useMutation({
    mutationFn: async () => {
      let finalAnswer = qAnswer;
      let finalOptions: string[] = [];

      if (qType === "multiple_choice") {
        finalOptions = qOptions.filter((o) => o.trim());
        if (finalOptions.length < 2) throw new Error("Add at least 2 options");
        finalAnswer = finalOptions[correctOptionIndex] || finalOptions[0];
      }

      if (!qText.trim()) throw new Error("Question text is required");
      if (!finalAnswer.trim()) throw new Error("Correct answer is required");

      const { error } = await supabase.from("challenge_questions").insert({
        course_id: selectedCourseId,
        question_type: qType,
        question_text: qText.trim(),
        correct_answer: finalAnswer.trim(),
        options: finalOptions,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["challenge-questions", selectedCourseId] });
      setShowForm(false);
      setQText("");
      setQAnswer("");
      setQOptions(["", "", "", ""]);
      setCorrectOptionIndex(0);
      toast.success("Question added!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteQuestion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("challenge_questions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["challenge-questions", selectedCourseId] });
      toast.success("Question deleted!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleAIGenerate = async () => {
    const courseName = courses?.find(c => c.id === selectedCourseId)?.title || "this course";
    setAiGenerating(true);

    try {
      const typeLabel = aiType === "multiple_choice" ? "multiple choice (with 4 options and the correct answer marked)"
        : aiType === "fill_blank" ? "fill in the blank (with ___ for the blank)"
        : "syntax correction (code with a syntax error)";

      const prompt = `Generate exactly ${aiCount} ${typeLabel} coding challenge questions for a course called "${courseName}".
Return ONLY a valid minified JSON array with double-quoted keys and strings. Do not include markdown fences, explanations, comments, or trailing commas. Each object must have:
- "question_text": string
- "correct_answer": string
- "options": string[] (4 options for multiple_choice, empty [] for others)

For multiple_choice, the correct_answer must be one of the options.
For fill_blank, use ___ in the question_text where the answer goes.
For syntax_correction, question_text should have code with an error and correct_answer should be the fixed code.

Focus on programming concepts like variables, loops, functions, arrays, objects, conditionals, and syntax.
Example format:
[{"question_text":"What is 2 + 2?","correct_answer":"4","options":["3","4","5","6"]}]
Return ONLY the JSON array, no other text.`;

      // Use non-streaming fetch to get AI response
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/code-ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
        }
      );

      if (!resp.ok) throw new Error("AI service error");

      // Read streaming SSE response and concatenate all content deltas
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) fullText += c;
          } catch {}
        }
      }

      if (!fullText.trim()) throw new Error("AI returned empty response");

      // Robust JSON extraction
      let cleaned = fullText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const jsonStart = cleaned.indexOf("[");
      const jsonEnd = cleaned.lastIndexOf("]");
      if (jsonStart === -1 || jsonEnd === -1) throw new Error("AI did not return valid JSON array");
      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
      
      let generated: any[];
      try {
        generated = JSON.parse(cleaned);
      } catch {
        cleaned = cleaned
          .replace(/,\s*]/g, "]")
          .replace(/,\s*}/g, "}")
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
          .trim();
        generated = JSON.parse(cleaned);
      }
      if (!Array.isArray(generated) || generated.length === 0) throw new Error("No questions generated");

      // Insert all questions
      const rows = generated
        .filter((q: any) => q && typeof q.question_text === "string" && typeof q.correct_answer === "string")
        .map((q: any) => ({
        course_id: selectedCourseId,
        question_type: aiType,
        question_text: q.question_text.trim(),
        correct_answer: q.correct_answer.trim(),
        options: aiType === "multiple_choice"
          ? (Array.isArray(q.options) ? q.options.map((opt: unknown) => String(opt).trim()).filter(Boolean).slice(0, 4) : [])
          : [],
      }))
        .filter((q) => q.question_text && q.correct_answer)
        .filter((q) => aiType !== "multiple_choice" || (q.options.length === 4 && q.options.includes(q.correct_answer)));

      if (rows.length === 0) throw new Error("AI did not return usable questions");

      const { error: insertErr } = await supabase.from("challenge_questions").insert(rows);
      if (insertErr) throw insertErr;

      queryClient.invalidateQueries({ queryKey: ["challenge-questions", selectedCourseId] });
      toast.success(`${rows.length} questions generated!`);
      setShowAIForm(false);
    } catch (e: any) {
      toast.error(e.message || "AI generation failed");
    } finally {
      setAiGenerating(false);
    }
  };

  // Course selection screen
  if (!selectedCourseId) {
    return (
      <AdminLayout>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Swords className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold font-display text-foreground">Challenge Questions</h2>
          </div>
          <p className="text-sm text-muted-foreground">Select a course to manage challenge questions</p>
          <div className="space-y-2">
            {courses?.map((c) => (
              <button key={c.id} onClick={() => setSelectedCourseId(c.id)}
                className="w-full cyber-card rounded-xl p-4 flex items-center justify-between hover:border-primary/40 transition-colors">
                <span className="text-sm font-semibold text-foreground">{c.title}</span>
                <span className="text-xs text-muted-foreground font-mono">→</span>
              </button>
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  const courseName = courses?.find((c) => c.id === selectedCourseId)?.title || "Course";

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedCourseId("")} className="text-muted-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-bold font-display text-foreground">{courseName}</h2>
            <p className="text-xs text-muted-foreground font-mono">{questions?.length || 0} questions</p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-center py-8 animate-pulse">Loading...</p>
        ) : (
          <div className="space-y-2">
            {questions?.map((q: any, i: number) => (
              <div key={q.id} className="cyber-card rounded-xl p-3 flex items-start gap-3">
                <span className="text-xs font-mono text-primary shrink-0 mt-0.5">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{q.question_text}</p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-1">
                    Type: {q.question_type} | Answer: {q.correct_answer}
                  </p>
                  {q.options && (q.options as string[]).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(q.options as string[]).map((opt: string, oi: number) => (
                        <span key={oi} className={`text-[10px] px-2 py-0.5 rounded-full ${opt === q.correct_answer ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                          {opt}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => deleteQuestion.mutate(q.id)} className="text-destructive/60 hover:text-destructive shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {questions?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No questions yet. Add some!</p>
            )}
          </div>
        )}

        {/* Floating buttons: AI above + */}
        <div className="fixed bottom-20 right-4 z-30 flex flex-col gap-3">
          <Button onClick={() => setShowAIForm(true)}
            className="w-14 h-14 rounded-full bg-secondary text-secondary-foreground shadow-lg">
            <Bot className="h-6 w-6" />
          </Button>
          <Button onClick={() => setShowForm(true)}
            className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg glow-btn">
            <Plus className="h-6 w-6" />
          </Button>
        </div>

        {/* AI Generate Dialog */}
        <Dialog open={showAIForm} onOpenChange={setShowAIForm}>
          <DialogContent className="bg-card border-border/50 max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display text-foreground flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" /> AI Generate Questions
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Auto-generate challenge questions for {courseName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-xs text-muted-foreground font-mono block mb-2">Question Type</label>
                <select value={aiType} onChange={e => setAiType(e.target.value as QuestionType)}
                  className="w-full bg-muted border border-primary/30 rounded-lg px-3 py-2.5 text-sm text-foreground focus:border-primary outline-none">
                  <option value="multiple_choice">Choose the Correct Option</option>
                  <option value="fill_blank">Fill in the Missing</option>
                  <option value="syntax_correction">Correct the Syntax</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-mono block mb-2">How many questions?</label>
                <Input type="number" value={aiCount} onChange={e => setAiCount(parseInt(e.target.value) || 5)}
                  min={1} max={50} className="bg-muted border-primary/30 focus:border-primary text-sm" />
              </div>
              <Button onClick={handleAIGenerate} disabled={aiGenerating}
                className="w-full bg-primary text-primary-foreground font-mono font-bold">
                {aiGenerating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> GENERATING...</> : `GENERATE ${aiCount} QUESTIONS`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Question Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="bg-card border-border/50 max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-foreground">Add Challenge Question</DialogTitle>
              <DialogDescription className="text-muted-foreground">Add a question for {courseName}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-xs text-muted-foreground font-mono block mb-2">Question Type</label>
                <select value={qType} onChange={e => setQType(e.target.value as QuestionType)}
                  className="w-full bg-muted border border-primary/30 rounded-lg px-3 py-2.5 text-sm text-foreground focus:border-primary outline-none">
                  <option value="multiple_choice">Choose the Correct Option</option>
                  <option value="fill_blank">Fill in the Missing</option>
                  <option value="syntax_correction">Correct the Syntax</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-mono block mb-2">Question</label>
                <Textarea value={qText} onChange={e => setQText(e.target.value)}
                  placeholder={qType === "fill_blank" ? "Question with ___ for blank" : qType === "syntax_correction" ? "Code with syntax error" : "What is the correct answer?"}
                  className="bg-muted border-primary/30 focus:border-primary text-sm" />
              </div>
              {qType === "multiple_choice" ? (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground font-mono block mb-2">Options</label>
                    {qOptions.map((opt, i) => (
                      <Input key={i} value={opt} onChange={e => {
                        const newOpts = [...qOptions]; newOpts[i] = e.target.value; setQOptions(newOpts);
                      }} placeholder={`Option ${i + 1}`} className="bg-muted border-primary/30 focus:border-primary text-sm mb-2" />
                    ))}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-mono block mb-2">Correct Option</label>
                    <select value={correctOptionIndex} onChange={e => setCorrectOptionIndex(parseInt(e.target.value))}
                      className="w-full bg-muted border border-primary/30 rounded-lg px-3 py-2.5 text-sm text-foreground focus:border-primary outline-none">
                      {qOptions.map((opt, i) => (
                        <option key={i} value={i}>{opt || `Option ${i + 1}`}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-xs text-muted-foreground font-mono block mb-2">Correct Answer</label>
                  <Input value={qAnswer} onChange={e => setQAnswer(e.target.value)}
                    placeholder="Correct answer" className="bg-muted border-primary/30 focus:border-primary text-sm" />
                </div>
              )}
              <Button onClick={() => addQuestion.mutate()} disabled={addQuestion.isPending}
                className="w-full bg-primary text-primary-foreground font-mono font-bold">
                {addQuestion.isPending ? "ADDING..." : "ADD QUESTION"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminChallenges;
