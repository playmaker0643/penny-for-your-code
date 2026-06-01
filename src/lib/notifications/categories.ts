import {
  BookOpen, Swords, ShieldAlert, Megaphone, Award, Radio, Bell,
  type LucideIcon,
} from "lucide-react";

export type NotificationCategory =
  | "new_lesson" | "challenge" | "security"
  | "announcement" | "achievement" | "live_class" | "system";

export const CATEGORY_META: Record<NotificationCategory, {
  label: string; icon: LucideIcon; color: string;
}> = {
  new_lesson:   { label: "New Lessons",       icon: BookOpen,    color: "text-blue-500" },
  challenge:    { label: "Challenges",        icon: Swords,      color: "text-orange-500" },
  security:     { label: "Security Alerts",   icon: ShieldAlert, color: "text-red-500" },
  announcement: { label: "Announcements",     icon: Megaphone,   color: "text-purple-500" },
  achievement:  { label: "Achievement Badges",icon: Award,       color: "text-yellow-500" },
  live_class:   { label: "Live Classes",      icon: Radio,       color: "text-green-500" },
  system:       { label: "System",            icon: Bell,        color: "text-muted-foreground" },
};