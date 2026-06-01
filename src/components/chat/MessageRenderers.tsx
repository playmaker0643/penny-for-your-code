import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Download, Play, FileText, Swords, Eye, Copy } from "lucide-react";
import { toast } from "sonner";

export const isImageMsg = (c: string) => c?.startsWith("[image:");
export const isVideoMsg = (c: string) => c?.startsWith("[video:");
export const isFileMsg = (c: string) => c?.startsWith("[file:");
export const isStickerMsg = (c: string) => c?.startsWith("[sticker:");
export const isPollMsg = (c: string) => c?.startsWith("[poll:");
export const isChallengeMsg = (c: string) => c?.startsWith("[challenge:");
export const isCodeMsg = (c: string) => c?.startsWith("[code:");
export const isVoiceMsg = (c: string) => c?.startsWith("[voice:");
export const isForwardedMsg = (c: string) => c?.startsWith("[forwarded]");

export const stripForwarded = (c: string) => c.replace(/^\[forwarded\]\s*/, "");

const downloadFromUrl = async (url: string, name: string) => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch { toast.error("Download failed"); }
};

export const ImageMessage = ({ url }: { url: string }) => {
  const [preview, setPreview] = useState(false);
  return (
    <>
      <div className="relative" style={{ width: "50vw", maxWidth: 280, height: "50vw", maxHeight: 280 }}>
        <img src={url} alt="img" onClick={() => setPreview(true)} className="w-full h-full object-cover rounded-lg cursor-pointer" />
        <button onClick={(e) => { e.stopPropagation(); downloadFromUrl(url, `image-${Date.now()}.jpg`); }} className="absolute top-1 right-1 bg-black/60 text-white p-1.5 rounded-full">
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>
      {preview && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center" onClick={() => setPreview(false)}>
          <img src={url} alt="full" className="max-w-full max-h-full" />
        </div>
      )}
    </>
  );
};

export const VideoMessage = ({ url }: { url: string }) => (
  <div style={{ width: "50vw", maxWidth: 280 }}>
    <video src={url} controls className="w-full rounded-lg" />
    <button onClick={() => downloadFromUrl(url, `video-${Date.now()}.webm`)} className="text-xs text-primary font-mono mt-1 flex items-center gap-1">
      <Download className="h-3 w-3" /> Download
    </button>
  </div>
);

export const FileMessage = ({ raw }: { raw: string }) => {
  const inner = raw.slice(6, -1);
  const [url, name, size] = inner.split("|");
  const sizeKB = size ? Math.round(Number(size) / 1024) : 0;
  return (
    <div className="flex items-center gap-3 bg-muted/40 rounded-lg p-2" style={{ width: "50vw", maxWidth: 280, height: "4rem" }}>
      <div className="w-10 h-10 rounded bg-primary/20 flex items-center justify-center shrink-0">
        <FileText className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold truncate">{name || "File"}</p>
        <p className="text-[10px] text-muted-foreground font-mono">{sizeKB} KB</p>
      </div>
      <button onClick={() => downloadFromUrl(url, name || "file")} className="p-2 text-primary">
        <Download className="h-4 w-4" />
      </button>
    </div>
  );
};

export const StickerMessage = ({ url }: { url: string }) => (
  <img src={url} alt="sticker" style={{ width: "33vw", maxWidth: 140, height: "33vw", maxHeight: 140 }} className="object-contain" />
);

