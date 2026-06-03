import DashboardLayout from "@/components/DashboardLayout";
import { CalendarCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const todayISO = () => new Date().toISOString().slice(0, 10);

const StudentAttendance = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: today } = useQuery({
    queryKey: ["attendance-today", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("id,status,date")
        .eq("user_id", user!.id)
        .eq("date", todayISO())
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: history } = useQuery({
    queryKey: ["attendance-history", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("id,status,date")
        .eq("user_id", user!.id)
        .order("date", { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: !!user,
  });

  const checkIn = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("attendance")
        .insert({ user_id: user!.id, date: todayISO(), status: "present" });
      if (error && !/duplicate/i.test(error.message)) throw error;
    },
    onSuccess: () => {
      toast.success("Checked in for today!");
      qc.invalidateQueries({ queryKey: ["attendance-today", user?.id] });
      qc.invalidateQueries({ queryKey: ["attendance-history", user?.id] });
      qc.invalidateQueries({ queryKey: ["student-attendance-month", user?.id] });
    },
    onError: (e: any) => toast.error(e.message || "Check-in failed"),
  });

  const checked = !!today;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Attendance</h1>
          <p className="text-sm text-muted-foreground">Check in each day you study.</p>
        </div>

        <div className="cyber-card rounded-xl p-6 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            {checked ? (
              <CheckCircle2 className="h-7 w-7 text-green-500" />
            ) : (
              <CalendarCheck className="h-7 w-7 text-primary" />
            )}
          </div>
          <h2 className="font-semibold text-foreground">
            {checked ? "You're checked in today" : "Mark today's attendance"}
          </h2>
          <p className="text-xs text-muted-foreground mt-1 mb-4">{todayISO()}</p>
          <Button
            onClick={() => checkIn.mutate()}
            disabled={checked || checkIn.isPending}
            className="glow-btn bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold text-xs"
          >
            {checked ? "ALREADY CHECKED IN" : checkIn.isPending ? "CHECKING IN..." : "CHECK IN"}
          </Button>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Recent history</h3>
          {history && history.length > 0 ? (
            <div className="space-y-2">
              {history.map((r) => (
                <div key={r.id} className="cyber-card rounded-lg p-3 flex items-center justify-between">
                  <span className="text-sm text-foreground font-mono">{r.date}</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${r.status === "present" ? "text-primary bg-primary/10" : "text-destructive bg-destructive/10"}`}>
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No attendance yet.</p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentAttendance;
