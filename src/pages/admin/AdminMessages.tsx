import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { MessageSquare, Bell, Send, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const AdminMessages = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"support" | "message">("support");
  const [showForm, setShowForm] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [messageText, setMessageText] = useState("");
  const [broadcastMode, setBroadcastMode] = useState(false);

  const { data: students } = useQuery({
    queryKey: ["admin-students-for-msg"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "student");
      if (!roles || roles.length === 0) return [];
      const ids = roles.map((r) => r.user_id);
      const { data } = await supabase.from("profiles").select("user_id, full_name, registration_number").in("user_id", ids);
      return data || [];
    },
  });

  // Support messages (from support-chat edge function)
  const { data: supportMessages, isLoading: supportLoading } = useQuery({
    queryKey: ["admin-support-messages", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .like("content", "[Support]%")
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (!data) return [];
      // Enrich with student names
      const enriched = await Promise.all(data.map(async (msg) => {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name, registration_number")
          .eq("user_id", msg.sender_id)
          .single();
        return { ...msg, senderProfile: prof };
      }));
      return enriched;
    },
    enabled: !!user,
  });

  // Regular messages (non-support)
  const { data: regularMessages, isLoading: messagesLoading } = useQuery({
    queryKey: ["admin-regular-messages", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
        .not("content", "like", "[Support]%")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!user,
  });

  // Send message to student or broadcast to all
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (broadcastMode) {
        if (!students || students.length === 0) throw new Error("No students found");
        
        // Send via messages table to all students
        const inserts = students.map((student) => ({
          sender_id: user!.id,
          receiver_id: student.user_id,
          content: messageText,
        }));
        const { error } = await supabase.from("messages").insert(inserts);
        if (error) throw error;

        // Also insert broadcast into each student's chats
        for (const student of students) {
          const { data: memberships } = await supabase
            .from("chat_members")
            .select("chat_id")
            .eq("user_id", student.user_id);
          
          if (memberships && memberships.length > 0) {
            // Insert into all their chats
            for (const m of memberships) {
              await supabase.from("chat_messages").insert({
                chat_id: m.chat_id,
                sender_id: user!.id,
                content: messageText,
                is_admin_broadcast: true,
              });
            }
          }
        }
      } else {
        const { error } = await supabase.from("messages").insert({
          sender_id: user!.id,
          receiver_id: selectedStudent,
          content: messageText,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-regular-messages"] });
      setMessageText("");
      setSelectedStudent("");
      setShowForm(false);
      setBroadcastMode(false);
      toast.success(broadcastMode ? "Broadcast sent to all students!" : "Message sent!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getStudentName = (id: string) => {
    return students?.find((s) => s.user_id === id)?.full_name || "Student";
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <h2 className="text-2xl font-bold font-display text-foreground leading-tight">Messages &<br />Notifications</h2>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          <button
            onClick={() => setActiveTab("support")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-mono font-bold transition-colors ${
              activeTab === "support" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <HelpCircle className="h-4 w-4" />
            Support
          </button>
          <button
            onClick={() => setActiveTab("message")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-mono font-bold transition-colors ${
              activeTab === "message" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Messages
          </button>
        </div>

        {/* Support Tab */}
        {activeTab === "support" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-mono">Student support inquiries from the AI assistant</p>
            {supportLoading ? (
              <p className="text-muted-foreground font-mono animate-pulse text-center py-12">Loading...</p>
            ) : supportMessages && supportMessages.length > 0 ? (
              supportMessages.map((msg: any) => (
                <div key={msg.id} className="cyber-card rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-muted-foreground font-mono">
                        From: <span className="text-foreground font-semibold">{msg.senderProfile?.full_name || "Student"}</span>
                        {msg.senderProfile?.registration_number && (
                          <span className="text-primary ml-1">({msg.senderProfile.registration_number})</span>
                        )}
                      </p>
                      <p className="text-sm text-foreground mt-1">{msg.content.replace("[Support] ", "")}</p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {new Date(msg.created_at).toLocaleDateString()}
                      </p>
                      <p className={`text-[11px] font-mono mt-0.5 ${msg.read ? "text-primary" : "text-muted-foreground"}`}>
                        {msg.read ? "Read" : "Unread"}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="cyber-card rounded-xl p-12 text-center">
                <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2 font-display">No Support Messages</h3>
                <p className="text-sm text-muted-foreground">Student support requests will appear here.</p>
              </div>
            )}
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === "message" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                onClick={() => { setShowForm(true); setBroadcastMode(false); }}
                className="flex-1 glow-btn bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold text-xs"
              >
                <Send className="h-4 w-4 mr-1" /> SEND TO STUDENT
              </Button>
              <Button
                onClick={() => { setShowForm(true); setBroadcastMode(true); }}
                variant="outline"
                className="flex-1 font-mono font-bold text-xs border-primary/30 text-primary"
              >
                <Bell className="h-4 w-4 mr-1" /> BROADCAST ALL
              </Button>
            </div>

            {messagesLoading ? (
              <p className="text-muted-foreground font-mono animate-pulse text-center py-12">Loading...</p>
            ) : regularMessages && regularMessages.length > 0 ? (
              regularMessages.map((msg) => (
                <div key={msg.id} className="cyber-card rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-muted-foreground font-mono">
                        {msg.sender_id === user?.id ? (
                          <>To: <span className="text-foreground font-semibold">{getStudentName(msg.receiver_id)}</span></>
                        ) : (
                          <>From: <span className="text-foreground font-semibold">{getStudentName(msg.sender_id)}</span></>
                        )}
                      </p>
                      <p className="text-sm text-foreground mt-1">{msg.content}</p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-[11px] text-muted-foreground font-mono">{new Date(msg.created_at).toLocaleDateString()}</p>
                      <p className={`text-[11px] font-mono mt-0.5 ${msg.read ? "text-primary" : "text-muted-foreground"}`}>
                        {msg.read ? "Read" : "Unread"}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="cyber-card rounded-xl p-12 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2 font-display">No Messages</h3>
                <p className="text-sm text-muted-foreground">Messages you send will appear here.</p>
              </div>
            )}
          </div>
        )}

        {/* Send Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="bg-card border-border/50">
            <DialogHeader>
              <DialogTitle className="font-display text-foreground">
                {broadcastMode ? "Broadcast to All Students" : "Send Notification"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {broadcastMode
                  ? "This message will be sent to all students as Support Team."
                  : "Send a message to a specific student."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {!broadcastMode && (
                <div>
                  <label className="text-xs text-muted-foreground font-mono block mb-2">Student</label>
                  <select
                    value={selectedStudent}
                    onChange={(e) => setSelectedStudent(e.target.value)}
                    className="w-full bg-muted border border-primary/30 rounded-lg px-3 py-2.5 text-sm text-foreground focus:border-primary outline-none"
                  >
                    <option value="">Select a student</option>
                    {students?.map((s) => (
                      <option key={s.user_id} value={s.user_id}>
                        {s.full_name} {s.registration_number ? `(${s.registration_number})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground font-mono block mb-2">Message</label>
                <Textarea
                  placeholder="Type your message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="bg-muted border-primary/30 focus:border-primary"
                />
              </div>
              <Button
                onClick={() => sendMessage.mutate()}
                disabled={(!broadcastMode && !selectedStudent) || !messageText.trim() || sendMessage.isPending}
                className="w-full glow-btn bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold"
              >
                {sendMessage.isPending ? "SENDING..." : broadcastMode ? "BROADCAST TO ALL" : "SEND NOTIFICATION"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminMessages;
