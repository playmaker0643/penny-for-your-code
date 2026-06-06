import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Play, Lock, CheckCircle, Unlock, Bot, Send, X, Trophy, Target } from "lucide-react";
import LessonPracticals from "@/components/lessons/LessonPracticals";
import LessonContent from "@/components/lessons/LessonContent";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer";

const StudentLessons = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeLesson, setActiveLesson] = useState<any>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showPracticals, setShowPracticals] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<{ passed: boolean; score: number } | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const { data: profileLock } = useQuery({
    queryKey: ["student-profile-lock", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("account_locked")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: lessons, isLoading } = useQuery({
    queryKey: ["student-lessons", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lessons")
        .select("*, courses(title)")
        .order("course_id")
        .order("order_index", { ascending: true });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: progress } = useQuery({
    queryKey: ["student-lesson-progress", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lesson_progress")
        .select("*")
        .eq("user_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  // Practicals required per lesson
  const { data: lessonPracticals } = useQuery({
    queryKey: ["all-lesson-practicals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lesson_practicals")
        .select("id, lesson_id, required");
      return data || [];
    },
    enabled: !!user,
  });

  // User submissions for gating
  const { data: passedSubs } = useQuery({
    queryKey: ["passed-submissions", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("practical_submissions")
        .select("practical_id")
        .eq("user_id", user!.id)
        .eq("passed", true);
      return data || [];
    },
    enabled: !!user,
  });

  // XP summary
  const { data: xpRow } = useQuery({
    queryKey: ["user-xp", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_xp")
        .select("xp, level, current_streak, practicals_passed")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: questions } = useQuery({
    queryKey: ["lesson-questions", activeLesson?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lesson_questions")
        .select("*")
        .eq("lesson_id", activeLesson.id)
        .order("order_index");
      return data || [];
    },
    enabled: !!activeLesson && showQuiz,
  });

  // AI chat usage tracking
  const { data: aiUsage } = useQuery({
    queryKey: ["ai-usage", user?.id, activeLesson?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lesson_progress")
        .select("ai_questions_used, ai_questions_date")
        .eq("user_id", user!.id)
        .eq("lesson_id", activeLesson.id)
        .maybeSingle();
      if (!data) return { used: 0, canAsk: true };
      const today = new Date().toISOString().split("T")[0];
      if (data.ai_questions_date !== today) return { used: 0, canAsk: true };
      return { used: data.ai_questions_used || 0, canAsk: (data.ai_questions_used || 0) < 5 };
    },
    enabled: !!activeLesson && !!user,
  });

  const isCompleted = (lessonId: string) => progress?.some((p) => p.lesson_id === lessonId && p.completed);

  const getCompletedAt = (lessonId: string) => {
    const p = progress?.find((pr) => pr.lesson_id === lessonId && pr.completed);
    return p?.completed_at;
  };

  const passedSet = new Set((passedSubs || []).map((s: any) => s.practical_id));
  const practicalsRequiredFor = (lessonId: string) =>
    (lessonPracticals || []).filter((p: any) => p.lesson_id === lessonId && p.required);
  const allPracticalsPassed = (lessonId: string) => {
    const req = practicalsRequiredFor(lessonId);
    if (req.length === 0) return true;
    return req.every((p: any) => passedSet.has(p.id));
  };
  const practicalsCountFor = (lessonId: string) =>
    (lessonPracticals || []).filter((p: any) => p.lesson_id === lessonId);
  const practicalsPassedCountFor = (lessonId: string) =>
    practicalsCountFor(lessonId).filter((p: any) => passedSet.has(p.id)).length;

  const getLessonStatus = (lesson: any, index: number, courseLessons: any[]) => {
    if (isCompleted(lesson.id)) return "completed";
    if (index === 0) return "unlocked";
    const prevLesson = courseLessons[index - 1];
    if (!isCompleted(prevLesson.id)) return "locked";
    if (!allPracticalsPassed(prevLesson.id)) return "locked_practicals";
    const completedAt = getCompletedAt(prevLesson.id);
    if (completedAt) {
      const completedDate = new Date(completedAt).toDateString();
      const today = new Date().toDateString();
      if (completedDate === today) return "locked_until_tomorrow";
    }
    return "unlocked";
  };

  const markComplete = useMutation({
    mutationFn: async () => {
      const existing = progress?.find((p) => p.lesson_id === activeLesson.id);
      if (existing) {
        await supabase.from("lesson_progress").update({
          completed: true,
          completed_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await supabase.from("lesson_progress").insert({
          user_id: user!.id,
          lesson_id: activeLesson.id,
          completed: true,
          completed_at: new Date().toISOString(),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-lesson-progress"] });
      toast.success("Lesson completed! 🎉");
      setActiveLesson(null);
      setShowQuiz(false);
      setQuizResult(null);
      setQuizAnswers({});
    },
  });

  const handleDone = () => {
    setShowQuiz(true);
    setQuizResult(null);
    setQuizAnswers({});
  };

  const submitQuiz = async () => {
    if (!questions || questions.length === 0) {
      markComplete.mutate();
      return;
    }
    const results = await Promise.all(
      questions.map(async (q: any) => {
        const ans = quizAnswers[q.id] || "";
        const { data } = await supabase.rpc("check_lesson_answer", { _qid: q.id, _answer: ans });
        return { q, ans, correct: !!data };
      })
    );
    const correct = results.filter((r) => r.correct).length;
    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= 80;
    setQuizResult({ passed, score });
    if (passed) {
      results.forEach(({ q, ans, correct }) => {
        supabase.from("lesson_question_attempts").insert({
          user_id: user!.id,
          lesson_id: activeLesson.id,
          question_id: q.id,
          answer: ans,
          correct,
        });
      });
      markComplete.mutate();
    }
  };


  const sendChatMessage = async () => {
    if (!chatInput.trim() || !aiUsage?.canAsk) return;
    const userMsg = { role: "user", content: chatInput };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("lesson-chat", {
        body: {
          messages: [...chatMessages, userMsg],
          lessonTitle: activeLesson?.title,
          lessonContent: activeLesson?.content || activeLesson?.content_html || "",
          userId: user!.id,
          lessonId: activeLesson?.id,
        },
      });
      if (error) throw error;
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      queryClient.invalidateQueries({ queryKey: ["ai-usage"] });
    } catch (e: any) {
      toast.error("AI is unavailable right now");
    } finally {
      setChatLoading(false);
    }
  };

  // Group lessons by course
  const grouped = (lessons || []).reduce<Record<string, { courseName: string; items: any[] }>>((acc, l) => {
    const courseTitle = l.courses ? (l.courses as any).title : "Unknown";
    if (!acc[l.course_id]) acc[l.course_id] = { courseName: courseTitle, items: [] };
    acc[l.course_id].items.push(l);
    return acc;
  }, {});

  return (
    <DashboardLayout>
      {profileLock?.account_locked ? (
        <div className="flex flex-col items-center justify-center py-32">
          <Lock className="h-16 w-16 text-destructive/40 mb-4" />
          <p className="text-lg font-bold text-destructive font-display">Courses Locked</p>
          <p className="text-sm text-muted-foreground mt-2 text-center">Your lessons are locked right now. Visit Support for help.</p>
        </div>
      ) : (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold font-display text-foreground">Lessons</h1>
          {xpRow && (
            <div className="flex items-center gap-2 text-xs font-mono">
              <Badge variant="outline" className="gap-1"><Trophy className="h-3 w-3 text-primary" /> {xpRow.xp} XP</Badge>
              <Badge variant="outline">Lv {xpRow.level}</Badge>
              {xpRow.current_streak > 0 && <Badge variant="outline">🔥 {xpRow.current_streak}d</Badge>}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <p className="text-muted-foreground font-mono animate-pulse">Loading...</p>
          </div>
        ) : Object.keys(grouped).length > 0 ? (
          <div className="space-y-6">
            {Object.entries(grouped).map(([courseId, group]) => (
              <div key={courseId} className="space-y-2">
                <p className="text-sm font-mono text-primary">{group.courseName}</p>
                {group.items.map((lesson, idx) => {
                  const status = getLessonStatus(lesson, idx, group.items);
                  const pracCount = practicalsCountFor(lesson.id).length;
                  const pracPassed = practicalsPassedCountFor(lesson.id);
                  return (
                    <div
                      key={lesson.id}
                      onClick={() => {
                        if (status === "unlocked" || status === "completed") {
                          setActiveLesson(lesson);
                          setShowQuiz(false);
                          setQuizResult(null);
                          setChatMessages([]);
                        } else if (status === "locked_until_tomorrow") {
                          toast.info("This lesson unlocks tomorrow!");
                        } else if (status === "locked_practicals") {
                          toast.info("Complete the previous lesson's required practicals to unlock this.");
                        }
                      }}
                      className={`cyber-card rounded-xl p-4 flex items-center gap-3 transition-colors ${
                        status === "locked" || status === "locked_until_tomorrow" || status === "locked_practicals"
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer hover:border-primary/40"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        {status === "completed" ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : status === "unlocked" ? (
                          <Unlock className="h-4 w-4 text-primary" />
                        ) : status === "locked_practicals" ? (
                          <Target className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-foreground text-sm truncate">{lesson.title}</h3>
                        {lesson.courses && (
                          <p className="text-xs text-primary font-mono">{(lesson.courses as any).title}</p>
                        )}
                      </div>
                      {pracCount > 0 && (
                        <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
                          <Target className="h-3 w-3" /> {pracPassed}/{pracCount}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32">
            <Play className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground font-mono text-center">No lessons available yet.</p>
          </div>
        )}

        {/* Active Lesson Dialog */}
        <Dialog open={!!activeLesson && !showQuiz} onOpenChange={() => setActiveLesson(null)}>
          <DialogContent className="bg-card border-border/50 max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-foreground">{activeLesson?.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              {activeLesson?.description && <p className="text-sm text-muted-foreground">{activeLesson.description}</p>}
              {activeLesson?.video_url && (
                <div className="rounded-lg overflow-hidden bg-muted p-3">
                  <a href={activeLesson.video_url} target="_blank" rel="noreferrer" className="text-xs text-primary font-mono break-all">{activeLesson.video_url}</a>
                </div>
              )}
              <div className="bg-muted/30 p-3 rounded-lg">
                <LessonContent html={activeLesson?.content_html} text={activeLesson?.content} />
              </div>

              {activeLesson && practicalsCountFor(activeLesson.id).length > 0 && (
                <Button onClick={() => setShowPracticals(true)} variant="outline"
                  className="w-full font-mono font-bold border-primary/40">
                  <Target className="h-4 w-4 mr-2" />
                  PRACTICALS ({practicalsPassedCountFor(activeLesson.id)}/{practicalsCountFor(activeLesson.id).length})
                </Button>
              )}

              {!isCompleted(activeLesson?.id) && (
                <Button onClick={handleDone} className="w-full glow-btn bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold">
                  DONE
                </Button>
              )}
            </div>

            {activeLesson && (
              <LessonPracticals
                lessonId={activeLesson.id}
                open={showPracticals}
                onClose={() => setShowPracticals(false)}
              />
            )}

            {/* AI Chat FAB */}
            <button
              onClick={() => setShowChat(true)}
              className="fixed bottom-24 right-6 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg z-50 hover:bg-primary/90 transition-colors"
            >
              <Bot className="h-5 w-5" />
            </button>
          </DialogContent>
        </Dialog>

        {/* Quiz Dialog */}
        <Dialog open={showQuiz} onOpenChange={(open) => { if (!open) { setShowQuiz(false); setActiveLesson(null); } }}>
          <DialogContent className="bg-card border-border/50 max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-foreground">Lesson Quiz</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {questions && questions.length > 0 ? (
                questions.map((q: any, idx: number) => (
                  <div key={q.id} className="cyber-card rounded-lg p-3 space-y-2">
                    <p className="text-xs font-mono text-primary">Q{idx + 1} — {q.question_type === "fill_blank" ? "Fill in the Blank" : "Correct the Syntax"}</p>
                    <p className="text-sm text-foreground">{q.question_text}</p>
                    {q.question_type === "syntax_correction" ? (
                      <Textarea
                        placeholder="Write the corrected code..."
                        value={quizAnswers[q.id] || ""}
                        onChange={(e) => setQuizAnswers({ ...quizAnswers, [q.id]: e.target.value })}
                        className="bg-muted border-primary/30 focus:border-primary text-xs font-mono min-h-[60px]"
                      />
                    ) : (
                      <Input
                        placeholder="Your answer..."
                        value={quizAnswers[q.id] || ""}
                        onChange={(e) => setQuizAnswers({ ...quizAnswers, [q.id]: e.target.value })}
                        className="bg-muted border-primary/30 focus:border-primary text-xs"
                      />
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No questions for this lesson. Marking as complete...</p>
              )}

              {quizResult && (
                <div className={`p-3 rounded-lg text-center font-mono text-sm ${quizResult.passed ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"}`}>
                  {quizResult.passed
                    ? `✅ You scored ${quizResult.score}%! Lesson complete!`
                    : `❌ You scored ${quizResult.score}%. You need 80% to pass. Retry!`}
                </div>
              )}

              {!quizResult && (
                <Button onClick={submitQuiz} className="w-full glow-btn bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold">
                  SUBMIT QUIZ
                </Button>
              )}

              {quizResult && !quizResult.passed && (
                <Button onClick={() => { setQuizAnswers({}); setQuizResult(null); }} className="w-full" variant="outline">
                  RETRY
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* AI Chat Drawer */}
        <Drawer open={showChat} onOpenChange={setShowChat}>
          <DrawerContent className="max-h-[70vh]">
            <DrawerHeader className="flex items-center justify-between">
              <DrawerTitle className="font-display text-foreground flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" /> AI Assistant
              </DrawerTitle>
              <span className="text-[10px] font-mono text-muted-foreground">{5 - (aiUsage?.used || 0)}/5 questions left today</span>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto px-4 space-y-3 min-h-[200px] max-h-[300px]">
              {chatMessages.length === 0 && (
                <p className="text-center text-muted-foreground text-xs font-mono py-4">Ask me anything about this lesson!</p>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && <p className="text-xs text-muted-foreground font-mono animate-pulse">Thinking...</p>}
            </div>
            <div className="p-4 flex gap-2">
              <Input
                placeholder={aiUsage?.canAsk ? "Ask a question..." : "Daily limit reached"}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                disabled={!aiUsage?.canAsk || chatLoading}
                className="bg-muted border-primary/30 focus:border-primary text-sm"
              />
              <Button onClick={sendChatMessage} disabled={!aiUsage?.canAsk || chatLoading || !chatInput.trim()} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
      )}
    </DashboardLayout>
  );
};

export default StudentLessons;
