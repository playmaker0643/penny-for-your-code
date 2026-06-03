import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Upload, Plus, Trash2, Eye, Code, FileText, CheckCircle, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import RichTextEditor from "@/components/RichTextEditor";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

type QuestionForm = {
  question_type: "fill_blank" | "syntax_correction";
  question_text: string;
  correct_answer: string;
};

const AdminLessons = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [codeMode, setCodeMode] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [viewLesson, setViewLesson] = useState<any>(null);
  const [richContent, setRichContent] = useState("");
  const [form, setForm] = useState({
    course_id: "",
    title: "",
    description: "",
    video_url: "",
    content: "",
    content_html: "",
    total_lessons_required: "",
    completion_time_minutes: "",
  });
  const [questions, setQuestions] = useState<QuestionForm[]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiCourseId, setAiCourseId] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const { data: courses } = useQuery({
    queryKey: ["admin-courses-list"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, title, total_lessons_required").order("created_at", { ascending: true });
      return data || [];
    },
  });

  const { data: lessons, isLoading } = useQuery({
    queryKey: ["admin-lessons"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lessons")
        .select("*, courses(title)")
        .order("course_id")
        .order("order_index", { ascending: true });
      return data || [];
    },
  });

  const { data: viewLessonCompletions } = useQuery({
    queryKey: ["lesson-completions", viewLesson?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("lesson_progress")
        .select("*", { count: "exact", head: true })
        .eq("lesson_id", viewLesson.id)
        .eq("completed", true);
      return count || 0;
    },
    enabled: !!viewLesson,
  });

  const createLesson = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase
        .from("lessons")
        .select("order_index")
        .eq("course_id", form.course_id)
        .order("order_index", { ascending: false })
        .limit(1);
      const nextIndex = existing && existing.length > 0 ? existing[0].order_index + 1 : 1;

      // Determine content: rich text editor content (stored as content_html) or code mode
      const finalContentHtml = codeMode ? (form.content_html || null) : (richContent || null);

      const { data: lesson, error } = await supabase.from("lessons").insert({
        course_id: form.course_id,
        title: form.title,
        description: form.description || null,
        video_url: form.video_url || null,
        content: null,
        content_html: finalContentHtml,
        order_index: nextIndex,
        completion_time_minutes: form.completion_time_minutes ? parseInt(form.completion_time_minutes) : null,
      } as any).select().single();
      if (error) throw error;

      if (form.total_lessons_required) {
        await supabase.from("courses").update({
          total_lessons_required: parseInt(form.total_lessons_required),
        }).eq("id", form.course_id);
      }

      if (questions.length > 0) {
        const questionInserts = questions.map((q, i) => ({
          lesson_id: lesson.id,
          question_type: q.question_type,
          question_text: q.question_text,
          correct_answer: q.correct_answer,
          order_index: i + 1,
        }));
        const { error: qError } = await supabase.from("lesson_questions").insert(questionInserts);
        if (qError) throw qError;
      }

      // Notify all students of the new lesson
      try {
        const { sendNotification } = await import("@/lib/notifications/api");
        await sendNotification({
          target: "all_students",
          category: "new_lesson",
          title: "New lesson available",
          body: form.title,
          link_url: `/student/courses/${form.course_id}`,
          actions: [{ action: "open", title: "Open Lesson" }, { action: "dismiss", title: "Dismiss" }],
        });
      } catch (e) { console.warn("notify new_lesson failed", e); }

    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-lessons"] });
      queryClient.invalidateQueries({ queryKey: ["admin-courses-list"] });
      setForm({ course_id: "", title: "", description: "", video_url: "", content: "", content_html: "", total_lessons_required: "", completion_time_minutes: "" });
      setQuestions([]);
      setCodeMode(false);
      setRichContent("");
      setShowForm(false);
      toast.success("Lesson added!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteLesson = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lessons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-lessons"] });
      toast.success("Lesson deleted!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addQuestion = () => {
    setQuestions([...questions, { question_type: "fill_blank", question_text: "", correct_answer: "" }]);
  };

  const updateQuestion = (idx: number, field: keyof QuestionForm, value: string) => {
    setQuestions(questions.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };

  const removeQuestion = (idx: number) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const runAiDraft = async () => {
    if (!aiPrompt.trim() || !aiCourseId) return;
    const course = courses?.find((c) => c.id === aiCourseId);
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-course-content", {
        body: { type: "lesson", prompt: aiPrompt, courseTitle: course?.title },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const d = data?.draft || {};
      setForm({
        course_id: aiCourseId,
        title: d.title || "",
        description: d.description || "",
        video_url: "",
        content: "",
        content_html: d.content_html || "",
        total_lessons_required: course?.total_lessons_required?.toString() || "",
        completion_time_minutes: d.completion_time_minutes ? String(d.completion_time_minutes) : "",
      });
      setRichContent(d.content_html || "");
      setCodeMode(false);
      const qs = Array.isArray(d.questions) ? d.questions : [];
      setQuestions(
        qs
          .filter((q: any) => q && q.question_text && q.correct_answer)
          .map((q: any) => ({
            question_type: q.question_type === "syntax_correction" ? "syntax_correction" : "fill_blank",
            question_text: String(q.question_text),
            correct_answer: String(q.correct_answer),
          })),
      );
      setAiOpen(false);
      setAiPrompt("");
      setShowForm(true);
      toast.success("Lesson drafted — review and edit before saving");
    } catch (err: any) {
      toast.error(err.message || "AI generation failed");
    } finally {
      setAiLoading(false);
    }
  };

  const handleCourseChange = (courseId: string) => {
    const course = courses?.find((c) => c.id === courseId);
    setForm({
      ...form,
      course_id: courseId,
      total_lessons_required: course?.total_lessons_required?.toString() || "",
    });
  };

  const grouped = (lessons || []).reduce<Record<string, { courseName: string; items: typeof lessons }>>((acc, l) => {
    const courseTitle = l.courses ? (l.courses as any).title : "Unknown";
    if (!acc[l.course_id]) acc[l.course_id] = { courseName: courseTitle, items: [] };
    acc[l.course_id].items!.push(l);
    return acc;
  }, {});

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold font-display text-foreground">Manage Lessons</h2>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => setAiOpen(true)}
              variant="outline"
              className="font-mono font-bold text-xs border-primary/40 text-primary hover:bg-primary/10"
            >
              <Sparkles className="h-4 w-4 mr-1" /> AI ASSIST
            </Button>
            <Button
              onClick={() => setShowForm(true)}
              className="glow-btn bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold text-xs"
            >
              <Plus className="h-4 w-4 mr-1" /> ADD LESSON
            </Button>
          </div>
        </div>

        {/* AI Assist Dialog */}
        <Dialog open={aiOpen} onOpenChange={setAiOpen}>
          <DialogContent className="bg-card border-border/50">
            <DialogHeader>
              <DialogTitle className="font-display text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> AI Lesson Assistant
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Pick a course and describe the lesson. AI drafts title, content and quiz questions — you review and edit before saving.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-xs text-muted-foreground font-mono block mb-2">Course</label>
                <select
                  value={aiCourseId}
                  onChange={(e) => setAiCourseId(e.target.value)}
                  className="w-full bg-muted border border-primary/30 rounded-lg px-3 py-2.5 text-sm text-foreground focus:border-primary outline-none"
                >
                  <option value="">Select a course</option>
                  {courses?.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-mono block mb-2">What should this lesson cover?</label>
                <Textarea
                  placeholder="e.g. Introduction to CSS Flexbox: containers, items, axes, justify-content and align-items, with code examples"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="bg-muted border-primary/30 focus:border-primary min-h-[120px]"
                />
              </div>
              <Button
                onClick={runAiDraft}
                disabled={!aiPrompt.trim() || !aiCourseId || aiLoading}
                className="w-full glow-btn bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold"
              >
                {aiLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> GENERATING...</> : <><Sparkles className="h-4 w-4 mr-2" /> GENERATE DRAFT</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Lesson Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="bg-card border-border/50 max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-foreground">Add Lesson</DialogTitle>
              <DialogDescription className="text-muted-foreground">Add a new lesson to a course.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2 pb-4">
              <div>
                <label className="text-xs text-muted-foreground font-mono block mb-2">Course</label>
                <select
                  value={form.course_id}
                  onChange={(e) => handleCourseChange(e.target.value)}
                  className="w-full bg-muted border border-primary/30 rounded-lg px-3 py-2.5 text-sm text-foreground focus:border-primary outline-none"
                >
                  <option value="">Select a course</option>
                  {courses?.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              {form.course_id && (
                <div>
                  <label className="text-xs text-muted-foreground font-mono block mb-2">Total Lessons Required for Course Completion</label>
                  <Input
                    type="number"
                    placeholder="e.g. 10"
                    value={form.total_lessons_required}
                    onChange={(e) => setForm({ ...form, total_lessons_required: e.target.value })}
                    className="bg-muted border-primary/30 focus:border-primary"
                  />
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground font-mono block mb-2">Lesson Title</label>
                <Input
                  placeholder="e.g. Introduction to HTML"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="bg-muted border-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-mono block mb-2">Description</label>
                <Textarea
                  placeholder="Brief description..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="bg-muted border-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-mono block mb-2">Video URL (optional)</label>
                <Input
                  placeholder="https://youtube.com/..."
                  value={form.video_url}
                  onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                  className="bg-muted border-primary/30 focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-mono block mb-2">Completion Time (minutes)</label>
                <Input
                  type="number"
                  placeholder="e.g. 30 (time allowed to finish lesson)"
                  value={form.completion_time_minutes}
                  onChange={(e) => setForm({ ...form, completion_time_minutes: e.target.value })}
                  className="bg-muted border-primary/30 focus:border-primary"
                />
                <p className="text-[10px] text-muted-foreground mt-1">How long students have to complete this lesson before moving to the quiz.</p>
              </div>

              {/* Content Mode Toggle */}
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground font-mono">Content</label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground">{codeMode ? "HTML Code" : "Rich Editor"}</span>
                  <Switch checked={codeMode} onCheckedChange={setCodeMode} />
                  <Code className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>

              {codeMode ? (
                <div className="space-y-2">
                  <Textarea
                    placeholder="<h1>My Lesson</h1>\n<p>Write HTML/CSS here...</p>"
                    value={form.content_html}
                    onChange={(e) => setForm({ ...form, content_html: e.target.value })}
                    className="bg-muted border-primary/30 focus:border-primary min-h-[180px] font-mono text-xs"
                    style={{ fontFamily: "monospace" }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewHtml(form.content_html)}
                    className="text-xs font-mono"
                  >
                    <Eye className="h-3 w-3 mr-1" /> Preview
                  </Button>
                </div>
              ) : (
                <RichTextEditor
                  content={richContent}
                  onChange={setRichContent}
                  placeholder="Write your lesson content here..."
                />
              )}

              {/* Questions Section */}
              <div className="border-t border-border/50 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs text-muted-foreground font-mono">Lesson Questions</label>
                  <Button type="button" variant="outline" size="sm" onClick={addQuestion} className="text-xs font-mono">
                    <Plus className="h-3 w-3 mr-1" /> Add Question
                  </Button>
                </div>
                {questions.map((q, idx) => (
                  <div key={idx} className="cyber-card rounded-lg p-3 mb-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-primary">Question {idx + 1}</span>
                      <button onClick={() => removeQuestion(idx)} className="text-destructive/70 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <select
                      value={q.question_type}
                      onChange={(e) => updateQuestion(idx, "question_type", e.target.value)}
                      className="w-full bg-muted border border-primary/30 rounded-lg px-3 py-2 text-xs text-foreground outline-none"
                    >
                      <option value="fill_blank">Fill in the Blank</option>
                      <option value="syntax_correction">Correct the Syntax</option>
                    </select>
                    <Input
                      placeholder={q.question_type === "fill_blank" ? "Question with ___ for blank" : "Code with syntax error"}
                      value={q.question_text}
                      onChange={(e) => updateQuestion(idx, "question_text", e.target.value)}
                      className="bg-muted border-primary/30 focus:border-primary text-xs"
                    />
                    <Input
                      placeholder="Correct answer"
                      value={q.correct_answer}
                      onChange={(e) => updateQuestion(idx, "correct_answer", e.target.value)}
                      className="bg-muted border-primary/30 focus:border-primary text-xs"
                    />
                  </div>
                ))}
              </div>

              <Button
                onClick={() => createLesson.mutate()}
                disabled={!form.title || !form.course_id || createLesson.isPending}
                className="w-full glow-btn bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold"
              >
                {createLesson.isPending ? "ADDING..." : "ADD LESSON"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* HTML Preview - Full Page */}
        {previewHtml && (
          <div className="fixed inset-0 z-[100] bg-background flex flex-col">
            <div className="h-12 bg-card border-b border-border/50 flex items-center justify-between px-4">
              <span className="text-sm font-mono text-muted-foreground">Content Preview</span>
              <Button variant="ghost" size="sm" onClick={() => setPreviewHtml(null)}>Close</Button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
        )}

        {/* View Lesson - Full Page */}
        {viewLesson && (
          <div className="fixed inset-0 z-[100] bg-background flex flex-col">
            <div className="h-12 bg-card border-b border-border/50 flex items-center justify-between px-4">
              <span className="text-sm font-mono text-muted-foreground">{viewLesson.title}</span>
              <Button variant="ghost" size="sm" onClick={() => setViewLesson(null)}>Close</Button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {viewLesson.description && <p className="text-sm text-muted-foreground">{viewLesson.description}</p>}
              {viewLesson.video_url && (
                <div className="rounded-lg overflow-hidden bg-muted p-3">
                  <a href={viewLesson.video_url} target="_blank" rel="noreferrer" className="text-xs text-primary font-mono break-all">{viewLesson.video_url}</a>
                </div>
              )}
              {viewLesson.content_html ? (
                <div className="prose prose-sm prose-invert max-w-none bg-muted p-4 rounded-lg" dangerouslySetInnerHTML={{ __html: viewLesson.content_html }} />
              ) : viewLesson.content ? (
                <div className="text-sm text-foreground whitespace-pre-wrap bg-muted p-4 rounded-lg">{viewLesson.content}</div>
              ) : null}
              <div className="cyber-card rounded-lg p-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span className="text-xs font-mono text-foreground">{viewLessonCompletions ?? 0} student(s) completed this lesson</span>
              </div>
            </div>
          </div>
        )}

        {/* Lessons grouped by course */}
        {isLoading ? (
          <p className="text-muted-foreground font-mono animate-pulse text-center py-12">Loading...</p>
        ) : Object.keys(grouped).length > 0 ? (
          <div className="space-y-6">
            {Object.entries(grouped).map(([courseId, group]) => (
              <div key={courseId} className="space-y-3">
                <p className="text-sm font-mono text-primary">{group.courseName}</p>
                {group.items!.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="cyber-card rounded-xl p-4 flex items-start gap-3 cursor-pointer hover:border-primary/40 transition-colors"
                    onClick={() => setViewLesson(lesson)}
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs font-mono shrink-0 mt-0.5">
                      {lesson.order_index}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground text-sm font-mono">{lesson.title}</h3>
                      {lesson.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{lesson.description}</p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {lesson.video_url && <span className="text-[11px] font-mono text-primary">🎥 Video</span>}
                        {(lesson as any).content_html && <span className="text-[11px] font-mono text-primary">📄 Content</span>}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Delete this lesson?")) deleteLesson.mutate(lesson.id);
                      }}
                      className="text-destructive/70 hover:text-destructive transition-colors shrink-0 mt-1"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="cyber-card rounded-xl p-12 text-center">
            <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2 font-display">No Lessons Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Add lessons to your courses for students to learn from.</p>
            <Button onClick={() => setShowForm(true)} className="glow-btn bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold text-xs">
              <Plus className="h-4 w-4 mr-1" /> ADD LESSON
            </Button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminLessons;
