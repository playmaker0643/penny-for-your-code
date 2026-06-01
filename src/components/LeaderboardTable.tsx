import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeAllStudentScores, gradeFromTotal, StudentScore } from "@/lib/grades";
import { Trophy, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Props {
  isAdmin?: boolean;
}

export default function LeaderboardTable({ isAdmin = false }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<StudentScore | null>(null);
  const [msg, setMsg] = useState("");

  const { data: scores, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const result = await computeAllStudentScores();
      // Higher total first; on tie, the user who joined first (lower registration number) ranks higher.
      return result.sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        const ra = a.registration_number || "ZZZZZZZZ";
        const rb = b.registration_number || "ZZZZZZZZ";
        return ra.localeCompare(rb);
      });
    },
    refetchInterval: 60000,
  });

  const myRank = scores?.findIndex((s) => s.user_id === user?.id);

  const sendMessage = async () => {
    if (!msg.trim() || !selected) return;
    const { error } = await supabase.from("messages").insert({
      sender_id: user!.id,
      receiver_id: selected.user_id,
      content: msg,
    });
    if (error) return toast.error(error.message);
    toast.success("Message sent!");
    setMsg("");
    setSelected(null);
  };

  if (isLoading) return <p className="text-muted-foreground font-mono animate-pulse text-center py-12">Loading...</p>;

  const me = scores && myRank !== undefined && myRank >= 0 ? scores[myRank] : null;
  const meGrade = me ? gradeFromTotal(me.total) : null;

  return (
    <div className="space-y-4">
      {!isAdmin && me && meGrade && (
        <div className="cyber-card rounded-xl p-4 border-2 border-primary/60 bg-primary/5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono uppercase tracking-wider text-primary">Your Position</span>
            <span className="text-2xl font-bold font-display text-primary">#{(myRank ?? 0) + 1}</span>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-muted shrink-0">
              {me.avatar_url ? <img src={me.avatar_url} alt="" className="w-full h-full object-cover" /> : (
                <div className="w-full h-full flex items-center justify-center text-lg font-bold text-primary">{me.full_name.charAt(0)}</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{me.full_name}</p>
              <p className="text-[10px] font-mono text-muted-foreground">{me.registration_number || "—"}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xl font-bold text-primary font-mono">{me.total}%</p>
              <p className="text-[10px] text-primary font-mono">{meGrade.letter}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <Stat label="Lessons" v={me.lesson_score} />
            <Stat label="Assignments" v={me.assignment_score} />
            <Stat label="Exams" v={me.exam_score} />
            <Stat label="Projects" v={me.project_score} />
            <Stat label="Challenges" v={me.challenge_score} />
            <Stat label="Attendance" v={me.attendance_score} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-right">
            Likes: {me.public_likes} · Comments: {me.public_comments}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {scores?.map((s, idx) => {
          const grade = gradeFromTotal(s.total);
          const isMe = s.user_id === user?.id;
          return (
            <div
              key={s.user_id}
              onClick={() => { if (s.user_id !== user?.id) setSelected(s); }}
              className={`cyber-card rounded-xl p-3 cursor-pointer hover:border-primary/50 ${isMe ? "border-primary" : ""}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm font-mono shrink-0 ${idx < 3 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                </div>
                <div className="w-9 h-9 rounded-full overflow-hidden bg-muted shrink-0">
                  {s.avatar_url ? <img src={s.avatar_url} alt="" className="w-full h-full object-cover" /> : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-primary">{s.full_name.charAt(0)}</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{s.full_name}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{s.registration_number || "—"}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-bold text-primary font-mono">{s.total}%</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{grade.letter}</p>
                </div>
              </div>
            </div>
          );
        })}
        {(!scores || scores.length === 0) && (
          <div className="text-center py-12">
            <Trophy className="h-12 w-12 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground font-mono">No students yet.</p>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-background/95 overflow-y-auto" onClick={() => setSelected(null)}>
          <div className="max-w-md mx-auto p-4 min-h-screen" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold font-display">Student Details</h2>
              <button onClick={() => setSelected(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="cyber-card rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-muted">
                  {selected.avatar_url ? <img src={selected.avatar_url} alt="" className="w-full h-full object-cover" /> : (
                    <div className="w-full h-full flex items-center justify-center text-lg font-bold text-primary">{selected.full_name.charAt(0)}</div>
                  )}
                </div>
                <div>
                  <p className="font-bold">{selected.full_name}</p>
                  <p className="text-xs font-mono text-muted-foreground">{selected.registration_number || "—"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <Stat label="Lessons" v={selected.lesson_score} />
                <Stat label="Assignments" v={selected.assignment_score} />
                <Stat label="Exams" v={selected.exam_score} />
                <Stat label="Projects" v={selected.project_score} />
                <Stat label="Challenges" v={selected.challenge_score} />
                <Stat label="Attendance" v={selected.attendance_score} />
              </div>
              <div className="border-t border-border/50 pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Total</span>
                  <span className="text-xl font-bold text-primary">{selected.total}%</span>
                </div>
                <p className="text-xs text-right text-primary font-mono">{gradeFromTotal(selected.total).letter} – {gradeFromTotal(selected.total).tier}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Public project likes: {selected.public_likes}</p>
              </div>
              {isAdmin && (
                <div className="border-t border-border/50 pt-3 space-y-2">
                  <p className="text-xs font-mono text-muted-foreground">Send Message</p>
                  <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Type message..." className="bg-muted text-sm min-h-[80px]" />
                  <Button onClick={sendMessage} disabled={!msg.trim()} className="w-full bg-primary text-primary-foreground font-mono text-xs">
                    <MessageSquare className="h-4 w-4 mr-1" /> SEND MESSAGE
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Stat = ({ label, v }: { label: string; v: number }) => (
  <div className="flex justify-between bg-muted px-2 py-1.5 rounded">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-foreground font-bold">{v}%</span>
  </div>
);
