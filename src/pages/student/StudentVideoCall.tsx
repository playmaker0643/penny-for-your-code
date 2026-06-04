import { useAuth } from "@/contexts/AuthContext";
import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PhoneOff, VideoOff, Video, Mic, MicOff, Monitor, UserPlus, Swords, User } from "lucide-react";
import { toast } from "sonner";
import { waitForChannelSubscription } from "@/lib/realtime";
import { getIceServers } from "@/lib/iceServers";
import AddToCallDialog from "@/components/AddToCallDialog";

const createRingTone = () => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = 440;
  osc.type = "sine";
  gain.gain.value = 0;
  let interval: any;
  const start = () => {
    osc.start();
    let on = true;
    const toggle = () => { gain.gain.setValueAtTime(on ? 0.3 : 0, ctx.currentTime); on = !on; };
    toggle();
    interval = setInterval(toggle, 1000);
  };
  const stop = () => {
    clearInterval(interval);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    try { osc.stop(); } catch {}
    try { ctx.close(); } catch {}
  };
  return { start, stop };
};

const StudentVideoCall = () => {
  const { callId } = useParams<{ callId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const incomingCallInfo = (location.state as any)?.incomingCall as { callerName?: string; callerAvatar?: string | null } | undefined;

  const [callStatus, setCallStatus] = useState<"connecting" | "ringing" | "active" | "reconnecting" | "ended" | "failed">("connecting");
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(() => !incomingCallInfo);
  const [showAddUser, setShowAddUser] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<any>(null);
  const ringTimeoutRef = useRef<any>(null);
  const ringToneRef = useRef<any>(null);
  const offerSentRef = useRef(false);
  const sendOfferRef = useRef<null | (() => Promise<void>)>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const { data: callInfo } = useQuery({
    queryKey: ["call-info", callId],
    queryFn: async () => {
      const { data } = await supabase.from("calls").select("*").eq("id", callId!).single();
      if (!data) return null;
      const otherId = data.caller_id === user!.id ? data.receiver_id : data.caller_id;
      const { data: prof } = await supabase.from("profiles").select("full_name, avatar_url").eq("user_id", otherId).single();
      return { ...data, otherProfile: prof, otherUserId: otherId };
    },
    enabled: !!callId && !!user,
  });

  const isCaller = callInfo?.caller_id === user?.id;

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    if (ringToneRef.current) { ringToneRef.current.stop(); ringToneRef.current = null; }
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    offerSentRef.current = false;
    sendOfferRef.current = null;
    pendingIceCandidatesRef.current = [];
  }, []);

  const startedAtRef = useRef<number | null>(null);
  const endCall = useCallback(async () => {
    const finalDuration = startedAtRef.current
      ? Math.floor((Date.now() - startedAtRef.current) / 1000)
      : 0;
    cleanup();
    setCallStatus("ended");
    if (callId) {
      await supabase.from("calls").update({
        status: "ended",
        ended_at: new Date().toISOString(),
        duration_seconds: finalDuration,
      }).eq("id", callId);
    }
    setTimeout(() => navigate(-1), 1000);
  }, [callId, cleanup, navigate]);

  // Ring tone
  useEffect(() => {
    if (callStatus === "ringing" && isCaller) {
      try { const tone = createRingTone(); ringToneRef.current = tone; tone.start(); } catch {}
    } else {
      if (ringToneRef.current) { ringToneRef.current.stop(); ringToneRef.current = null; }
    }
    return () => { if (ringToneRef.current) { ringToneRef.current.stop(); ringToneRef.current = null; } };
  }, [callStatus, isCaller]);

  useEffect(() => {
    if (callStatus === "ringing") {
      ringTimeoutRef.current = setTimeout(async () => {
        cleanup();
        setCallStatus("failed");
        if (callId) await supabase.from("calls").update({ status: "missed" }).eq("id", callId);
        toast.error("Can't connect — no answer");
        setTimeout(() => navigate(-1), 2500);
      }, 60000);
    }
    return () => { if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current); };
  }, [callStatus, cleanup, navigate, callId]);

  useEffect(() => {
    if (!callId || !user || !callInfo) return;
    if (!isCaller && !hasAnswered && callInfo.status !== "active") return;
    let mounted = true;

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const iceServers = await getIceServers();
        const pc = new RTCPeerConnection({ iceServers, iceTransportPolicy: "all" });
        pcRef.current = pc;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const flushPendingIceCandidates = async () => {
          if (!pc.remoteDescription) return;
          while (pendingIceCandidatesRef.current.length > 0) {
            const candidate = pendingIceCandidatesRef.current.shift();
            if (!candidate) continue;
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch {}
          }
        };

        pc.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
            remoteVideoRef.current.play().catch(() => {});
          }
          if (mounted) setCallStatus("active");
        };

        pc.onconnectionstatechange = () => {
          if (!mounted) return;
          if (pc.connectionState === "connected") {
            if (!startedAtRef.current) startedAtRef.current = Date.now();
            setCallStatus("active");
          }
          if (pc.connectionState === "disconnected") {
            setCallStatus((prev) => (prev === "active" ? "reconnecting" : prev));
          }
          if (pc.connectionState === "failed") setCallStatus("failed");
        };
        pc.oniceconnectionstatechange = () => {
          if (!mounted) return;
          if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
            setCallStatus((prev) => (prev === "reconnecting" ? "active" : prev));
          }
        };

        const channel = supabase.channel(`call-signal-${callId}`, { config: { broadcast: { self: false } } });
        channelRef.current = channel;

        sendOfferRef.current = async () => {
          if (offerSentRef.current) return;
          offerSentRef.current = true;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channel.send({ type: "broadcast", event: "offer", payload: { sdp: offer, from: user.id } });
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) channel.send({ type: "broadcast", event: "ice-candidate", payload: { candidate: event.candidate.toJSON(), from: user.id } });
        };

        channel.on("broadcast", { event: "offer" }, async ({ payload }) => {
          if (payload.from === user.id) return;
          if (pc.signalingState !== "stable") return;
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await flushPendingIceCandidates();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({ type: "broadcast", event: "answer", payload: { sdp: answer, from: user.id } });
        });

        channel.on("broadcast", { event: "answer" }, async ({ payload }) => {
          if (payload.from === user.id) return;
          if (pc.signalingState !== "have-local-offer") return;
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await flushPendingIceCandidates();
        });

        channel.on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
          if (payload.from === user.id) return;
          if (!pc.remoteDescription) {
            pendingIceCandidatesRef.current.push(payload.candidate);
            return;
          }
          try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch {}
        });

        channel.on("broadcast", { event: "call-ended" }, () => {
          if (mounted) { cleanup(); setCallStatus("ended"); toast.info("Call ended"); setTimeout(() => navigate(-1), 1500); }
        });

        // Listen for receiver ready signal
        channel.on("broadcast", { event: "ready" }, async ({ payload }) => {
          if (payload.from === user.id) return;
          if (isCaller && sendOfferRef.current) {
            await sendOfferRef.current();
          }
        });

        await waitForChannelSubscription(channel);

        if (isCaller) {
          if (callInfo.status === "active") {
            setCallStatus("connecting");
            await sendOfferRef.current?.();
          } else {
            setCallStatus("ringing");
          }
        } else {
          setCallStatus("connecting");
          channel.send({ type: "broadcast", event: "ready", payload: { from: user.id } });
        }
      } catch (e: any) {
        console.error("Call init error:", e);
        toast.error("Could not access camera/microphone");
        setTimeout(() => navigate(-1), 2000);
      }
    };

    init();
    return () => { mounted = false; cleanup(); };
  }, [callId, user, callInfo, isCaller, cleanup, navigate, hasAnswered]);

  useEffect(() => {
    if (!callId) return;
    const channel = supabase
      .channel(`call-status-${callId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calls", filter: `id=eq.${callId}` }, (payload) => {
        const next = payload.new as any;
        if (next.status === "active") {
          if (isCaller) {
            // Don't send offer here - wait for "ready" signal from receiver
            setCallStatus("connecting");
          } else {
            setCallStatus("connecting");
            setHasAnswered(true);
          }
          return;
        }
        if (next.status === "ended" || next.status === "missed") { cleanup(); setCallStatus("ended"); setTimeout(() => navigate(-1), 1500); }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [callId, cleanup, navigate, isCaller]);

  const answerCall = async () => {
    if (!callId) return;
    setHasAnswered(true);
    setCallStatus("connecting");
    await supabase.from("calls").update({ status: "active" }).eq("id", callId);
  };

  const rejectCall = async () => {
    if (!callId) return;
    await supabase.from("calls").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", callId);
    navigate(-1);
  };

  const toggleCamera = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) { videoTrack.enabled = !videoTrack.enabled; setIsCameraOn(videoTrack.enabled); }
  };

  const toggleMic = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) { audioTrack.enabled = !audioTrack.enabled; setIsMicOn(audioTrack.enabled); }
  };

  const toggleScreenShare = async () => {
    if (!pcRef.current) return;
    try {
      if (isScreenSharing) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = stream.getVideoTracks()[0];
        const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(videoTrack);
        setIsScreenSharing(false);
      } else {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(screenTrack);
        screenTrack.onended = () => toggleScreenShare();
        setIsScreenSharing(true);
      }
    } catch { toast.error("Screen sharing not available"); }
  };

  const handleEndCall = () => {
    channelRef.current?.send({ type: "broadcast", event: "call-ended", payload: { from: user?.id } });
    endCall();
  };

  const sendChallengeInvite = async () => {
    if (!callInfo?.otherUserId || !user) return;
    await supabase.rpc("create_quick_invite", { _receiver: callInfo.otherUserId, _chat_id: callInfo.chat_id });
    toast.success("Challenge invite sent!");
  };

  const otherName = callInfo?.otherProfile?.full_name || "User";
  const otherAvatar = callInfo?.otherProfile?.avatar_url || incomingCallInfo?.callerAvatar;

  if (!isCaller && !hasAnswered && callStatus !== "ended") {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center gap-8 px-6">
        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary/40">
          {otherAvatar ? <img src={otherAvatar} alt={otherName} className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-primary/20 flex items-center justify-center"><User className="h-16 w-16 text-primary" /></div>}
        </div>
        <div className="text-center">
          <p className="text-primary-foreground text-2xl font-bold">{incomingCallInfo?.callerName || otherName}</p>
          <p className="text-primary-foreground/70 text-sm mt-2">Incoming video call</p>
        </div>
        <div className="flex items-center gap-10">
          <button onClick={rejectCall} className="w-16 h-16 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg">
            <PhoneOff className="h-7 w-7" />
          </button>
          <button onClick={answerCall} className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg animate-pulse">
            <Video className="h-7 w-7" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <button onClick={sendChallengeInvite} className="absolute top-4 left-4 z-10 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white px-3 py-2 rounded-full text-xs">
        <Swords className="h-4 w-4" /> Challenge
      </button>

      <div className="flex-1 relative">
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />

        {callStatus !== "active" && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary/50 mb-4">
              {otherAvatar ? <img src={otherAvatar} alt={otherName} className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-primary/30 flex items-center justify-center"><User className="h-10 w-10 text-white/70" /></div>}
            </div>
            <p className="text-white text-lg font-bold">{otherName}</p>
            <p className="text-white/60 text-sm mt-1 animate-pulse">
              {callStatus === "ringing" ? "Ringing..." : callStatus === "connecting" ? "Connecting..." : callStatus === "reconnecting" ? "Reconnecting..." : callStatus === "failed" ? "Can't connect" : "Call ended"}
            </p>
            {callStatus === "ringing" && (
              <div className="mt-6 flex gap-3">
                <div className="w-3 h-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-3 h-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-3 h-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}
          </div>
        )}

        <div className="absolute top-4 right-4 w-28 h-40 rounded-2xl overflow-hidden border-2 border-white/20 shadow-xl z-10">
          {isCameraOn ? <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gray-800 flex items-center justify-center"><VideoOff className="h-6 w-6 text-white/50" /></div>}
        </div>
      </div>

      <div className="shrink-0 bg-black/90 backdrop-blur-xl px-4 py-6">
        <div className="flex items-center justify-center gap-5">
          <button onClick={toggleMic} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isMicOn ? "bg-white/20 text-white" : "bg-red-500 text-white"}`}>
            {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>
          <button onClick={toggleCamera} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isCameraOn ? "bg-white/20 text-white" : "bg-red-500 text-white"}`}>
            {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>
          <button onClick={toggleScreenShare} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isScreenSharing ? "bg-primary text-white" : "bg-white/20 text-white"}`}>
            <Monitor className="h-5 w-5" />
          </button>
          <button onClick={() => setShowAddUser(true)} className="w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center">
            <UserPlus className="h-5 w-5" />
          </button>
          <button onClick={handleEndCall} className="w-14 h-14 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
            <PhoneOff className="h-6 w-6" />
          </button>
        </div>
      </div>
      {user && callId && (
        <AddToCallDialog isOpen={showAddUser} onClose={() => setShowAddUser(false)} callId={callId} callType="video" callerId={user.id} />
      )}
    </div>
  );
};

export default StudentVideoCall;
