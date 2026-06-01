import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import blogAi from "@/assets/blog-ai.jpg";
import blogSecurity from "@/assets/blog-security.jpg";
import blogReact from "@/assets/blog-react.jpg";

const posts = [
  {
    image: blogAi,
    author: "Abdussalam Nasir",
    date: "Mar 15, 2024",
    readTime: "5 min read",
    title: "The Future of AI in Coding",
    desc: "Explore how artificial intelligence is revolutionizing software development and what it means for developers.",
  },
  {
    image: blogSecurity,
    date: "Mar 10, 2024",
    readTime: "8 min read",
    title: "10 Security Tips for 2024",
    desc: "Essential cybersecurity practices every developer should know to protect their...",
  },
  {
    image: blogReact,
    date: "Mar 5, 2024",
    readTime: "6 min read",
    title: "Why React Still Rules",
    desc: "An in-depth look at why React continues to dominate the frontend landscape in...",
  },
];

const BlogSection = () => (
  <section className="py-20 border-t border-border/50">
    <div className="container">
      <div className="flex items-center justify-between mb-4">
        <span className="inline-flex items-center px-3 py-1 rounded-full border border-primary/20 bg-primary/10 text-xs font-semibold text-primary">
          Latest Intel
        </span>
      </div>

      <div className="flex items-center justify-between mb-10">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-bold font-display"
        >
          From Our <span className="neon-text">Blog</span>
        </motion.h2>
        <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10 gap-2 hidden sm:flex">
          View All Posts <ArrowRight className="h-3 w-3" />
        </Button>
      </div>

      <div className="space-y-8">
        {posts.map((post, i) => (
          <motion.article
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="group cursor-pointer"
          >
            <div className="rounded-2xl overflow-hidden mb-4">
              <img
                src={post.image}
                alt={post.title}
                loading="lazy"
                width={800}
                height={512}
                className="w-full h-48 md:h-56 object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
              {post.author && <span>{post.author}</span>}
              <span>{post.date}</span>
              <span>{post.readTime}</span>
            </div>
            <h3 className="text-lg font-bold font-display text-foreground mb-1 group-hover:text-primary transition-colors">
              {post.title}
            </h3>
            <p className="text-sm text-muted-foreground mb-2">{post.desc}</p>
            <span className="text-sm text-primary font-medium flex items-center gap-1">
              Read More <ArrowRight className="h-3 w-3" />
            </span>
          </motion.article>
        ))}
      </div>
    </div>
  </section>
);

export default BlogSection;
