import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Swords, FileUp, ImagePlus, BarChart3, X, Camera, Code2, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  otherUserId?: string | null;
  chatId?: string | null;
  isDirectConversation: boolean;
  onSendMessage: (content: string) => void;
  onOpenCodeSpace?: () => void;
}

const AttachmentMenu = ({ isOpen, onClose, userId, otherUserId, chatId, isDirectConversation, onSendMessage, onOpenCodeSpace }: Props) => {
  const navigate = useNavigate();
  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  if (!isOpen) return null;

  const createChallengeLink = async () => {
    if (!otherUserId) { toast.error("No user to challenge"); return; }
    const { data: invId, error } = await supabase.rpc("create_quick_invite", { _receiver: otherUserId, _chat_id: isDirectConversation ? null : chatId });
    if (error || !invId) { toast.error(error?.message || "Could not send invite"); return; }
    onSendMessage(`[challenge:${invId}]`);
    toast.success("Challenge invite sent!");
    onClose();
  };

  const uploadAndSend = async (file: File, kind: "image" | "file" | "video") => {
    if (file.size > 25 * 1024 * 1024) { toast.error("File must be < 25MB"); return; }
    const ext = file.name.split(".").pop();
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("chat-media").upload(path, file, { contentType: file.type });
    if (error) { toast.error("Upload failed"); return; }
    const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path);
    if (kind === "image") onSendMessage(`[image:${pub.publicUrl}]`);
    else if (kind === "video") onSendMessage(`[video:${pub.publicUrl}]`);
    else onSendMessage(`[file:${pub.publicUrl}|${file.name}|${file.size}]`);
    onClose();
  };

  const pickFile = (accept: string, kind: "image" | "file" | "video") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = (e: any) => { const f = e.target.files?.[0]; if (f) uploadAndSend(f, kind); };
    input.click();
  };

  const sendPoll = async () => {
    if (!pollQuestion.trim()) { toast.error("Enter a question"); return; }
    const valid = pollOptions.filter(o => o.trim());
    if (valid.length < 2) { toast.error("Need at least 2 options"); return; }
    const { data: poll } = await supabase.from("polls").insert({
      creator_id: userId,
      chat_id: isDirectConversation ? null : chatId,
      question: pollQuestion.trim(),
      options: valid,
    }).select().single();
    if (poll) onSendMessage(`[poll:${poll.id}]`);
    setPollQuestion(""); setPollOptions(["", ""]); setShowPoll(false); onClose();
  };

  if (showPoll) {
    return (
      <div className="bg-card border-t border-border/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">Create Poll</p>
          <button onClick={() => setShowPoll(false)}><X className="h-4 w-4" /></button>
        </div>
        <input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="Ask a question..." className="w-full bg-muted border border-border/30 rounded-xl px-3 py-2 text-base outline-none" style={{ fontSize: 16 }} />
        {pollOptions.map((opt, i) => (
          <input key={i} value={opt} onChange={(e) => { const n = [...pollOptions]; n[i] = e.target.value; setPollOptions(n); }} placeholder={`Option ${i + 1}`} className="w-full bg-muted border border-border/30 rounded-xl px-3 py-2 text-base outline-none" style={{ fontSize: 16 }} />
        ))}
        <div className="flex gap-2">
          {pollOptions.length < 5 && <button onClick={() => setPollOptions([...pollOptions, ""])} className="text-xs text-primary font-mono">+ Add option</button>}
          <button onClick={sendPoll} className="ml-auto bg-primary text-primary-foreground px-4 py-1.5 rounded-xl text-xs font-mono font-bold">Send Poll</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border-t border-border/50 p-3">
      <div className="grid grid-cols-4 gap-2">
        <Btn label="Camera" Icon={Camera} onClick={() => { onClose(); navigate("/student/camera", { state: { returnTo: window.location.pathname, chatId, isDirect: isDirectConversation, otherUserId } }); }} />
        <Btn label="Image" Icon={ImagePlus} onClick={() => pickFile("image/*", "image")} />
        <Btn label="Video" Icon={Video} onClick={() => pickFile("video/*", "video")} />
        <Btn label="File" Icon={FileUp} onClick={() => pickFile("*/*", "file")} />
        <Btn label="Poll" Icon={BarChart3} onClick={() => setShowPoll(true)} />
        <Btn label="Code Space" Icon={Code2} onClick={() => { onClose(); onOpenCodeSpace?.(); }} />
        <Btn label="Challenge" Icon={Swords} onClick={createChallengeLink} />
      </div>
    </div>
  );
};

const Btn = ({ label, Icon, onClick }: any) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-muted/50 transition-colors">
    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center"><Icon className="h-5 w-5 text-primary" /></div>
    <span className="text-[10px] text-muted-foreground font-mono">{label}</span>
  </button>
);

export default AttachmentMenu;
