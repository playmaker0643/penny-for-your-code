import { useEffect, useState } from "react";
import { Bell, BellOff, Volume2, VolumeX, Vibrate, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { CATEGORY_META, type NotificationCategory } from "@/lib/notifications/categories";
import {
  pushSupported, notificationPermission, registerSwAndSubscribe,
} from "@/lib/notifications/push";
import { PermissionPrompt } from "@/components/notifications/PermissionPrompt";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

const CATS: NotificationCategory[] = [
  "new_lesson","challenge","announcement","achievement","live_class","system",
];

export default function StudentNotifications() {
  const { user } = useAuth();
  const { items, unread, markRead, markAllRead, remove, clearAll } = useNotifications();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [perm, setPerm] = useState<NotificationPermission>("default");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setPerm(notificationPermission()); }, []);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("notification_preferences").select("*").eq("user_id", user.id).maybeSingle();
      if (data) setPrefs(data as any);
      else setPrefs(Object.fromEntries([...CATS, "sound_enabled", "vibration_enabled"].map((k) => [k, true])));
    })();
  }, [user]);

  const updatePref = async (key: string, value: boolean) => {
    if (!user) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    await supabase.from("notification_preferences").upsert({
      user_id: user.id, ...next, updated_at: new Date().toISOString(),
    } as any);
  };

  const enable = async () => {
    if (!user) return;
    setBusy(true);
    const res = await registerSwAndSubscribe(user.id);
    setBusy(false); setPerm(notificationPermission());
    if (res.ok) toast.success("Notifications enabled");
    else toast.error(res.reason || "Could not enable");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Bell className="h-6 w-6" /> Notifications</h1>
            <p className="text-sm text-muted-foreground">{unread} unread · {items.length} total</p>
          </div>
          <Link to="/student" className="text-sm text-muted-foreground hover:text-foreground">Back</Link>
        </header>

        <PermissionPrompt />

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-medium">Browser push</p>
              <p className="text-xs text-muted-foreground">Works even when the app is closed.</p>
            </div>
            {perm === "granted" ? (
              <span className="text-xs text-green-600 inline-flex items-center gap-1"><Bell className="h-3 w-3" /> Enabled</span>
            ) : !pushSupported() ? (
              <span className="text-xs text-muted-foreground">Not available in preview</span>
            ) : (
              <Button size="sm" onClick={enable} disabled={busy}>{busy ? "…" : "Enable"}</Button>
            )}
          </div>

          <div className="space-y-3 pt-3 border-t">
            <h3 className="text-sm font-medium">Categories</h3>
            {CATS.map((c) => {
              const meta = CATEGORY_META[c]; const Icon = meta.icon;
              return (
                <div key={c} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${meta.color}`} />
                    <span className="text-sm">{meta.label}</span>
                  </div>
                  <Switch checked={prefs[c] !== false} onCheckedChange={(v) => updatePref(c, v)} />
                </div>
              );
            })}
          </div>

          <div className="space-y-3 pt-3 mt-3 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {prefs.sound_enabled !== false ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                <span className="text-sm">Sound</span>
              </div>
              <Switch checked={prefs.sound_enabled !== false} onCheckedChange={(v) => updatePref("sound_enabled", v)} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Vibrate className="h-4 w-4" />
                <span className="text-sm">Vibration (mobile)</span>
              </div>
              <Switch checked={prefs.vibration_enabled !== false} onCheckedChange={(v) => updatePref("vibration_enabled", v)} />
            </div>
          </div>
        </Card>

        <Card className="p-2">
          <div className="flex items-center justify-between px-2 py-2">
            <h2 className="text-sm font-medium">History</h2>
            <div className="flex gap-1">
              {unread > 0 && <Button size="sm" variant="ghost" onClick={markAllRead}>Mark all read</Button>}
              {items.length > 0 && <Button size="sm" variant="ghost" onClick={clearAll}>Clear</Button>}
            </div>
          </div>
          <div className="divide-y">
            {items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <BellOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No notifications yet.</p>
              </div>
            ) : items.map((n) => {
              const meta = CATEGORY_META[n.category as NotificationCategory] || CATEGORY_META.system;
              const Icon = meta.icon;
              const inner = (
                <div className={`flex gap-3 p-3 ${!n.read ? "bg-accent/30" : ""}`}>
                  <div className={`h-9 w-9 rounded-full bg-accent flex items-center justify-center ${meta.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {meta.label} · {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={(e) => { e.preventDefault(); remove(n.id); }}>×</Button>
                </div>
              );
              return n.link_url ? (
                <Link key={n.id} to={n.link_url} onClick={() => !n.read && markRead(n.id)}>{inner}</Link>
              ) : (
                <div key={n.id} onClick={() => !n.read && markRead(n.id)}>{inner}</div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}