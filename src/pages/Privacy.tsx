import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";

const sections = [
  { title: "Information We Collect", content: "We collect information you provide when registering, including your name, email, and academic progress. We also collect usage data to improve our platform." },
  { title: "How We Use Your Data", content: "Your data is used to provide and improve our educational services, track your learning progress, and communicate important updates about courses and assignments." },
  { title: "Data Security", content: "We implement industry-standard security measures to protect your personal information, including encryption, secure authentication, and regular security audits." },
  { title: "Data Sharing", content: "We do not sell your personal information. Data may be shared with instructors for educational purposes and with service providers who help us operate the platform." },
  { title: "Your Rights", content: "You have the right to access, update, or delete your personal information at any time. Contact us to exercise these rights." },
];

const Privacy = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <div className="pt-24 pb-20">
      <div className="container max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl md:text-5xl font-bold font-display mb-4">
            Privacy <span className="neon-text">Policy</span>
          </h1>
          <p className="text-muted-foreground mb-10">Last updated: March 2026</p>
        </motion.div>

        <div className="space-y-6">
          {sections.map((section, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="cyber-card rounded-xl p-6"
            >
              <h2 className="text-lg font-semibold font-display text-foreground mb-3">{section.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
    <Footer />
  </div>
);

export default Privacy;
