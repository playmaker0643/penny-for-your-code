import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const logoAsset = { url: "/codebreakers-logo.jpg" };

interface Props {
  label?: string;
  /** Show a retry message after this many ms (default 8000). Pass 0 to disable. */
  timeoutMs?: number;
}

export default function BrandedLoader({ label = "Loading...", timeoutMs = 8000 }: Props) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!timeoutMs) return;
    const t = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(t);
  }, [timeoutMs]);

  const handleReload = () => {
    try {
      sessionStorage.removeItem("lovable:chunk-reloaded");
    } catch {}
    window.location.reload();
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10">
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-secondary via-primary to-accent opacity-60 blur-xl animate-pulse" />
        <img
          src={logoAsset.url}
          alt="CodeBreakers"
          width={80}
          height={80}
          decoding="async"
          loading="lazy"
          className="relative h-20 w-20 rounded-2xl object-cover animate-pulse-neon"
        />
      </div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-secondary via-primary to-accent animate-[loaderSlide_1.2s_ease-in-out_infinite]" />
      </div>
      <p className="text-xs font-mono text-muted-foreground">{label}</p>
      {timedOut && (
        <div className="mt-2 flex flex-col items-center gap-2 text-center">
          <p className="text-xs text-muted-foreground max-w-xs">
            Taking longer than expected. Check your connection or try reloading.
          </p>
          <Button size="sm" variant="outline" onClick={handleReload}>
            Reload
          </Button>
        </div>
      )}
      <style>{`
        @keyframes loaderSlide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
