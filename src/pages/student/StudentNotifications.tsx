import { useEffect, useState } from "react";
import { Bell, BellOff, Volume2, VolumeX, Vibrate, CheckCircle2, XCircle, RefreshCw, Beaker, Moon, BellMinus, ShieldAlert, ScrollText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

// Auto-render every category from the meta map so newly-added categories
// (lesson_reminder, course_reminder, etc.) appear without further edits.
const CATS = Object.keys(CATEGORY_META) as NotificationCategory[];

export default function StudentNotifications() {
  const { user } = useAuth();
  const { items, unread, markRead, markAllRead, remove, clearAll } = useNotifications();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [perm, setPerm] = useState<NotificationPermission>("default");
  const [busy, setBusy] = useState(false);
  const [diag, setDiag] = useState({ sw: false, token: false, dbToken: false });

  const refreshDiag = async () => {
    let sw = false;
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        sw = regs.some((r) => (r.active?.scriptURL || "").includes("firebase-messaging-sw.js"));
      }
    } catch {}
    const token = !!localStorage.getItem("cb_fcm_token");
    let dbToken = false;
    if (user) {
      const { count } = await supabase
        .from("notification_tokens").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      dbToken = (count ?? 0) > 0;
    }
    setDiag({ sw, token, dbToken });
  };

  useEffect(() => { setPerm(notificationPermission()); refreshDiag(); }, [user]);
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
    setBusy(false); setPerm(notificationPermission()); await refreshDiag();
    if (res.ok) toast.success("Notifications enabled");
    else toast.error(res.reason || "Could not enable");
  };

  const retry = async () => {
    if (!user) return;
    setBusy(true);
    try {
      localStorage.removeItem("cb_fcm_token");
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) {
          if ((r.active?.scriptURL || "").includes("firebase-messaging-sw.js")) await r.unregister();
        }
      }
      const res = await registerSwAndSubscribe(user.id);
      setPerm(notificationPermission()); await refreshDiag();
      if (res.ok) toast.success("Re-registered successfully");
      else toast.error(res.reason || "Re-registration failed");
    } finally { setBusy(false); }
  };

  // Local browser test — shows a real OS-level notification via the SW
  // (or the Notification API fallback) without round-tripping the server.
  const sendTestNotification = async () => {
    console.group("[push] Send Test Notification");
    try {
      if (!("Notification" in window)) { toast.error("Notifications not supported"); return; }
      if (Notification.permission !== "granted") {
        const p = await Notification.requestPermission();
        setPerm(p);
        if (p !== "granted") { toast.error("Permission not granted"); return; }
      }
      const reg = "serviceWorker" in navigator
        ? await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js")
        : null;
      const title = "Test notification";
      const opts: NotificationOptions = {
        body: "If you see this, your browser push pipeline is working.",
        icon: "/icon-512.png",
        badge: "/icon-512.png",
        tag: "test:" + Date.now(),
        data: { link: "/student/notifications" },
      };
      if (reg && reg.active) {
        await reg.showNotification(title, opts);
        console.log("[push] showNotification via SW OK");
      } else {
        new Notification(title, opts);
        console.log("[push] direct Notification() OK (no SW)");
      }
      toast.success("Test notification fired");
    } catch (e: any) {
      console.error("[push] test failed", e);
      toast.error("Test failed: " + (e?.message || e));
    } finally { console.groupEnd(); }
  };

  // Detailed diagnostic dump for the console.
  const printDiagnostics = async () => {
    console.group("%c[push] DIAGNOSTIC REPORT", "color:#3b82f6;font-weight:bold");
    const secure = window.isSecureContext;
    const host = location.hostname;
    const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
    console.log("Secure context (HTTPS/localhost):", secure);
    console.log("Hostname:", host, "| in iframe:", inIframe);
    console.log("Notification API:", "Notification" in window);
    console.log("Service Worker API:", "serviceWorker" in navigator);
    console.log("Push Manager:", "PushManager" in window);
    console.log("Permission:", typeof Notification !== "undefined" ? Notification.permission : "n/a");
    console.log("FCM token (cached):", localStorage.getItem("cb_fcm_token")?.slice(0, 18) + "…" || "none");
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      console.log("SW registrations:", regs.map((r) => ({
        scope: r.scope, script: r.active?.scriptURL, state: r.active?.state,
      })));
    }
    if (user) {
      const { count } = await supabase
        .from("notification_tokens").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      console.log("Tokens stored server-side for this user:", count);
    }
    console.log("UA:", navigator.userAgent);
    console.groupEnd();
    toast.success("Diagnostics printed to console");
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

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Push diagnostics</p>
              <p className="text-xs text-muted-foreground">Status of this device's push connection.</p>
            </div>
            <Button size="sm" variant="outline" onClick={retry} disabled={busy} className="gap-1">
              <RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} />
              Re-register
            </Button>
          </div>
          <ul className="text-sm space-y-1.5">
            <StatusRow label="Browser supports push" ok={pushSupported()} />
            <StatusRow label="Notification permission granted" ok={perm === "granted"} warn={perm === "default"} />
            <StatusRow label="Service worker active" ok={diag.sw} />
            <StatusRow label="FCM token cached locally" ok={diag.token} />
            <StatusRow label="Token saved to server" ok={diag.dbToken} />
          </ul>
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button size="sm" variant="secondary" onClick={sendTestNotification} className="gap-1">
              <Beaker className="h-3 w-3" /> Send test notification
            </Button>
            <Button size="sm" variant="ghost" onClick={printDiagnostics}>
              Print diagnostics to console
            </Button>
          </div>
        </Card>

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

        <SmartDeliveryCard prefs={prefs} updatePref={updatePref} />

        <DeliveryLogCard />



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

