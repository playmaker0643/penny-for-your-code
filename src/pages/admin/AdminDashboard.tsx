import AdminLayout from "@/components/AdminLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Users, BookOpen, FileText, Upload, TrendingUp, Calendar, CalendarDays, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const AdminDashboard = () => {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] || "Admin";
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [activeUsersView, setActiveUsersView] = useState<"day" | "week" | "month" | null>(null);
  const [activeUsersDate, setActiveUsersDate] = useState<string | null>(null);
  const [activeUsersLabel, setActiveUsersLabel] = useState("");
  const [presentDayView, setPresentDayView] = useState(false);
  const [presentSelectedDate, setPresentSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const navigate = useNavigate();

  // Stats
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [students, courses, lessons, exams] = await Promise.all([
        supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "student"),
        supabase.from("courses").select("*", { count: "exact", head: true }),
        supabase.from("lessons").select("*", { count: "exact", head: true }),
        supabase.from("exams").select("*", { count: "exact", head: true }),
      ]);
      return {
        students: students.count || 0,
        courses: courses.count || 0,
        lessons: lessons.count || 0,
        exams: exams.count || 0,
      };
    },
  });

  // Present today
  const { data: presentToday } = useQuery({
    queryKey: ["admin-present-today"],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("lesson_progress")
        .select("user_id")
        .gte("created_at", todayStart.toISOString());
      if (!data) return 0;
      return new Set(data.map((d) => d.user_id)).size;
    },
  });

  // Weekly active users count
  const { data: weeklyActiveCount } = useQuery({
    queryKey: ["admin-weekly-active"],
    queryFn: async () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data } = await supabase
        .from("lesson_progress")
        .select("user_id")
        .gte("created_at", weekAgo.toISOString());
      if (!data) return 0;
      return new Set(data.map((d) => d.user_id)).size;
    },
  });

  // Monthly active users count
  const { data: monthlyActiveCount } = useQuery({
    queryKey: ["admin-monthly-active"],
    queryFn: async () => {
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      const { data } = await supabase
        .from("lesson_progress")
        .select("user_id")
        .gte("created_at", monthAgo.toISOString());
      if (!data) return 0;
      return new Set(data.map((d) => d.user_id)).size;
    },
  });

  // Weekly bar chart
  const { data: weeklyActivity } = useQuery({
    queryKey: ["admin-weekly-activity"],
    queryFn: async () => {
      const days: { date: string; label: string; count: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const start = new Date(d); start.setHours(0, 0, 0, 0);
        const end = new Date(d); end.setHours(23, 59, 59, 999);
        const { data } = await supabase
          .from("lesson_progress")
          .select("user_id")
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString());
        days.push({
          date: d.toISOString().split("T")[0],
          label: d.toLocaleDateString("en", { weekday: "short", day: "numeric" }),
          count: data ? new Set(data.map((r) => r.user_id)).size : 0,
        });
      }
      return days;
    },
  });

  // Full history (on demand)
  const { data: fullHistory } = useQuery({
    queryKey: ["admin-full-history"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lesson_progress")
        .select("user_id, created_at")
        .order("created_at", { ascending: true });
      if (!data || data.length === 0) return [];
      const map: Record<string, Set<string>> = {};
      data.forEach((r) => {
        const day = r.created_at.split("T")[0];
        if (!map[day]) map[day] = new Set();
        map[day].add(r.user_id);
      });
      return Object.entries(map).map(([date, users]) => ({
        date,
        label: new Date(date).toLocaleDateString("en", { month: "short", day: "numeric" }),
        count: users.size,
      }));
    },
    enabled: showFullHistory,
  });

  // Active users drill-down list
  const { data: activeUsersList } = useQuery({
    queryKey: ["admin-active-users-list", activeUsersView, activeUsersDate],
    queryFn: async () => {
      let startDate = new Date();
      let endDate = new Date();

      if (activeUsersView === "day" && activeUsersDate) {
        startDate = new Date(activeUsersDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(activeUsersDate);
        endDate.setHours(23, 59, 59, 999);
      } else if (activeUsersView === "week") {
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
      } else if (activeUsersView === "month") {
        startDate.setDate(startDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
      }

      const { data: progressData } = await supabase
        .from("lesson_progress")
        .select("user_id")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (!progressData) return [];
      const uniqueIds = [...new Set(progressData.map((d) => d.user_id))];
      if (uniqueIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, registration_number, avatar_url, country, state, town, phone")
        .in("user_id", uniqueIds);

      return profiles || [];
    },
    enabled: !!activeUsersView,
  });

  // Present day attendance query - get students present on selected date
  const { data: presentDayStudents } = useQuery({
    queryKey: ["admin-present-day-students", presentSelectedDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("user_id")
        .eq("date", presentSelectedDate)
        .eq("status", "present");
      if (!data || data.length === 0) return [];
      const uniqueIds = [...new Set(data.map((d) => d.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, registration_number, avatar_url, phone, country, state, town")
        .in("user_id", uniqueIds);
      return profiles || [];
    },
    enabled: presentDayView,
  });

  // Generate date list for horizontal scroll (from first attendance to today)
  const { data: attendanceDateRange } = useQuery({
    queryKey: ["admin-attendance-date-range"],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("date")
        .order("date", { ascending: true })
        .limit(1);
      const firstDate = data?.[0]?.date || new Date().toISOString().split("T")[0];
      const dates: string[] = [];
      const start = new Date(firstDate);
      const end = new Date();
      for (let d = new Date(end); d >= start; d.setDate(d.getDate() - 1)) {
        dates.push(d.toISOString().split("T")[0]);
      }
      return dates;
    },
    enabled: presentDayView,
  });

  // Course enrollments
  const { data: courseEnrollments } = useQuery({
    queryKey: ["admin-course-enrollments"],
    queryFn: async () => {
      const { data: courses } = await supabase.from("courses").select("id, title");
      if (!courses) return [];
      const { data: enrollments } = await supabase.from("enrollments").select("course_id");
      if (!enrollments) return courses.map((c) => ({ ...c, count: 0 }));
      return courses.map((c) => ({
        ...c,
        count: enrollments.filter((e) => e.course_id === c.id).length,
      }));
    },
  });

  const COLORS = ["hsl(var(--primary))", "#06b6d4", "#a855f7", "#ec4899", "#f59e0b", "#10b981", "#6366f1"];

  const handleBarClick = (data: any) => {
    if (data?.activePayload?.[0]?.payload?.date) {
      const d = data.activePayload[0].payload;
      setActiveUsersView("day");
      setActiveUsersDate(d.date);
      setActiveUsersLabel(`Active Students — ${d.label}`);
    }
  };

  const statCards = [
    { label: "Total Students", value: stats?.students ?? 0, icon: Users, onClick: () => navigate("/admin/students") },
    { label: "Present Today", value: presentToday ?? 0, icon: TrendingUp, onClick: () => { setPresentDayView(true); setPresentSelectedDate(new Date().toISOString().split("T")[0]); } },
    { label: "Total Courses", value: stats?.courses ?? 0, icon: BookOpen },
    { label: "Total Lessons", value: stats?.lessons ?? 0, icon: Upload },
  ];

  // Present Day View
  if (presentDayView) {
    return (
      <AdminLayout>
        <div className="space-y-4">
          <button
            onClick={() => setPresentDayView(false)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Overview
          </button>
          <h2 className="text-xl font-bold font-display text-foreground">
            Present Students — {new Date(presentSelectedDate).toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" })}
          </h2>

          {/* Horizontal date scroll */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {attendanceDateRange?.map((date) => {
              const isSelected = date === presentSelectedDate;
              const d = new Date(date);
              const isToday = date === new Date().toISOString().split("T")[0];
              const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
              const isYesterday = date === yesterday.toISOString().split("T")[0];
              return (
                <button
                  key={date}
                  onClick={() => setPresentSelectedDate(date)}
                  className={`shrink-0 px-3 py-2 rounded-lg text-xs font-mono transition-colors ${
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {isToday ? "Today" : isYesterday ? "Yesterday" : d.toLocaleDateString("en", { month: "short", day: "numeric" })}
                </button>
              );
            })}
          </div>

          {presentDayStudents && presentDayStudents.length > 0 ? (
            <div className="space-y-2">
              {presentDayStudents.map((u: any) => (
                <div key={u.user_id} className="cyber-card rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/30 shrink-0">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm font-display">
                        {(u.full_name || "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate">{u.full_name || "Unknown"}</p>
                    <p className="text-[10px] text-primary font-mono">{u.registration_number || "N/A"}</p>
                    {(u.country || u.state || u.town) && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {[u.town, u.state, u.country].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                  {u.phone && (
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">{u.phone}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground font-mono text-sm py-8">No students present on this date.</p>
          )}
        </div>
      </AdminLayout>
    );
  }

  // If showing active users list
  if (activeUsersView) {
    return (
      <AdminLayout>
        <div className="space-y-4">
          <button
            onClick={() => { setActiveUsersView(null); setActiveUsersDate(null); }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Overview
          </button>
          <h2 className="text-xl font-bold font-display text-foreground">{activeUsersLabel}</h2>

          {activeUsersList && activeUsersList.length > 0 ? (
            <div className="space-y-2">
              {activeUsersList.map((u: any) => (
                <div key={u.user_id} className="cyber-card rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/30 shrink-0">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm font-display">
                        {(u.full_name || "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate">{u.full_name || "Unknown"}</p>
                    <p className="text-[10px] text-primary font-mono">{u.registration_number || "N/A"}</p>
                    {(u.country || u.state || u.town) && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {[u.town, u.state, u.country].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                  {u.phone && (
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">{u.phone}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground font-mono text-sm py-8">No active students found.</p>
          )}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold font-display text-foreground mb-0.5">
            Welcome, {firstName}
          </h2>
          <p className="text-muted-foreground text-xs font-mono">Admin Dashboard Overview</p>
        </div>

        {/* Weekly / Monthly Active Users */}
        <div className="grid grid-cols-2 gap-3">
          <div
            className="cyber-card rounded-xl p-4 cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => {
              setActiveUsersView("week");
              setActiveUsersLabel("Weekly Active Students (Last 7 Days)");
            }}
          >
            <Calendar className="h-5 w-5 text-primary mb-1.5" />
            <p className="text-2xl font-bold font-display text-primary">{weeklyActiveCount ?? 0}</p>
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">Weekly Active</p>
          </div>
          <div
            className="cyber-card rounded-xl p-4 cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => {
              setActiveUsersView("month");
              setActiveUsersLabel("Monthly Active Students (Last 30 Days)");
            }}
          >
            <CalendarDays className="h-5 w-5 text-primary mb-1.5" />
            <p className="text-2xl font-bold font-display text-primary">{monthlyActiveCount ?? 0}</p>
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">Monthly Active</p>
          </div>
        </div>

        {/* Weekly Bar Chart - clickable bars */}
        <div
          className="cyber-card rounded-xl p-4 cursor-pointer"
          onClick={() => setShowFullHistory(true)}
        >
          <p className="text-xs font-mono text-muted-foreground mb-3">Student Lesson Visits (Last 7 Days) — Tap a bar to see users</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weeklyActivity || []} onClick={handleBarClick}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis hide allowDecimals={false} domain={[0, (dataMax: number) => Math.max(dataMax, 1)]} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-muted-foreground font-mono text-center mt-1">Tap chart background for full history • Tap a bar for that day's users</p>
        </div>

        {/* Full History Dialog */}
        <Dialog open={showFullHistory} onOpenChange={setShowFullHistory}>
          <DialogContent className="bg-card border-border/50 max-h-[90vh] overflow-y-auto max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display text-foreground">Full Activity History</DialogTitle>
            </DialogHeader>
            <div className="mt-2">
              {fullHistory && fullHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(200, fullHistory.length * 8)}>
                  <BarChart data={fullHistory}>
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis hide allowDecimals={false} domain={[0, (dataMax: number) => Math.max(dataMax, 1)]} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground font-mono text-sm py-8">No activity data yet.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Course enrollment legend */}
        {courseEnrollments && courseEnrollments.length > 0 && (
          <div className="cyber-card rounded-xl p-4">
            <p className="text-xs font-mono text-muted-foreground mb-2">Students per Course</p>
            <div className="flex flex-wrap gap-2">
              {courseEnrollments.map((c, i) => (
                <div key={c.id} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-[11px] font-mono text-foreground">{c.title}: <span className="font-bold">{c.count}</span></span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2x2 Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {statCards.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`cyber-card rounded-xl p-4 ${card.onClick ? "cursor-pointer hover:border-primary/40" : ""}`}
              onClick={card.onClick}
            >
              <card.icon className="h-5 w-5 text-primary mb-1.5" />
              <p className="text-2xl font-bold font-display text-primary">{card.value}</p>
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{card.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
