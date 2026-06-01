import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Star, Quote } from "lucide-react";
import testimonial1 from "@/assets/testimonial-1.jpg";

const testimonials = [
  {
    name: "Sarah Johnson",
    role: "Frontend Developer at Google",
    image: testimonial1,
    text: "\"CodeBreakers transformed my career. The hands-on approach and real-world projects gave me the confidence to land my dream job at Google. The instructors are world-class!\"",
  },
  {
    name: "Ahmed Hassan",
    role: "Security Engineer at Microsoft",
    image: testimonial1,
    text: "\"The cybersecurity track at CodeBreakers is unmatched. I went from zero knowledge to passing my OSCP certification in just 6 months. Incredible learning experience!\"",
  },
  {
    name: "Maria Lopez",
    role: "Full-Stack Developer at Meta",
    image: testimonial1,
    text: "\"I tried many platforms before CodeBreakers. The structured, project-based approach here is what finally made everything click for me. Best investment in my career.\"",
  },
];

const TestimonialsSection = () => {
  const [current, setCurrent] = useState(0);

  const next = () => setCurrent((c) => (c + 1) % testimonials.length);
  const prev = () => setCurrent((c) => (c - 1 + testimonials.length) % testimonials.length);

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
            Testimonials
          </span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-bold font-display text-center mb-4"
        >
          Graduate <span className="neon-text">Stories</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-muted-foreground text-center max-w-xl mx-auto mb-12"
        >
          Hear from our alumni who have transformed their careers through CodeBreakers.
        </motion.p>

        <div className="max-w-lg mx-auto">
          <div className="cyber-card rounded-2xl p-8 text-center">
            <div className="flex justify-center mb-4">
              <Quote className="h-8 w-8 text-primary/30" />
            </div>
            <div className="flex justify-center gap-1 mb-6">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-primary text-primary" />
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                  {testimonials[current].text}
                </p>
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={testimonials[current].image}
                    alt={testimonials[current].name}
                    loading="lazy"
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-full object-cover border-2 border-primary/30"
                  />
                  <div>
                    <p className="font-semibold text-foreground text-sm">{testimonials[current].name}</p>
                    <p className="text-xs text-primary">{testimonials[current].role}</p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="flex items-center justify-center gap-4 mt-8">
              <button onClick={prev} className="p-2 rounded-full border border-border hover:border-primary/30 transition-colors">
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <div className="flex gap-2">
                {testimonials.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    className={`h-2 rounded-full transition-all ${i === current ? "w-6 bg-primary" : "w-2 bg-muted"}`}
                  />
                ))}
              </div>
              <button onClick={next} className="p-2 rounded-full border border-border hover:border-primary/30 transition-colors">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
