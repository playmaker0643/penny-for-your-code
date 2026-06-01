import { motion } from "framer-motion";
import { CheckCircle2, Users, BookOpen, Award, TrendingUp, Target, Rocket, GraduationCap } from "lucide-react";
import classroomImg from "@/assets/classroom.jpg";

const benefits = [
  "Project-based learning with real-world applications",
  "Expert instructors from top tech companies",
  "Lifetime access to course materials and updates",
  "Industry-recognized certificates upon completion",
  "Built-in coding sandbox for hands-on practice",
  "Cybersecurity training integrated into every course",
  "Direct messaging with instructors for 1-on-1 support",
  "Community of thousands of fellow learners",
];

const stats = [
  { icon: Users, value: "10K+", label: "Active Students" },
  { icon: BookOpen, value: "50+", label: "Expert Courses" },
  { icon: Award, value: "98%", label: "Success Rate" },
  { icon: TrendingUp, value: "95%", label: "Job Placement" },
];

const mission = [
  { icon: Target, title: "Our Mission", desc: "To train and develop the next generation of junior programmers, software developers, ethical hackers, and penetration testers through practical, hands-on education." },
  { icon: Rocket, title: "Our Vision", desc: "To become the leading platform for tech education in Africa and beyond, producing world-class developers and cybersecurity professionals." },
  { icon: GraduationCap, title: "Our Impact", desc: "Over 10,000 students trained, hundreds of careers launched, and a growing community of developers who are shaping the digital future." },
];

const AboutSection = () => (
  <section className="py-20 border-t border-border/50">
    <div className="container">
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mb-4"
      >
        <span className="inline-flex items-center px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-xs font-semibold text-primary">
          About Us
        </span>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-3xl md:text-4xl font-bold font-display mb-6"
      >
        Who We <span className="neon-text">Are</span>
      </motion.h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mb-6"
          >
            We are a collective of developers and security experts dedicated to
            democratizing tech education. Our hands-on approach ensures you don't
            just learn—you build. Every course is designed with real-world projects
            that prepare you for actual industry challenges.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="text-muted-foreground mb-6"
          >
            Founded by <strong className="text-foreground">Abdussalam Nasir (Codebreaker)</strong>, a seasoned software
            engineer, and <strong className="text-foreground">Abdulhafiz Nasir (Playmaker)</strong>, a senior cybersecurity
            specialist, CodeBreakers represents the perfect blend of development expertise and
            security knowledge. Together, they've trained thousands of students across Nigeria and beyond.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground mb-8"
          >
            The name "CodeBreakers" represents our dual expertise: one breaks down complex code into
            teachable concepts, while the other breaks through security barriers to teach ethical hacking.
            Together, we provide a 360° tech education experience.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.25 }}
            className="space-y-3"
          >
            {benefits.map((b, i) => (
              <div key={i} className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <span className="text-sm text-muted-foreground">{b}</span>
              </div>
            ))}
          </motion.div>
        </div>

        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl overflow-hidden"
          >
            <img
              src={classroomImg}
              alt="CodeBreakers classroom"
              loading="lazy"
              width={800}
              height={512}
              className="w-full h-64 object-cover"
            />
          </motion.div>

          {mission.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="cyber-card rounded-xl p-5"
            >
              <div className="flex items-start gap-3">
                <item.icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-foreground text-sm mb-1">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="cyber-card rounded-2xl p-6 text-center"
          >
            <stat.icon className="h-6 w-6 text-primary mx-auto mb-3" />
            <div className="text-2xl font-bold neon-text font-display">{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default AboutSection;
