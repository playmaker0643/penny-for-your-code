import { useAuth } from "@/contexts/AuthContext";
import { NotificationCenter } from "./NotificationCenter";

/**
 * Fixed-position bell for authenticated users.
 * Sits above bottom navigation on mobile, top-right on desktop.
 */
export function FloatingNotificationBell() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="fixed top-3 right-3 z-50 rounded-full bg-background/80 backdrop-blur border shadow-sm">
      <NotificationCenter />
    </div>
  );
}