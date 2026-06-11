import ChallengeButton from "@/components/call/ChallengeButton";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PhoneOff, Mic, MicOff, UserPlus, Swords, User } from "lucide-react";
import { toast } from "sonner";
import { waitForChannelSubscription } from "@/lib/realtime";
import { getIceServers } from "@/lib/iceServers";
import AddToCallDialog from "@/components/AddToCallDialog";

// Generate ringing tone using Web Audio API
const createRingTone = () => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = 440;
  osc.type = "sine";
  gain.gain.value = 0;

  // Ring pattern: on 1s, off 2s
  let interval: any;
  const start = () => {
    osc.start();
    let on = true;
    const toggle = () => {
      gain.gain.setValueAtTime(on ? 0.3 : 0, ctx.currentTime);
      on = !on;
    };
    toggle();
    interval = setInterval(toggle, on ? 1000 : 2000);
  };
  const stop = () => {
    clearInterval(interval);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    try { osc.stop(); } catch {}
    try { ctx.close(); } catch {}
  };
  return { start, stop };
};

const StudentVoiceCall = () => {
  const { callId } = useParams<{ callId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const incomingCallInfo = (location.state as any)?.incomingCall as { callerName?: string; callerAvatar?: string | null } | undefined;

  const [callStatus, setCallStatus] = useState<"connecting" | "ringing" | "active" | "reconnecting" | "ended" | "failed">("connecting");
  const [isMicOn, setIsMicOn] = useState(true);
  const [duration, setDuration] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(() => !incomingCallInfo);
  const [showAddUser, setShowAddUser] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const ringTimeoutRef = useRef<any>(null);
  const ringToneRef = useRef<any>(null);
  const offerSentRef = useRef(false);
  const sendOfferRef = useRef<null | (() => Promise<void>)>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
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
    if (timerRef.current) clearInterval(timerRef.current);
    if (ringToneRef.current) { ringToneRef.current.stop(); ringToneRef.current = null; }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current.remove();
      remoteAudioRef.current = null;
    }
    offerSentRef.current = false;
    sendOfferRef.current = null;
    pendingIceCandidatesRef.current = [];
  }, []);

  const durationRef = useRef(0);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  const endCall = useCallback(async () => {
    const finalDuration = durationRef.current;
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

  // Start/stop ringing sound
  useEffect(() => {
    if (callStatus === "ringing" && isCaller) {
      try {
        const tone = createRingTone();
        ringToneRef.current = tone;
        tone.start();
      } catch {}
    } else {
      if (ringToneRef.current) { ringToneRef.current.stop(); ringToneRef.current = null; }
    }
    return () => { if (ringToneRef.current) { ringToneRef.current.stop(); ringToneRef.current = null; } };
  }, [callStatus, isCaller]);

  // 1-minute ringing timeout
  useEffect(() => {
    if (callStatus === "ringing") {
      ringTimeoutRef.current = setTimeout(async () => {
        cleanup();
        setCallStatus("failed");
        // Log missed call
        if (callId && callInfo) {
          await supabase.from("calls").update({ status: "missed" }).eq("id", callId);
        }
        toast.error("Can't connect — no answer");
        setTimeout(() => navigate(-1), 2500);
      }, 60000);
    }
    return () => { if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current); };
  }, [callStatus, cleanup, navigate, callId, callInfo]);

  useEffect(() => {
    if (!callId || !user || !callInfo) return;
    if (!isCaller && !hasAnswered && callInfo.status !== "active") return;
    let mounted = true;

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;

        const iceServers = await getIceServers();
        const pc = new RTCPeerConnection({ iceServers, iceTransportPolicy: "all" });
        pcRef.current = pc;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const remoteAudio = document.createElement("audio");
        remoteAudio.autoplay = true;
        remoteAudio.setAttribute("playsinline", "true");
        remoteAudio.style.display = "none";
        document.body.appendChild(remoteAudio);
        remoteAudioRef.current = remoteAudio;

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
          if (event.streams[0] && remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = event.streams[0];
            remoteAudioRef.current.play().catch(() => {});
          }
          if (mounted) {
            setCallStatus("active");
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
          }
        };

        pc.onconnectionstatechange = () => {
          if (!mounted) return;
          if (pc.connectionState === "connected") {
            setCallStatus("active");
            if (!timerRef.current) {
              timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
            }
          }
          if (pc.connectionState === "disconnected") {
            setCallStatus((prev) => (prev === "active" ? "reconnecting" : prev));
          }
          if (pc.connectionState === "failed") {
            setCallStatus("failed");
          }
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
          if (event.candidate) {
            channel.send({ type: "broadcast", event: "ice-candidate", payload: { candidate: event.candidate.toJSON(), from: user.id } });
          }
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
          if (mounted) {
            cleanup();
            setCallStatus("ended");
            toast.info("Call ended");
            setTimeout(() => navigate(-1), 1500);
          }
        });

        // Listen for receiver ready signal
        channel.on("broadcast", { event: "ready" }, async ({ payload }) => {
          if (payload.from === user.id) return;
          // Other side is ready, send offer if we're the caller
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
          // Signal that receiver is ready
          channel.send({ type: "broadcast", event: "ready", payload: { from: user.id } });
        }
      } catch (e) {
        console.error("Voice call error:", e);
        toast.error("Could not access microphone");
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
        if (next.status === "ended" || next.status === "missed") {
          cleanup();
          setCallStatus("ended");
          setTimeout(() => navigate(-1), 1500);
        }
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

  const toggleMic = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) { audioTrack.enabled = !audioTrack.enabled; setIsMicOn(audioTrack.enabled); }
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

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const otherName = callInfo?.otherProfile?.full_name || "User";
  const otherAvatar = callInfo?.otherProfile?.avatar_url || incomingCallInfo?.callerAvatar;

  if (!isCaller && !hasAnswered && callStatus !== "ended") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 px-6" style={{ background: "linear-gradient(180deg, hsl(var(--primary)/0.9) 0%, hsl(var(--background)) 100%)" }}>
        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary-foreground/30">
          {otherAvatar ? (
            <img src={otherAvatar} alt={otherName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-primary-foreground/20 flex items-center justify-center"><User className="h-16 w-16 text-primary-foreground/70" /></div>
          )}
        </div>
        <div className="text-center">
          <p className="text-primary-foreground text-2xl font-bold">{incomingCallInfo?.callerName || otherName}</p>
          <p className="text-primary-foreground/70 text-sm mt-2">Incoming voice call</p>
        </div>
        <div className="flex items-center gap-10">
          <button onClick={rejectCall} className="w-16 h-16 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg">
            <PhoneOff className="h-7 w-7" />
          </button>
          <button onClick={answerCall} className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg animate-pulse">
            <Mic className="h-7 w-7" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "linear-gradient(180deg, hsl(var(--primary)/0.9) 0%, hsl(var(--background)) 100%)" }}>
      <ChallengeButton onChallenge={sendChallengeInvite} className="absolute top-4 left-4 z-10" />

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className={`w-32 h-32 rounded-full overflow-hidden border-4 mb-6 ${callStatus === "active" ? "border-green-400 shadow-[0_0_30px_rgba(74,222,128,0.3)]" : "border-white/30"}`}>
          {otherAvatar ? (
            <img src={otherAvatar} alt={otherName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-white/20 flex items-center justify-center"><User className="h-16 w-16 text-white/70" /></div>
          )}
        </div>
        <p className="text-white text-xl font-bold">{otherName}</p>
        <p className="text-white/60 text-sm mt-1">
          {callStatus === "active" ? formatDuration(duration)
            : callStatus === "ringing" ? "Ringing..."
            : callStatus === "connecting" ? "Connecting..."
            : callStatus === "reconnecting" ? "Reconnecting..."
            : callStatus === "failed" ? "Can't connect"
            : "Call ended"}
        </p>

        {callStatus === "ringing" && (
          <div className="mt-8 flex gap-3">
            <div className="w-3 h-3 rounded-full bg-white animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-3 h-3 rounded-full bg-white animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-3 h-3 rounded-full bg-white animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        )}
      </div>

      <div className="shrink-0 pb-12 px-4">
        <div className="flex items-center justify-center gap-8">
          <button onClick={toggleMic} className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isMicOn ? "bg-white/20 text-white" : "bg-red-500 text-white"}`}>
            {isMicOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
          </button>
          <button onClick={() => setShowAddUser(true)} className="w-14 h-14 rounded-full bg-white/20 text-white flex items-center justify-center">
            <UserPlus className="h-6 w-6" />
          </button>
          <button onClick={handleEndCall} className="w-16 h-16 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
            <PhoneOff className="h-7 w-7" />
          </button>
        </div>
      </div>
      {user && callId && (
        <AddToCallDialog isOpen={showAddUser} onClose={() => setShowAddUser(false)} callId={callId} callType="voice" callerId={user.id} />
      )}
    </div>
  );
};

export default StudentVoiceCall;
