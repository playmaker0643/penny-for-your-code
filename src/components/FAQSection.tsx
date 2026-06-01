import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "Do I need prior coding experience to join?",
    a: "Not at all! Our Frontend Mastery course starts from absolute zero — HTML basics, your first webpage, and progressively builds to advanced React applications. We designed the curriculum for complete beginners.",
  },
  {
    q: "How does the sequential lesson system work?",
    a: "Each course has ordered lessons that must be completed in sequence. You'll watch the video, complete the practice exercises, and pass a short quiz before the next lesson unlocks. This ensures you build a solid foundation.",
  },
  {
    q: "What makes the security training different?",
    a: "After completing each web project, you'll go through a dedicated security module where you learn to identify vulnerabilities in your own code, implement authentication, protect APIs, and understand common attack vectors like XSS and SQL injection.",
  },
  {
    q: "Can I practice coding directly on the platform?",
    a: "Yes! Our built-in Code Sandbox supports HTML, CSS, JavaScript, and more. You can write code, see real-time previews, and save your projects — all without leaving the browser.",
  },
  {
    q: "How do I get help if I'm stuck?",
    a: "You can message instructors directly through our built-in chat system, participate in community discussions, and access detailed code walkthroughs for every lesson. Our instructors typically respond within 24 hours.",
  },
  {
    q: "Will I receive a certificate?",
    a: "Yes! Upon completing each course track, you'll receive an industry-recognized certificate that you can share on LinkedIn and include in your portfolio.",
  },
];

const FAQSection = () => {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-20 border-t border-border/50">
      <div className="container">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-4"
        >
          <span className="inline-flex items-center px-3 py-1 rounded-full border border-primary/20 bg-primary/10 text-xs font-semibold text-primary">
            FAQ
          </span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-bold font-display text-center mb-4"
        >
          Frequently Asked <span className="neon-text">Questions</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-muted-foreground text-center max-w-xl mx-auto mb-12"
        >
          Everything you need to know about CodeBreakers before getting started.
        </motion.p>

        <div className="max-w-2xl mx-auto space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="cyber-card rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <span className="text-sm font-semibold text-foreground pr-4">{faq.q}</span>
                <ChevronDown
                  className={`h-4 w-4 text-primary shrink-0 transition-transform ${open === i ? "rotate-180" : ""}`}
                />
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="px-4 pb-4">
                      <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
