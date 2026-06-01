import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Phone, PhoneOff, Video, Swords } from "lucide-react";
import { toast } from "sonner";

interface IncomingCall {
  id: string;
  callerId: string;
  callerName: string;
  callerAvatar: string | null;
  callType: string;
}

interface ChallengeInvite {
  id: string;
  sender_id: string;
  senderName: string;
  course_id: string | null;
}

const IncomingCallOverlay = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [challengeInvite, setChallengeInvite] = useState<ChallengeInvite | null>(null);
  const ringIntervalRef = useRef<any>(null);
  const audioCtxRef = useRef<any>(null);

  const startRinging = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      let on = true;
      const ring = () => {
        if (!audioCtxRef.current) return;
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = on ? 523 : 659;
          osc.type = "sine";
          gain.gain.value = 0.2;
          osc.start();
          setTimeout(() => { try { gain.gain.setValueAtTime(0, ctx.currentTime); osc.stop(); } catch {} }, 300);
          on = !on;
        } catch {}
      };
      ring();
      ringIntervalRef.current = setInterval(ring, 1500);
    } catch {}
  };

  const stopRinging = () => {
    if (ringIntervalRef.current) { clearInterval(ringIntervalRef.current); ringIntervalRef.current = null; }
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} audioCtxRef.current = null; }
  };

  useEffect(() => {
    if (location.pathname.includes("/student/call/")) {
      stopRinging();
      setIncomingCall(null);
    }
  }, [location.pathname]);

  useEffect(() => () => stopRinging(), []);

  // Listen for incoming calls
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`incoming-calls-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "calls", filter: `receiver_id=eq.${user.id}` },
        async (payload) => {
          const call = payload.new as any;
          if (call.status !== "pending") return;
          // Don't show if already on a call page
          if (location.pathname.includes("/student/call/")) return;
          const { data: prof } = await supabase.from("profiles").select("full_name, avatar_url").eq("user_id", call.caller_id).single();
          startRinging();
          setIncomingCall({
            id: call.id,
            callerId: call.caller_id,
            callerName: prof?.full_name || "Someone",
            callerAvatar: prof?.avatar_url || null,
            callType: call.call_type,
          });
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, location.pathname]);

  // Listen for challenge invitations
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("incoming-challenges")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "challenge_invitations", filter: `receiver_id=eq.${user.id}` },
        async (payload) => {
          const inv = payload.new as any;
          if (inv.status !== "pending") return;
          // Don't show if already on challenges page
          if (location.pathname.includes("/student/challenges")) return;
          const { data: prof } = await supabase.from("profiles").select("full_name").eq("user_id", inv.sender_id).single();
          setChallengeInvite({ id: inv.id, sender_id: inv.sender_id, senderName: prof?.full_name || "Someone", course_id: inv.course_id });
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, location.pathname]);

  // Auto-dismiss call after 30s
  useEffect(() => {
    if (!incomingCall) return;
    const t = setTimeout(() => {
      stopRinging();
      setIncomingCall(null);
    }, 30000);
    return () => clearTimeout(t);
  }, [incomingCall]);

  const answerCall = async () => {
    if (!incomingCall) return;
    stopRinging();
    // If this call is an "add to call" invitation, jump into the parent (existing) call
    const { data: callRow } = await supabase.from("calls").select("parent_call_id").eq("id", incomingCall.id).maybeSingle();
    const targetId = (callRow as any)?.parent_call_id || incomingCall.id;
    // Mark THIS call row active so:
    // - the caller's page stops "ringing" and starts WebRTC
    // - "add to call" invitation rows stop ringing the original participants
    await supabase.from("calls").update({ status: "active" }).eq("id", incomingCall.id);
    // If this was an invitation pointing to a parent, also ensure the parent stays active
    if (callRow && (callRow as any).parent_call_id) {
      await supabase.from("calls").update({ status: "active" }).eq("id", (callRow as any).parent_call_id);
    }
    const route = incomingCall.callType === "video"
      ? `/student/call/video/${targetId}`
      : `/student/call/voice/${targetId}`;
    const callerName = incomingCall.callerName;
    const callerAvatar = incomingCall.callerAvatar;
    setIncomingCall(null);
    // Do NOT pass `incomingCall` in state — that makes the call page render
    // a second answer screen. We've already answered. Use `answered` so the
    // page can still show the caller's name/avatar while WebRTC sets up.
    navigate(route, {
      state: {
        answered: { callerName, callerAvatar },
      },
    });
  };

  const rejectCall = async () => {
    if (!incomingCall) return;
    stopRinging();
    await supabase.from("calls").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", incomingCall.id);
    setIncomingCall(null);
  };

  const acceptChallenge = async () => {
    if (!challengeInvite) return;
    stopRinging();
    setChallengeInvite(null);
    navigate("/student/challenges", { state: { acceptedInvitationId: challengeInvite.id } });
  };

  const declineChallenge = async () => {
    if (!challengeInvite) return;
    stopRinging();
    await supabase.from("challenge_invitations").update({ status: "rejected" }).eq("id", challengeInvite.id);
    setChallengeInvite(null);
  };

  if (!incomingCall && !challengeInvite) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center">
      {incomingCall && (
        <div className="bg-card rounded-3xl p-8 mx-4 max-w-sm w-full text-center shadow-2xl border border-border/50 animate-in fade-in zoom-in">
          <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-4 border-4 border-primary/30">
            {incomingCall.callerAvatar ? (
              <img src={incomingCall.callerAvatar} alt={incomingCall.callerName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                <Phone className="h-8 w-8 text-primary animate-bounce" />
              </div>
            )}
          </div>
          <p className="text-xl font-bold text-foreground">{incomingCall.callerName}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Incoming {incomingCall.callType} call
          </p>
          <div className="flex items-center justify-center gap-6 mt-8">
            <button onClick={rejectCall} className="w-14 h-14 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg">
              <PhoneOff className="h-6 w-6" />
            </button>
            <button onClick={answerCall} className="w-14 h-14 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg animate-pulse">
              {incomingCall.callType === "video" ? <Video className="h-6 w-6" /> : <Phone className="h-6 w-6" />}
            </button>
          </div>
        </div>
      )}

      {challengeInvite && !incomingCall && (
        <div className="bg-card rounded-3xl p-8 mx-4 max-w-sm w-full text-center shadow-2xl border border-border/50 animate-in fade-in zoom-in">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4 animate-bounce">
            <Swords className="h-10 w-10 text-primary" />
          </div>
          <p className="text-xl font-bold text-foreground">Challenge Invite!</p>
          <p className="text-sm text-muted-foreground mt-2">
            <span className="text-foreground font-semibold">{challengeInvite.senderName}</span> wants to challenge you
          </p>
          <div className="flex items-center justify-center gap-4 mt-8">
            <button onClick={declineChallenge} className="px-8 py-3 rounded-xl bg-destructive/20 text-destructive font-mono font-bold text-sm">
              Reject
            </button>
            <button onClick={acceptChallenge} className="px-8 py-3 rounded-xl bg-primary/20 text-primary font-mono font-bold text-sm animate-pulse">
              Accept ⚡
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default IncomingCallOverlay;