export const VoiceMessage = ({ src }: { src: string }) => {
  const [playing, setPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const play = () => {
    if (playing && audio) { audio.pause(); setPlaying(false); return; }
    const a = new Audio(src);
    a.onended = () => setPlaying(false);
    a.play(); setAudio(a); setPlaying(true);
  };
  return (
    <button onClick={play} className="flex items-center gap-2 py-1">
      <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center">
        <Play className="h-3.5 w-3.5 text-primary" />
      </div>
      <span className="text-xs font-mono">{playing ? "Playing..." : "Voice note"}</span>
    </button>
  );
};

export const ChallengeMessage = ({ id, isMine }: { id: string; isMine: boolean }) => {
  const [accepting, setAccepting] = useState(false);
  const accept = async () => {
    setAccepting(true);
    await supabase.from("challenge_invitations").update({ status: "accepted" }).eq("id", id);
    toast.success("Challenge accepted!");
    window.location.href = "/student/challenges";
  };
  return (
    <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 flex items-center gap-3" style={{ minWidth: 220 }}>
      <Swords className="h-6 w-6 text-primary shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-bold text-primary">⚔️ Challenge Invitation</p>
        <p className="text-[11px] text-muted-foreground">Battle in coding challenges</p>
      </div>
      {!isMine && (
        <button onClick={accept} disabled={accepting} className="bg-primary text-primary-foreground text-xs font-mono font-bold px-3 py-1.5 rounded-lg">
          {accepting ? "..." : "Accept"}
        </button>
      )}
    </div>
  );
};

export const PollMessage = ({ id }: { id: string }) => {
  const { user } = useAuth();
  const [poll, setPoll] = useState<any>(null);
  const [votes, setVotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [{ data: p }, { data: v }] = await Promise.all([
      supabase.from("polls").select("*").eq("id", id).maybeSingle(),
      supabase.from("poll_votes").select("user_id, option_index").eq("poll_id", id),
    ]);
    setPoll(p); setVotes(v || []); setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const myVote = votes.find((v) => v.user_id === user?.id)?.option_index;

  const vote = async (idx: number) => {
    if (!user) return;
    if (myVote !== undefined) {
      await supabase.from("poll_votes").update({ option_index: idx }).eq("poll_id", id).eq("user_id", user.id);
    } else {
      await supabase.from("poll_votes").insert({ poll_id: id, user_id: user.id, option_index: idx });
    }
    load();
  };

  if (loading) return <p className="text-xs text-muted-foreground">Loading poll...</p>;
  if (!poll) return <p className="text-xs text-destructive">Poll not found</p>;

  const options: string[] = poll.options || [];
  const total = votes.length || 1;

  return (
    <div className="bg-muted/40 border border-border/30 rounded-xl p-3 space-y-2" style={{ minWidth: 240 }}>
      <p className="text-sm font-bold">📊 {poll.question}</p>
      {options.map((opt, i) => {
        const count = votes.filter((v) => v.option_index === i).length;
        const pct = Math.round((count / total) * 100);
        const selected = myVote === i;
        return (
          <button key={i} onClick={() => vote(i)} className="w-full flex items-center gap-2 text-left">
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? "border-primary" : "border-muted-foreground"}`}>
              {selected && <div className="w-2 h-2 rounded-full bg-primary" />}
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-xs">
                <span className="text-foreground">{opt}</span>
                <span className="text-muted-foreground font-mono">{count}</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </button>
        );
      })}
      <p className="text-[10px] text-muted-foreground font-mono">{votes.length} vote{votes.length === 1 ? "" : "s"}</p>
    </div>
  );
};

export const CodeMessage = ({ raw }: { raw: string }) => {
  const code = raw.slice(6, -1);
  const [previewing, setPreviewing] = useState(false);
  const copy = () => { navigator.clipboard.writeText(code); toast.success("Code copied!"); };
  return (
    <div className="rounded-xl overflow-hidden border border-border/40" style={{ width: "66vw", maxWidth: 480 }}>
      <div className="bg-muted/60 px-2 py-1 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground font-mono">code</span>
        <div className="flex gap-1">
          <button onClick={copy} className="p-1 text-muted-foreground hover:text-foreground"><Copy className="h-3 w-3" /></button>
          <button onClick={() => setPreviewing(true)} className="p-1 text-muted-foreground hover:text-foreground"><Eye className="h-3 w-3" /></button>
        </div>
      </div>
      <pre className="bg-background text-xs p-2 overflow-auto" style={{ maxHeight: "20rem" }}><code>{code}</code></pre>
      {previewing && (
        <div className="fixed inset-0 z-[200] bg-background flex flex-col">
          <div className="h-12 flex items-center justify-between px-4 bg-card border-b border-border/50">
            <span className="text-sm font-mono">Preview</span>
            <button onClick={() => setPreviewing(false)} className="text-xs text-primary font-mono">Close</button>
          </div>
          <iframe srcDoc={code} className="flex-1 bg-white" sandbox="allow-scripts" title="preview" />
        </div>
      )}
    </div>
  );
};
