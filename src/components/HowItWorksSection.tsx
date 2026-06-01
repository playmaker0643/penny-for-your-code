import { motion } from "framer-motion";
import { UserPlus, MonitorPlay, Award, Rocket, ShieldCheck } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    num: "01",
    title: "Enroll",
    desc: "Sign up and choose your learning path. Get instant access to our comprehensive curriculum. No credit card required for the 7-day free trial.",
  },
  {
    icon: MonitorPlay,
    num: "02",
    title: "Learn",
    desc: "Interactive video lessons, hands-on projects, and real-time coding exercises. Each lesson builds on the previous one with sequential progression.",
  },
  {
    icon: Rocket,
    num: "03",
    title: "Build",
    desc: "Apply your knowledge by building real-world projects in our Code Sandbox. Create portfolios, web apps, APIs, and security tools from scratch.",
  },
  {
    icon: ShieldCheck,
    num: "04",
    title: "Secure",
    desc: "After each project, complete a security training module. Learn to identify vulnerabilities, implement authentication, and protect your applications.",
  },
  {
    icon: Award,
    num: "05",
    title: "Achieve",
    desc: "Complete projects, pass assessments, earn industry-recognized certificates, and launch your career as a developer or cybersecurity professional.",
  },
];

const HowItWorksSection = () => (
  <section className="py-20 border-t border-border/50">
    <div className="container">
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="text-center mb-4"
      >
        <span className="inline-flex items-center px-3 py-1 rounded-full border border-primary/20 bg-primary/10 text-xs font-semibold text-primary">
          Your Journey
        </span>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-3xl md:text-4xl font-bold font-display text-center mb-4"
      >
        How It <span className="neon-text">Works</span>
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="text-muted-foreground text-center max-w-2xl mx-auto mb-12"
      >
        A structured path from enrollment to mastery. Follow our proven five-step
        methodology to achieve your tech career goals — from writing your first line
        of code to securing production applications.
      </motion.p>

      <div className="max-w-md mx-auto space-y-6">
        {steps.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="cyber-card rounded-2xl p-6"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-primary/10 shrink-0">
                <step.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="text-xs font-mono text-primary">{step.num}</span>
                <h3 className="text-lg font-bold font-display text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorksSection;
