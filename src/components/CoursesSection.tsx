import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { ArrowRight, Clock, BarChart3, Code, Server, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import courseFrontend from "@/assets/course-frontend.jpg";
import courseBackend from "@/assets/course-backend.jpg";
import courseSecurity from "@/assets/course-security.jpg";

const courses = [
  {
    title: "Frontend Mastery",
    desc: "Master modern frontend development with HTML, CSS, JavaScript, and React. Build responsive, interactive web applications from scratch. Learn component architecture, state management, and deploy production-ready apps.",
    tags: ["HTML5", "CSS3", "JavaScript ES6+", "React", "TypeScript", "Tailwind CSS"],
    weeks: "12 weeks",
    students: "1,250",
    level: "Beginner",
    icon: Code,
    image: courseFrontend,
    featured: true,
  },
  {
    title: "Backend Architecture",
    desc: "Build robust server-side applications with Node.js and Python. Design RESTful APIs, manage databases, implement authentication, and deploy scalable backend systems.",
    tags: ["Node.js", "Python", "Express", "PostgreSQL", "REST APIs", "Docker"],
    weeks: "16 weeks",
    students: "890",
    level: "Intermediate",
    icon: Server,
    image: courseBackend,
  },
  {
    title: "Cybersecurity Fundamentals",
    desc: "Learn ethical hacking, penetration testing, and security best practices. Understand how attacks work and how to defend against them using industry-standard tools.",
    tags: ["Kali Linux", "Burp Suite", "OWASP", "Nmap", "Metasploit", "Network Security"],
    weeks: "14 weeks",
    students: "720",
    level: "Advanced",
    icon: Shield,
    image: courseSecurity,
  },
];

const CoursesSection = () => {
  const { user, role } = useAuth();
  const enrollTarget = user ? (role === "admin" ? "/admin" : "/student") : "/register";
  return (
  <section className="py-20 border-t border-border/50 grid-bg">
    <div className="container">
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="text-center mb-4"
      >
        <span className="inline-flex items-center px-3 py-1 rounded-full border border-primary/20 bg-primary/10 text-xs font-semibold text-primary">
          Our Curriculum
        </span>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-3xl md:text-4xl font-bold font-display text-center mb-4"
      >
        Choose Your <span className="neon-text">Path</span>
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="text-muted-foreground text-center max-w-2xl mx-auto mb-12"
      >
        Structured learning paths designed to take you from beginner to professional
        in your chosen field. Each track includes video lessons, hands-on projects,
        coding exercises, and a security training module.
      </motion.p>

      <div className="space-y-6 max-w-3xl mx-auto">
        {courses.map((course, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="cyber-card rounded-2xl overflow-hidden"
          >
            {/* Image */}
            <div className="relative">
              <img
                src={course.image}
                alt={course.title}
                loading="lazy"
                width={800}
                height={512}
                className="w-full h-48 md:h-56 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
              <div className="absolute top-4 left-4">
                <div className="p-2 rounded-lg bg-primary/20 backdrop-blur-sm">
                  <course.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <h3 className="text-xl font-bold font-display text-foreground mb-2">{course.title}</h3>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{course.desc}</p>

              <div className="flex flex-wrap gap-2 mb-4">
                {course.tags.map((tag, j) => (
                  <span key={j} className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary font-medium">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {course.weeks}</span>
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {course.students} students</span>
                <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" /> {course.level}</span>
              </div>

              <Link to={enrollTarget}>
                <Button size="sm" className="glow-btn bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                  {user ? "Go to Dashboard" : "Enroll Now"} <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="text-center mt-10"
      >
        <Link to="/courses">
          <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 gap-2">
            View All Courses <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </motion.div>
    </div>
  </section>
);
};

export default CoursesSection;
