import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
const logoAsset = { url: "/codebreakers-logo.jpg" };


const Navbar = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, signOut } = useAuth();

  const dashboardPath = role === "admin" ? "/admin" : "/student";

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/courses", label: "Courses" },
    { to: "/about", label: "About" },
    ...(user ? [{ to: dashboardPath, label: "Dashboard" }] : []),
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-nav">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo left - not clickable */}
        <div className="flex items-center gap-2">
          <img
            src={logoAsset.url}
            alt="CodeBreakers"
            width={36}
            height={36}
            decoding="async"
            fetchPriority="high"
            className="h-9 w-9 rounded-lg object-cover shadow-[0_0_18px_hsl(var(--primary)/0.45)]"
          />
          <span className="text-lg font-bold font-display text-foreground">
            Code<span className="text-primary">Breakers</span>
          </span>
        </div>


        {/* Desktop auth buttons center-right */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={async () => { await signOut(); navigate("/"); }}
            >
              Sign Out
            </Button>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                  Login
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm" className="glow-btn bg-primary text-primary-foreground hover:bg-primary/90">
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Hamburger menu on the right */}
        <button className="text-foreground" onClick={() => setOpen(!open)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Dropdown menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-border/50 bg-background"
          >
            <div className="container py-4 flex flex-col gap-3">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className={`text-sm font-medium transition-colors hover:text-primary py-2 ${
                    location.pathname === link.to ? "neon-text" : "text-muted-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex gap-3 pt-2">
                {user ? (
                  <Button size="sm" variant="ghost" onClick={async () => { await signOut(); setOpen(false); navigate("/"); }}>
                    Sign Out
                  </Button>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setOpen(false)}>
                      <Button variant="ghost" size="sm">Login</Button>
                    </Link>
                    <Link to="/register" onClick={() => setOpen(false)}>
                      <Button size="sm" className="glow-btn bg-primary text-primary-foreground">Get Started</Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
