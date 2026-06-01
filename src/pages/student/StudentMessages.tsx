import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Mail } from "lucide-react";

const StudentMessages = () => {
  const { user } = useAuth();

  const { data: messages } = useQuery({
    queryKey: ["student-messages", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("receiver_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  return (
    <DashboardLayout>
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold font-display text-foreground">Messages</h1>
          <button className="flex items-center gap-1 text-primary text-sm font-medium">
            <Bell className="h-4 w-4" />
            <span>New</span>
          </button>
        </div>

        {messages && messages.length > 0 ? (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className="neon-border rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      From: <span className="font-semibold text-foreground">Instructor</span>
                    </p>
                    <p className="text-sm text-foreground mt-1">{msg.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(msg.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32">
            <Mail className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground font-mono text-center">No messages yet.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentMessages;
