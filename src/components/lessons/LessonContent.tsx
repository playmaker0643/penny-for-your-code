import { useMemo, Fragment } from "react";
import ReactMarkdown from "react-markdown";
import InteractiveCodeBlock from "./InteractiveCodeBlock";

interface LessonContentProps {
  /** Rich HTML output from the WYSIWYG editor (TipTap). */
  html?: string | null;
  /** Plain text / markdown fallback. */
  text?: string | null;
  className?: string;
}

interface Segment {
  type: "html" | "code";
  value: string;
  language?: string;
}

/**
 * Detects language from a <pre><code class="language-xxx"> block, or by inspecting the
 * snippet body for telltale HTML/CSS/JS/Python/JSON/Bash markers.
 */
const detectLanguage = (codeEl: string, raw: string): string => {
  const classMatch = codeEl.match(/class=["'][^"']*language-([\w-]+)/i);
  if (classMatch) return classMatch[1].toLowerCase();
  const trimmed = raw.trim();
  if (/^\s*<!doctype|^\s*<html|^\s*<[a-z][\s\S]*>/i.test(trimmed)) return "html";
  if (/^\s*[.#]?[\w-]+\s*\{[\s\S]*\}\s*$/.test(trimmed) && /[:;]/.test(trimmed)) return "css";
  if (/^\s*[\[{][\s\S]*[\]}]\s*$/.test(trimmed)) {
    try { JSON.parse(trimmed); return "json"; } catch { /* fallthrough */ }
  }
  if (/^\s*(def |import |from |print\()/m.test(trimmed)) return "python";
  if (/^\s*(\$|#!\/bin\/)/m.test(trimmed) || /^\s*(npm|yarn|bun|pnpm|git|curl|cd|ls|mkdir|echo) /m.test(trimmed)) return "bash";
  if (/\b(function|const|let|var|=>|console\.)/.test(trimmed)) return "javascript";
  return "markup";
};

const decodeEntities = (s: string): string => {
  if (typeof document === "undefined") return s;
  const ta = document.createElement("textarea");
  ta.innerHTML = s;
  return ta.value;
};

/** Splits HTML content into <pre><code> code segments and surrounding HTML segments. */
const splitHtml = (html: string): Segment[] => {
  const segments: Segment[] = [];
  const re = /<pre[^>]*>\s*(<code[^>]*>)([\s\S]*?)<\/code>\s*<\/pre>/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m.index > last) segments.push({ type: "html", value: html.slice(last, m.index) });
    const codeTag = m[1];
    const inner = decodeEntities(m[2].replace(/<[^>]+>/g, ""));
    segments.push({ type: "code", value: inner, language: detectLanguage(codeTag, inner) });
    last = re.lastIndex;
  }
  if (last < html.length) segments.push({ type: "html", value: html.slice(last) });
  return segments;
};

const LessonContent = ({ html, text, className }: LessonContentProps) => {
  const htmlSegments = useMemo(() => (html ? splitHtml(html) : []), [html]);

  if (html) {
    return (
      <div className={className}>
        {htmlSegments.map((seg, i) =>
          seg.type === "code" ? (
            <InteractiveCodeBlock key={i} code={seg.value.replace(/\n$/, "")} language={seg.language} />
          ) : (
            <div
              key={i}
              className="prose prose-sm prose-invert max-w-none [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
              dangerouslySetInnerHTML={{ __html: seg.value }}
            />
          )
        )}
      </div>
    );
  }

  if (text) {
    return (
      <div className={className}>
        <ReactMarkdown
          components={{
            code({ inline, className: cn, children, ...props }: any) {
              const lang = /language-(\w+)/.exec(cn || "")?.[1];
              const value = String(children).replace(/\n$/, "");
              if (inline || (!lang && !value.includes("\n"))) {
                return (
                  <code className="px-1 py-0.5 rounded bg-muted text-primary font-mono text-[12px]" {...props}>
                    {children}
                  </code>
                );
              }
              return <InteractiveCodeBlock code={value} language={lang} />;
            },
            p: ({ children }) => <p className="text-sm text-foreground leading-relaxed mb-3">{children}</p>,
            h1: ({ children }) => <h1 className="text-lg font-bold font-display text-foreground mt-4 mb-2">{children}</h1>,
            h2: ({ children }) => <h2 className="text-base font-bold font-display text-foreground mt-3 mb-2">{children}</h2>,
            h3: ({ children }) => <h3 className="text-sm font-bold font-display text-foreground mt-3 mb-2">{children}</h3>,
            ul: ({ children }) => <ul className="list-disc pl-6 text-sm text-foreground space-y-1 mb-3">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-6 text-sm text-foreground space-y-1 mb-3">{children}</ol>,
            a: ({ children, href }) => (
              <a href={href} target="_blank" rel="noreferrer" className="text-primary underline">{children}</a>
            ),
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
    );
  }

  return <Fragment />;
};

export default LessonContent;
