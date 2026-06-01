import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, FileText, Clock, Send, X } from "lucide-react";
import { toast } from "sonner";
import Editor from "@monaco-editor/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SearchBar from "@/components/SearchBar";
import { filterByQuery } from "@/lib/search";

const StudentExams = () => {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [active, setActive] = useState<any>(null);
  const [viewResult, setViewResult] = useState<any>(null);
  const [searchQ, setSearchQ] = useState("");

  const { data: exams } = useQuery({
    queryKey: ["s-exams", user?.id],
    queryFn: async () => {
      const { data: all } = await supabase.from("exams").select("*, courses(title)").eq("is_published", true);
      // Filter by target
      const filtered = (all || []).filter((e: any) => {
        if (e.target_type === "all") return true;
        if (e.target_type === "regno") return e.target_reg_numbers?.includes(profile?.registration_number);
        return true; // lesson check would need lesson_progress
      });
      return filtered;
    },
    enabled: !!user,
  });

  const { data: subs } = useQuery({
    queryKey: ["s-subs", user?.id],
    queryFn: async () => (await supabase.from("exam_submissions").select("*").eq("user_id", user!.id)).data || [],
    enabled: !!user,
  });

  const getSub = (eid: string) => subs?.find((s) => s.exam_id === eid);

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold font-display mb-4">Exams & Assignments</h1>
      <SearchBar value={searchQ} onChange={setSearchQ} placeholder="Search by title or description..." className="mb-4" />
      <div className="space-y-2">
        {filterByQuery(exams, searchQ, (e: any) => e.title, (e: any) => e.description).map((e: any) => {
          const sub = getSub(e.id);
          const graded = sub?.graded || sub?.ai_score !== null;
          return (
            <div key={e.id} onClick={() => { if (graded) setViewResult(sub); else if (!sub) setActive(e); else toast.info("Submitted, waiting"); }}
              className="cyber-card rounded-xl p-3 cursor-pointer hover:border-primary/40">
              <div className="flex items-start gap-2">
                {graded && <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />}
                <div className="flex-1">
                  <p className="font-bold text-sm">{e.title}</p>
                  <p className="text-xs text-muted-foreground">{e.courses?.title} • {(e.parts as any)?.length || 0} parts</p>
                </div>
                {sub && !graded && <span className="text-[10px] bg-muted px-2 py-0.5 rounded">pending</span>}
              </div>
            </div>
          );
        })}
        {(!exams || exams.length === 0) && <div className="text-center py-12 text-muted-foreground"><FileText className="h-12 w-12 mx-auto mb-2 opacity-40" /><p className="text-sm">No exams yet</p></div>}
      </div>

      {active && <ExamRunner exam={active} userId={user!.id} onClose={() => { setActive(null); qc.invalidateQueries({ queryKey: ["s-subs"] }); }} />}

      <Dialog open={!!viewResult} onOpenChange={() => setViewResult(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Your Result</DialogTitle></DialogHeader>
          <div className="text-center py-4 space-y-2">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <p className="text-3xl font-bold text-primary">{viewResult?.ai_score ?? viewResult?.score ?? 0}%</p>
            {viewResult?.obj_score != null && <p className="text-xs">OBJ: {viewResult.obj_score}</p>}
            {viewResult?.essay_score != null && <p className="text-xs">Essay: {viewResult.essay_score}</p>}
            {viewResult?.code_score != null && <p className="text-xs">Code: {viewResult.code_score}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

function ExamRunner({ exam, userId, onClose }: { exam: any; userId: string; onClose: () => void }) {
  const parts = exam.parts || [];
  const [partIdx, setPartIdx] = useState(0);
  const [questions, setQuestions] = useState<any[]>([]);
  const [objAnswers, setObjAnswers] = useState<Record<string, string>>({});
  const [essayAnswers, setEssayAnswers] = useState<Record<string, string>>({});
  const [codeAnswer, setCodeAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [results, setResults] = useState<any>({ obj_score: null, essay_score: null, code_score: null });

  const currentPart = parts[partIdx];

  useEffect(() => {
    supabase.from("exam_questions").select("*").eq("exam_id", exam.id).order("order_index").then(({ data }) => {
      setQuestions(data || []);
    });
  }, [exam.id]);

  useEffect(() => {
    if (!currentPart) return;
    setTimeLeft(currentPart.minutes * 60);
  }, [partIdx]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft]);

  useEffect(() => {
    if (timeLeft === 0 && currentPart) finishPart();
  }, [timeLeft]);

  const partQuestions = questions.filter((q) => q.part === currentPart?.type);

  const finishPart = async () => {
    const newResults = { ...results };
    if (currentPart.type === "obj") {
      const correct = partQuestions.filter((q) => objAnswers[q.id] === q.correct_answer).length;
      const score = partQuestions.length > 0 ? Math.round((correct / partQuestions.length) * currentPart.percent) : 0;
      newResults.obj_score = score;
    }
    setResults(newResults);

    if (partIdx < parts.length - 1) {
      setPartIdx(partIdx + 1);
    } else {
      // Submit
      const total = (newResults.obj_score || 0); // essay/code marked by admin/AI
      const allEssay = exam.parts.some((p: any) => p.type === "essay");
      const allCode = exam.parts.some((p: any) => p.type === "code");
      const needsManual = (allEssay || allCode) && !exam.ai_marking;

      await supabase.from("exam_submissions").insert({
        exam_id: exam.id,
        user_id: userId,
        obj_score: newResults.obj_score,
        obj_answers: objAnswers,
        essay_answers: essayAnswers,
        code_answer: codeAnswer || null,
        marking_status: needsManual ? "pending" : "queued",
        score: needsManual ? null : total,
        ai_score: needsManual ? null : (exam.ai_marking ? null : total),
        graded: !needsManual && !exam.ai_marking,
      });

      if (exam.ai_marking) {
        supabase.functions.invoke("grade-assignment", { body: { examId: exam.id, userId } }).catch(console.error);
      }

      toast.success("Exam submitted!");
      onClose();
    }
  };

  if (!currentPart) return null;

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="sticky top-0 bg-background border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="font-bold text-sm">{exam.title}</p>
          <p className="text-xs text-muted-foreground">Part {partIdx + 1}/{parts.length}: {currentPart.type.toUpperCase()}</p>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span className={`font-mono ${timeLeft < 60 ? "text-destructive" : "text-primary"}`}>{fmt(timeLeft)}</span>
          <button onClick={() => confirm("Quit? Progress lost.") && onClose()}><X className="h-5 w-5 ml-2" /></button>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {currentPart.type === "obj" && partQuestions.map((q, i) => (
          <div key={q.id} className="cyber-card rounded-xl p-3">
            <p className="text-sm font-bold mb-2">{i + 1}. {q.question_text}</p>
            <div className="space-y-1">
              {(q.options || []).map((opt: string, j: number) => (
                <label key={j} className="flex items-center gap-2 p-2 rounded bg-muted cursor-pointer text-sm">
                  <input type="radio" name={q.id} value={opt} checked={objAnswers[q.id] === opt} onChange={(e) => setObjAnswers({ ...objAnswers, [q.id]: e.target.value })} />
                  <span>{String.fromCharCode(65 + j)}: {opt}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        {currentPart.type === "essay" && partQuestions.map((q, i) => (
          <div key={q.id} className="cyber-card rounded-xl p-3">
            <p className="text-sm font-bold mb-2">{i + 1}. {q.question_text}</p>
            <Textarea value={essayAnswers[q.id] || ""} onChange={(e) => setEssayAnswers({ ...essayAnswers, [q.id]: e.target.value })} placeholder="Your answer..." className="min-h-[150px]" />
          </div>
        ))}

        {currentPart.type === "code" && (
          <div className="cyber-card rounded-xl p-3">
            {partQuestions[0] && <p className="text-sm font-bold mb-2">{partQuestions[0].question_text}</p>}
            <div className="border border-border/50 rounded">
              <Editor height="300px" language="javascript" value={codeAnswer} onChange={(v) => setCodeAnswer(v || "")} theme="vs-dark" options={{ minimap: { enabled: false }, fontSize: 13 }} />
            </div>
          </div>
        )}

        <Button onClick={finishPart} className="w-full bg-primary text-primary-foreground">
          <Send className="h-4 w-4 mr-1" /> {partIdx < parts.length - 1 ? "NEXT PART" : "SUBMIT EXAM"}
        </Button>
      </div>
    </div>
  );
}

export default StudentExams;
