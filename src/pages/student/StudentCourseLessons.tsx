import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { ArrowLeft, Play, Lock, CheckCircle, Unlock, Bot, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";


const StudentCourseLessons = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check if account is locked
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

  const [activeLesson, setActiveLesson] = useState<any>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<{ passed: boolean; score: number } | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timerStorageKey = activeLesson && user ? `lesson-timer:${user.id}:${activeLesson.id}` : null;

  // Timer effect: when activeLesson changes and has completion_time_minutes, start countdown
  useEffect(() => {
    if (activeLesson && activeLesson.completion_time_minutes && !isCompleted(activeLesson.id) && !showQuiz) {
      const totalSeconds = activeLesson.completion_time_minutes * 60;
      const saved = timerStorageKey ? Number(localStorage.getItem(timerStorageKey)) : NaN;
      const initialRemaining = Number.isFinite(saved) && saved > 0 ? saved : totalSeconds;
      setTimeRemaining(initialRemaining);
      
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          const next = (typeof prev === "number" ? prev : initialRemaining) - 1;
          if (timerStorageKey) {
            if (next > 0) localStorage.setItem(timerStorageKey, String(next));
            else localStorage.removeItem(timerStorageKey);
          }
          if (next <= 0) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return next;
        });
      }, 1000);
      
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      setTimeRemaining(null);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [activeLesson, showQuiz, timerStorageKey]);

  const { data: course } = useQuery({
    queryKey: ["student-course", courseId],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("*").eq("id", courseId!).single();
      return data;
    },
    enabled: !!courseId,
  });

  const { data: lessons, isLoading } = useQuery({
    queryKey: ["student-course-lessons", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("lessons")
        .select("*")
        .eq("course_id", courseId!)
        .order("order_index", { ascending: true });
      return data || [];
    },
    enabled: !!courseId,
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

  const getLessonStatus = (lesson: any, index: number) => {
    if (isCompleted(lesson.id)) return "completed";
    if (index === 0) return "unlocked";
    const prevLesson = lessons![index - 1];
    if (!isCompleted(prevLesson.id)) return "locked";
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
      if (timerStorageKey) localStorage.removeItem(timerStorageKey);
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
    } catch {
      toast.error("AI is unavailable right now");
    } finally {
      setChatLoading(false);
    }
  };

  // Account locked check
  if (profileLock?.account_locked) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-32">
          <Lock className="h-16 w-16 text-destructive/40 mb-4" />
          <p className="text-lg font-bold text-destructive font-display">Courses Locked</p>
          <p className="text-sm text-muted-foreground mt-2 text-center">
            Your course access has been restricted. Visit{" "}
            <button onClick={() => navigate("/student/support")} className="text-primary underline">Support</button>
            {" "}for help.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  // Full page lesson view
  if (activeLesson && !showQuiz) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <button onClick={() => setActiveLesson(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to lessons
          </button>

          <div className="cyber-card rounded-xl p-4 space-y-2">
            <h2 className="text-xl font-bold font-display text-foreground">{activeLesson.title}</h2>
            {activeLesson.description && <p className="text-sm text-muted-foreground">{activeLesson.description}</p>}
          </div>

          {activeLesson.video_url && (
            <div className="rounded-lg overflow-hidden bg-muted p-3">
              <a href={activeLesson.video_url} target="_blank" rel="noreferrer" className="text-xs text-primary font-mono break-all">{activeLesson.video_url}</a>
            </div>
          )}

          <LessonContent html={activeLesson.content_html} text={activeLesson.content} />

          {!isCompleted(activeLesson?.id) && (
            <div className="space-y-2">
              {timeRemaining !== null && timeRemaining > 0 && (
                <div className="p-3 rounded-lg bg-muted text-center font-mono text-sm text-muted-foreground">
                  ⏱ Time remaining: {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
                </div>
              )}
              <Button 
                onClick={handleDone} 
                disabled={timeRemaining !== null && timeRemaining > 0}
                className="w-full glow-btn bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold disabled:opacity-50"
              >
                {timeRemaining !== null && timeRemaining > 0 ? "WAIT FOR TIMER" : "DONE"}
              </Button>
            </div>
          )}

          {isCompleted(activeLesson?.id) && (
            <div className="p-3 rounded-lg bg-green-500/10 text-green-500 text-center font-mono text-sm">
              ✅ Lesson completed!
            </div>
          )}

          {/* AI Chat FAB */}
          <button
            onClick={() => setShowChat(true)}
            className="fixed bottom-24 right-6 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg z-50 hover:bg-primary/90 transition-colors"
          >
            <Bot className="h-5 w-5" />
          </button>

          {/* AI Chat Full Page */}
          {showChat && (
            <div className="fixed inset-0 z-[100] bg-background flex flex-col">
              <div className="h-12 bg-card border-b border-border/50 flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <span className="text-sm font-display text-foreground">AI Assistant</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-muted-foreground">{5 - (aiUsage?.used || 0)}/5 left</span>
                  <Button variant="ghost" size="sm" onClick={() => setShowChat(false)}>Close</Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {chatMessages.length === 0 && (
                  <p className="text-center text-muted-foreground text-xs font-mono py-4">Ask me anything about this lesson!</p>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    }`}>
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm prose-invert max-w-none [&_pre]:bg-background [&_pre]:rounded-lg [&_pre]:p-2 [&_code]:text-primary [&_ol]:list-decimal [&_ol]:pl-4 [&_ul]:list-disc [&_ul]:pl-4">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && <p className="text-xs text-muted-foreground font-mono animate-pulse">Thinking...</p>}
              </div>
              <div className="p-4 flex gap-2 border-t border-border/50">
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
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // Quiz view
  if (showQuiz) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <button onClick={() => { setShowQuiz(false); }} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h1 className="text-xl font-bold font-display text-foreground">Lesson Quiz</h1>

          {questions && questions.length > 0 ? (
            questions.map((q: any, idx: number) => (
              <div key={q.id} className="cyber-card rounded-lg p-4 space-y-2">
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
      </DashboardLayout>
    );
  }

  // Lesson list for this course
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <button onClick={() => navigate("/student")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to courses
        </button>

        <h1 className="text-xl font-bold font-display text-foreground">{course?.title || "Course"}</h1>
        {course?.description && <p className="text-sm text-muted-foreground">{course.description}</p>}

        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <p className="text-muted-foreground font-mono animate-pulse">Loading...</p>
          </div>
        ) : lessons && lessons.length > 0 ? (
          <div className="space-y-2">
            {lessons.map((lesson, idx) => {
              const status = getLessonStatus(lesson, idx);
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
                    }
                  }}
                  className={`cyber-card rounded-xl p-4 flex items-center gap-3 transition-colors ${
                    status === "locked" || status === "locked_until_tomorrow"
                      ? "opacity-50 cursor-not-allowed"
                      : "cursor-pointer hover:border-primary/40"
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {status === "completed" ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : status === "unlocked" ? (
                      <Unlock className="h-4 w-4 text-primary" />
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground text-sm truncate">{lesson.title}</h3>
                    {lesson.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{lesson.description}</p>
                    )}
                  </div>
                  <span className="text-xs font-mono text-muted-foreground shrink-0">{lesson.order_index}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32">
            <Play className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground font-mono text-center">No lessons available for this course yet.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentCourseLessons;
