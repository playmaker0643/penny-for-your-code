import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { Code, Server, Shield, Lock, BookOpen } from "lucide-react";

const courseCategories = [
  {
    title: "Frontend Development",
    icon: Code,
    courses: [
      { name: "HTML & CSS Fundamentals", lessons: 0 },
      { name: "JavaScript Essentials", lessons: 0 },
      { name: "Advanced Frameworks (React)", lessons: 0 },
    ],
  },
  {
    title: "Backend Development",
    icon: Server,
    courses: [
      { name: "Node.js Fundamentals", lessons: 0 },
      { name: "Python Programming", lessons: 0 },
      { name: "APIs & Database Design", lessons: 0 },
    ],
  },
  {
    title: "Cybersecurity",
    icon: Shield,
    courses: [
      { name: "Ethical Hacking Basics", lessons: 0 },
      { name: "Penetration Testing", lessons: 0 },
      { name: "Network Security", lessons: 0 },
    ],
  },
  {
    title: "Security Training",
    icon: Lock,
    courses: [
      { name: "Web App Security", lessons: 0 },
      { name: "Authentication & Data Protection", lessons: 0 },
      { name: "Vulnerability Assessment", lessons: 0 },
    ],
  },
];

const Courses = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <div className="pt-24 pb-20">
      <div className="container max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl md:text-5xl font-bold font-display mb-4">
            Our <span className="neon-text">Courses</span>
          </h1>
          <p className="text-muted-foreground mb-12">Structured learning paths — courses will be added by administrators.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {courseCategories.map((cat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="cyber-card rounded-xl p-6"
            >
              <div className="flex items-center gap-3 mb-5">
                <cat.icon className="h-7 w-7 text-primary" />
                <h2 className="text-xl font-bold font-display text-foreground">{cat.title}</h2>
              </div>
              <div className="space-y-3">
                {cat.courses.map((course, j) => (
                  <div key={j} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">{course.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
    <Footer />
  </div>
);

export default Courses;
