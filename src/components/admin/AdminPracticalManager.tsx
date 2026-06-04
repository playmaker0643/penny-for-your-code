import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

interface Props { lessonId: string; lessonTitle: string; open: boolean; onClose: () => void }

const empty = {
  title: "", prompt: "", language: "python", starter_code: "", reference_solution: "",
  visible_tests_text: "[]", hidden_tests_text: "[]", difficulty: "easy",
  xp_reward: 20, min_engagement_seconds: 30, required: true, order_index: 0,
};

export default function AdminPracticalManager({ lessonId, lessonTitle, open, onClose }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);

  const { data: practicals, refetch } = useQuery({
    queryKey: ["admin-practicals", lessonId],
    queryFn: async () => {
      const { data } = await supabase.from("lesson_practicals" as any).select("*").eq("lesson_id", lessonId).order("order_index");
      return (data as any[]) || [];
    },
    enabled: open && !!lessonId,
  });

  const save = useMutation({
    mutationFn: async () => {
      let visible_tests: any, hidden_tests: any;
      try { visible_tests = JSON.parse(form.visible_tests_text || "[]"); } catch { throw new Error("Visible tests must be valid JSON array"); }
      try { hidden_tests = JSON.parse(form.hidden_tests_text || "[]"); } catch { throw new Error("Hidden tests must be valid JSON array"); }
      const payload: any = {
        lesson_id: lessonId,
        title: form.title, prompt: form.prompt, language: form.language,
        starter_code: form.starter_code, reference_solution: form.reference_solution || null,
        visible_tests, hidden_tests,
        difficulty: form.difficulty, xp_reward: Number(form.xp_reward),
        min_engagement_seconds: Number(form.min_engagement_seconds),
        required: !!form.required, order_index: Number(form.order_index),
      };
      if (editing?.id) {
        const { error } = await supabase.from("lesson_practicals" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lesson_practicals" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Saved"); setEditing(null); setForm(empty); refetch(); qc.invalidateQueries({ queryKey: ["all-lesson-practicals"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = async (id: string) => {
    if (!confirm("Delete this practical?")) return;
    const { error } = await supabase.from("lesson_practicals" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    refetch();
    qc.invalidateQueries({ queryKey: ["all-lesson-practicals"] });
  };

  const startEdit = (p: any) => {
    setEditing(p);
    setForm({
      title: p.title, prompt: p.prompt, language: p.language,
      starter_code: p.starter_code || "", reference_solution: p.reference_solution || "",
      visible_tests_text: JSON.stringify(p.visible_tests || [], null, 2),
      hidden_tests_text: JSON.stringify(p.hidden_tests || [], null, 2),
      difficulty: p.difficulty, xp_reward: p.xp_reward,
      min_engagement_seconds: p.min_engagement_seconds, required: p.required, order_index: p.order_index,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border/50 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-foreground">Practicals — {lessonTitle}</DialogTitle></DialogHeader>

        <div className="space-y-2">
          {practicals?.map((p) => (
            <div key={p.id} className="cyber-card rounded-lg p-3 flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{p.title} <span className="text-[10px] font-mono text-muted-foreground">[{p.language}/{p.difficulty}/+{p.xp_reward}XP]</span></p>
                <p className="text-xs text-muted-foreground truncate">{p.prompt}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => startEdit(p)}>Edit</Button>
              <Button size="icon" variant="ghost" onClick={() => del(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
          {!practicals?.length && <p className="text-xs text-muted-foreground text-center py-4">No practicals yet.</p>}
        </div>

        <div className="border-t border-border/50 pt-4 space-y-2">
          <p className="text-xs font-mono text-primary">{editing ? "EDIT PRACTICAL" : "NEW PRACTICAL"}</p>
          <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea placeholder="Prompt / problem statement" value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} className="min-h-[80px]" />
          <div className="grid grid-cols-2 gap-2">
            <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="python">Python</SelectItem>
                <SelectItem value="javascript">JavaScript</SelectItem>
                <SelectItem value="java">Java</SelectItem>
                <SelectItem value="cpp">C++</SelectItem>
                <SelectItem value="logic">Logic / Pseudocode</SelectItem>
              </SelectContent>
            </Select>
            <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
                <SelectItem value="boss">Boss</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea placeholder="Starter code (optional)" value={form.starter_code} onChange={(e) => setForm({ ...form, starter_code: e.target.value })} className="font-mono text-xs min-h-[60px]" />
          <Textarea placeholder="Reference solution (hidden from students)" value={form.reference_solution} onChange={(e) => setForm({ ...form, reference_solution: e.target.value })} className="font-mono text-xs min-h-[60px]" />
          <p className="text-[10px] font-mono text-muted-foreground">Visible tests JSON — e.g. [{`{"input":"2 3","expected":"5","description":"adds two numbers"}`}]</p>
          <Textarea value={form.visible_tests_text} onChange={(e) => setForm({ ...form, visible_tests_text: e.target.value })} className="font-mono text-xs min-h-[60px]" />
          <p className="text-[10px] font-mono text-muted-foreground">Hidden tests JSON (not shown to students)</p>
          <Textarea value={form.hidden_tests_text} onChange={(e) => setForm({ ...form, hidden_tests_text: e.target.value })} className="font-mono text-xs min-h-[60px]" />
          <div className="grid grid-cols-3 gap-2">
            <Input type="number" placeholder="XP" value={form.xp_reward} onChange={(e) => setForm({ ...form, xp_reward: e.target.value })} />
            <Input type="number" placeholder="Min engage (s)" value={form.min_engagement_seconds} onChange={(e) => setForm({ ...form, min_engagement_seconds: e.target.value })} />
            <Input type="number" placeholder="Order" value={form.order_index} onChange={(e) => setForm({ ...form, order_index: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-xs font-mono">
            <input type="checkbox" checked={form.required} onChange={(e) => setForm({ ...form, required: e.target.checked })} />
            Required to unlock next lesson
          </label>
          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="flex-1 glow-btn bg-primary text-primary-foreground font-mono font-bold">
              <Save className="h-4 w-4 mr-2" /> {editing ? "UPDATE" : "ADD"}
            </Button>
            {editing && <Button variant="outline" onClick={() => { setEditing(null); setForm(empty); }}>Cancel</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
