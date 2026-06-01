import { Link, useLocation, useNavigate } from "react-router-dom";
import { X, BarChart3, BookOpen, Upload, FileText, MessageSquare, LogOut, Trophy, FolderKanban, Award, ClipboardCheck, Newspaper, Menu, Home, Info, LayoutDashboard, Users, Bot, Swords } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const bottomTabs = [
  { to: "/admin", label: "Overview", icon: BarChart3 },
  { to: "/admin/courses", label: "Courses", icon: BookOpen },
  { to: "/admin/lessons", label: "Lessons", icon: Upload },
  { to: "/admin/exams", label: "Tasks", icon: FileText },
  { to: "/admin/messages", label: "Messages", icon: MessageSquare },
];

const sidebarItems = [
  { to: "/admin/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/admin/students", label: "Students", icon: Users },
  { to: "/admin/certificates", label: "Certificates", icon: Award },
  { to: "/admin/attendance", label: "Attendance", icon: ClipboardCheck },
  { to: "/admin/posts", label: "Posts", icon: Newspaper },
  { to: "/admin/exams", label: "Exams", icon: FileText },
  { to: "/admin/code-ai", label: "Code Yourself AI", icon: Bot },
  { to: "/admin/challenges", label: "Challenges", icon: Swords },
  { to: "/admin/projects", label: "Projects", icon: FolderKanban },
  { to: "/admin/groups", label: "Groups", icon: Users },
];

const hamburgerLinks = [
  { to: "/", label: "Home", icon: Home },
  { to: "/courses", label: "Courses", icon: BookOpen },
  { to: "/about", label: "About", icon: Info },
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
];

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { signOut, profile, user } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const isActive = (path: string) => location.pathname === path;
  const firstName = profile?.full_name?.split(" ")[0] || "Admin";
  const avatarUrl = profile?.avatar_url;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 h-14 border-b border-border/50 bg-background/95 backdrop-blur-xl flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 rounded-full overflow-hidden border-2 border-primary/40 hover:border-primary transition-colors shrink-0"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm font-display">
                {firstName.charAt(0).toUpperCase()}
              </div>
            )}
          </button>
          <div className="flex items-center gap-1">
            <span className="text-3xl font-mono text-primary font-bold">&lt;/&gt;</span>
            <span className="text-lg font-bold font-display text-foreground">
              Code<span className="text-primary">Breakers</span>
            </span>
          </div>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="text-foreground shrink-0">
          <Menu className="h-6 w-6" />
        </button>
      </header>

      {menuOpen && (
        <div className="sticky top-14 z-30 border-b border-border/50 bg-background">
          <div className="px-4 py-3 flex flex-col gap-2">
            {hamburgerLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive(link.to) ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <link.icon className="h-4 w-4" />
                <span className="font-mono">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {sidebarOpen && (
        <div className="fixed inset-0 bg-background/80 z-50" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border/50 transform transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 p-5 border-b border-border/50">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/30 shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg font-display">
                {firstName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm truncate">{profile?.full_name || "Admin"}</p>
            <p className="text-[10px] text-primary font-mono">Administrator</p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 font-mono">Admin Panel</p>
          <nav className="space-y-1">
            {sidebarItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive(item.to)
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span className="font-mono text-sm">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="absolute bottom-6 left-4 right-4">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground hover:text-destructive transition-colors w-full"
          >
            <LogOut className="h-4 w-4" />
            <span className="font-mono">Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 pb-20">
        <div className="p-4">{children}</div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-xl border-t border-border/50">
        <div className="flex items-center justify-around h-16">
          {bottomTabs.map((tab) => {
            const active = isActive(tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={`flex flex-col items-center gap-1 px-3 py-1 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <tab.icon className={`h-5 w-5 ${active ? "fill-primary/20" : ""}`} />
                <span className={`text-[10px] font-mono ${active ? "font-bold" : ""}`}>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default AdminLayout;
