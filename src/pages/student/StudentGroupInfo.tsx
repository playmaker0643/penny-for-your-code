import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Users, MoreVertical, MessageSquare, Crown, UserMinus, Shield, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";

const StudentGroupInfo = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [memberMenu, setMemberMenu] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["group-info", chatId],
    queryFn: async () => {
      const { data: chat } = await supabase.from("chats").select("*").eq("id", chatId!).single();
      const { data: members } = await supabase.from("chat_members").select("user_id, is_admin, joined_at").eq("chat_id", chatId!);
      const userIds = (members || []).map((m: any) => m.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url, registration_number").in("user_id", userIds);
      const profMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const enriched = (members || []).map((m: any) => ({ ...m, profile: profMap.get(m.user_id) }));
      enriched.sort((a: any, b: any) => Number(b.is_admin) - Number(a.is_admin));
      return { chat, members: enriched };
    },
    enabled: !!chatId,
  });

  const isMyAdmin = data?.members.find((m: any) => m.user_id === user?.id)?.is_admin;
  const isCreator = data?.chat?.created_by === user?.id;

  const exitGroup = async () => {
    if (!confirm("Exit this group?")) return;
    await supabase.from("chat_members").delete().eq("chat_id", chatId!).eq("user_id", user!.id);
    toast.success("Left group");
    navigate("/student/chat");
  };

  const deleteGroup = async () => {
    if (!confirm("Delete this group permanently?")) return;
    await supabase.from("chat_members").delete().eq("chat_id", chatId!);
    await supabase.from("chats").delete().eq("id", chatId!);
    toast.success("Group deleted");
    navigate("/student/chat");
  };

  const promoteMember = async (uid: string) => {
    await supabase.from("chat_members").update({ is_admin: true }).eq("chat_id", chatId!).eq("user_id", uid);
    qc.invalidateQueries({ queryKey: ["group-info", chatId] });
    toast.success("Promoted to admin");
    setMemberMenu(null);
  };

  const removeMember = async (uid: string) => {
    await supabase.from("chat_members").delete().eq("chat_id", chatId!).eq("user_id", uid);
    qc.invalidateQueries({ queryKey: ["group-info", chatId] });
    toast.success("Member removed");
    setMemberMenu(null);
  };

  const messageMember = (uid: string) => {
    setMemberMenu(null);
    navigate(`/student/chat/dm-${uid}`);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background overflow-y-auto">
      <header className="sticky top-0 z-10 h-14 bg-card border-b border-border/50 flex items-center px-3 gap-3">
        <button onClick={() => navigate(-1)} className="p-2"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="text-base font-bold font-display">Group Info</h1>
      </header>

      <div className="p-4 space-y-5">
        <div className="cyber-card rounded-2xl p-5 text-center">
          <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3 border-4 border-primary/30">
            <Users className="h-10 w-10 text-primary" />
          </div>
          <p className="text-xl font-bold font-display">{data?.chat?.group_name || "Group"}</p>
          <p className="text-xs text-muted-foreground font-mono mt-1">{data?.members.length || 0} members</p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase font-mono text-muted-foreground mb-2 px-1">Members</p>
          <div className="space-y-1">
            {data?.members.map((m: any) => (
              <div key={m.user_id} className="cyber-card rounded-xl p-3 flex items-center gap-3 relative">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-border/50 shrink-0">
                  {m.profile?.avatar_url ? (
                    <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                      {m.profile?.full_name?.charAt(0) || "?"}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate flex items-center gap-1">
                    {m.profile?.full_name || "User"}
                    {m.user_id === user?.id && <span className="text-[10px] text-muted-foreground">(You)</span>}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">{m.profile?.registration_number}</p>
                </div>
                {m.is_admin && (
                  <span className="flex items-center gap-1 text-[10px] text-primary font-mono bg-primary/10 px-2 py-1 rounded-full shrink-0">
                    <Crown className="h-3 w-3" /> Group Admin
                  </span>
                )}
                {m.user_id !== user?.id && (
                  <button onClick={() => setMemberMenu(memberMenu === m.user_id ? null : m.user_id)} className="p-2 text-muted-foreground">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                )}
                {memberMenu === m.user_id && (
                  <div className="absolute right-2 top-12 bg-card border border-border/50 rounded-lg shadow-xl z-20 overflow-hidden min-w-[160px]">
                    <button onClick={() => messageMember(m.user_id)} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted w-full">
                      <MessageSquare className="h-3 w-3" /> Message
                    </button>
                    {isMyAdmin && !m.is_admin && (
                      <button onClick={() => promoteMember(m.user_id)} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted w-full">
                        <Shield className="h-3 w-3" /> Make admin
                      </button>
                    )}
                    {isMyAdmin && (
                      <button onClick={() => removeMember(m.user_id)} className="flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-muted w-full">
                        <UserMinus className="h-3 w-3" /> Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <button onClick={exitGroup} className="w-full cyber-card rounded-xl p-3 flex items-center gap-3 text-destructive">
            <LogOut className="h-4 w-4" /> <span className="text-sm font-mono">Exit Group</span>
          </button>
          {(isCreator || isMyAdmin) && (
            <button onClick={deleteGroup} className="w-full cyber-card rounded-xl p-3 flex items-center gap-3 text-destructive">
              <Trash2 className="h-4 w-4" /> <span className="text-sm font-mono">Delete Group</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentGroupInfo;
