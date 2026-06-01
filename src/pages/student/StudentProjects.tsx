import { useState, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FolderKanban, Plus, Upload, X, FileArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SearchBar from "@/components/SearchBar";
import { filterByQuery } from "@/lib/search";

export default function StudentProjects() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", course_id: "", description: "", public_project_id: "" });
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [searchQ, setSearchQ] = useState("");

  const { data: courses } = useQuery({
    queryKey: ["pub-courses"],
    queryFn: async () => (await supabase.from("courses").select("id, title").eq("is_published", true)).data || [],
  });

  const { data: myProjects } = useQuery({
    queryKey: ["my-public-projects-list", user?.id],
    queryFn: async () => (await supabase.from("public_projects").select("id, name").eq("user_id", user!.id)).data || [],
    enabled: !!user,
  });

  const { data: submissions } = useQuery({
    queryKey: ["my-project-subs", user?.id],
    queryFn: async () => (await supabase.from("student_projects").select("*, courses(title)").eq("user_id", user!.id).order("created_at", { ascending: false })).data || [],
    enabled: !!user,
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!form.name || !form.course_id || form.description.length < 100) {
        throw new Error("Name, course and description (min 100 chars) required");
      }
      let file_url = null;
      if (zipFile) {
        const path = `${user!.id}/${Date.now()}-${zipFile.name}`;
        const { error } = await supabase.storage.from("student-projects").upload(path, zipFile);
        if (error) throw error;
        file_url = path;
      }
      const { error } = await supabase.from("student_projects").insert({
        user_id: user!.id,
        course_id: form.course_id,
        name: form.name,
        description: form.description,
        file_url,
        public_project_id: form.public_project_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-project-subs"] });
      setShowAdd(false); setForm({ name: "", course_id: "", description: "", public_project_id: "" }); setZipFile(null);
      toast.success("Submitted!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const submitted = (submissions || []).filter((s: any) => !s.graded);
  const marked = (submissions || []).filter((s: any) => s.graded);

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold font-display mb-4">My Projects</h1>
      <SearchBar value={searchQ} onChange={setSearchQ} placeholder="Search by name or description..." className="mb-4" />
      <Tabs defaultValue="add">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="add">Add</TabsTrigger>
          <TabsTrigger value="submitted">Submitted ({submitted.length})</TabsTrigger>
          <TabsTrigger value="marked">Marked ({marked.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="add">
          <Button onClick={() => setShowAdd(true)} className="w-full bg-primary text-primary-foreground mt-4"><Plus className="h-4 w-4 mr-1" /> Add Project</Button>
        </TabsContent>
        <TabsContent value="submitted" className="space-y-2 mt-4">
          {filterByQuery(submitted, searchQ, (s: any) => s.name, (s: any) => s.description).map((s: any) => (
            <div key={s.id} className="cyber-card rounded-xl p-3">
              <p className="font-bold text-sm">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.courses?.title} • Awaiting marking</p>
            </div>
          ))}
          {submitted.length === 0 && <p className="text-center py-8 text-sm text-muted-foreground">None submitted</p>}
        </TabsContent>
        <TabsContent value="marked" className="space-y-2 mt-4">
          {filterByQuery(marked, searchQ, (s: any) => s.name, (s: any) => s.description).map((s: any) => (
            <div key={s.id} className="cyber-card rounded-xl p-3">
              <div className="flex justify-between"><p className="font-bold text-sm">{s.name}</p><p className="text-primary font-bold">{s.mark}%</p></div>
              <p className="text-xs text-muted-foreground">{s.courses?.title}</p>
              {s.feedback && <p className="text-xs mt-1 italic">"{s.feedback}"</p>}
            </div>
          ))}
          {marked.length === 0 && <p className="text-center py-8 text-sm text-muted-foreground">None marked yet</p>}
        </TabsContent>
      </Tabs>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Project</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })} className="w-full bg-muted border border-primary/30 rounded-lg px-3 py-2.5 text-sm">
              <option value="">Select course</option>
              {courses?.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <Textarea placeholder="Description (min 100 chars)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-[120px]" />
            <p className="text-[10px] text-muted-foreground">{form.description.length} / 100</p>

            <input type="file" accept=".zip" ref={fileRef} className="hidden" onChange={(e) => setZipFile(e.target.files?.[0] || null)} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="w-full"><Upload className="h-4 w-4 mr-1" /> {zipFile ? zipFile.name : "Upload ZIP"}</Button>

            <div className="text-center text-xs text-muted-foreground">— OR —</div>
            <select value={form.public_project_id} onChange={(e) => setForm({ ...form, public_project_id: e.target.value })} className="w-full bg-muted border border-primary/30 rounded-lg px-3 py-2.5 text-sm">
              <option value="">Import from public project (optional)</option>
              {myProjects?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <Button onClick={() => submit.mutate()} disabled={submit.isPending} className="w-full bg-primary text-primary-foreground">{submit.isPending ? "Submitting..." : "SUBMIT"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
