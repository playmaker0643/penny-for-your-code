import DashboardLayout from "@/components/DashboardLayout";
import { BookOpen, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import SearchBar from "@/components/SearchBar";
import { filterByQuery } from "@/lib/search";

const StudentCourses = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQ, setSearchQ] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["student-profile-lock", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("account_locked, locked_at")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: courses, isLoading } = useQuery({
    queryKey: ["student-courses", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!user,
  });

  const isLocked = profile?.account_locked === true;

  return (
    <DashboardLayout>
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground mb-4">My Courses</h1>
        <SearchBar value={searchQ} onChange={setSearchQ} placeholder="Search courses by name or description..." className="mb-4" />

        {isLocked && (
          <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/30 flex items-start gap-3">
            <Lock className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">Your courses are locked</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your course access has been restricted. Please visit the{" "}
                <button onClick={() => navigate("/student/support")} className="text-primary underline">Support</button>
                {" "}page to resolve this issue.
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <p className="text-muted-foreground font-mono animate-pulse">Loading...</p>
          </div>
        ) : courses && courses.length > 0 ? (
          <div className="space-y-4">
            {filterByQuery(courses, searchQ, (c: any) => c.title, (c: any) => c.description).map((course: any) => (
              <div
                key={course.id}
                className={`cyber-card rounded-xl p-4 ${isLocked ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
                onClick={() => !isLocked && navigate(`/student/courses/${course.id}`)}
              >
                {course.thumbnail_url && (
                  <img src={course.thumbnail_url} alt={course.title} className="w-full h-36 object-cover rounded-lg mb-3" />
                )}
                <h3 className="font-semibold text-foreground">{course.title}</h3>
                {course.category && (
                  <span className="inline-block text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded mt-1">
                    {course.category}
                  </span>
                )}
                <p className="text-sm text-muted-foreground mt-1">{course.description}</p>
                {isLocked && (
                  <div className="mt-2 flex items-center gap-1 text-destructive">
                    <Lock className="h-3 w-3" />
                    <span className="text-[10px] font-mono">Locked</span>
                  </div>
                )}
              </div>
            ))}
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

export default StudentCourses;
