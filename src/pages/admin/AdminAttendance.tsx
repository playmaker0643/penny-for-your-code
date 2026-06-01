import AdminLayout from "@/components/AdminLayout";
import { ClipboardCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const AdminAttendance = () => {
  const { data: records, isLoading } = useQuery({
    queryKey: ["admin-attendance"],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*, courses(title)")
        .order("date", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, registration_number");
      return data || [];
    },
  });

  const getStudentName = (userId: string) => {
    const p = profiles?.find((pr) => pr.user_id === userId);
    return p?.full_name || "Unknown";
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold font-display text-foreground">Attendance</h2>
          <p className="text-sm text-muted-foreground">Monitor student attendance and activity</p>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground font-mono animate-pulse text-center py-12">Loading...</p>
        ) : records && records.length > 0 ? (
          <div className="space-y-3">
            {records.map((r) => (
              <div key={r.id} className="cyber-card rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground text-sm">{getStudentName(r.user_id)}</p>
                  {r.courses && <p className="text-xs text-primary font-mono">{(r.courses as any).title}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">{r.date}</p>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${r.status === "present" ? "text-primary bg-primary/10" : "text-destructive bg-destructive/10"}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="cyber-card rounded-xl p-12 text-center">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Attendance Data</h3>
            <p className="text-sm text-muted-foreground">Attendance will be tracked automatically when students access lessons.</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminAttendance;