function StatusRow({ label, ok, warn }: { label: string; ok: boolean; warn?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      {ok ? (
        <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> OK</span>
      ) : warn ? (
        <span className="inline-flex items-center gap-1 text-amber-600"><XCircle className="h-3.5 w-3.5" /> Not set</span>
      ) : (
        <span className="inline-flex items-center gap-1 text-destructive"><XCircle className="h-3.5 w-3.5" /> Missing</span>
      )}
    </li>
  );
}

// ---- Smart-delivery preferences (quiet hours, mute, high-priority only) ----
function SmartDeliveryCard({
  prefs, updatePref,
}: { prefs: Record<string, any>; updatePref: (k: string, v: any) => void }) {
  const muteUntil = prefs.mute_until ? new Date(prefs.mute_until) : null;
  const muted = !!muteUntil && muteUntil.getTime() > Date.now();
  const setMute = (hours: number | null) => {
    updatePref("mute_until", hours == null ? null : new Date(Date.now() + hours * 3600_000).toISOString());
  };
  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Moon className="h-4 w-4 text-indigo-500" />
        <h3 className="text-sm font-medium">Smart delivery</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Quiet hours start</Label>
          <Select value={String(prefs.quiet_hours_start ?? "")} onValueChange={(v) => updatePref("quiet_hours_start", v === "" ? null : Number(v))}>
            <SelectTrigger><SelectValue placeholder="Off" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="">Off</SelectItem>
              {Array.from({ length: 24 }, (_, i) => (
                <SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}:00</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Quiet hours end</Label>
          <Select value={String(prefs.quiet_hours_end ?? "")} onValueChange={(v) => updatePref("quiet_hours_end", v === "" ? null : Number(v))}>
            <SelectTrigger><SelectValue placeholder="Off" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="">Off</SelectItem>
              {Array.from({ length: 24 }, (_, i) => (
                <SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}:00</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-2">
        Non-urgent notifications are skipped during quiet hours (your local time).
      </p>

      <div className="flex items-center justify-between pt-2 border-t">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-rose-500" />
          <div>
            <p className="text-sm">High priority only</p>
            <p className="text-[11px] text-muted-foreground">Only security, deadlines, mentor & direct messages.</p>
          </div>
        </div>
        <Switch checked={!!prefs.high_priority_only} onCheckedChange={(v) => updatePref("high_priority_only", v)} />
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <div className="flex items-center gap-2">
          <BellMinus className="h-4 w-4 text-amber-500" />
          <div>
            <p className="text-sm">Mute notifications</p>
            <p className="text-[11px] text-muted-foreground">
              {muted ? `Muted until ${muteUntil!.toLocaleString()}` : "Pause all categories temporarily."}
            </p>
          </div>
        </div>
        <Select value="" onValueChange={(v) => setMute(v === "off" ? null : Number(v))}>
          <SelectTrigger className="w-32"><SelectValue placeholder={muted ? "Muted" : "Off"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="off">Unmute</SelectItem>
            <SelectItem value="1">1 hour</SelectItem>
            <SelectItem value="8">8 hours</SelectItem>
            <SelectItem value="24">24 hours</SelectItem>
            <SelectItem value="168">1 week</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </Card>
  );
}

// ---- Delivery log (debug-friendly) -----------------------------------------
function DeliveryLogCard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notification_events")
      .select("event, category, meta, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setRows(data || []);
  };
  useEffect(() => { if (open) load(); }, [open, user]);
  return (
    <Card className="p-4">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between text-sm font-medium">
        <span className="flex items-center gap-2"><ScrollText className="h-4 w-4 text-muted-foreground" /> Delivery log</span>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show last 50"}</span>
      </button>
      {open && (
        <div className="mt-3 max-h-72 overflow-auto text-xs divide-y">
          {rows.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center">No events yet.</p>
          ) : rows.map((r, i) => (
            <div key={i} className="py-1.5 flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleTimeString()}</span>
              <span className="uppercase tracking-wide text-[10px]">{r.event}</span>
              <span className="text-muted-foreground truncate flex-1 text-right">{r.category || "—"}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
