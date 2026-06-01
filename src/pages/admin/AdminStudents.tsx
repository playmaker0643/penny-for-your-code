import AdminLayout from "@/components/AdminLayout";
import { Users, ChevronRight, Phone, MapPin, Calendar, BookOpen, ClipboardCheck, ArrowLeft, Award, FileText, Lock, Unlock, Trash2, MessageSquare, Globe } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface StudentProfile {
  id: string;
  user_id: string;
  full_name: string;
  first_name: string | null;
  second_name: string | null;
  other_names: string | null;
  registration_number: string | null;
  avatar_url: string | null;
  phone: string | null;
  country: string | null;
  state: string | null;
  town: string | null;
  address: string | null;
  date_of_birth: string | null;
  created_at: string;
  account_locked: boolean;
  locked_at: string | null;
}

type DrillDown = "attendance" | "lessons" | "courses" | "profile" | null;

const AdminStudents = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [drillDown, setDrillDown] = useState<DrillDown>(null);
  const [messageText, setMessageText] = useState("");
  const [showMessageBox, setShowMessageBox] = useState(false);

  const { data: students, isLoading } = useQuery({
    queryKey: ["admin-students"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "student");
      if (!roles || roles.length === 0) return [];
      const studentIds = new Set(roles.map((r) => r.user_id));
      const { data: profiles } = await supabase.rpc("admin_list_profiles");
      return ((profiles || []) as StudentProfile[]).filter((p) => studentIds.has(p.user_id)).sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    },
  });

  const { data: yesterdayAttendance } = useQuery({
    queryKey: ["admin-yesterday-attendance"],
    queryFn: async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split("T")[0];
      const { data } = await supabase.from("attendance").select("user_id, status").eq("date", dateStr);
      const map: Record<string, string> = {};
      (data || []).forEach((a) => { map[a.user_id] = a.status; });
      return map;
    },
  });

  const { data: lessonCounts } = useQuery({
    queryKey: ["admin-lesson-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("lesson_progress").select("user_id, completed").eq("completed", true);
      const counts: Record<string, number> = {};
      (data || []).forEach((l) => { counts[l.user_id] = (counts[l.user_id] || 0) + 1; });
      return counts;
    },
  });

  const { data: examScores } = useQuery({
    queryKey: ["admin-exam-scores-all"],
    queryFn: async () => {
      const { data } = await supabase.from("exam_submissions").select("user_id, score, ai_score");
      const totals: Record<string, number> = {};
      (data || []).forEach((s) => {
        const mark = s.score ?? s.ai_score ?? 0;
        totals[s.user_id] = (totals[s.user_id] || 0) + mark;
      });
      return totals;
    },
  });

  const { data: questionScores } = useQuery({
    queryKey: ["admin-question-scores-all"],
    queryFn: async () => {
      const { data } = await supabase.from("lesson_question_attempts").select("user_id, correct");
      const totals: Record<string, { correct: number; total: number }> = {};
      (data || []).forEach((a) => {
        if (!totals[a.user_id]) totals[a.user_id] = { correct: 0, total: 0 };
        totals[a.user_id].total++;
        if (a.correct) totals[a.user_id].correct++;
      });
      return totals;
    },
  });

  const { data: coursesData } = useQuery({
    queryKey: ["admin-courses-full"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, title, total_lessons_required, is_published");
      return data || [];
    },
  });

  const { data: allLessons } = useQuery({
    queryKey: ["admin-all-lessons"],
    queryFn: async () => {
      const { data } = await supabase.from("lessons").select("id, course_id, title, order_index").order("order_index");
      return data || [];
    },
  });

  const { data: allProgress } = useQuery({
    queryKey: ["admin-all-progress"],
    queryFn: async () => {
      const { data } = await supabase.from("lesson_progress").select("user_id, lesson_id, completed").eq("completed", true);
      return data || [];
    },
  });

  const { data: allEnrollments } = useQuery({
    queryKey: ["admin-all-enrollments"],
    queryFn: async () => {
      const { data } = await supabase.from("enrollments").select("user_id, course_id");
      return data || [];
    },
  });

  // Monthly attendance for the grid
  const { data: monthlyAttendance } = useQuery({
    queryKey: ["admin-student-monthly-attendance", selectedStudent?.user_id],
    enabled: !!selectedStudent,
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const { data } = await supabase
        .from("attendance")
        .select("date, status")
        .eq("user_id", selectedStudent!.user_id)
        .gte("date", startOfMonth.toISOString().split("T")[0])
        .order("date");
      return data || [];
    },
  });

  // Check if student took any lesson on a given date
  const { data: lessonActivityDates } = useQuery({
    queryKey: ["admin-student-lesson-activity", selectedStudent?.user_id],
    enabled: !!selectedStudent,
    queryFn: async () => {
      const { data } = await supabase
        .from("lesson_progress")
        .select("completed_at")
        .eq("user_id", selectedStudent!.user_id)
        .eq("completed", true);
      const dates = new Set<string>();
      (data || []).forEach((p) => {
        if (p.completed_at) dates.add(p.completed_at.split("T")[0]);
      });
      return dates;
    },
  });

  // Drill-down attendance
  const { data: studentAllAttendance } = useQuery({
    queryKey: ["admin-student-all-attendance", selectedStudent?.user_id],
    enabled: !!selectedStudent && drillDown === "attendance",
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*, courses(title)")
        .eq("user_id", selectedStudent!.user_id)
        .eq("status", "present")
        .order("date", { ascending: false });
      return data || [];
    },
  });

  // Lock / unlock / delete mutations
  const lockMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("profiles").update({ account_locked: true, locked_at: new Date().toISOString() } as any).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-students"] });
      toast.success("Courses locked");
      if (selectedStudent) setSelectedStudent({ ...selectedStudent, account_locked: true, locked_at: new Date().toISOString() });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unlockMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("profiles").update({ account_locked: false, locked_at: null } as any).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-students"] });
      toast.success("Courses unlocked");
      if (selectedStudent) setSelectedStudent({ ...selectedStudent, account_locked: false, locked_at: null });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Delete user data - profile, roles, enrollments, progress, etc.
      await supabase.from("lesson_progress").delete().eq("user_id", userId);
      await supabase.from("lesson_question_attempts").delete().eq("user_id", userId);
      await supabase.from("exam_submissions").delete().eq("user_id", userId);
      await supabase.from("enrollments").delete().eq("user_id", userId);
      await supabase.from("attendance").delete().eq("user_id", userId);
      await supabase.from("messages").delete().eq("sender_id", userId);
      await supabase.from("messages").delete().eq("receiver_id", userId);
      await supabase.from("sandbox_projects").delete().eq("user_id", userId);
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("profiles").delete().eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-students"] });
      setSelectedStudent(null);
      toast.success("Student deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ receiverId, content }: { receiverId: string; content: string }) => {
      const { error } = await supabase.from("messages").insert({
        sender_id: user!.id,
        receiver_id: receiverId,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessageText("");
      setShowMessageBox(false);
      toast.success("Message sent!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getStudentStats = (userId: string) => {
    const userProgress = (allProgress || []).filter((p) => p.user_id === userId);
    const completedLessonIds = new Set(userProgress.map((p) => p.lesson_id));
    const userEnrollments = (allEnrollments || []).filter((e) => e.user_id === userId);

    let finishedCourses = 0;
    let totalEnrolledCourses = userEnrollments.length;
    let finishedLessons = completedLessonIds.size;
    let totalLessons = 0;

    userEnrollments.forEach((enrollment) => {
      const courseLessons = (allLessons || []).filter((l) => l.course_id === enrollment.course_id);
      totalLessons += courseLessons.length;
      const course = (coursesData || []).find((c) => c.id === enrollment.course_id);
      const required = course?.total_lessons_required || courseLessons.length;
      const completed = courseLessons.filter((l) => completedLessonIds.has(l.id)).length;
      if (completed >= required) finishedCourses++;
    });

    return { finishedCourses, totalEnrolledCourses, finishedLessons, totalLessons };
  };

  const getUserCoursesDetail = (userId: string) => {
    const userProgress = (allProgress || []).filter((p) => p.user_id === userId);
    const completedLessonIds = new Set(userProgress.map((p) => p.lesson_id));
    const userEnrollments = (allEnrollments || []).filter((e) => e.user_id === userId);

    return (coursesData || []).filter((c) => c.is_published).map((course) => {
      const courseLessons = (allLessons || []).filter((l) => l.course_id === course.id);
      const required = course.total_lessons_required || courseLessons.length;
      const completed = courseLessons.filter((l) => completedLessonIds.has(l.id)).length;
      const isEnrolled = userEnrollments.some((e) => e.course_id === course.id);
      return { ...course, completed, required, isFinished: completed >= required, isEnrolled, totalLessons: courseLessons.length };
    });
  };

  const getUserLessonsDetail = (userId: string) => {
    const userProgress = (allProgress || []).filter((p) => p.user_id === userId);
    const completedLessonIds = new Set(userProgress.map((p) => p.lesson_id));

    return (coursesData || []).filter((c) => c.is_published).map((course) => {
      const courseLessons = (allLessons || []).filter((l) => l.course_id === course.id).map((l) => ({
        ...l,
        isCompleted: completedLessonIds.has(l.id),
      }));
      return { courseTitle: course.title, lessons: courseLessons };
    });
  };

  // Build the 4-week x 7-day attendance grid for current month
  const buildAttendanceGrid = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const attendanceMap: Record<string, string> = {};
    (monthlyAttendance || []).forEach((a) => { attendanceMap[a.date] = a.status; });

    const weeks: { day: number; date: string; status: "present" | "yellow" | "absent" | "future" }[][] = [];
    let currentWeek: typeof weeks[0] = [];

    // Pad start of month
    const startDow = firstDay.getDay(); // 0=Sun
    for (let i = 0; i < startDow; i++) {
      currentWeek.push({ day: 0, date: "", status: "future" });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dateObj = new Date(year, month, d);
      const isFuture = dateObj > now;

      let status: "present" | "yellow" | "absent" | "future" = "future";
      if (!isFuture) {
        const att = attendanceMap[dateStr];
        if (att === "present") {
          // Check if they took a lesson that day
          const tookLesson = lessonActivityDates?.has(dateStr);
          status = tookLesson ? "present" : "yellow";
        } else {
          status = "absent";
        }
      }

      currentWeek.push({ day: d, date: dateStr, status });
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push({ day: 0, date: "", status: "future" });
      weeks.push(currentWeek);
    }

    return weeks.slice(0, 4); // max 4 weeks
  };

  // Count bad dots (yellow + red) for auto-lock check
  const countBadDots = () => {
    const grid = buildAttendanceGrid();
    let bad = 0;
    grid.forEach((week) =>
      week.forEach((day) => {
        if (day.status === "yellow" || day.status === "absent") {
          if (day.day > 0) bad++;
        }
      })
    );
    return bad;
  };

  // Check consecutive bad days (3 yellow/red)
  const shouldAutoLock = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const attendanceMap: Record<string, string> = {};
    (monthlyAttendance || []).forEach((a) => { attendanceMap[a.date] = a.status; });

    let consecutive = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dateObj = new Date(year, month, d);
      if (dateObj > now) break;

      const att = attendanceMap[dateStr];
      const tookLesson = lessonActivityDates?.has(dateStr);
      const isGood = att === "present" && tookLesson;

      if (!isGood) {
        consecutive++;
        if (consecutive >= 3) return true;
      } else {
        consecutive = 0;
      }
    }
    return false;
  };

  // Drill-down view
  if (selectedStudent && drillDown) {
    return (
      <AdminLayout>
        <div className="space-y-4">
          <button onClick={() => setDrillDown(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to {selectedStudent.full_name}
          </button>

          {drillDown === "attendance" && (
            <>
              <h2 className="text-xl font-bold font-display text-foreground">Attendance — {selectedStudent.full_name}</h2>
              {studentAllAttendance && studentAllAttendance.length > 0 ? (
                <div className="space-y-2">
                  {studentAllAttendance.map((a: any) => (
                    <div key={a.id} className="cyber-card rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{a.date}</p>
                        {a.courses && <p className="text-[10px] text-primary font-mono">{(a.courses as any).title}</p>}
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full text-green-500 bg-green-500/10">present</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground font-mono text-sm py-8">No attendance records.</p>
              )}
            </>
          )}

          {drillDown === "lessons" && (
            <>
              <h2 className="text-xl font-bold font-display text-foreground">Lessons — {selectedStudent.full_name}</h2>
              {getUserLessonsDetail(selectedStudent.user_id).map((group) => (
                <div key={group.courseTitle} className="space-y-2">
                  <p className="text-sm font-mono text-primary">{group.courseTitle}</p>
                  {group.lessons.map((l) => (
                    <div key={l.id} className="cyber-card rounded-lg p-3 flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${l.isCompleted ? "bg-green-500/20" : "bg-muted"}`}>
                        {l.isCompleted ? <ClipboardCheck className="h-3 w-3 text-green-500" /> : <span className="text-[10px] text-muted-foreground">{l.order_index}</span>}
                      </div>
                      <p className={`text-sm ${l.isCompleted ? "text-foreground" : "text-muted-foreground"}`}>{l.title}</p>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}

          {drillDown === "courses" && (
            <>
              <h2 className="text-xl font-bold font-display text-foreground">Courses — {selectedStudent.full_name}</h2>
              {getUserCoursesDetail(selectedStudent.user_id).map((c) => (
                <div key={c.id} className="cyber-card rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground text-sm">{c.title}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{c.completed}/{c.required} lessons</p>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${c.isFinished ? "text-green-500 bg-green-500/10" : c.isEnrolled ? "text-primary bg-primary/10" : "text-muted-foreground bg-muted"}`}>
                      {c.isFinished ? "✓ Finished" : c.isEnrolled ? "In Progress" : "Not Enrolled"}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}

          {drillDown === "profile" && (
            <>
              <h2 className="text-xl font-bold font-display text-foreground">Full Profile — {selectedStudent.full_name}</h2>
              <div className="cyber-card rounded-xl overflow-hidden">
                <div className="h-20 bg-gradient-to-r from-primary/40 via-secondary/20 to-accent/10" />
                <div className="px-4 pb-4 -mt-10">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-card">
                    {selectedStudent.avatar_url ? (
                      <img src={selectedStudent.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl font-display">
                        {selectedStudent.full_name?.charAt(0)?.toUpperCase() || "S"}
                      </div>
                    )}
                  </div>
                  <h3 className="text-lg font-bold font-display text-foreground mt-2">{selectedStudent.full_name}</h3>
                  <p className="text-xs text-primary font-mono">{selectedStudent.registration_number || "No ID"}</p>
                </div>
              </div>

              <div className="cyber-card rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-bold font-display text-foreground">Personal Information</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground font-mono">First Name</p>
                    <p className="text-sm text-foreground">{selectedStudent.first_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-mono">Second Name</p>
                    <p className="text-sm text-foreground">{selectedStudent.second_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-mono">Other Names</p>
                    <p className="text-sm text-foreground">{selectedStudent.other_names || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-mono">Phone</p>
                    <p className="text-sm text-foreground">{selectedStudent.phone || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-mono">Date of Birth</p>
                    <p className="text-sm text-foreground">{selectedStudent.date_of_birth ? new Date(selectedStudent.date_of_birth).toLocaleDateString() : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-mono">Email</p>
                    <p className="text-sm text-foreground truncate">{selectedStudent.user_id}</p>
                  </div>
                </div>
              </div>

              <div className="cyber-card rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-bold font-display text-foreground">Location</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground font-mono">Country</p>
                    <p className="text-sm text-foreground">{selectedStudent.country || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-mono">State</p>
                    <p className="text-sm text-foreground">{selectedStudent.state || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-mono">City/Town</p>
                    <p className="text-sm text-foreground">{selectedStudent.town || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-mono">Address</p>
                    <p className="text-sm text-foreground">{selectedStudent.address || "—"}</p>
                  </div>
                </div>
              </div>

              <div className="cyber-card rounded-xl p-4 space-y-2">
                <h4 className="text-sm font-bold font-display text-foreground">Account</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground font-mono">Joined</p>
                    <p className="text-sm text-foreground">{new Date(selectedStudent.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-mono">Status</p>
                    <p className={`text-sm ${selectedStudent.account_locked ? "text-destructive" : "text-green-500"}`}>
                      {selectedStudent.account_locked ? "Locked" : "Active"}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </AdminLayout>
    );
  }

  // Student detail view
  if (selectedStudent) {
    const stats = getStudentStats(selectedStudent.user_id);
    const examTotal = examScores?.[selectedStudent.user_id] || 0;
    const qStats = questionScores?.[selectedStudent.user_id] || { correct: 0, total: 0 };
    const attendanceGrid = buildAttendanceGrid();
    const autoLock = shouldAutoLock();
    const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const now = new Date();

    return (
      <AdminLayout>
        <div className="space-y-4">
          <button onClick={() => { setSelectedStudent(null); setShowMessageBox(false); }} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Students
          </button>

          {/* Profile header - clickable to see full profile */}
          <div className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setDrillDown("profile")}>
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/30 shrink-0">
              {selectedStudent.avatar_url ? (
                <img src={selectedStudent.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl font-display">
                  {selectedStudent.full_name?.charAt(0)?.toUpperCase() || "S"}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-lg font-display text-foreground font-bold">{selectedStudent.full_name}</h2>
              <p className="text-xs text-primary font-mono">{selectedStudent.registration_number || "No ID"}</p>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Joined {new Date(selectedStudent.created_at).toLocaleDateString()}</p>
              {selectedStudent.phone && <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" /> {selectedStudent.phone}</p>}
              {(selectedStudent.country || selectedStudent.state || selectedStudent.town) && (
                <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" /> {[selectedStudent.town, selectedStudent.state, selectedStudent.country].filter(Boolean).join(", ")}</p>
              )}
              {selectedStudent.date_of_birth && <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5"><Calendar className="h-3 w-3" /> DOB: {new Date(selectedStudent.date_of_birth).toLocaleDateString()}</p>}
              {selectedStudent.account_locked && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-destructive mt-1">
                  <Lock className="h-3 w-3" /> Courses Locked
                </span>
              )}
            </div>
          </div>

          {/* Marks summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="cyber-card rounded-xl p-3 text-center">
              <Award className="h-4 w-4 text-primary mx-auto mb-1" />
              <p className="text-lg font-bold font-display text-foreground">{examTotal}</p>
              <p className="text-[9px] text-muted-foreground font-mono">Exam Marks</p>
            </div>
            <div className="cyber-card rounded-xl p-3 text-center">
              <FileText className="h-4 w-4 text-primary mx-auto mb-1" />
              <p className="text-lg font-bold font-display text-foreground">{qStats.correct}/{qStats.total}</p>
              <p className="text-[9px] text-muted-foreground font-mono">Quiz Score</p>
            </div>
          </div>

          {/* Attendance grid - 4 weeks x 7 days */}
          <div className="cyber-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground font-display">Attendance — {monthNames[now.getMonth()]}</p>
              {autoLock && !selectedStudent.account_locked && (
                <span className="text-[10px] font-mono text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full">Auto-lock triggered</span>
              )}
            </div>

            {/* Day labels */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {dayLabels.map((d, i) => (
                <div key={i} className="text-center text-[9px] font-mono text-muted-foreground">{d}</div>
              ))}
            </div>

            {/* Grid */}
            {attendanceGrid.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
                {week.map((day, di) => (
                  <div key={di} className="flex items-center justify-center h-7">
                    {day.day === 0 ? (
                      <span />
                    ) : (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[8px] text-muted-foreground font-mono">{day.day}</span>
                        <div
                          className={`w-3 h-3 rounded-full ${
                            day.status === "present"
                              ? "bg-green-500"
                              : day.status === "yellow"
                              ? "bg-yellow-500"
                              : day.status === "absent"
                              ? "bg-red-500"
                              : "bg-muted/30"
                          }`}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="text-[9px] text-muted-foreground font-mono">Present + Lesson</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <span className="text-[9px] text-muted-foreground font-mono">Present only</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-[9px] text-muted-foreground font-mono">Absent</span>
              </div>
            </div>
          </div>

          {/* Clickable stat boxes */}
          <div className="cyber-card rounded-xl p-4 cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setDrillDown("attendance")}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-foreground text-sm">Attendance History</p>
                  <p className="text-[10px] text-muted-foreground font-mono">All days present</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div className="cyber-card rounded-xl p-4 cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setDrillDown("lessons")}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-foreground text-sm">Lessons</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{stats.finishedLessons} finished / {stats.totalLessons} total</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div className="cyber-card rounded-xl p-4 cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setDrillDown("courses")}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-foreground text-sm">Courses</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{stats.finishedCourses} finished / {stats.totalEnrolledCourses} enrolled</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Message box */}
          {showMessageBox && (
            <div className="cyber-card rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground font-display">Message {selectedStudent.full_name}</p>
              <Textarea
                placeholder="Type your message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="bg-muted border-primary/30 focus:border-primary text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => sendMessageMutation.mutate({ receiverId: selectedStudent.user_id, content: messageText })}
                  disabled={!messageText.trim() || sendMessageMutation.isPending}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-xs"
                >
                  {sendMessageMutation.isPending ? "Sending..." : "Send"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowMessageBox(false)} className="text-xs font-mono">Cancel</Button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              onClick={() => lockMutation.mutate(selectedStudent.user_id)}
              disabled={selectedStudent.account_locked || lockMutation.isPending}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-mono text-xs h-11"
            >
              <Lock className="h-4 w-4 mr-1" /> Lock Courses
            </Button>
            <Button
              onClick={() => unlockMutation.mutate(selectedStudent.user_id)}
              disabled={!selectedStudent.account_locked || unlockMutation.isPending}
              className="bg-green-500 hover:bg-green-600 text-black font-mono text-xs h-11"
            >
              <Unlock className="h-4 w-4 mr-1" /> Unlock Courses
            </Button>
            <Button
              onClick={() => {
                if (confirm(`Are you sure you want to delete ${selectedStudent.full_name}? This cannot be undone.`)) {
                  deleteMutation.mutate(selectedStudent.user_id);
                }
              }}
              disabled={deleteMutation.isPending}
              className="bg-red-500 hover:bg-red-600 text-white font-mono text-xs h-11"
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete Student
            </Button>
            <Button
              onClick={() => setShowMessageBox(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-mono text-xs h-11"
            >
              <MessageSquare className="h-4 w-4 mr-1" /> Message
            </Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Student list view
  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold font-display text-foreground">Students</h2>
            <p className="text-xs text-muted-foreground font-mono">{students?.length || 0} registered</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="cyber-card rounded-xl p-4 animate-pulse">
                <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-muted" /><div className="flex-1 space-y-2"><div className="h-3 bg-muted rounded w-1/3" /><div className="h-2 bg-muted rounded w-1/2" /></div></div>
              </div>
            ))}
          </div>
        ) : students && students.length > 0 ? (
          <div className="space-y-3">
            <AnimatePresence>
              {students.map((s, i) => {
                const status = yesterdayAttendance?.[s.user_id] || "absent";
                const studentStats = getStudentStats(s.user_id);
                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => setSelectedStudent(s)}
                    className="cyber-card rounded-xl p-3 cursor-pointer hover:border-primary/30 transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3">
                      {/* Profile pic */}
                      <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-primary/20 shrink-0">
                        {s.avatar_url ? (
                          <img src={s.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm font-display">
                            {s.full_name?.charAt(0)?.toUpperCase() || "S"}
                          </div>
                        )}
                      </div>

                      {/* Name & reg */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{s.full_name || "Unnamed"}</p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">{s.registration_number || "—"}</p>
                      </div>

                      {/* Right side: country, courses, attendance */}
                      <div className="text-right shrink-0 space-y-0.5">
                        <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 justify-end">
                          <Globe className="h-3 w-3" /> {s.country || "—"}
                        </p>
                        <p className="text-[10px] font-mono text-foreground">
                          {studentStats.totalEnrolledCourses} courses
                        </p>
                        <p className="text-[10px] font-mono text-foreground">
                          {studentStats.finishedLessons} lessons
                        </p>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full inline-block ${
                          status === "present"
                            ? "text-green-500 bg-green-500/10"
                            : "text-red-400 bg-red-500/10"
                        }`}>
                          {status === "present" ? "Present" : "Absent"}
                        </span>
                      </div>
                    </div>
                    {s.account_locked && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-destructive font-mono">
                        <Lock className="h-3 w-3" /> Courses Locked
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="cyber-card rounded-xl p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2 font-display">No Students Registered</h3>
            <p className="text-sm text-muted-foreground">Students will appear here once they register.</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminStudents;
