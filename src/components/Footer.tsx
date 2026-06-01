import { Link } from "react-router-dom";
import { Terminal, Github, Twitter, Linkedin, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Footer = () => {
  const { user, role } = useAuth();
  const portalLink = user ? (role === "admin" ? "/admin" : "/student") : "/login";
  return (
  <footer className="border-t border-border/50 bg-background py-16">
    <div className="container">
      {/* Brand */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg font-mono text-primary">&lt;/&gt;</span>
          <span className="text-xl font-bold font-display">
            Code<span className="neon-text">Breakers</span>
          </span>
        </div>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          Master the digital frontier. From zero to hero in web development and cybersecurity.
          Join thousands of students breaking codes and building futures.
        </p>
        <div className="flex gap-3">
          {[Github, Twitter, Linkedin, Mail].map((Icon, i) => (
            <a key={i} href="#" className="p-2 rounded-lg border border-border hover:border-primary/30 hover:text-primary text-muted-foreground transition-colors">
              <Icon className="h-4 w-4" />
            </a>
          ))}
        </div>
      </div>

      {/* Links grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-12">
        <div>
          <h4 className="font-semibold text-foreground mb-4 text-sm">Platform</h4>
          <div className="flex flex-col gap-3">
            <Link to="/courses" className="text-sm text-muted-foreground hover:text-primary transition-colors">Courses</Link>
            <Link to="/about" className="text-sm text-muted-foreground hover:text-primary transition-colors">About Us</Link>
            <Link to="/contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">Contact</Link>
            <Link to="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">Privacy Policy</Link>
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-4 text-sm">Courses</h4>
          <div className="flex flex-col gap-3">
            <span className="text-sm text-muted-foreground">Frontend Development</span>
            <span className="text-sm text-muted-foreground">Backend Development</span>
            <span className="text-sm text-muted-foreground">Cybersecurity</span>
            <span className="text-sm text-muted-foreground">Coding Sandbox</span>
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-4 text-sm">Community</h4>
          <div className="flex flex-col gap-3">
            <Link to={portalLink} className="text-sm text-muted-foreground hover:text-primary transition-colors">Student Portal</Link>
            <Link to={portalLink} className="text-sm text-muted-foreground hover:text-primary transition-colors">Instructor Login</Link>
            <span className="text-sm text-muted-foreground">Discord Community</span>
            <span className="text-sm text-muted-foreground">Blog</span>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="pt-8 border-t border-border/50 text-center">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} CodeBreakers. All rights reserved.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Created by{" "}
          <span className="text-primary font-medium">Abdussalam Nasir</span> &{" "}
          <span className="text-primary font-medium">Abdulhafiz Nasir</span>
        </p>
      </div>
    </div>
  </footer>
);
};

export default Footer;
