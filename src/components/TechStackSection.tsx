import { motion } from "framer-motion";
import codingHandsImg from "@/assets/coding-hands.jpg";

const techItems = [
  { category: "Frontend", items: ["HTML5", "CSS3", "JavaScript ES6+", "React", "TypeScript", "Tailwind CSS", "Next.js"] },
  { category: "Backend", items: ["Node.js", "Python", "Express.js", "Django", "REST APIs", "GraphQL", "PostgreSQL"] },
  { category: "Security", items: ["OWASP Top 10", "Kali Linux", "Burp Suite", "Nmap", "Wireshark", "Metasploit", "JWT Security"] },
  { category: "DevOps", items: ["Git & GitHub", "Docker", "CI/CD", "Linux", "AWS Basics", "Nginx", "Deployment"] },
];

const TechStackSection = () => (
  <section className="py-20 border-t border-border/50 grid-bg">
    <div className="container">
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="text-center mb-4"
      >
        <span className="inline-flex items-center px-3 py-1 rounded-full border border-primary/20 bg-primary/10 text-xs font-semibold text-primary">
          Tech Arsenal
        </span>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-3xl md:text-4xl font-bold font-display text-center mb-4"
      >
        Technologies You'll <span className="neon-text">Master</span>
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="text-muted-foreground text-center max-w-2xl mx-auto mb-12"
      >
        From modern JavaScript frameworks to ethical hacking tools, our curriculum covers the 
        full spectrum of technologies used by professional developers and security engineers worldwide.
      </motion.p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-12">
        {techItems.map((group, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="cyber-card rounded-xl p-5"
          >
            <h3 className="text-sm font-bold font-display text-primary mb-3">{group.category}</h3>
            <div className="flex flex-wrap gap-2">
              {group.items.map((item, j) => (
                <span key={j} className="px-3 py-1.5 rounded-full bg-muted border border-border/50 text-xs text-foreground font-medium">
                  {item}
                </span>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="rounded-2xl overflow-hidden max-w-3xl mx-auto"
      >
        <img
          src={codingHandsImg}
          alt="Hands-on coding practice"
          loading="lazy"
          width={800}
          height={512}
          className="w-full h-64 md:h-80 object-cover"
        />
      </motion.div>
    </div>
  </section>
);

export default TechStackSection;
