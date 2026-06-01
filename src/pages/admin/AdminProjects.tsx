import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Download, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function AdminProjects() {
  const qc = useQueryClient();
  const [course, setCourse] = useState<string>("");
  const [active, setActive] = useState<any>(null);
  const [mark, setMark] = useState("");
  const [feedback, setFeedback] = useState("");

  const { data: courses } = useQuery({
    queryKey: ["all-courses"],
    queryFn: async () => (await supabase.from("courses").select("id, title").order("title")).data || [],
  });

  const { data: subs } = useQuery({
    queryKey: ["admin-projects", course],
    queryFn: async () => {
      let q = supabase.from("student_projects").select("*, courses(title)");
      if (course) q = q.eq("course_id", course);
      const { data } = await q.order("created_at", { ascending: false });
      const userIds = [...new Set((data || []).map((s: any) => s.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, registration_number").in("user_id", userIds);
      return (data || []).map((s: any) => ({ ...s, profile: profiles?.find((p) => p.user_id === s.user_id) }));
    },
  });

  const grade = useMutation({
    mutationFn: async () => {
      const m = parseInt(mark);
      if (isNaN(m) || m < 0 || m > 100) throw new Error("Mark must be 0-100");
      const { error } = await supabase.from("student_projects").update({ mark: m, feedback, graded: true, graded_at: new Date().toISOString() }).eq("id", active.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-projects"] });
      setActive(null); setMark(""); setFeedback("");
      toast.success("Graded");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const download = async (path: string) => {
    const { data, error } = await supabase.storage.from("student-projects").createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  const not_marked = (subs || []).filter((s: any) => !s.graded);
  const marked = (subs || []).filter((s: any) => s.graded);

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold font-display mb-4">Student Projects</h1>
      <select value={course} onChange={(e) => setCourse(e.target.value)} className="w-full bg-muted border border-primary/30 rounded-lg px-3 py-2 text-sm mb-3">
        <option value="">All courses</option>
        {courses?.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
      <Tabs defaultValue="not_marked">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="not_marked">Not Marked ({not_marked.length})</TabsTrigger>
          <TabsTrigger value="marked">Marked ({marked.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="not_marked" className="space-y-2 mt-4">
          {not_marked.map((s: any) => (
            <div key={s.id} onClick={() => setActive(s)} className="cyber-card rounded-xl p-3 cursor-pointer hover:border-primary/40">
              <p className="font-bold text-sm">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.profile?.full_name} ({s.profile?.registration_number}) • {s.courses?.title}</p>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="marked" className="space-y-2 mt-4">
          {marked.map((s: any) => (
            <div key={s.id} className="cyber-card rounded-xl p-3 flex justify-between">
              <div>
                <p className="font-bold text-sm">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.profile?.full_name}</p>
              </div>
              <p className="text-primary font-bold">{s.mark}%</p>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={!!active} onOpenChange={() => setActive(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {active && <>
            <DialogHeader><DialogTitle>{active.name}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-xs">{active.profile?.full_name} • {active.profile?.registration_number}</p>
              <p className="text-sm whitespace-pre-wrap">{active.description}</p>
              {active.file_url && <Button size="sm" variant="outline" onClick={() => download(active.file_url)}><Download className="h-4 w-4 mr-1" /> Download ZIP</Button>}
              <Input type="number" placeholder="Mark (0-100)" value={mark} onChange={(e) => setMark(e.target.value)} />
              <Textarea placeholder="Feedback (optional)" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
              <Button onClick={() => grade.mutate()} className="w-full bg-primary text-primary-foreground">SAVE MARK</Button>
            </div>
          </>}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
