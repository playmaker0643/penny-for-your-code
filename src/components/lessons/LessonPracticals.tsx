import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Lock, Lightbulb, Trophy, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface Props {
  lessonId: string;
  open: boolean;
  onClose: () => void;
  onAllPassed?: () => void;
}

export default function LessonPracticals({ lessonId, open, onClose, onAllPassed }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeIdx, setActiveIdx] = useState(0);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<any>(null);
  const [hint, setHint] = useState<string>("");
  const [hintLevel, setHintLevel] = useState(0);
  const [running, setRunning] = useState(false);
  const [hinting, setHinting] = useState(false);
  const startedAt = useRef<number>(Date.now());

  const { data: practicals } = useQuery({
    queryKey: ["lesson-practicals", lessonId],
    queryFn: async () => {
      const { data } = await supabase
        .from("lesson_practicals")
        .select("id, lesson_id, title, prompt, language, starter_code, visible_tests, difficulty, xp_reward, min_engagement_seconds, required, order_index")
        .eq("lesson_id", lessonId)
        .order("order_index");
      return data || [];
    },
    enabled: open && !!lessonId,
  });

  const { data: submissions } = useQuery({
    queryKey: ["practical-submissions", lessonId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("practical_submissions")
        .select("practical_id, passed, score, attempt_number, created_at")
        .eq("user_id", user!.id)
        .eq("lesson_id", lessonId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: open && !!user,
  });

  const active = practicals?.[activeIdx];
  const passedSet = new Set((submissions || []).filter((s) => s.passed).map((s) => s.practical_id));
  const allRequiredPassed = (practicals || []).filter((p) => p.required).every((p) => passedSet.has(p.id));

  useEffect(() => {
    if (active) {
      setCode(active.starter_code || "");
      setResult(null);
      setHint("");
      setHintLevel(0);
      startedAt.current = Date.now();
    }
  }, [active?.id]);

  useEffect(() => {
    if (allRequiredPassed && practicals?.length) onAllPassed?.();
  }, [allRequiredPassed, practicals?.length]);

  // Engagement pings
  useEffect(() => {
    if (!open || !user || !lessonId) return;
    let interactions = 0;
    const onClick = () => { interactions += 1; };
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onClick);
    const tick = setInterval(async () => {
      try {
        const { data: ex } = await supabase
          .from("lesson_engagement").select("id, seconds_active, interactions")
          .eq("user_id", user.id).eq("lesson_id", lessonId).maybeSingle();
        if (ex) {
          await supabase.from("lesson_engagement").update({
            seconds_active: (ex.seconds_active || 0) + 15,
            interactions: (ex.interactions || 0) + interactions,
            last_ping: new Date().toISOString(),
          }).eq("id", ex.id);
        } else {
          await supabase.from("lesson_engagement").insert({
            user_id: user.id, lesson_id: lessonId, seconds_active: 15, interactions,
          });
        }
        interactions = 0;
      } catch {}
    }, 15000);
    return () => { clearInterval(tick); window.removeEventListener("click", onClick); window.removeEventListener("keydown", onClick); };
  }, [open, user?.id, lessonId]);

  const submit = async () => {
    if (!active) return;
    setRunning(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("evaluate-practical", {
        body: {
          practical_id: active.id,
          code,
          time_spent_seconds: Math.floor((Date.now() - startedAt.current) / 1000),
          hint_level: hintLevel,
        },
      });
      if (error) throw error;
      if (data?.error === "engagement_required") {
        toast.info(data.message);
        return;
      }
      if (data?.error) throw new Error(data.error);
      setResult(data);
      if (data.passed) toast.success(`✅ Passed! +${active.xp_reward} XP`);
      else toast.error(`Failed: ${data.visible_passed + data.hidden_passed}/${data.total_tests} tests`);
      qc.invalidateQueries({ queryKey: ["practical-submissions", lessonId, user?.id] });
      qc.invalidateQueries({ queryKey: ["user-xp", user?.id] });
    } catch (e: any) {
      toast.error(e.message || "Evaluation failed");
    } finally {
      setRunning(false);
    }
  };

  const requestHint = async () => {
    if (!active) return;
    setHinting(true);
    try {
      const nextLevel = Math.min(hintLevel + 1, 3);
      const { data, error } = await supabase.functions.invoke("practical-hint", {
        body: { practical_id: active.id, code, level: nextLevel },
      });
      if (error) throw error;
      setHint(data.hint || "");
      setHintLevel(nextLevel);
    } catch {
      toast.error("Hint unavailable");
    } finally {
      setHinting(false);
    }
  };

  const masteryPct = practicals?.length
    ? Math.round((practicals.filter((p) => passedSet.has(p.id)).length / practicals.length) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border/50 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-foreground flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" /> Practicals
          </DialogTitle>
        </DialogHeader>

        {!practicals?.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No practicals required for this lesson.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground">Mastery</span>
              <span className="text-primary">{masteryPct}%</span>
            </div>
            <Progress value={masteryPct} className="h-2" />

            <div className="flex gap-1 flex-wrap">
              {practicals.map((p, i) => {
                const passed = passedSet.has(p.id);
                return (
                  <button key={p.id} onClick={() => setActiveIdx(i)}
                    className={`px-2 py-1 rounded text-[10px] font-mono border ${
                      i === activeIdx ? "border-primary bg-primary/10" : "border-border/50"
                    }`}>
                    {passed ? <CheckCircle2 className="inline h-3 w-3 text-green-500 mr-1" /> : p.required ? <Lock className="inline h-3 w-3 mr-1" /> : null}
                    #{i + 1}
                  </button>
                );
              })}
            </div>

            {active && (
              <div className="space-y-3 pt-2 border-t border-border/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-foreground text-sm">{active.title}</h3>
                  <Badge variant="outline" className="text-[10px]">{active.difficulty}</Badge>
                  <Badge variant="outline" className="text-[10px]">{active.language}</Badge>
                  <Badge variant="outline" className="text-[10px]">+{active.xp_reward} XP</Badge>
                  {active.required && <Badge variant="destructive" className="text-[10px]">required</Badge>}
                </div>
                <div className="text-sm text-foreground whitespace-pre-wrap bg-muted p-3 rounded-lg">{active.prompt}</div>
                {Array.isArray(active.visible_tests) && active.visible_tests.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer font-mono text-primary">Sample test cases ({active.visible_tests.length})</summary>
                    <pre className="bg-muted p-2 rounded mt-1 overflow-x-auto text-[11px]">{JSON.stringify(active.visible_tests, null, 2)}</pre>
                  </details>
                )}

                <Textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={`Write your ${active.language} solution here...`}
                  className="bg-muted border-primary/30 focus:border-primary text-xs font-mono min-h-[180px]"
                />

                <div className="flex gap-2">
                  <Button onClick={submit} disabled={running || !code.trim()}
                    className="flex-1 glow-btn bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold">
                    {running ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> RUNNING</> : "SUBMIT & TEST"}
                  </Button>
                  <Button onClick={requestHint} disabled={hinting || hintLevel >= 3} variant="outline" size="icon" title={`Hint ${hintLevel + 1}/3`}>
                    <Lightbulb className="h-4 w-4" />
                  </Button>
                </div>

                {hint && (
                  <div className="text-xs bg-accent/10 border border-accent/30 rounded p-2 text-foreground">
                    <span className="font-mono text-accent">Hint L{hintLevel}:</span> {hint}
                  </div>
                )}

                {result && (
                  <div className={`rounded-lg p-3 space-y-2 ${result.passed ? "bg-green-500/10 border border-green-500/30" : "bg-destructive/10 border border-destructive/30"}`}>
                    <div className="flex items-center justify-between text-sm font-mono">
                      <span className="flex items-center gap-2">
                        {result.passed ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                        {result.passed ? "All tests passed" : `${result.visible_passed + result.hidden_passed}/${result.total_tests} passed`}
                      </span>
                      <span className="text-primary">Score: {result.score}</span>
                    </div>
                    {result.suspicious && (
                      <p className="text-[11px] text-yellow-500 flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Flagged: suspicious submission pattern</p>
                    )}
                    {result.errors && <pre className="text-[11px] bg-background/50 p-2 rounded overflow-x-auto">{result.errors}</pre>}
                    {result.results?.length > 0 && (
                      <ul className="space-y-1">
                        {result.results.map((r: any) => (
                          <li key={r.index} className="text-[11px] font-mono flex items-start gap-2">
                            {r.passed ? <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0 mt-0.5" /> : <XCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />}
                            <span>Test #{r.index + 1}: {r.reason}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {result.hidden_total > 0 && (
                      <p className="text-[11px] text-muted-foreground">Hidden tests: {result.hidden_passed}/{result.hidden_total}</p>
                    )}
                    {result.suggestion && !result.passed && (
                      <p className="text-[11px] italic text-muted-foreground">💡 {result.suggestion}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {allRequiredPassed && (
              <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3 text-center text-sm font-mono text-green-500">
                🎉 All required practicals passed — next lesson unlocked!
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
