import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const CTASection = () => {
  const { user, role } = useAuth();
  const target = user ? (role === "admin" ? "/admin" : "/student") : "/register";
  return (
  <section className="py-20 border-t border-border/50 grid-bg">
    <div className="container">
      <div className="max-w-2xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 mb-8">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-xs font-semibold text-primary">Start Your Journey Today</span>
          </div>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-3xl md:text-5xl font-bold font-display mb-6"
        >
          Ready to Break
          <br />
          the <span className="neon-text">Code</span>?
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-muted-foreground max-w-md mx-auto mb-8"
        >
          Join thousands of students who have transformed their careers with CodeBreakers.
          Your future in tech starts here.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="flex flex-col items-center gap-4"
        >
          <Link to={target}>
            <Button size="lg" className="glow-btn bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-8 gap-2">
              {user ? "Go to Dashboard" : "Enroll Now"} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/contact" className="text-sm text-foreground font-medium hover:text-primary transition-colors">
            Contact Us
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap justify-center gap-6 mt-10 text-xs text-muted-foreground"
        >
          <span className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> 7-day free trial</span>
          <span className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> Cancel anytime</span>
          <span className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> Lifetime access</span>
        </motion.div>
      </div>
    </div>
  </section>
);
};

export default CTASection;
