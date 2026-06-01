import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { Code, Shield } from "lucide-react";

const About = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <div className="pt-24 pb-20">
      <div className="container max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl md:text-5xl font-bold font-display mb-6">
            About <span className="neon-text">CodeBreakers</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-12">
            An e-learning platform built to train the next generation of software developers, ethical hackers, and cybersecurity specialists.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="cyber-card rounded-xl p-8 mb-8"
        >
          <h2 className="text-2xl font-bold font-display mb-4">Our Mission</h2>
          <p className="text-muted-foreground leading-relaxed">
            Our goal is to train and develop junior programmers, software developers, ethical hackers, 
            and penetration testers. We believe in hands-on, project-based learning combined with real-world 
            security training to produce well-rounded tech professionals.
          </p>
        </motion.div>

        <h2 className="text-2xl font-bold font-display mb-6 mt-12">The Founders</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              name: "Abdussalam Nasir",
              alias: "Codebreaker",
              role: "Software Engineer",
              icon: Code,
              desc: "A passionate software engineer dedicated to building scalable systems and teaching the art of coding.",
            },
            {
              name: "Abdulhafiz Nasir",
              alias: "Playmaker",
              role: "Senior Cybersecurity Specialist",
              icon: Shield,
              desc: "A cybersecurity expert focused on ethical hacking, penetration testing, and securing digital infrastructure.",
            },
          ].map((founder, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="cyber-card rounded-xl p-6"
            >
              <founder.icon className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold font-display text-foreground">{founder.name}</h3>
              <p className="text-sm text-primary font-mono mb-1">@{founder.alias}</p>
              <p className="text-sm text-cyber-blue mb-3">{founder.role}</p>
              <p className="text-sm text-muted-foreground">{founder.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
    <Footer />
  </div>
);

export default About;
