import DashboardLayout from "@/components/DashboardLayout";
import LeaderboardTable from "@/components/LeaderboardTable";

export default function StudentLeaderboard() {
  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold font-display mb-6">Leaderboard</h1>
      <LeaderboardTable />
    </DashboardLayout>
  );
}
