import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Swords, Bot, Users, ArrowLeft, Trophy, ChevronRight, Inbox, Plus, Check, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { useLocation } from "react-router-dom";
import { getInitials, getCountryFlag, pickChallengeQuestions } from "@/lib/challenge";
import type { ChallengeQuestion } from "@/lib/challenge";

type ChallengeStep = "hub" | "select-course" | "select-mode" | "select-player" | "waiting" | "gameplay" | "victory";
type HubTab = "create" | "invitations";

interface Player {
  id: string;
  name: string;
  regNum: string;
  country: string;
  initials: string;
}

const StudentChallenge = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [step, setStep] = useState<ChallengeStep>("hub");
  const [hubTab, setHubTab] = useState<HubTab>("create");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedCourseName, setSelectedCourseName] = useState("");
  const [mode, setMode] = useState<"ai" | "friend" | null>(null);
  const [regInput, setRegInput] = useState("");
  const [opponent, setOpponent] = useState<Player | null>(null);
  const [questions, setQuestions] = useState<ChallengeQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [opponentCurrentIndex, setOpponentCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [answered, setAnswered] = useState(false);
  const [winner, setWinner] = useState<"me" | "opponent" | "draw" | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const matchChannelRef = useRef<any>(null);

  const getWinnerFromScores = useCallback((my: number, opponentValue: number): "me" | "opponent" | "draw" => {
    if (my > opponentValue) return "me";
    if (opponentValue > my) return "opponent";
    return "draw";
  }, []);

  const myPlayer: Player = {
    id: user?.id || "",
    name: profile?.full_name || "You",
    regNum: profile?.registration_number || "",
    country: "",
    initials: getInitials(profile?.full_name || "You"),
  };

  const { data: myFullProfile } = useQuery({
    queryKey: ["my-full-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("country").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  if (myFullProfile?.country) myPlayer.country = myFullProfile.country;

  const { data: courses } = useQuery({
    queryKey: ["challenge-courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, title").eq("is_published", true).order("title");
      return data || [];
    },
  });

  // Fetch pending invitations received
  const { data: receivedInvitations, refetch: refetchInvitations } = useQuery({
    queryKey: ["challenge-invitations-received", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("challenge_invitations")
        .select("*")
        .eq("receiver_id", user!.id)
        .in("status", ["pending"])
        .order("created_at", { ascending: false });
      if (!data || data.length === 0) return [];
      // Filter out cancelled invitations (sender left waiting page)
      const enriched = await Promise.all(data.filter((inv: any) => inv.status === "pending").map(async (inv: any) => {
        const { data: prof } = await supabase.from("profiles")
          .select("full_name, registration_number, country, avatar_url")
          .eq("user_id", inv.sender_id).single();
        const courseName = inv.course_id
          ? (await supabase.from("courses").select("title").eq("id", inv.course_id).single()).data?.title
          : null;
        return { ...inv, senderProfile: prof, courseName };
      }));
      return enriched;
    },
    enabled: !!user,
    refetchInterval: 5000,
  });

  // Listen for real-time invitation updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("challenge-inv-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "challenge_invitations", filter: `receiver_id=eq.${user.id}` },
        () => { refetchInvitations(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, refetchInvitations]);

  const { data: courseStudents } = useQuery({
    queryKey: ["course-students-challenge", selectedCourseId],
    queryFn: async () => {
      // Get enrolled students for this course
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("user_id")
        .eq("course_id", selectedCourseId);
      
      const enrolledIds = (enrollments || []).map((e: any) => e.user_id).filter((id: string) => id !== user!.id);
      
      if (enrolledIds.length === 0) {
        // Fallback: show all non-admin students
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, registration_number, country")
          .neq("user_id", user!.id);
        const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
        const adminIds = new Set((adminRoles || []).map((r: any) => r.user_id));
        const students = (profiles || []).filter((p: any) => !adminIds.has(p.user_id));
        const ids = students.map((p: any) => p.user_id);
        const { data: presences } = await supabase.from("user_presence").select("user_id, is_online").in("user_id", ids.length > 0 ? ids : ["none"]);
        const onlineMap = new Map((presences || []).map((p: any) => [p.user_id, p.is_online]));
        return students.map((p: any) => ({ ...p, is_online: onlineMap.get(p.user_id) || false }));
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, registration_number, country")
        .in("user_id", enrolledIds);

      const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      const adminIds = new Set((adminRoles || []).map((r: any) => r.user_id));
      const students = (profiles || []).filter((p: any) => !adminIds.has(p.user_id));

      const ids = students.map((p: any) => p.user_id);
      const { data: presences } = await supabase.from("user_presence").select("user_id, is_online").in("user_id", ids.length > 0 ? ids : ["none"]);
      const onlineMap = new Map((presences || []).map((p: any) => [p.user_id, p.is_online]));
      return students.map((p: any) => ({ ...p, is_online: onlineMap.get(p.user_id) || false }));
    },
    enabled: !!selectedCourseId && step === "select-player",
  });

  // Subscribe to match updates for real-time score sync
  useEffect(() => {
    if (!matchId || !user) return;
    const channel = supabase
      .channel(`match-${matchId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "challenge_matches",
        filter: `id=eq.${matchId}`,
      }, (payload) => {
        const m = payload.new as any;
        const amPlayerOne = m.player_one_id === user.id;
        setOpponentScore(amPlayerOne ? m.player_two_score : m.player_one_score);
        setOpponentCurrentIndex(amPlayerOne ? (m.player_two_current_index || 0) : (m.player_one_current_index || 0));
        if (m.status === "completed") {
          const myFinalScore = amPlayerOne ? m.player_one_score : m.player_two_score;
          const opponentFinalScore = amPlayerOne ? m.player_two_score : m.player_one_score;
          setMyScore(myFinalScore);
          setOpponentScore(opponentFinalScore);
          setWinner(getWinnerFromScores(myFinalScore, opponentFinalScore));
          setStep("victory");
        }
      })
      .subscribe();
    matchChannelRef.current = channel;
    return () => { supabase.removeChannel(channel); matchChannelRef.current = null; };
  }, [matchId, user]);

  // Handle pre-selected opponent from chat
  useEffect(() => {
    const state = location.state as any;
    if (state?.fromChatOpponent && step === "hub") {
      const o = state.fromChatOpponent;
      setOpponent({ id: o.id, name: o.name, regNum: o.regNum || "", country: o.country || "", initials: getInitials(o.name) });
      setMode("friend");
      setStep("select-course");
      window.history.replaceState({}, document.title);
    }
  }, [location.state, step]);

  // Handle accepted invitation from overlay navigation
  useEffect(() => {
    const state = location.state as any;
    if (state?.acceptedInvitationId && user) {
      const invId = state.acceptedInvitationId;
      // Load invitation details and start match
      (async () => {
        const { data: inv } = await supabase.from("challenge_invitations").select("*").eq("id", invId).single();
        if (!inv) return;
        const { data: prof } = await supabase.from("profiles")
          .select("full_name, registration_number, country")
          .eq("user_id", inv.sender_id).single();
        
        setOpponent({
          id: inv.sender_id,
          name: prof?.full_name || "Opponent",
          regNum: prof?.registration_number || "",
          country: prof?.country || "",
          initials: getInitials(prof?.full_name || "Opponent"),
        });

        const courseId = inv.course_id;
        if (courseId) {
          setSelectedCourseId(courseId);
          const { data: course } = await supabase.from("courses").select("title").eq("id", courseId).single();
          setSelectedCourseName(course?.title || "Course");
        }

        // Accept the invitation
        await supabase.from("challenge_invitations").update({ status: "accepted" }).eq("id", invId);

        // Check if match already exists for this invitation
        const { data: existingMatch } = await supabase
          .from("challenge_matches")
          .select("*")
          .eq("invitation_id", invId)
          .single();

        if (existingMatch) {
          // Join existing match
          setMatchId(existingMatch.id);
          const qIds = existingMatch.question_ids as string[];
          await loadQuestionsFromIds(qIds);
          setCurrentQ(0);
          setMyScore(0);
          setOpponentScore(existingMatch.player_one_score || 0);
          setSelectedAnswer("");
          setAnswered(false);
          setWinner(null);
          setStep("gameplay");
        }
      })();
      // Clear location state
      window.history.replaceState({}, document.title);
    }
  }, [location.state, user]);

  const loadQuestionsFromIds = async (ids: string[]) => {
    if (ids.length === 0) return;
    const { data } = await supabase
      .from("challenge_questions")
      .select("id, question_text, question_type, options, correct_answer")
      .in("id", ids);
    if (!data) return;
    // Maintain the order from ids array
    const map = new Map(data.map(q => [q.id, q]));
    const ordered = ids.map(id => map.get(id)).filter(Boolean) as any[];
    setQuestions(ordered.map(q => ({
      ...q,
      options: Array.isArray(q.options) ? q.options as string[] : [],
    })));
  };

  const startAIGame = useCallback(async () => {
    const { data } = await supabase
      .from("challenge_questions")
      .select("id, question_text, question_type, options, correct_answer")
      .eq("course_id", selectedCourseId);

    if (!data || data.length === 0) {
      toast.error("No challenge questions available for this course");
      setStep("select-course");
      return;
    }

    const picked = pickChallengeQuestions(data, `ai-${Date.now()}`, 10);
    setQuestions(picked.map((q: any) => ({
      ...q,
      options: Array.isArray(q.options) ? q.options as string[] : [],
    })));
    setCurrentQ(0);
    setMyScore(0);
    setOpponentScore(0);
    setOpponentCurrentIndex(0);
    setSelectedAnswer("");
    setAnswered(false);
    setWinner(null);
    setMatchId(null);
    setStep("gameplay");
  }, [selectedCourseId]);

  const handleSelectCourse = (courseId: string, courseName: string) => {
    setSelectedCourseId(courseId);
    setSelectedCourseName(courseName);
    // If opponent already preset (from chat), skip directly to invite
    if (opponent && mode === "friend") {
      handleSelectPlayer({ user_id: opponent.id, full_name: opponent.name, registration_number: opponent.regNum, country: opponent.country });
      return;
    }
    setStep("select-mode");
  };

  const handleSelectMode = (m: "ai" | "friend") => {
    setMode(m);
    if (m === "ai") {
      setOpponent({
        id: "ai", name: "AI Bot", regNum: "AI-0000", country: "Global", initials: "AI",
      });
      startAIGame();
    } else {
      setStep("select-player");
    }
  };

  const handleSelectPlayer = async (p: any) => {
    const opp: Player = {
      id: p.user_id, name: p.full_name, regNum: p.registration_number || "",
      country: p.country || "", initials: getInitials(p.full_name),
    };
    setOpponent(opp);

    // Fetch questions and create match first
    const { data: allQ } = await supabase
      .from("challenge_questions")
      .select("id")
      .eq("course_id", selectedCourseId);

    if (!allQ || allQ.length === 0) {
      toast.error("No challenge questions for this course");
      return;
    }

    const seed = `${user!.id}-${p.user_id}-${Date.now()}`;
    const picked = pickChallengeQuestions(allQ, seed, 10);
    const questionIds = picked.map(q => q.id);

    // Create invitation with course_id
    const { data: inv, error: invErr } = await supabase.from("challenge_invitations").insert({
      sender_id: user!.id, receiver_id: p.user_id, status: "pending", course_id: selectedCourseId,
    }).select().single();

    if (invErr || !inv) {
      toast.error("Failed to send invitation");
      return;
    }

    // Create match record
    const { data: match, error: matchErr } = await supabase.from("challenge_matches").insert({
      invitation_id: inv.id,
      course_id: selectedCourseId,
      player_one_id: user!.id,
      player_two_id: p.user_id,
      question_ids: questionIds,
      status: "pending",
    }).select().single();

    if (matchErr || !match) {
      toast.error("Failed to create match");
      return;
    }

    setMatchId(match.id);
    toast.success(`Challenge sent to ${p.full_name}! Waiting...`);
    setStep("waiting");

    // Push notify the opponent
    try {
      const { sendNotification } = await import("@/lib/notifications/api");
      await sendNotification({
        target: "user",
        user_id: p.user_id,
        category: "challenge",
        title: "Challenge invitation",
        body: `${profile?.full_name || "Someone"} challenged you to a quiz battle`,
        link_url: "/student/challenges",
        actions: [{ action: "open", title: "Accept" }, { action: "dismiss", title: "Later" }],
      });
    } catch (e) { console.warn("notify challenge failed", e); }

    // Listen for acceptance via realtime on the invitation
    const channel = supabase
      .channel(`inv-response-${inv.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "challenge_invitations",
        filter: `id=eq.${inv.id}`,
      }, async (payload) => {
        const updated = payload.new as any;
        if (updated.status === "accepted") {
          toast.success(`${p.full_name} accepted! Starting...`);
          supabase.removeChannel(channel);
          // Update match status
          await supabase.from("challenge_matches").update({
            status: "active", accepted_at: new Date().toISOString(),
          }).eq("id", match.id);
          // Load questions and start
          await loadQuestionsFromIds(questionIds);
          setCurrentQ(0);
          setMyScore(0);
          setOpponentScore(0);
          setSelectedAnswer("");
          setAnswered(false);
          setWinner(null);
          setStep("gameplay");
        } else if (updated.status === "rejected") {
          toast.error(`${p.full_name} declined`);
          supabase.removeChannel(channel);
          setStep("select-player");
        }
      })
      .subscribe();

    // Timeout after 60s
    setTimeout(() => {
      supabase.removeChannel(channel);
    }, 65000);
  };

  const findByReg = async () => {
    if (!regInput.trim()) return;
    const { data } = await supabase.from("profiles")
      .select("user_id, full_name, registration_number, country")
      .eq("registration_number", regInput.trim()).single();
    if (!data) { toast.error("Student not found"); return; }
    if (data.user_id === user!.id) { toast.error("That's you!"); return; }
    handleSelectPlayer(data);
  };

  const acceptInvitation = async (inv: any) => {
    // Accept invitation
    await supabase.from("challenge_invitations").update({ status: "accepted" }).eq("id", inv.id);
    toast.success("Challenge accepted!");

    setOpponent({
      id: inv.sender_id,
      name: inv.senderProfile?.full_name || "Opponent",
      regNum: inv.senderProfile?.registration_number || "",
      country: inv.senderProfile?.country || "",
      initials: getInitials(inv.senderProfile?.full_name || "Opponent"),
    });

    if (inv.course_id) {
      setSelectedCourseId(inv.course_id);
      setSelectedCourseName(inv.courseName || "Course");
    }

    // Find or wait for match
    const { data: match } = await supabase
      .from("challenge_matches")
      .select("*")
      .eq("invitation_id", inv.id)
      .single();

    if (match) {
      setMatchId(match.id);
      // Update match status to active
      await supabase.from("challenge_matches").update({
        status: "active", accepted_at: new Date().toISOString(),
      }).eq("id", match.id);

      const qIds = match.question_ids as string[];
      await loadQuestionsFromIds(qIds);
      setCurrentQ(0);
      setMyScore(0);
        setOpponentScore(0);
      setSelectedAnswer("");
      setAnswered(false);
      setWinner(null);
      setStep("gameplay");
    } else {
      toast.error("Match not found, try again");
    }

    refetchInvitations();
  };

  const rejectInvitation = async (inv: any) => {
    await supabase.from("challenge_invitations").update({ status: "rejected" }).eq("id", inv.id);
    toast.info("Challenge declined");
    refetchInvitations();
  };

  const handleAnswer = async () => {
    if (!selectedAnswer) return;
    const q = questions[currentQ];
    const correct = selectedAnswer.toLowerCase().trim() === q.correct_answer.toLowerCase().trim();
    const newScore = correct ? myScore + 1 : myScore;
    if (correct) setMyScore(newScore);
    setAnswered(true);

    // AI mode: simulate opponent
    if (mode === "ai") {
      if (Math.random() < 0.5) setOpponentScore(s => s + 1);
      return;
    }

    // Friend mode: update match in DB
    if (matchId && user) {
      const { data: match } = await supabase.from("challenge_matches").select("*").eq("id", matchId).single();
      if (!match) return;
      const amPlayerOne = match.player_one_id === user.id;
      const updates: any = {};
      if (amPlayerOne) {
        updates.player_one_score = newScore;
        updates.player_one_current_index = currentQ + 1;
      } else {
        updates.player_two_score = newScore;
        updates.player_two_current_index = currentQ + 1;
      }
      await supabase.from("challenge_matches").update(updates).eq("id", matchId);
    }
  };

  const handleNext = async () => {
    if (currentQ >= questions.length - 1) {
      const finalMyScore = myScore;
      const finalOpponentScore = opponentScore;
      const resolvedWinner = getWinnerFromScores(finalMyScore, finalOpponentScore);
      setWinner(resolvedWinner);
      setStep("victory");

      // Update match as completed
      if (matchId && user) {
        const { data: match } = await supabase.from("challenge_matches").select("*").eq("id", matchId).single();
        if (match) {
          const amPlayerOne = match.player_one_id === user.id;
          let winnerId: string | null = null;
          if (finalMyScore > finalOpponentScore) winnerId = user.id;
          else if (finalOpponentScore > finalMyScore) winnerId = amPlayerOne ? match.player_two_id : match.player_one_id;
          await supabase.from("challenge_matches").update({
            status: "completed",
            completed_at: new Date().toISOString(),
            winner_id: winnerId,
            ...(amPlayerOne
              ? { player_one_score: finalMyScore, player_one_current_index: questions.length }
              : { player_two_score: finalMyScore, player_two_current_index: questions.length }
            ),
          }).eq("id", matchId);
        }
      }
      return;
    }
    setCurrentQ(c => c + 1);
    setSelectedAnswer("");
    setAnswered(false);
  };

  const resetGame = () => {
    setStep("hub");
    setSelectedCourseId("");
    setMode(null);
    setOpponent(null);
    setQuestions([]);
    setWinner(null);
    setMatchId(null);
  };

  const invitationCount = receivedInvitations?.length || 0;

  // ---- HUB ----
  if (step === "hub") {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Swords className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display text-foreground">Coding Challenge</h1>
              <p className="text-xs text-muted-foreground">Battle your friends or AI</p>
            </div>
          </div>

          <div className="flex bg-muted rounded-xl p-1">
            <button onClick={() => setHubTab("create")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-colors ${hubTab === "create" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              <Plus className="h-4 w-4" /> New Challenge
            </button>
            <button onClick={() => setHubTab("invitations")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-colors relative ${hubTab === "invitations" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              <Inbox className="h-4 w-4" /> Invitations
              {invitationCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center font-bold">
                  {invitationCount}
                </span>
              )}
            </button>
          </div>

          {hubTab === "create" ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Select a course to start</p>
              {courses?.map(c => (
                <button key={c.id} onClick={() => handleSelectCourse(c.id, c.title)}
                  className="w-full cyber-card rounded-xl p-4 flex items-center justify-between hover:border-primary/40 transition-colors">
                  <span className="text-sm font-semibold text-foreground">{c.title}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
              {(!courses || courses.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-8">No courses available yet</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {receivedInvitations && receivedInvitations.length > 0 ? (
                receivedInvitations.map((inv: any) => (
                  <div key={inv.id} className="cyber-card rounded-xl p-4 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
                      {getInitials(inv.senderProfile?.full_name || "?")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{inv.senderProfile?.full_name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{inv.senderProfile?.registration_number}</p>
                      {inv.courseName && (
                        <p className="text-[10px] text-primary font-mono">{inv.courseName}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(inv.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => rejectInvitation(inv)} className="w-9 h-9 rounded-full bg-destructive/20 flex items-center justify-center text-destructive">
                        <X className="h-4 w-4" />
                      </button>
                      <button onClick={() => acceptInvitation(inv)} className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 animate-pulse">
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No pending invitations</p>
              )}
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  if (step === "select-course") {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <button onClick={() => setStep("hub")} className="flex items-center gap-2 text-muted-foreground text-sm">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="space-y-2">
            {courses?.map(c => (
              <button key={c.id} onClick={() => handleSelectCourse(c.id, c.title)}
                className="w-full cyber-card rounded-xl p-4 flex items-center justify-between hover:border-primary/40 transition-colors">
                <span className="text-sm font-semibold text-foreground">{c.title}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (step === "select-mode") {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <button onClick={() => setStep("hub")} className="flex items-center gap-2 text-muted-foreground text-sm">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h1 className="text-xl font-bold font-display text-foreground text-center">{selectedCourseName}</h1>
          <p className="text-sm text-muted-foreground text-center">Choose your opponent</p>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <button onClick={() => handleSelectMode("ai")}
              className="cyber-card rounded-xl p-6 flex flex-col items-center gap-3 hover:border-primary/40 transition-colors">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <span className="text-sm font-bold text-foreground">Play with AI</span>
            </button>
            <button onClick={() => handleSelectMode("friend")}
              className="cyber-card rounded-xl p-6 flex flex-col items-center gap-3 hover:border-primary/40 transition-colors">
              <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center">
                <Users className="h-8 w-8 text-secondary" />
              </div>
              <span className="text-sm font-bold text-foreground">Play with Friend</span>
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (step === "select-player") {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <button onClick={() => setStep("select-mode")} className="flex items-center gap-2 text-muted-foreground text-sm">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h1 className="text-lg font-bold font-display text-foreground">Select Opponent</h1>
          <div className="flex gap-2">
            <Input value={regInput} onChange={e => setRegInput(e.target.value)}
              placeholder="Enter registration number" className="bg-muted border-border/50 flex-1"
              inputMode="text" autoComplete="off" />
            <Button onClick={findByReg} size="sm" className="bg-primary text-primary-foreground shrink-0">Find</Button>
          </div>
          <p className="text-xs text-muted-foreground font-mono">Available students:</p>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {courseStudents?.map((s: any) => (
              <button key={s.user_id} onClick={() => handleSelectPlayer(s)}
                className="w-full cyber-card rounded-xl p-3 flex items-center gap-3 hover:border-primary/40 transition-colors">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {getInitials(s.full_name)}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-foreground truncate">{s.full_name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{s.registration_number}</p>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${s.is_online ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                  <span className="text-[10px] text-muted-foreground">{s.is_online ? "Online" : "Offline"}</span>
                </div>
              </button>
            ))}
            {(!courseStudents || courseStudents.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-6">No other students found</p>
            )}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const cancelWaiting = async () => {
    // Cancel the invitation so it disappears from receiver's list
    if (matchId) {
      const { data: match } = await supabase.from("challenge_matches").select("invitation_id").eq("id", matchId).single();
      if (match?.invitation_id) {
        await supabase.from("challenge_invitations").update({ status: "cancelled" }).eq("id", match.invitation_id);
      }
      await supabase.from("challenge_matches").update({ status: "cancelled" }).eq("id", matchId);
    }
    setMatchId(null);
    setStep("select-player");
  };

  if (step === "waiting") {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 space-y-6">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
            <Swords className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Waiting for {opponent?.name}...</h2>
          <p className="text-sm text-muted-foreground">Challenge invitation sent</p>
          <div className="flex gap-3">
            <div className="w-3 h-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-3 h-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-3 h-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <Button variant="outline" onClick={cancelWaiting} className="mt-4">Cancel</Button>
        </div>
      </DashboardLayout>
    );
  }

  // Gameplay
  if (step === "gameplay" && questions.length > 0) {
    const q = questions[currentQ];
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="bg-card border-b border-border/50 p-4 relative">
          <button onClick={resetGame} className="absolute top-2 right-2 p-2 rounded-full bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors" title="Exit Challenge">
            <LogOut className="h-4 w-4" />
          </button>
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center gap-1 flex-1">
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg border-2 border-primary/40">
                {myPlayer.initials}
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">{myPlayer.regNum}</p>
              <p className="text-[10px] text-muted-foreground">{myPlayer.country} {getCountryFlag(myPlayer.country)}</p>
              <p className="text-lg font-bold text-primary">{myScore}</p>
            </div>
            <div className="flex flex-col items-center px-3">
              <span className="text-xl font-bold text-destructive font-display">V/S</span>
              <span className="text-[10px] text-muted-foreground font-mono">Q{currentQ + 1}/{questions.length}</span>
            </div>
            <div className="flex flex-col items-center gap-1 flex-1">
              <div className="w-14 h-14 rounded-full bg-secondary/20 flex items-center justify-center text-secondary font-bold text-lg border-2 border-secondary/40">
                {opponent?.initials}
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">{opponent?.regNum}</p>
              <p className="text-[10px] text-muted-foreground">{opponent?.country} {opponent?.country ? getCountryFlag(opponent.country) : "🤖"}</p>
              <p className="text-lg font-bold text-secondary">{opponentScore}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 p-4 flex flex-col">
          <div className="cyber-card rounded-xl p-4 mb-4">
            <p className="text-xs text-primary font-mono mb-2">Question {currentQ + 1}</p>
            <p className="text-sm text-foreground font-medium">{q.question_text}</p>
          </div>

          {q.question_type === "multiple_choice" && q.options.length > 0 ? (
            <RadioGroup value={selectedAnswer} onValueChange={setSelectedAnswer} className="space-y-2">
              {q.options.map((opt, i) => (
                <label key={i}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    answered
                      ? opt.toLowerCase().trim() === q.correct_answer.toLowerCase().trim()
                        ? "border-green-500 bg-green-500/10"
                        : selectedAnswer === opt ? "border-destructive bg-destructive/10" : "border-border/30 bg-card"
                      : selectedAnswer === opt ? "border-primary bg-primary/10" : "border-border/30 bg-card hover:border-primary/40"
                  }`}>
                  <RadioGroupItem value={opt} disabled={answered} />
                  <span className="text-sm text-foreground">{opt}</span>
                </label>
              ))}
            </RadioGroup>
          ) : (
            <div className="space-y-2">
              <Input value={selectedAnswer} onChange={e => setSelectedAnswer(e.target.value)}
                placeholder="Type your answer..." className="bg-muted border-border/50"
                disabled={answered} inputMode="text" autoComplete="off" />
              {answered && (
                <p className={`text-xs font-mono ${selectedAnswer.toLowerCase().trim() === q.correct_answer.toLowerCase().trim() ? "text-green-500" : "text-destructive"}`}>
                  Correct answer: {q.correct_answer}
                </p>
              )}
            </div>
          )}

          <div className="mt-auto pt-4">
            {!answered ? (
              <Button onClick={handleAnswer} disabled={!selectedAnswer}
                className="w-full bg-primary text-primary-foreground font-mono font-bold">
                SUBMIT ANSWER
              </Button>
            ) : (() => {
              const isLast = currentQ >= questions.length - 1;
              const waitingForOpponent = isLast && mode === "friend" && opponentCurrentIndex < questions.length;
              return (
                <Button onClick={handleNext} disabled={waitingForOpponent}
                  className="w-full bg-primary text-primary-foreground font-mono font-bold disabled:opacity-50">
                  {isLast ? (waitingForOpponent ? `WAITING FOR OPPONENT (${opponentCurrentIndex}/${questions.length})` : "FINISH") : "NEXT →"}
                </Button>
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  // Victory
  if (step === "victory") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          {winner === "draw" ? (
            <>
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto">
                <Swords className="h-10 w-10 text-muted-foreground" />
              </div>
              <h1 className="text-3xl font-bold font-display text-foreground">It's a Draw!</h1>
            </>
          ) : (
            <>
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto border-4 border-primary/40 animate-pulse">
                <Trophy className="h-12 w-12 text-primary" />
              </div>
              <h1 className="text-3xl font-bold font-display text-primary">
                {winner === "me" ? "Victory!" : `${opponent?.name} Wins!`}
              </h1>
            </>
          )}
          <p className="text-sm text-muted-foreground">{selectedCourseName}</p>
          <div className="flex items-center justify-between gap-4 mt-6">
            <div className="flex flex-col items-center gap-1 flex-1">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl border-2 ${winner === "me" ? "bg-primary/20 text-primary border-primary/40" : "bg-muted text-muted-foreground border-border/30"}`}>
                {myPlayer.initials}
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">{myPlayer.regNum}</p>
              <p className="text-2xl font-bold text-primary">{myScore}</p>
            </div>
            <span className="text-lg font-bold text-destructive font-display">V/S</span>
            <div className="flex flex-col items-center gap-1 flex-1">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl border-2 ${winner === "opponent" ? "bg-secondary/20 text-secondary border-secondary/40" : "bg-muted text-muted-foreground border-border/30"}`}>
                {opponent?.initials}
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">{opponent?.regNum}</p>
              <p className="text-2xl font-bold text-secondary">{opponentScore}</p>
            </div>
          </div>
          <Button onClick={resetGame} className="w-full bg-primary text-primary-foreground font-mono font-bold mt-6">
            PLAY AGAIN
          </Button>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </DashboardLayout>
  );
};

export default StudentChallenge;
