import { useState } from "react";
import { Bell, Check, CheckCheck, Trash2, X, BellOff, Settings as Cog } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useNotifications } from "@/hooks/useNotifications";
import { CATEGORY_META, type NotificationCategory } from "@/lib/notifications/categories";
import { PermissionPrompt } from "./PermissionPrompt";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

const TABS: { key: "all" | NotificationCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new_lesson", label: "Lessons" },
  { key: "challenge", label: "Challenges" },
  { key: "announcement", label: "News" },
];

export function NotificationCenter() {
  const { items, unread, markRead, markAllRead, remove, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | NotificationCategory>("all");

  const filtered = tab === "all" ? items : items.filter((i) => i.category === tab);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] flex items-center justify-center animate-in zoom-in"
            >
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" /> Notifications
              {unread > 0 && <Badge variant="secondary">{unread} new</Badge>}
            </SheetTitle>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllRead} title="Mark all read">
                  <CheckCheck className="h-4 w-4" />
                </Button>
              )}
              {items.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAll} title="Clear all">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="px-4 pt-3">
          <PermissionPrompt compact />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col">
          <div className="px-4 pt-2">
            <TabsList className="w-full overflow-x-auto justify-start">
              {TABS.map((t) => (
                <TabsTrigger key={t.key} value={t.key} className="text-xs">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value={tab} className="flex-1 mt-0 overflow-hidden">
            <ScrollArea className="h-[calc(100vh-220px)]">
              <div className="p-3 space-y-2">
                {filtered.length === 0 ? (
                  <EmptyState />
                ) : (
                  filtered.map((n) => (
                    <NotificationItem
                      key={n.id}
                      item={n}
                      onRead={() => markRead(n.id)}
                      onRemove={() => remove(n.id)}
                      onNavigate={() => setOpen(false)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <BellOff className="h-10 w-10 mx-auto mb-3 opacity-50" />
      <p className="text-sm">You're all caught up.</p>
    </div>
  );
}

function NotificationItem({
  item, onRead, onRemove, onNavigate,
}: {
  item: any;
  onRead: () => void;
  onRemove: () => void;
  onNavigate: () => void;
}) {
  const meta = CATEGORY_META[item.category as NotificationCategory] || CATEGORY_META.system;
  const Icon = meta.icon;
  const content = (
    <div
      className={cn(
        "group relative flex gap-3 rounded-lg p-3 transition-colors",
        "hover:bg-accent/60 cursor-pointer",
        !item.read && "bg-accent/40"
      )}
    >
      <div className={cn("shrink-0 h-9 w-9 rounded-full bg-accent flex items-center justify-center", meta.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium truncate">{item.title}</p>
          {!item.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
        </div>
        {item.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.body}</p>
        )}
        {item.image_url && (
          <img
            src={item.image_url} alt="" loading="lazy"
            className="mt-2 rounded-md max-h-32 w-full object-cover"
          />
        )}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {meta.label} · {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!item.read && (
              <Button variant="ghost" size="icon" className="h-6 w-6"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRead(); }}>
                <Check className="h-3 w-3" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const handleClick = () => { if (!item.read) onRead(); onNavigate(); };
  if (item.link_url) {
    return <Link to={item.link_url} onClick={handleClick}>{content}</Link>;
  }
  return <div onClick={handleClick}>{content}</div>;
}