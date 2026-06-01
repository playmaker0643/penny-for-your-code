import DashboardLayout from "@/components/DashboardLayout";
import { Trophy } from "lucide-react";

const StudentAttendance = () => (
  <DashboardLayout>
    <div>
      <h1 className="text-2xl font-bold font-display text-foreground mb-6">Leaderboard</h1>
      <div className="flex flex-col items-center justify-center py-32">
        <Trophy className="h-16 w-16 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground font-mono text-center">
          No leaderboard data yet.
        </p>
        <p className="text-sm text-muted-foreground/60 text-center mt-1">
          Rankings will appear as students complete assignments.
        </p>
      </div>
    </div>
  </DashboardLayout>
);

export default StudentAttendance;
