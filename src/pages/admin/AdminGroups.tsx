import AdminLayout from "@/components/AdminLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Trash2 } from "lucide-react";
import { toast } from "sonner";

const AdminGroups = () => {
  const qc = useQueryClient();
  const { data: groups, isLoading } = useQuery({
    queryKey: ["admin-groups"],
    queryFn: async () => {
      const { data } = await supabase.from("chats").select("*").eq("is_group", true).order("created_at", { ascending: false });
      const enriched = await Promise.all((data || []).map(async (g: any) => {
        const { count } = await supabase.from("chat_members").select("*", { count: "exact", head: true }).eq("chat_id", g.id);
        return { ...g, memberCount: count || 0 };
      }));
      return enriched;
    },
  });

  const deleteGroup = async (id: string) => {
    if (!confirm("Delete this group permanently?")) return;
    await supabase.from("chat_members").delete().eq("chat_id", id);
    await supabase.from("chats").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-groups"] });
    toast.success("Group deleted");
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold font-display text-foreground">Groups</h1>
        <p className="text-sm text-muted-foreground">All student groups. Admins can delete any group.</p>

        {isLoading ? (
          <p className="text-muted-foreground font-mono py-8 text-center">Loading...</p>
        ) : groups && groups.length > 0 ? (
          <div className="space-y-2">
            {groups.map((g: any) => (
              <div key={g.id} className="cyber-card rounded-xl p-3 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-secondary/20 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{g.group_name || "Untitled Group"}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{g.memberCount} members • {new Date(g.created_at).toLocaleDateString()}</p>
                </div>
                <button onClick={() => deleteGroup(g.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground font-mono py-12">No groups yet</p>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminGroups;
