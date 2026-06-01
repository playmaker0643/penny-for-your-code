import DashboardLayout from "@/components/DashboardLayout";
import { BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const StudentGrades = () => {
  const { user } = useAuth();

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["student-grades", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("exam_submissions")
        .select("*, exams(title, max_score)")
        .eq("user_id", user!.id)
        .eq("graded", true)
        .order("graded_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  return (
    <DashboardLayout>
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground mb-6">Grades</h1>

        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <p className="text-muted-foreground font-mono animate-pulse">Loading...</p>
          </div>
        ) : submissions && submissions.length > 0 ? (
          <div className="space-y-3">
            {submissions.map((sub) => (
              <div key={sub.id} className="cyber-card rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground text-sm">
                    {sub.exams ? (sub.exams as any).title : "Assignment"}
                  </h3>
                  {sub.graded_at && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Graded: {new Date(sub.graded_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary font-mono">
                    {sub.score ?? "—"}/{sub.exams ? (sub.exams as any).max_score : 100}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32">
            <BarChart3 className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground font-mono text-center">No grades available yet.</p>
            <p className="text-sm text-muted-foreground/60 text-center mt-1">
              Your grades will appear here once assignments are graded.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentGrades;
