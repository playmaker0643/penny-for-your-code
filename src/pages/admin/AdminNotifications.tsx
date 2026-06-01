import { useState } from "react";
import { Bell, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CATEGORY_META, type NotificationCategory } from "@/lib/notifications/categories";
import { sendNotification } from "@/lib/notifications/api";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const CATEGORIES = Object.keys(CATEGORY_META) as NotificationCategory[];

export default function AdminNotifications() {
  const [form, setForm] = useState({
    target: "all_students" as "all_students" | "all_admins" | "user",
    user_id: "",
    category: "announcement" as NotificationCategory,
    title: "",
    body: "",
    image_url: "",
    link_url: "",
    action1: "",
    action2: "",
  });
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!form.title.trim()) { toast.error("Title required"); return; }
    setSending(true);
    try {
      const actions = [
        form.action1 && { action: "open", title: form.action1 },
        form.action2 && { action: "dismiss", title: form.action2 },
      ].filter(Boolean) as { action: string; title: string }[];
      const res = await sendNotification({
        target: form.target,
        user_id: form.target === "user" ? form.user_id : undefined,
        category: form.category,
        title: form.title.trim(),
        body: form.body.trim() || undefined,
        image_url: form.image_url.trim() || undefined,
        link_url: form.link_url.trim() || undefined,
        actions: actions.length ? actions : undefined,
      });
      toast.success(`Sent to ${res.recipients} · pushed ${res.pushed}`);
      setForm({ ...form, title: "", body: "", image_url: "", link_url: "", action1: "", action2: "" });
    } catch (e: any) {
      toast.error(e.message || "Send failed");
    } finally { setSending(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2"><Bell className="h-6 w-6" /> Notifications</h1>
          <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground">Back</Link>
        </header>

        <Card className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Audience</Label>
              <Select value={form.target} onValueChange={(v: any) => setForm({ ...form, target: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_students">All students</SelectItem>
                  <SelectItem value="all_admins">All admins</SelectItem>
                  <SelectItem value="user">Specific user (by user ID)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v: any) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_META[c].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.target === "user" && (
            <div>
              <Label>User ID</Label>
              <Input value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} placeholder="uuid" />
            </div>
          )}

          <div>
            <Label>Title *</Label>
            <Input value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea rows={3} maxLength={500} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Image URL</Label>
              <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" />
            </div>
            <div>
              <Label>Link (on click)</Label>
              <Input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="/student/lessons" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Action 1 (e.g. Open Lesson)</Label>
              <Input value={form.action1} maxLength={40} onChange={(e) => setForm({ ...form, action1: e.target.value })} />
            </div>
            <div>
              <Label>Action 2 (e.g. Dismiss)</Label>
              <Input value={form.action2} maxLength={40} onChange={(e) => setForm({ ...form, action2: e.target.value })} />
            </div>
          </div>

          <Button onClick={send} disabled={sending} className="w-full gap-2">
            <Send className="h-4 w-4" />
            {sending ? "Sending…" : "Send notification"}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Rate-limited to 60 sends per minute. Recipients with the category disabled in their preferences are skipped.
          </p>
        </Card>
      </div>
    </div>
  );
}