import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Users, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const StudentCreateGroup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [groupName, setGroupName] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<{ id: string; name: string; regNum: string }[]>([]);

  // Fetch existing friends (accepted friend requests)
  const { data: friends } = useQuery({
    queryKey: ["my-friends", user?.id],
    queryFn: async () => {
      const { data: requests } = await supabase
        .from("friend_requests")
        .select("sender_id, receiver_id")
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
        .eq("status", "accepted");
      
      if (!requests) return [];
      const friendIds = requests.map((r: any) => r.sender_id === user!.id ? r.receiver_id : r.sender_id);
      if (friendIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, registration_number, avatar_url")
        .in("user_id", friendIds);
      return profiles || [];
    },
    enabled: !!user,
  });

  const addMemberByRegNum = async () => {
    if (!memberInput.trim()) return;
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, registration_number")
      .eq("registration_number", memberInput.trim())
      .single();
    
    if (!data) { toast.error("User not found"); return; }
    if (data.user_id === user!.id) { toast.error("That's you!"); return; }
    if (selectedMembers.find(m => m.id === data.user_id)) { toast.error("Already added"); return; }
    
    setSelectedMembers(prev => [...prev, { id: data.user_id, name: data.full_name, regNum: data.registration_number || "" }]);
    setMemberInput("");
  };

  const toggleFriend = (friend: any) => {
    if (selectedMembers.find(m => m.id === friend.user_id)) {
      setSelectedMembers(prev => prev.filter(m => m.id !== friend.user_id));
    } else {
      setSelectedMembers(prev => [...prev, { id: friend.user_id, name: friend.full_name, regNum: friend.registration_number || "" }]);
    }
  };

  const createGroup = useMutation({
    mutationFn: async () => {
      if (!groupName.trim()) throw new Error("Group name required");
      if (selectedMembers.length === 0) throw new Error("Add at least one member");

      // Create group chat
      const { data: chat, error } = await supabase
        .from("chats")
        .insert({ is_group: true, group_name: groupName.trim(), created_by: user!.id })
        .select()
        .single();
      if (error) throw error;

      // Add self as admin member
      await supabase.from("chat_members").insert({ chat_id: chat.id, user_id: user!.id, is_admin: true });

      // Send invitations to selected members
      const invitations = selectedMembers.map(m => ({
        chat_id: chat.id,
        inviter_id: user!.id,
        invitee_id: m.id,
      }));
      await supabase.from("group_invitations").insert(invitations);

      return chat;
    },
    onSuccess: (chat) => {
      toast.success("Group created! Invitations sent.");
      navigate(`/student/chat/${chat.id}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="h-14 bg-card border-b border-border/50 flex items-center px-4 gap-3 shrink-0">
        <button onClick={() => navigate("/student/chat")} className="text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold font-display text-foreground">Create Group</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="text-xs text-muted-foreground font-mono block mb-2">Group Name</label>
          <Input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Enter group name"
            className="bg-muted border-border/50"
          />
        </div>

        {/* Add by registration number */}
        <div>
          <label className="text-xs text-muted-foreground font-mono block mb-2">Add by Registration Number</label>
          <div className="flex gap-2">
            <Input
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              placeholder="e.g. CBS260001"
              className="bg-muted border-border/50 flex-1"
            />
            <Button onClick={addMemberByRegNum} size="icon" variant="outline" className="shrink-0">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Selected members */}
        {selectedMembers.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground font-mono mb-2">Selected ({selectedMembers.length})</p>
            <div className="flex flex-wrap gap-2">
              {selectedMembers.map((m) => (
                <span key={m.id} className="flex items-center gap-1 bg-primary/20 text-primary text-xs font-mono px-2 py-1 rounded-full">
                  {m.name}
                  <button onClick={() => setSelectedMembers(prev => prev.filter(x => x.id !== m.id))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Friends list */}
        {friends && friends.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground font-mono mb-2">Your Friends</p>
            <div className="space-y-1">
              {friends.map((friend: any) => {
                const isSelected = selectedMembers.some(m => m.id === friend.user_id);
                return (
                  <button
                    key={friend.user_id}
                    onClick={() => toggleFriend(friend)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      isSelected ? "bg-primary/10 border border-primary/30" : "bg-card hover:bg-muted/50"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full overflow-hidden border border-border/50 shrink-0">
                      {friend.avatar_url ? (
                        <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                          {friend.full_name?.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{friend.full_name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{friend.registration_number}</p>
                    </div>
                    {isSelected && <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center"><Users className="h-3 w-3 text-primary-foreground" /></div>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 p-4 border-t border-border/50 bg-card">
        <Button
          onClick={() => createGroup.mutate()}
          disabled={!groupName.trim() || selectedMembers.length === 0 || createGroup.isPending}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold"
        >
          {createGroup.isPending ? "CREATING..." : `CREATE GROUP (${selectedMembers.length} members)`}
        </Button>
      </div>
    </div>
  );
};

export default StudentCreateGroup;
