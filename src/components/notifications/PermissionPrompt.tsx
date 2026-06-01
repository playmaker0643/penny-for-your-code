import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  pushSupported, notificationPermission, registerSwAndSubscribe,
} from "@/lib/notifications/push";
import { toast } from "sonner";

const DISMISS_KEY = "cb_notif_prompt_dismissed_at";

export function PermissionPrompt({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const [perm, setPerm] = useState<NotificationPermission>("default");
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPerm(notificationPermission());
    const d = localStorage.getItem(DISMISS_KEY);
    if (d && Date.now() - parseInt(d) < 1000 * 60 * 60 * 24 * 3) setDismissed(true);
  }, []);

  if (!user) return null;
  if (!pushSupported()) return null;
  if (perm === "granted" || perm === "denied" || dismissed) return null;

  const enable = async () => {
    setBusy(true);
    const res = await registerSwAndSubscribe(user.id);
    setBusy(false);
    setPerm(notificationPermission());
    if (res.ok) toast.success("Notifications enabled");
    else toast.error(res.reason || "Could not enable notifications");
  };

  const skip = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setDismissed(true);
  };

  return (
    <div className={`relative rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10 p-3 ${compact ? "" : "mb-4"}`}>
      <button
        onClick={skip}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Bell className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Stay in the loop</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Get notified about new lessons, challenges, and announcements — even when the app is closed.
          </p>
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={enable} disabled={busy}>
              {busy ? "Enabling…" : "Enable notifications"}
            </Button>
            <Button size="sm" variant="ghost" onClick={skip}>Not now</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PermissionStatusBadge() {
  const perm = notificationPermission();
  if (perm === "granted")
    return <span className="inline-flex items-center gap-1 text-xs text-green-600"><Bell className="h-3 w-3" /> On</span>;
  if (perm === "denied")
    return <span className="inline-flex items-center gap-1 text-xs text-destructive"><BellOff className="h-3 w-3" /> Blocked</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Bell className="h-3 w-3" /> Off</span>;
}