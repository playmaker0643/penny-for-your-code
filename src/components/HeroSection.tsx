import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Play, Code, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import worldMap from "@/assets/world-map.png";
import courseFrontend from "@/assets/course-frontend.jpg";
import courseSecurity from "@/assets/course-security.jpg";

const HeroSection = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const handleStartLearning = () => {
    if (user) {
      navigate(role === "admin" ? "/admin" : "/student");
    } else {
      navigate("/register");
    }
  };

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20 pb-16">
      <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
        <img src={worldMap} alt="" width={1200} height={600} className="w-full max-w-5xl object-contain" />
      </div>

      <div className="container relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 mb-8">
              <span className="text-xs font-semibold text-primary">✦ Next-Gen Tech Education</span>
            </div>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="text-4xl md:text-6xl lg:text-7xl font-bold font-display mb-6 leading-tight text-foreground">
            Master the<br /><span className="neon-text">Digital</span><br />Frontier
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="text-base text-muted-foreground max-w-xl mx-auto mb-10">
            From zero to hero in web development and cybersecurity. Join thousands of students breaking codes and building futures with hands-on, project-based learning.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button onClick={handleStartLearning} size="lg" className="glow-btn bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-8 gap-2">
              Start Learning <ArrowRight className="h-4 w-4" />
            </Button>
            <Link to="/courses" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <Play className="h-4 w-4" />
              <span className="text-sm font-medium">View Curriculum</span>
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }} className="flex justify-center gap-8 md:gap-16 mt-16">
            {[
              { value: "10K+", label: "Students" },
              { value: "50+", label: "Courses" },
              { value: "98%", label: "Success Rate" },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl md:text-3xl font-bold neon-text font-display">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.5 }} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-16 max-w-2xl mx-auto">
            <div className="relative rounded-2xl overflow-hidden group cursor-pointer">
              <img src={courseFrontend} alt="Frontend Development" loading="lazy" width={800} height={512} className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
              <div className="absolute bottom-4 left-4 flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/20 backdrop-blur-sm"><Code className="h-4 w-4 text-primary" /></div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Frontend</p>
                  <p className="text-xs text-muted-foreground">HTML, CSS, JS</p>
                </div>
              </div>
            </div>
            <div className="relative rounded-2xl overflow-hidden group cursor-pointer">
              <img src={courseSecurity} alt="Cybersecurity" loading="lazy" width={800} height={512} className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
              <div className="absolute bottom-4 left-4 flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/20 backdrop-blur-sm"><Shield className="h-4 w-4 text-primary" /></div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Security</p>
                  <p className="text-xs text-muted-foreground">Ethical Hacking</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.7 }} className="mt-12 inline-flex items-center gap-3 px-6 py-4 rounded-2xl cyber-card">
            <div className="text-3xl font-bold neon-text font-display">10+</div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Years</p>
              <p className="text-xs text-muted-foreground">Experience</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
