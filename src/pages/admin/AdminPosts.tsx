import { useState, useRef } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Newspaper, Plus, Trash2, Edit, MessageCircle, Heart, Send, X, Image as ImageIcon, Video, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import RichTextEditor from "@/components/RichTextEditor";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const AdminPosts = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [viewPost, setViewPost] = useState<any>(null);
  const [comment, setComment] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ title: "", content_html: "", image_url: "", video_url: "", link_url: "" });

  const { data: posts } = useQuery({
    queryKey: ["admin-posts"],
    queryFn: async () => {
      const { data } = await supabase.from("posts").select("*").order("created_at", { ascending: false });
      const ids = (data || []).map((p) => p.id);
      const [{ data: likes }, { data: comments }] = await Promise.all([
        supabase.from("post_likes").select("post_id").in("post_id", ids),
        supabase.from("post_comments").select("post_id").in("post_id", ids),
      ]);
      return (data || []).map((p) => ({
        ...p,
        likes_count: likes?.filter((l) => l.post_id === p.id).length || 0,
        comments_count: comments?.filter((c) => c.post_id === p.id).length || 0,
      }));
    },
  });

  const { data: postComments } = useQuery({
    queryKey: ["post-comments-admin", viewPost?.id],
    queryFn: async () => {
      const { data } = await supabase.from("post_comments").select("*").eq("post_id", viewPost.id).order("created_at");
      const userIds = [...new Set((data || []).map((c) => c.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      return (data || []).map((c) => ({ ...c, author: profiles?.find((p) => p.user_id === c.user_id) }));
    },
    enabled: !!viewPost,
  });

  const upload = async (file: File, type: "image" | "video") => {
    const path = `${user!.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("post-media").upload(path, file);
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("post-media").getPublicUrl(path);
    if (type === "image") setForm({ ...form, image_url: data.publicUrl });
    else setForm({ ...form, video_url: data.publicUrl });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from("posts").update({ ...form, content: form.content_html.replace(/<[^>]+>/g, "") }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("posts").insert({ ...form, content: form.content_html.replace(/<[^>]+>/g, ""), created_by: user!.id, is_published: true });
        if (error) throw error;
        // Broadcast to all students
        try {
          const { sendNotification } = await import("@/lib/notifications/api");
          await sendNotification({
            target: "all_students",
            category: "announcement",
            title: form.title || "New announcement",
            body: (form.content_html || "").replace(/<[^>]+>/g, "").slice(0, 200) || undefined,
            image_url: form.image_url || undefined,
            link_url: "/student/feed",
            actions: [{ action: "open", title: "Read" }, { action: "dismiss", title: "Dismiss" }],
          });
        } catch (e) { console.warn("notify announcement failed", e); }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-posts"] });
      setForm({ title: "", content_html: "", image_url: "", video_url: "", link_url: "" });
      setShowForm(false); setEditing(null);
      toast.success("Saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delPost = useMutation({
    mutationFn: async (id: string) => { await supabase.from("posts").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-posts"] }),
  });

  const delComment = useMutation({
    mutationFn: async (id: string) => { await supabase.from("post_comments").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["post-comments-admin"] }),
  });

  const replyComment = useMutation({
    mutationFn: async () => {
      await supabase.from("post_comments").insert({ post_id: viewPost.id, user_id: user!.id, content: comment });
    },
    onSuccess: () => { setComment(""); qc.invalidateQueries({ queryKey: ["post-comments-admin"] }); },
  });

  const openEdit = (p: any) => { setForm({ title: p.title, content_html: p.content_html || p.content, image_url: p.image_url || "", video_url: p.video_url || "", link_url: p.link_url || "" }); setEditing(p); setShowForm(true); };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold font-display">Posts</h1>
        <Button onClick={() => { setEditing(null); setForm({ title: "", content_html: "", image_url: "", video_url: "", link_url: "" }); setShowForm(true); }} size="sm" className="bg-primary text-primary-foreground"><Plus className="h-4 w-4 mr-1" /> NEW POST</Button>
      </div>

      <div className="space-y-3">
        {posts?.map((p) => (
          <div key={p.id} className="cyber-card rounded-xl p-3">
            <div className="flex justify-between items-start gap-2">
              <div onClick={() => setViewPost(p)} className="flex-1 cursor-pointer">
                {p.image_url && <img src={p.image_url} alt="" className="w-full h-32 object-cover rounded mb-2" />}
                <p className="font-bold text-sm">{p.title}</p>
                <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground"><span><Heart className="inline h-3 w-3" /> {p.likes_count}</span><span><MessageCircle className="inline h-3 w-3" /> {p.comments_count}</span></div>
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></button>
                <button onClick={() => confirm("Delete?") && delPost.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></button>
              </div>
            </div>
          </div>
        ))}
        {(!posts || posts.length === 0) && <p className="text-center py-12 text-muted-foreground text-sm">No posts yet</p>}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} Post</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            {form.image_url && <img src={form.image_url} className="w-full h-32 object-cover rounded" />}
            <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "image")} />
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><ImageIcon className="h-3 w-3 mr-1" /> Image</Button>
              <Input placeholder="Video URL" value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} className="flex-1 min-w-[150px] text-xs" />
            </div>
            <Input placeholder="Link URL (optional)" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} />
            <div>
              <p className="text-xs mb-1">Content</p>
              <RichTextEditor content={form.content_html} onChange={(v) => setForm({ ...form, content_html: v })} />
            </div>
            <Button onClick={() => save.mutate()} disabled={!form.title || !form.content_html} className="w-full bg-primary text-primary-foreground">{editing ? "UPDATE" : "PUBLISH"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {viewPost && (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto" onClick={() => setViewPost(null)}>
          <div className="max-w-md mx-auto p-4" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setViewPost(null)} className="mb-2"><X className="h-5 w-5" /></button>
            {viewPost.image_url && <img src={viewPost.image_url} className="w-full rounded mb-3" />}
            <h2 className="text-xl font-bold">{viewPost.title}</h2>
            <div className="prose prose-invert prose-sm mt-2" dangerouslySetInnerHTML={{ __html: viewPost.content_html || viewPost.content }} />
            <div className="border-t border-border/50 pt-3 mt-4">
              <h3 className="font-bold text-sm mb-2">Comments</h3>
              {postComments?.map((c: any) => (
                <div key={c.id} className="bg-muted rounded p-2 text-xs mb-2 flex justify-between items-start gap-2">
                  <div><p className="font-bold">{c.author?.full_name}</p><p>{c.content}</p></div>
                  <button onClick={() => delComment.mutate(c.id)}><Trash2 className="h-3 w-3 text-destructive" /></button>
                </div>
              ))}
              <div className="flex gap-1 mt-2">
                <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Reply..." className="text-sm" />
                <Button size="sm" onClick={() => replyComment.mutate()} disabled={!comment} className="bg-primary text-primary-foreground"><Send className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminPosts;
