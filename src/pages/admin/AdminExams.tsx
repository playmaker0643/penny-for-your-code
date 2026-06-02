import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Plus, Trash2, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type PartCfg = { type: "obj" | "essay" | "code"; minutes: number; percent: number; questions: any[] };

const AdminExams = () => {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [viewExam, setViewExam] = useState<any>(null);
  const [viewSub, setViewSub] = useState<any>(null);

  const [step, setStep] = useState(1);
  const [base, setBase] = useState({ title: "", course_id: "", target_type: "all", target_lesson_id: "", target_reg_numbers: "", ai_marking: false, ai_marking_context: "" });
  const [parts, setParts] = useState<PartCfg[]>([]);
  const [partType, setPartType] = useState<"obj" | "essay" | "code">("obj");
  const [partCfg, setPartCfg] = useState({ minutes: "30", percent: "100" });
  const [questions, setQuestions] = useState<any[]>([]);
  const [qInput, setQInput] = useState({ question_text: "", options: ["", "", "", ""], correct_answer: "" });

  const { data: courses } = useQuery({
    queryKey: ["courses-list"],
    queryFn: async () => (await supabase.from("courses").select("id, title")).data || [],
  });

  const { data: lessons } = useQuery({
    queryKey: ["lessons-of", base.course_id],
    queryFn: async () => (await supabase.from("lessons").select("id, title").eq("course_id", base.course_id)).data || [],
    enabled: !!base.course_id,
  });

  const { data: exams } = useQuery({
    queryKey: ["all-exams"],
    queryFn: async () => (await supabase.from("exams").select("*, courses(title)").order("created_at", { ascending: false })).data || [],
  });

  const { data: examSubs } = useQuery({
    queryKey: ["exam-subs", viewExam?.id],
    queryFn: async () => {
      const { data } = await supabase.from("exam_submissions").select("*").eq("exam_id", viewExam.id);
      const userIds = [...new Set((data || []).map((s) => s.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, registration_number").in("user_id", userIds);
      return (data || []).map((s) => ({ ...s, profile: profiles?.find((p) => p.user_id === s.user_id) }));
    },
    enabled: !!viewExam,
  });

  const createExam = useMutation({
    mutationFn: async () => {
      const { data: ex, error } = await supabase.from("exams").insert({
        title: base.title,
        course_id: base.course_id,
        exam_type: "exam",
        max_score: 100,
        is_published: true,
        parts: parts.map((p) => ({ type: p.type, minutes: p.minutes, percent: p.percent })),
        target_type: base.target_type,
        target_lesson_id: base.target_lesson_id || null,
        target_reg_numbers: base.target_reg_numbers ? base.target_reg_numbers.split(",").map((s) => s.trim()).filter(Boolean) : null,
        ai_marking: base.ai_marking,
        ai_marking_context: base.ai_marking_context || null,
        allow_sandbox: parts.some((p) => p.type === "code"),
      }).select().single();
      if (error) throw error;

      // Insert questions
      const allQs: any[] = [];
      parts.forEach((p) => {
        p.questions.forEach((q, i) => {
          allQs.push({ exam_id: ex.id, part: p.type, question_text: q.question_text, options: q.options || [], correct_answer: q.correct_answer || null, order_index: i });
        });
      });
      if (allQs.length > 0) {
        const { error: qe } = await supabase.from("exam_questions").insert(allQs);
        if (qe) throw qe;
      }

      // Notify enrolled students of the new exam
      try {
        const { sendNotification } = await import("@/lib/notifications/api");
        const { data: enrolled } = await supabase
          .from("enrollments").select("user_id").eq("course_id", base.course_id);
        const userIds = [...new Set((enrolled || []).map((e: any) => e.user_id))];
        if (userIds.length) {
          await sendNotification({
            target: "users",
            user_ids: userIds,
            category: "live_class",
            title: "New exam available",
            body: base.title,
            link_url: "/student/exams",
            actions: [{ action: "open", title: "Open" }, { action: "dismiss", title: "Dismiss" }],
          });
        }
      } catch (e) { console.warn("notify exam failed", e); }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-exams"] });
      setShowForm(false); setStep(1);
      setBase({ title: "", course_id: "", target_type: "all", target_lesson_id: "", target_reg_numbers: "", ai_marking: false, ai_marking_context: "" });
      setParts([]); setQuestions([]);
      toast.success("Exam created!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delExam = useMutation({
    mutationFn: async (id: string) => { await supabase.from("exams").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-exams"] }),
  });

  const saveMark = useMutation({
    mutationFn: async ({ id, essay_score, code_score }: any) => {
      const sub = viewSub;
      const obj = sub.obj_score || 0;
      const total = obj + (essay_score || 0) + (code_score || 0);
      await supabase.from("exam_submissions").update({ essay_score, code_score, score: total, ai_score: total, graded: true, graded_at: new Date().toISOString() }).eq("id", id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exam-subs"] }); setViewSub(null); toast.success("Saved"); },
  });

  const addQuestion = () => {
    if (!qInput.question_text) return;
    if (partType === "obj" && !qInput.correct_answer) return toast.error("Pick correct option");
    setQuestions([...questions, { ...qInput, options: partType === "obj" ? qInput.options : [] }]);
    setQInput({ question_text: "", options: ["", "", "", ""], correct_answer: "" });
  };

  const finishPart = () => {
    setParts([...parts, { type: partType, minutes: parseInt(partCfg.minutes), percent: parseInt(partCfg.percent), questions }]);
    setQuestions([]); setPartCfg({ minutes: "30", percent: "100" }); setStep(2);
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold font-display">Exams</h1>
        <Button onClick={() => setShowForm(true)} size="sm" className="bg-primary text-primary-foreground"><Plus className="h-4 w-4 mr-1" /> CREATE</Button>
      </div>

      <div className="space-y-2">
        {exams?.map((e: any) => (
          <div key={e.id} onClick={() => setViewExam(e)} className="cyber-card rounded-xl p-3 cursor-pointer flex justify-between items-center hover:border-primary/40">
            <div>
              <p className="font-bold text-sm">{e.title}</p>
              <p className="text-xs text-muted-foreground">{e.courses?.title} • {(e.parts as any)?.length || 0} parts</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={(ev) => { ev.stopPropagation(); confirm("Delete?") && delExam.mutate(e.id); }}><Trash2 className="h-4 w-4 text-destructive" /></button>
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        ))}
      </div>

      <Dialog open={showForm} onOpenChange={(o) => !o && (setShowForm(false), setStep(1))}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Exam — Step {step}/3</DialogTitle></DialogHeader>
          {step === 1 && (
            <div className="space-y-3">
              <Input placeholder="Title" value={base.title} onChange={(e) => setBase({ ...base, title: e.target.value })} />
              <select value={base.course_id} onChange={(e) => setBase({ ...base, course_id: e.target.value })} className="w-full bg-muted border border-primary/30 rounded-lg px-3 py-2.5 text-sm">
                <option value="">Select course</option>
                {courses?.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <p className="text-xs">Target students:</p>
              <select value={base.target_type} onChange={(e) => setBase({ ...base, target_type: e.target.value })} className="w-full bg-muted border border-primary/30 rounded-lg px-3 py-2.5 text-sm">
                <option value="all">All in course</option>
                <option value="lesson">By lesson reached</option>
                <option value="regno">By registration numbers</option>
              </select>
              {base.target_type === "lesson" && (
                <select value={base.target_lesson_id} onChange={(e) => setBase({ ...base, target_lesson_id: e.target.value })} className="w-full bg-muted border border-primary/30 rounded-lg px-3 py-2.5 text-sm">
                  <option value="">Select lesson</option>
                  {lessons?.map((l: any) => <option key={l.id} value={l.id}>{l.title}</option>)}
                </select>
              )}
              {base.target_type === "regno" && (
                <Textarea placeholder="CBS260001, CBS260002, ..." value={base.target_reg_numbers} onChange={(e) => setBase({ ...base, target_reg_numbers: e.target.value })} />
              )}
              <div className="flex justify-between items-center"><span className="text-sm">AI Marking</span><Switch checked={base.ai_marking} onCheckedChange={(v) => setBase({ ...base, ai_marking: v })} /></div>
              {base.ai_marking && <Textarea placeholder="Grading rubric" value={base.ai_marking_context} onChange={(e) => setBase({ ...base, ai_marking_context: e.target.value })} />}
              <Button onClick={() => setStep(2)} disabled={!base.title || !base.course_id} className="w-full bg-primary text-primary-foreground">NEXT</Button>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm font-bold">Exam parts ({parts.length})</p>
              {parts.map((p, i) => (
                <div key={i} className="bg-muted rounded p-2 text-xs flex justify-between"><span>{p.type.toUpperCase()} • {p.minutes}min • {p.percent}% • {p.questions.length} Qs</span><button onClick={() => setParts(parts.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button></div>
              ))}
              <p className="text-xs">Add part:</p>
              <div className="grid grid-cols-3 gap-1">
                {(["obj", "essay", "code"] as const).map((t) => (
                  <Button key={t} size="sm" variant={partType === t ? "default" : "outline"} onClick={() => setPartType(t)} className="text-xs">{t.toUpperCase()}</Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Minutes" value={partCfg.minutes} onChange={(e) => setPartCfg({ ...partCfg, minutes: e.target.value })} />
                <Input type="number" placeholder="% weight" value={partCfg.percent} onChange={(e) => setPartCfg({ ...partCfg, percent: e.target.value })} />
              </div>
              <Button onClick={() => setStep(3)} className="w-full bg-primary text-primary-foreground">ADD QUESTIONS →</Button>
              {parts.length > 0 && <Button onClick={() => createExam.mutate()} disabled={createExam.isPending} className="w-full" variant="outline">SUBMIT EXAM</Button>}
            </div>
          )}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm font-bold">{partType.toUpperCase()} questions ({questions.length})</p>
              {questions.map((q, i) => <div key={i} className="bg-muted rounded p-2 text-xs">{i + 1}. {q.question_text}</div>)}
              <Textarea placeholder="Question text" value={qInput.question_text} onChange={(e) => setQInput({ ...qInput, question_text: e.target.value })} />
              {partType === "obj" && (
                <>
                  {qInput.options.map((opt, i) => (
                    <Input key={i} placeholder={`Option ${String.fromCharCode(65 + i)}`} value={opt} onChange={(e) => { const o = [...qInput.options]; o[i] = e.target.value; setQInput({ ...qInput, options: o }); }} />
                  ))}
                  <select value={qInput.correct_answer} onChange={(e) => setQInput({ ...qInput, correct_answer: e.target.value })} className="w-full bg-muted border border-primary/30 rounded-lg px-3 py-2 text-sm">
                    <option value="">Correct option</option>
                    {qInput.options.map((opt, i) => opt && <option key={i} value={opt}>{String.fromCharCode(65 + i)}: {opt}</option>)}
                  </select>
                </>
              )}
              <Button size="sm" onClick={addQuestion} className="w-full bg-primary text-primary-foreground"><Plus className="h-4 w-4 mr-1" /> ADD QUESTION</Button>
              <Button onClick={finishPart} disabled={questions.length === 0} className="w-full" variant="outline">DONE — Save Part</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewExam} onOpenChange={() => setViewExam(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {viewExam && <>
            <DialogHeader><DialogTitle>{viewExam.title} — Submissions</DialogTitle></DialogHeader>
            <div className="space-y-2">
              {examSubs?.map((s: any) => (
                <div key={s.id} onClick={() => setViewSub(s)} className="cyber-card rounded p-2 cursor-pointer flex justify-between">
                  <div><p className="text-sm">{s.profile?.full_name}</p><p className="text-[10px] text-muted-foreground">{s.profile?.registration_number}</p></div>
                  <span className="text-primary font-bold">{s.graded ? `${s.score}%` : (s.obj_score !== null ? `OBJ:${s.obj_score}` : "Pending")}</span>
                </div>
              ))}
              {(!examSubs || examSubs.length === 0) && <p className="text-center text-sm text-muted-foreground py-4">No submissions yet</p>}
            </div>
          </>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewSub} onOpenChange={() => setViewSub(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {viewSub && <ManualMark sub={viewSub} onSave={(es, cs) => saveMark.mutate({ id: viewSub.id, essay_score: es, code_score: cs })} />}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

const ManualMark = ({ sub, onSave }: { sub: any; onSave: (e: number, c: number) => void }) => {
  const [es, setEs] = useState("0");
  const [cs, setCs] = useState("0");
  return (
    <div className="space-y-3">
      <p className="font-bold">{sub.profile?.full_name}</p>
      <p className="text-xs">OBJ Score: {sub.obj_score ?? "—"}</p>
      {sub.essay_answers && (
        <div>
          <p className="text-xs font-bold">Essay Answers:</p>
          <pre className="bg-muted p-2 text-xs rounded whitespace-pre-wrap">{JSON.stringify(sub.essay_answers, null, 2)}</pre>
          <Input type="number" placeholder="Essay mark" value={es} onChange={(e) => setEs(e.target.value)} />
        </div>
      )}
      {sub.code_answer && (
        <div>
          <p className="text-xs font-bold">Code:</p>
          <pre className="bg-muted p-2 text-xs rounded whitespace-pre-wrap max-h-40 overflow-auto">{sub.code_answer}</pre>
          <Input type="number" placeholder="Code mark" value={cs} onChange={(e) => setCs(e.target.value)} />
        </div>
      )}
      <Button onClick={() => onSave(parseInt(es) || 0, parseInt(cs) || 0)} className="w-full bg-primary text-primary-foreground">SAVE</Button>
    </div>
  );
};

export default AdminExams;
