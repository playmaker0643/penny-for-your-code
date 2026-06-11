import { useCallback, useRef, useState } from "react";
import { Swords, Loader2, Check, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChallengeButtonProps {
  onChallenge: () => Promise<void> | void;
  disabled?: boolean;
  live?: boolean;
  className?: string;
  label?: string;
}

type State = "idle" | "loading" | "done";

/**
 * Premium glassmorphic Challenge button for the in-call overlay.
 * Pure presentation: delegates the actual invite logic to `onChallenge`.
 */
const ChallengeButton = ({
  onChallenge,
  disabled,
  live = true,
  className,
  label = "Challenge",
}: ChallengeButtonProps) => {
  const [state, setState] = useState<State>("idle");
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const lockRef = useRef(false);
  const doneTimerRef = useRef<number | null>(null);

  const handleClick = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      if (lockRef.current || disabled || state !== "idle") return;
      lockRef.current = true;

      // ripple
      const rect = e.currentTarget.getBoundingClientRect();
      const id = Date.now();
      setRipples((r) => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
      window.setTimeout(() => setRipples((r) => r.filter((x) => x.id !== id)), 600);

      try {
        setState("loading");
        await onChallenge();
        setState("done");
        if (doneTimerRef.current) window.clearTimeout(doneTimerRef.current);
        doneTimerRef.current = window.setTimeout(() => {
          setState("idle");
          lockRef.current = false;
        }, 1800);
      } catch {
        setState("idle");
        lockRef.current = false;
      } finally {
        // unlock after small delay even if state stays in `done`
        window.setTimeout(() => { lockRef.current = false; }, 600);
      }
    },
    [onChallenge, disabled, state],
  );

  const isLoading = state === "loading";
  const isDone = state === "done";
  const isDisabled = disabled || isLoading;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      aria-label={isDone ? "Challenge sent" : isLoading ? "Sending challenge" : "Send challenge invite"}
      aria-busy={isLoading}
      className={cn(
        "group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-4 py-2",
        "text-xs font-mono font-semibold tracking-wide text-white",
        "bg-white/10 backdrop-blur-xl border border-white/15",
        "shadow-[0_4px_24px_-4px_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.15)]",
        "transition-all duration-300 ease-out will-change-transform",
        "hover:scale-[1.04] hover:border-white/30 hover:bg-white/15",
        "hover:shadow-[0_0_24px_-2px_hsl(var(--primary)/0.55),0_4px_24px_-4px_rgba(0,0,0,0.5)]",
        "active:scale-[0.97] active:duration-75",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black/40",
        "disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100",
        !isDone && !isLoading && live && "animate-[challengePulse_2.4s_ease-in-out_infinite]",
        className,
      )}
    >
      {/* Animated gradient border */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full opacity-70 group-hover:opacity-100 transition-opacity"
        style={{
          padding: 1,
          background:
            "conic-gradient(from var(--cb-angle,0deg), hsl(var(--primary)) 0%, hsl(var(--cyber-purple,260 90% 65%)) 25%, hsl(var(--cyber-pink,320 90% 65%)) 50%, hsl(var(--cyber-blue,210 100% 65%)) 75%, hsl(var(--primary)) 100%)",
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          animation: "challengeSpin 6s linear infinite",
        }}
      />

      {/* Soft inner glow on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background:
            "radial-gradient(60% 80% at 50% 50%, hsl(var(--primary)/0.35) 0%, transparent 70%)",
        }}
      />

      {/* Ripples */}
      {ripples.map((r) => (
        <span
          key={r.id}
          aria-hidden
          className="pointer-events-none absolute rounded-full bg-white/40"
          style={{
            left: r.x,
            top: r.y,
            width: 8,
            height: 8,
            transform: "translate(-50%, -50%)",
            animation: "challengeRipple 600ms ease-out forwards",
          }}
        />
      ))}

      {/* LIVE dot */}
      {live && !isLoading && !isDone && (
        <span aria-hidden className="relative z-10 flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>
      )}

      <span className="relative z-10 inline-flex items-center gap-1.5">
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : isDone ? (
          <Check className="h-3.5 w-3.5 animate-[challengePop_400ms_ease-out]" aria-hidden />
        ) : (
          <Swords className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-[-8deg]" aria-hidden />
        )}
        <span className="whitespace-nowrap">
          {isLoading ? "Starting…" : isDone ? "Challenge Sent" : label}
        </span>
        {!isLoading && !isDone && (
          <Zap className="h-3 w-3 text-yellow-300/90 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
        )}
      </span>
    </button>
  );
};

export default ChallengeButton;
