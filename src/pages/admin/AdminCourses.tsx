import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { BookOpen, Plus, Trash2, Eye, EyeOff, Settings, Sparkles, Upload, Loader2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

const AdminCourses = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [settingsCourse, setSettingsCourse] = useState<any>(null);
  const [settingsLessons, setSettingsLessons] = useState("");
  const [form, setForm] = useState({ title: "", description: "", category: "", total_lessons_required: "", thumbnail_url: "" });
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [uploadingForCourse, setUploadingForCourse] = useState<string | null>(null);

  const { data: courses, isLoading } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("*").order("created_at", { ascending: true });
      return data || [];
    },
  });

  const createCourse = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("courses").insert({
        title: form.title,
        description: form.description || null,
        category: form.category || null,
        created_by: user!.id,
        is_published: false,
        total_lessons_required: form.total_lessons_required ? parseInt(form.total_lessons_required) : null,
        thumbnail_url: form.thumbnail_url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      setForm({ title: "", description: "", category: "", total_lessons_required: "", thumbnail_url: "" });
      setShowForm(false);
      toast.success("Course saved as draft. Publish when ready.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const togglePublish = useMutation({
    mutationFn: async ({ id, is_published }: { id: string; is_published: boolean }) => {
      const { error } = await supabase.from("courses").update({ is_published: !is_published }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      toast.success("Course updated!");
    },
  });

  const deleteCourse = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Course deleted!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateLessonsRequired = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("courses").update({
        total_lessons_required: settingsLessons ? parseInt(settingsLessons) : null,
      }).eq("id", settingsCourse.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      setSettingsCourse(null);
      toast.success("Updated!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openSettings = (course: any) => {
    setSettingsCourse(course);
    setSettingsLessons(course.total_lessons_required?.toString() || "");
  };

  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `course-thumbnails/${user!.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("post-media").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("post-media").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingThumb(true);
    try {
      const url = await uploadImage(file);
      setForm((f) => ({ ...f, thumbnail_url: url }));
      toast.success("Image uploaded!");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingThumb(false);
    }
  };

  const handleCourseThumbUpload = async (courseId: string, file: File) => {
    setUploadingForCourse(courseId);
    try {
      const url = await uploadImage(file);
      const { error } = await supabase.from("courses").update({ thumbnail_url: url }).eq("id", courseId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      toast.success("Course image updated!");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingForCourse(null);
    }
  };

  const runAiDraft = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-course-content", {
        body: { type: "course", prompt: aiPrompt },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const d = data?.draft || {};
      setForm({
        title: d.title || "",
        description: d.description || "",
        category: d.category || "",
        total_lessons_required: d.total_lessons_required ? String(d.total_lessons_required) : "",
        thumbnail_url: "",
      });
      setAiOpen(false);
      setAiPrompt("");
      setShowForm(true);
      toast.success("Draft ready — review and edit before publishing");
    } catch (err: any) {
      toast.error(err.message || "AI generation failed");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold font-display text-foreground">Manage Courses</h2>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => setAiOpen(true)}
              variant="outline"
              className="font-mono font-bold text-xs border-primary/40 text-primary hover:bg-primary/10"
            >
              <Sparkles className="h-4 w-4 mr-1" /> AI ASSIST
            </Button>
            <Button
              onClick={() => setShowForm(true)}
              className="glow-btn bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold text-xs"
            >
              <Plus className="h-4 w-4 mr-1" /> ADD COURSE
            </Button>
          </div>
        </div>

        {/* AI Assist Dialog */}
        <Dialog open={aiOpen} onOpenChange={setAiOpen}>
          <DialogContent className="bg-card border-border/50">
            <DialogHeader>
              <DialogTitle className="font-display text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> AI Course Assistant
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Describe the course you want. AI drafts the title, category, description and suggested lesson count — you review and edit before publishing.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <Textarea
                placeholder="e.g. A beginner-friendly course on Python for data analysis covering pandas and numpy basics"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="bg-muted border-primary/30 focus:border-primary min-h-[120px]"
              />
              <Button
                onClick={runAiDraft}
                disabled={!aiPrompt.trim() || aiLoading}
                className="w-full glow-btn bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold"
              >
                {aiLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> GENERATING...</> : <><Sparkles className="h-4 w-4 mr-2" /> GENERATE DRAFT</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Course Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="bg-card border-border/50 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-foreground">Review & Save Course</DialogTitle>
              <DialogDescription className="text-muted-foreground">Edit any field before saving. Course is saved as draft; publish it when ready.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-xs text-muted-foreground font-mono block mb-2">Course Image</label>
                {form.thumbnail_url ? (
                  <div className="relative mb-2">
                    <img src={form.thumbnail_url} alt="thumbnail" className="w-full h-36 object-cover rounded-lg" />
                    <button
                      onClick={() => setForm({ ...form, thumbnail_url: "" })}
                      className="absolute top-2 right-2 bg-background/80 hover:bg-background rounded-full p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                ) : null}
                <label className="cyber-card rounded-lg p-3 flex items-center justify-center gap-2 cursor-pointer hover:bg-muted/50 transition-colors">
                  {uploadingThumb ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Upload className="h-4 w-4 text-primary" />}
                  <span className="text-xs font-mono text-muted-foreground">
                    {uploadingThumb ? "Uploading..." : form.thumbnail_url ? "Replace image" : "Upload course image"}
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleThumbUpload} disabled={uploadingThumb} />
                </label>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-mono block mb-2">Course Title</label>
                <Input
                  placeholder="e.g. Frontend Development"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="bg-muted border-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-mono block mb-2">Category</label>
                <Input
                  placeholder="e.g. Easy, Intermediate, Advanced"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="bg-muted border-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-mono block mb-2">How many lessons will this course have?</label>
                <Input
                  type="number"
                  placeholder="e.g. 10"
                  value={form.total_lessons_required}
                  onChange={(e) => setForm({ ...form, total_lessons_required: e.target.value })}
                  className="bg-muted border-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-mono block mb-2">Description</label>
                <Textarea
                  placeholder="Brief description..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="bg-muted border-primary/30 focus:border-primary"
                />
              </div>
              <Button
                onClick={() => createCourse.mutate()}
                disabled={!form.title || createCourse.isPending}
                className="w-full glow-btn bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold"
              >
                {createCourse.isPending ? "SAVING..." : "SAVE AS DRAFT"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Settings Dialog */}
        <Dialog open={!!settingsCourse} onOpenChange={(open) => !open && setSettingsCourse(null)}>
          <DialogContent className="bg-card border-border/50">
            <DialogHeader>
              <DialogTitle className="font-display text-foreground">Course Settings</DialogTitle>
              <DialogDescription className="text-muted-foreground">{settingsCourse?.title}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-xs text-muted-foreground font-mono block mb-2">Total Lessons Required for Completion</label>
                <Input
                  type="number"
                  placeholder="e.g. 10"
                  value={settingsLessons}
                  onChange={(e) => setSettingsLessons(e.target.value)}
                  className="bg-muted border-primary/30 focus:border-primary"
                />
                <p className="text-[10px] text-muted-foreground font-mono mt-1">
                  Students who complete this many lessons will see a green tick on the course.
                </p>
              </div>
              <Button
                onClick={() => updateLessonsRequired.mutate()}
                disabled={updateLessonsRequired.isPending}
                className="w-full glow-btn bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold"
              >
                {updateLessonsRequired.isPending ? "SAVING..." : "SAVE SETTINGS"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <p className="text-muted-foreground font-mono animate-pulse text-center py-12">Loading...</p>
        ) : courses && courses.length > 0 ? (
          <div className="space-y-3">
            {courses.map((course) => (
              <div key={course.id} className="cyber-card rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {course.thumbnail_url ? (
                      <img src={course.thumbnail_url} alt={course.title} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                    ) : (
                      <label className="w-16 h-16 rounded-lg bg-muted border border-dashed border-primary/30 flex items-center justify-center cursor-pointer hover:bg-muted/60 shrink-0">
                        {uploadingForCourse === course.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleCourseThumbUpload(course.id, f);
                          }}
                        />
                      </label>
                    )}
                    <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground font-mono text-sm truncate">{course.title}</h3>
                    {course.category && (
                      <p className="text-xs text-muted-foreground mt-0.5">{course.category}</p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className={`text-xs font-mono ${course.is_published ? "text-primary" : "text-muted-foreground"}`}>
                        {course.is_published ? "Published" : "Draft"}
                      </p>
                      {course.total_lessons_required && (
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {course.total_lessons_required} lessons
                        </span>
                      )}
                      {course.thumbnail_url && (
                        <label className="text-[10px] font-mono text-primary cursor-pointer hover:underline">
                          replace image
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleCourseThumbUpload(course.id, f);
                            }}
                          />
                        </label>
                      )}
                    </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <button
                      onClick={() => openSettings(course)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="Settings"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => togglePublish.mutate({ id: course.id, is_published: course.is_published })}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title={course.is_published ? "Unpublish" : "Publish"}
                    >
                      {course.is_published ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                    <button
                      onClick={() => { if (confirm("Delete this course?")) deleteCourse.mutate(course.id); }}
                      className="text-destructive/70 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="cyber-card rounded-xl p-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2 font-display">No Courses Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first course to get started.</p>
            <Button onClick={() => setShowForm(true)} className="glow-btn bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold text-xs">
              <Plus className="h-4 w-4 mr-1" /> ADD COURSE
            </Button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminCourses;
