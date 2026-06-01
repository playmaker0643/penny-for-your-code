import DashboardLayout from "@/components/DashboardLayout";
import { Newspaper, Heart, MessageCircle, X, Send, ArrowLeft } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import SearchBar from "@/components/SearchBar";
import { filterByQuery } from "@/lib/search";

const StudentFeed = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openPost, setOpenPost] = useState<any>(null);
  const [comment, setComment] = useState("");
  const [searchQ, setSearchQ] = useState("");

  const { data: posts } = useQuery({
    queryKey: ["student-updates"],
    queryFn: async () => {
      const { data } = await supabase.from("posts").select("*").eq("is_published", true).order("created_at", { ascending: false });
      const ids = (data || []).map((p) => p.id);
      const [{ data: likes }, { data: comments }] = await Promise.all([
        supabase.from("post_likes").select("post_id, user_id").in("post_id", ids),
        supabase.from("post_comments").select("post_id").in("post_id", ids),
      ]);
      return (data || []).map((p) => ({
        ...p,
        likes_count: likes?.filter((l) => l.post_id === p.id).length || 0,
        liked_by_me: !!likes?.find((l) => l.post_id === p.id && l.user_id === user?.id),
        comments_count: comments?.filter((c) => c.post_id === p.id).length || 0,
      }));
    },
    enabled: !!user,
  });

  const { data: postComments } = useQuery({
    queryKey: ["student-post-comments", openPost?.id],
    queryFn: async () => {
      const { data } = await supabase.from("post_comments").select("*").eq("post_id", openPost.id).order("created_at");
      const userIds = [...new Set((data || []).map((c) => c.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds);
      return (data || []).map((c) => ({ ...c, author: profiles?.find((p) => p.user_id === c.user_id) }));
    },
    enabled: !!openPost,
  });

  const toggleLike = useMutation({
    mutationFn: async ({ id, liked }: any) => {
      if (liked) await supabase.from("post_likes").delete().eq("post_id", id).eq("user_id", user!.id);
      else await supabase.from("post_likes").insert({ post_id: id, user_id: user!.id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["student-updates"] }),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      await supabase.from("post_comments").insert({ post_id: openPost.id, user_id: user!.id, content: comment });
    },
    onSuccess: () => { setComment(""); qc.invalidateQueries({ queryKey: ["student-post-comments"] }); qc.invalidateQueries({ queryKey: ["student-updates"] }); },
  });

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold font-display mb-4">Updates</h1>
      <SearchBar value={searchQ} onChange={setSearchQ} placeholder="Search updates..." className="mb-4" />
      <div className="space-y-3">
        {filterByQuery(posts, searchQ, (p: any) => p.title, (p: any) => p.content).map((p: any) => (
          <div key={p.id} onClick={() => setOpenPost(p)} className="cyber-card rounded-xl p-3 cursor-pointer hover:border-primary/40">
            {p.image_url && <img src={p.image_url} className="w-full h-32 object-cover rounded mb-2" />}
            <p className="font-bold text-sm">{p.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{p.content}</p>
            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
              <span><Heart className={`inline h-3 w-3 ${p.liked_by_me ? "fill-red-500 text-red-500" : ""}`} /> {p.likes_count}</span>
              <span><MessageCircle className="inline h-3 w-3" /> {p.comments_count}</span>
              <span className="ml-auto">{new Date(p.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
        {(!posts || posts.length === 0) && <p className="text-center py-12 text-muted-foreground text-sm">No updates yet</p>}
      </div>

      {openPost && (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto" onClick={() => setOpenPost(null)}>
          <div className="max-w-md mx-auto p-4" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpenPost(null)} className="mb-2"><ArrowLeft className="h-5 w-5" /></button>
            {openPost.image_url && <img src={openPost.image_url} className="w-full rounded mb-3" />}
            {openPost.video_url && <video src={openPost.video_url} controls className="w-full rounded mb-3" />}
            <h2 className="text-xl font-bold">{openPost.title}</h2>
            <div className="prose prose-invert prose-sm mt-2" dangerouslySetInnerHTML={{ __html: openPost.content_html || openPost.content }} />
            {openPost.link_url && <a href={openPost.link_url} target="_blank" className="text-primary text-xs underline">{openPost.link_url}</a>}

            <div className="flex items-center gap-4 mt-3 border-t border-border/50 pt-3">
              <button onClick={() => toggleLike.mutate({ id: openPost.id, liked: openPost.liked_by_me })} className="flex items-center gap-1 text-sm">
                <Heart className={`h-5 w-5 ${openPost.liked_by_me ? "fill-red-500 text-red-500" : ""}`} /> {openPost.likes_count}
              </button>
              <span className="text-sm flex items-center gap-1"><MessageCircle className="h-5 w-5" /> {openPost.comments_count}</span>
            </div>

            <div className="border-t border-border/50 pt-3 mt-3">
              <h3 className="font-bold text-sm mb-2">Comments</h3>
              {postComments?.map((c: any) => (
                <div key={c.id} className="bg-muted rounded p-2 text-xs mb-2">
                  <p className="font-bold">{c.author?.full_name}</p>
                  <p>{c.content}</p>
                </div>
              ))}
              <div className="flex gap-1 mt-2">
                <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment..." className="text-sm" />
                <Button size="sm" onClick={() => addComment.mutate()} disabled={!comment} className="bg-primary text-primary-foreground"><Send className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default StudentFeed;
