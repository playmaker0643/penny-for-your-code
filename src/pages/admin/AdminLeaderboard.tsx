import AdminLayout from "@/components/AdminLayout";
import LeaderboardTable from "@/components/LeaderboardTable";

export default function AdminLeaderboard() {
  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold font-display mb-6">Leaderboard</h1>
      <LeaderboardTable isAdmin />
    </AdminLayout>
  );
}
