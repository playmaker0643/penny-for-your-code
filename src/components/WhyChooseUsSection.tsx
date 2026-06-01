import { motion } from "framer-motion";
import { Zap, Globe, ShieldCheck, Code2, Laptop, HeadphonesIcon } from "lucide-react";
import classroomImg from "@/assets/classroom.jpg";

const features = [
  { icon: Code2, title: "Live Code Sandbox", desc: "Practice HTML, CSS, JavaScript, Python, and Node.js in a real-time browser-based coding environment with instant preview." },
  { icon: Globe, title: "Project-Based Learning", desc: "Build real-world applications from scratch — portfolios, e-commerce sites, APIs, and full-stack web apps." },
  { icon: ShieldCheck, title: "Security-First Approach", desc: "Every project includes a security module teaching authentication, API protection, and vulnerability assessment." },
  { icon: Zap, title: "Sequential Progression", desc: "Lessons unlock step-by-step. You must complete each module before advancing, ensuring deep understanding." },
  { icon: Laptop, title: "Virtual Classrooms", desc: "Join live sessions with instructors, participate in Q&A, and collaborate with fellow students in real-time." },
  { icon: HeadphonesIcon, title: "1-on-1 Mentorship", desc: "Get direct messaging access to instructors for personalized guidance, code reviews, and career advice." },
];

const WhyChooseUsSection = () => (
  <section className="py-20 border-t border-border/50">
    <div className="container">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-4"
          >
            <span className="inline-flex items-center px-3 py-1 rounded-full border border-primary/20 bg-primary/10 text-xs font-semibold text-primary">
              Why CodeBreakers
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold font-display mb-4"
          >
            More Than Just <span className="neon-text">Courses</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mb-8 max-w-lg"
          >
            CodeBreakers isn't just another e-learning platform. We combine structured video lessons,
            hands-on coding practice, real-time collaboration, and cybersecurity training into one
            comprehensive platform designed to launch your tech career.
          </motion.p>

          <div className="rounded-2xl overflow-hidden">
            <img
              src={classroomImg}
              alt="Students learning to code"
              loading="lazy"
              width={800}
              height={512}
              className="w-full h-64 object-cover"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="cyber-card rounded-xl p-4"
            >
              <f.icon className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-semibold text-foreground text-sm mb-1 font-display">{f.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default WhyChooseUsSection;
