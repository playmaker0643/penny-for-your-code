import {
  BookOpen, Swords, ShieldAlert, Megaphone, Award, Radio, Bell, MessageCircle,
  Clock, BookMarked, FileClock, HelpCircle, Reply, Flame, Trophy, Sparkles,
  type LucideIcon,
} from "lucide-react";

export type NotificationCategory =
  | "new_lesson" | "challenge" | "security"
  | "announcement" | "achievement" | "live_class"
  | "chat_message" | "system"
  | "lesson_reminder" | "course_reminder" | "assignment_deadline"
  | "quiz_reminder" | "direct_message" | "mentor_reply"
  | "streak_reminder" | "leaderboard_change" | "ai_recommendation";

export const CATEGORY_META: Record<NotificationCategory, {
  label: string; icon: LucideIcon; color: string;
}> = {
  new_lesson:          { label: "New Lessons",            icon: BookOpen,    color: "text-blue-500" },
  challenge:           { label: "Challenges",             icon: Swords,      color: "text-orange-500" },
  security:            { label: "Security Alerts",        icon: ShieldAlert, color: "text-red-500" },
  announcement:        { label: "Announcements",          icon: Megaphone,   color: "text-purple-500" },
  achievement:         { label: "Achievement Badges",     icon: Award,       color: "text-yellow-500" },
  live_class:          { label: "Live Classes",           icon: Radio,       color: "text-green-500" },
  chat_message:        { label: "Chat Messages",          icon: MessageCircle, color: "text-cyan-500" },
  lesson_reminder:     { label: "Lesson Reminders",       icon: Clock,       color: "text-blue-400" },
  course_reminder:     { label: "Unfinished Courses",     icon: BookMarked,  color: "text-indigo-500" },
  assignment_deadline: { label: "Assignment Deadlines",   icon: FileClock,   color: "text-rose-500" },
  quiz_reminder:       { label: "Quiz Reminders",         icon: HelpCircle,  color: "text-amber-500" },
  direct_message:      { label: "Direct Messages",        icon: MessageCircle, color: "text-sky-500" },
  mentor_reply:        { label: "Mentor Replies",         icon: Reply,       color: "text-emerald-500" },
  streak_reminder:     { label: "Streak Reminders",       icon: Flame,       color: "text-orange-600" },
  leaderboard_change:  { label: "Leaderboard Changes",    icon: Trophy,      color: "text-yellow-600" },
  ai_recommendation:   { label: "AI Recommendations",     icon: Sparkles,    color: "text-fuchsia-500" },
  system:              { label: "System",                 icon: Bell,        color: "text-muted-foreground" },
};

// High-priority categories bypass quiet hours and the "high_priority_only" filter.
export const HIGH_PRIORITY: NotificationCategory[] = [
  "security", "assignment_deadline", "mentor_reply", "direct_message", "live_class",
];
