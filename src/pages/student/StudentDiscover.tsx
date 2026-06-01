import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Heart, MessageCircle, Link2, ArrowLeft, Eye, Lock, Copy as CopyIcon, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import SearchBar from "@/components/SearchBar";
import { filterByQuery } from "@/lib/search";

const SHARE_DOMAIN = "https://elearning.codebreakers.uk";

const buildPreview = (files: any[]) => {
  const html = files.find((f: any) => f.path?.endsWith("index.html"))?.content || "<h1>No preview</h1>";
  const css = files.filter((f: any) => f.path?.endsWith(".css")).map((f: any) => f.content).join("\n");
  const js = files.filter((f: any) => f.path?.endsWith(".js")).map((f: any) => f.content).join("\n");
  return `<!doctype html><html><head><style>${css}</style></head><body>${html}<script>${js}<\/script></body></html>`;
};

export default function StudentDiscover() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openProject, setOpenProject] = useState<any>(null);
  const [comment, setComment] = useState("");
  const [searchQ, setSearchQ] = useState("");

  const { data: projects } = useQuery({
    queryKey: ["discover-projects"],
    queryFn: async () => {
      const { data } = await supabase.from("public_projects").select("*").eq("is_public", true).order("created_at", { ascending: false });
      if (!data) return [];
      const userIds = [...new Set(data.map((p) => p.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds);
      const ids = data.map((d) => d.id);
      const { data: likes } = await supabase.from("project_likes").select("project_id, user_id").in("project_id", ids);
      const { data: comments } = await supabase.from("project_comments").select("project_id").in("project_id", ids);
      return data.map((p) => ({
        ...p,
        author: profiles?.find((pr) => pr.user_id === p.user_id),
        likes_count: likes?.filter((l) => l.project_id === p.id).length || 0,
        liked_by_me: !!likes?.find((l) => l.project_id === p.id && l.user_id === user?.id),
        comments_count: comments?.filter((c) => c.project_id === p.id).length || 0,
      }));
    },
    enabled: !!user,
    refetchInterval: 5000,
  });

  useEffect(() => {
    const ch = supabase.channel("public-projects-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "public_projects" },
        () => qc.invalidateQueries({ queryKey: ["discover-projects"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const { data: projectComments } = useQuery({
    queryKey: ["project-comments", openProject?.id],
    queryFn: async () => {
      const { data } = await supabase.from("project_comments").select("*").eq("project_id", openProject.id).order("created_at");
      const userIds = [...new Set((data || []).map((c) => c.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds);
      return (data || []).map((c) => ({ ...c, author: profiles?.find((p) => p.user_id === c.user_id) }));
    },
    enabled: !!openProject,
  });

  const toggleLike = useMutation({
    mutationFn: async ({ id, liked }: any) => {
      if (liked) await supabase.from("project_likes").delete().eq("project_id", id).eq("user_id", user!.id);
      else await supabase.from("project_likes").insert({ project_id: id, user_id: user!.id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["discover-projects"] }),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("project_comments").insert({ project_id: openProject.id, user_id: user!.id, content: comment });
      if (error) throw error;
    },
    onSuccess: () => {
      setComment("");
      qc.invalidateQueries({ queryKey: ["project-comments"] });
      qc.invalidateQueries({ queryKey: ["discover-projects"] });
    },
  });

  const copyLink = async (p: any) => {
    const url = `${SHARE_DOMAIN}/preview/${p.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Project link copied!");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const cloneProject = async (p: any) => {
    if (p.allow_clone === false) return toast.error("Cloning is disabled by the author");
    const newName = prompt("Rename your cloned project:", `${p.name} (copy)`);
    if (!newName || !newName.trim()) return;
    const { error } = await supabase.from("public_projects").insert({
      user_id: user!.id,
      name: newName.trim(),
      description: p.description,
      files: p.files,
      is_public: false,
    });
    if (error) return toast.error(error.message);
    toast.success("Cloned to your projects!");
  };

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold font-display mb-4">Discover</h1>
      <SearchBar value={searchQ} onChange={setSearchQ} placeholder="Search by name or description..." className="mb-4" />
      <div className="space-y-3">
        {filterByQuery(projects, searchQ, (p: any) => p.name, (p: any) => p.description)?.map((p) => (
          <div key={p.id} className="cyber-card rounded-xl p-4 relative">
            {/* Clone button top-right corner */}
            {p.allow_clone !== false ? (
              <button
                onClick={() => cloneProject(p)}
                className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-mono bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary/20"
                title="Clone project"
              >
                <CopyIcon className="h-3 w-3" /> Clone
              </button>
            ) : (
              <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-mono text-muted-foreground" title="Clone disabled">
                <Lock className="h-3 w-3" /> Locked
              </span>
            )}

            <div className="flex items-center gap-2 mb-2 pr-16">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {p.author?.full_name?.charAt(0) || "?"}
              </div>
              <div className="flex-1">
                <p className="text-xs font-mono">{p.author?.full_name}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <h3 className="font-bold">{p.name}</h3>
            {p.description && <p className="text-xs text-muted-foreground mb-2">{p.description}</p>}
            <button
              onClick={() => setOpenProject(p)}
              className="block w-full"
              title="Open full preview"
            >
              <iframe srcDoc={buildPreview(p.files as any)} className="w-full h-32 bg-white rounded mt-2 pointer-events-none" sandbox="allow-scripts" />
            </button>
            <div className="flex items-center gap-3 mt-3 text-xs">
              <button onClick={() => toggleLike.mutate({ id: p.id, liked: p.liked_by_me })} className="flex items-center gap-1">
                <Heart className={`h-4 w-4 ${p.liked_by_me ? "fill-red-500 text-red-500" : ""}`} /> {p.likes_count}
              </button>
              <button onClick={() => setOpenProject(p)} className="flex items-center gap-1"><MessageCircle className="h-4 w-4" /> {p.comments_count}</button>
              <button onClick={() => copyLink(p)} className="flex items-center gap-1" title="Copy link"><Link2 className="h-4 w-4" /> Copy</button>
              <button onClick={() => setOpenProject(p)} className="flex items-center gap-1 ml-auto text-primary"><Eye className="h-4 w-4" /> View Project</button>
            </div>
          </div>
        ))}
        {(!projects || projects.length === 0) && <p className="text-center py-12 text-muted-foreground text-sm">No public projects yet.</p>}
      </div>

      {/* View Project overlay: 80% width preview, 45% height; comment input below preview; comments listed below input with author avatars */}
      {openProject && (
        <div className="fixed inset-0 z-50 bg-background/95 overflow-y-auto" onClick={() => setOpenProject(null)}>
          <div onClick={(e) => e.stopPropagation()} className="mx-auto py-4 px-2" style={{ width: "80%" }}>
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setOpenProject(null)} className="flex items-center gap-1 text-sm"><ArrowLeft className="h-5 w-5" /> Back</button>
              <h2 className="text-lg font-bold truncate max-w-[60%]">{openProject.name}</h2>
              <div className="flex gap-1">
                <button onClick={() => copyLink(openProject)} className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-muted hover:bg-muted/70"><Link2 className="h-3 w-3" /> Copy</button>
                {openProject.allow_clone !== false && (
                  <button onClick={() => cloneProject(openProject)} className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary"><CopyIcon className="h-3 w-3" /> Clone</button>
                )}
              </div>
            </div>

            {/* 80% width × 45% viewport-height preview. Click opens UI-less full preview. */}
            <button
              type="button"
              onClick={() => window.open(`/preview/${openProject.id}`, "_blank", "noopener,noreferrer")}
              className="block w-full"
              title="Open full preview"
              style={{ height: "45vh" }}
            >
              <iframe
                srcDoc={buildPreview(openProject.files as any)}
                className="w-full h-full bg-white rounded pointer-events-none"
                sandbox="allow-scripts"
              />
            </button>

            {/* Comment input directly below the preview */}
            <div className="flex gap-1 mt-3">
              <Input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Write a comment..."
                className="bg-muted text-sm"
              />
              <Button size="sm" onClick={() => addComment.mutate()} disabled={!comment} className="bg-primary text-primary-foreground">
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {/* All comments below the input — each with the commenter avatar */}
            <div className="space-y-2 mt-3">
              <h3 className="font-bold text-sm">Comments</h3>
              {projectComments?.map((c: any) => (
                <div key={c.id} className="flex gap-2 bg-muted rounded p-2 text-xs">
                  <div className="w-7 h-7 rounded-full overflow-hidden bg-background shrink-0">
                    {c.author?.avatar_url ? (
                      <img src={c.author.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-primary">
                        {c.author?.full_name?.charAt(0) || "?"}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold">{c.author?.full_name || "Unknown"}</p>
                    <p className="break-words">{c.content}</p>
                  </div>
                </div>
              ))}
              {projectComments?.length === 0 && <p className="text-xs text-muted-foreground">No comments yet — be the first.</p>}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
