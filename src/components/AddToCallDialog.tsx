import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  callId: string;
  callType: "voice" | "video";
  callerId: string;
}

const AddToCallDialog = ({ isOpen, onClose, callId, callType, callerId }: Props) => {
  const [chats, setChats] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    (async () => {
      // Direct chats from messages
      const { data: directMessages } = await supabase.from("messages").select("sender_id, receiver_id")
        .or(`sender_id.eq.${callerId},receiver_id.eq.${callerId}`);
      const otherIds = new Set<string>();
      (directMessages || []).forEach((m: any) => {
        const other = m.sender_id === callerId ? m.receiver_id : m.sender_id;
        if (other && other !== callerId) otherIds.add(other);
      });
      const ids = Array.from(otherIds);
      if (ids.length === 0) { setChats([]); setLoading(false); return; }
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, avatar_url, registration_number").in("user_id", ids),
        supabase.from("user_roles").select("user_id, role").in("user_id", ids),
      ]);
      const adminIds = new Set((roles || []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id));
      setChats((profiles || []).filter((p: any) => !adminIds.has(p.user_id)));
      setLoading(false);
    })();
  }, [isOpen, callerId]);

  const inviteUser = async (userId: string, name: string) => {
    // Create a child call row pointing to the parent so receiver navigates into the same call
    const { error } = await supabase.from("calls").insert({
      caller_id: callerId,
      receiver_id: userId,
      call_type: callType,
      parent_call_id: callId,
    });
    if (error) { toast.error("Failed to invite"); return; }
    toast.success(`Invited ${name} to the call`);
    onClose();
  };

  if (!isOpen) return null;

  const filtered = chats.filter((c: any) =>
    !search.trim() ||
    c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.registration_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl border border-border/50 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border/30">
          <p className="text-sm font-bold flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" /> Add to call</p>
          <button onClick={onClose} className="p-1"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search friends..."
              className="w-full bg-muted border border-border/30 rounded-xl pl-9 pr-3 py-2 text-base outline-none"
              style={{ fontSize: 16 }}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {loading ? (
            <p className="text-center text-xs text-muted-foreground py-6 font-mono">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-6">No friends to invite</p>
          ) : (
            filtered.map((c: any) => (
              <button key={c.user_id} onClick={() => inviteUser(c.user_id, c.full_name || "User")}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-border/50 shrink-0">
                  {c.avatar_url ? <img src={c.avatar_url} alt="" className="w-full h-full object-cover" /> :
                    <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                      {c.full_name?.charAt(0).toUpperCase() || "?"}
                    </div>}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-bold truncate">{c.full_name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{c.registration_number}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AddToCallDialog;
