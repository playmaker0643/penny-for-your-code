import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Video, RefreshCw, X, Send, Square, Circle } from "lucide-react";
import { toast } from "sonner";

const StudentCamera = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const returnTo: string = (location.state as any)?.returnTo || "/student/chat";
  const chatId: string | null = (location.state as any)?.chatId || null;
  const isDirect: boolean = (location.state as any)?.isDirect || false;
  const otherUserId: string | null = (location.state as any)?.otherUserId || null;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [mode, setMode] = useState<"photo" | "video">("photo");
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [recording, setRecording] = useState(false);
  const [captured, setCaptured] = useState<{ blob: Blob; url: string; type: "image" | "video" } | null>(null);
  const [sending, setSending] = useState(false);

  const startStream = async () => {
    try {
      streamRef.current?.getTracks().forEach(t => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: mode === "video",
      });
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch {
      toast.error("Camera access denied");
    }
  };

  useEffect(() => {
    startStream();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing, mode]);

  const takePhoto = () => {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob((blob) => {
      if (!blob) return;
      setCaptured({ blob, url: URL.createObjectURL(blob), type: "image" });
    }, "image/jpeg", 0.9);
  };

  const startRecording = () => {
    const s = streamRef.current;
    if (!s) return;
    chunksRef.current = [];
    const rec = new MediaRecorder(s, { mimeType: "video/webm" });
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setCaptured({ blob, url: URL.createObjectURL(blob), type: "video" });
    };
    rec.start();
    recorderRef.current = rec;
    setRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const send = async () => {
    if (!captured || !user) return;
    setSending(true);
    const ext = captured.type === "image" ? "jpg" : "webm";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("chat-media").upload(path, captured.blob, { contentType: captured.blob.type });
    if (uploadError) { toast.error("Upload failed"); setSending(false); return; }
    const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path);
    const tag = captured.type === "image" ? "image" : "video";
    const content = `[${tag}:${pub.publicUrl}]`;
    if (isDirect && otherUserId) {
      await supabase.from("messages").insert({ sender_id: user.id, receiver_id: otherUserId, content });
    } else if (chatId) {
      await supabase.from("chat_messages").insert({ chat_id: chatId, sender_id: user.id, content, message_type: tag });
      await supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
    }
    setSending(false);
    navigate(returnTo);
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black flex flex-col">
      <header className="h-12 flex items-center justify-between px-3 bg-black/80 text-white">
        <button onClick={() => navigate(-1)} className="p-2"><X className="h-5 w-5" /></button>
        <div className="flex gap-3">
          <button onClick={() => setMode("photo")} className={`px-3 py-1 text-xs rounded ${mode === "photo" ? "bg-primary text-primary-foreground" : "text-white/70"}`}>Photo</button>
          <button onClick={() => setMode("video")} className={`px-3 py-1 text-xs rounded ${mode === "video" ? "bg-primary text-primary-foreground" : "text-white/70"}`}>Video</button>
        </div>
        <button onClick={() => setFacing(f => f === "user" ? "environment" : "user")} className="p-2"><RefreshCw className="h-5 w-5" /></button>
      </header>

      <div className="flex-1 relative bg-black overflow-hidden">
        {!captured ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        ) : captured.type === "image" ? (
          <img src={captured.url} alt="captured" className="w-full h-full object-contain" />
        ) : (
          <video src={captured.url} autoPlay loop controls className="w-full h-full object-contain" />
        )}
      </div>

      <div className="h-24 bg-black/90 flex items-center justify-center gap-8">
        {captured ? (
          <>
            <button onClick={() => { URL.revokeObjectURL(captured.url); setCaptured(null); }} className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs">Retake</button>
            <button onClick={send} disabled={sending} className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
              <Send className="h-6 w-6 text-primary-foreground" />
            </button>
          </>
        ) : mode === "photo" ? (
          <button onClick={takePhoto} className="w-16 h-16 rounded-full border-4 border-white bg-white/20 flex items-center justify-center">
            <Camera className="h-7 w-7 text-white" />
          </button>
        ) : (
          <button onClick={recording ? stopRecording : startRecording} className={`w-16 h-16 rounded-full border-4 flex items-center justify-center ${recording ? "border-destructive bg-destructive/40" : "border-white bg-white/20"}`}>
            {recording ? <Square className="h-7 w-7 text-white" /> : <Circle className="h-7 w-7 text-destructive fill-destructive" />}
          </button>
        )}
      </div>
    </div>
  );
};

export default StudentCamera;
