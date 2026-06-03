import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { BookOpen, CheckCircle, ChevronRight, Lock, CalendarCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const StudentDashboard = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const firstName = profile?.full_name?.split(" ")[0] || "User";

  const { data: courses, isLoading } = useQuery({
    queryKey: ["student-courses", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("*").eq("is_published", true).order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!user,
  });

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

  // Get lesson progress to determine course completion
  const { data: progress } = useQuery({
    queryKey: ["student-lesson-progress", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lesson_progress")
        .select("lesson_id, completed")
        .eq("user_id", user!.id)
        .eq("completed", true);
      return data || [];
    },
    enabled: !!user,
  });

  // Get lessons per course
  const { data: lessonCounts } = useQuery({
    queryKey: ["student-lesson-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("lessons").select("id, course_id");
      const counts: Record<string, { total: number; lessonIds: string[] }> = {};
      (data || []).forEach((l) => {
        if (!counts[l.course_id]) counts[l.course_id] = { total: 0, lessonIds: [] };
        counts[l.course_id].total++;
        counts[l.course_id].lessonIds.push(l.id);
      });
      return counts;
    },
    enabled: !!user,
  });

  // Attendance this month
  const { data: attendance } = useQuery({
    queryKey: ["student-attendance-month", user?.id],
    queryFn: async () => {
      const start = new Date();
      start.setDate(1);
      const iso = start.toISOString().slice(0, 10);
      const { data } = await supabase
        .from("attendance")
        .select("date,status")
        .eq("user_id", user!.id)
        .gte("date", iso);
      const rows = data || [];
      const present = rows.filter((r: any) => r.status === "present").length;
      return { present, total: rows.length };
    },
    enabled: !!user,
  });

  const isCourseCompleted = (courseId: string, totalRequired: number | null) => {
    if (!progress || !lessonCounts) return false;
    const courseLessons = lessonCounts[courseId];
    if (!courseLessons) return false;
    const target = totalRequired || courseLessons.total;
    const completedCount = courseLessons.lessonIds.filter(
      (lid) => progress.some((p) => p.lesson_id === lid)
    ).length;
    return completedCount >= target;
  };

  return (
    <DashboardLayout>
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground mb-1">
          Welcome, {firstName}!
        </h1>
        <p className="text-sm text-muted-foreground mb-8">Your learning journey starts here. Tap a course to see its lessons.</p>

        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <p className="text-muted-foreground font-mono animate-pulse">Loading...</p>
          </div>
        ) : courses && courses.length > 0 ? (
          <div className="space-y-3">
            {courses.map((course) => {
              const completed = isCourseCompleted(course.id, course.total_lessons_required);
              const totalLessons = lessonCounts?.[course.id]?.total || 0;
              const completedLessons = lessonCounts?.[course.id]?.lessonIds.filter(
                (lid) => progress?.some((p) => p.lesson_id === lid)
              ).length || 0;
              const isLocked = profileLock?.account_locked === true;

              return (
                <div
                  key={course.id}
                  onClick={() => {
                    if (!isLocked) navigate(`/student/courses/${course.id}`);
                  }}
                  className={`cyber-card rounded-xl overflow-hidden transition-colors ${isLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:border-primary/40 active:scale-[0.98]"}`}
                >
                  {course.thumbnail_url && (
                    <img
                      src={course.thumbnail_url}
                      alt={course.title}
                      loading="lazy"
                      className="w-full h-32 object-cover"
                    />
                  )}
                  <div className="flex items-center gap-3 p-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {isLocked ? (
                        <Lock className="h-5 w-5 text-destructive" />
                      ) : completed ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <BookOpen className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground text-sm">{course.title}</h3>
                      {course.category && (
                        <span className="inline-block text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded mt-0.5">
                          {course.category}
                        </span>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {completedLessons}/{course.total_lessons_required || totalLessons} lessons
                      </p>
                      {isLocked && <p className="text-[10px] text-destructive font-mono mt-1">Locked by admin</p>}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32">
            <BookOpen className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground font-mono text-center">No courses available yet.</p>
            <p className="text-sm text-muted-foreground/60 text-center mt-1">
              Check back later — your instructors are preparing content.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
