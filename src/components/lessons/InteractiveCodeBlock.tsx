import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check } from "lucide-react";
import LivePreview from "./LivePreview";

interface InteractiveCodeBlockProps {
  code: string;
  language?: string;
  /** When true, allow rendering a live preview below the snippet for web languages. */
  enablePreview?: boolean;
  /** Optional companion blocks for a combined preview (e.g. css + js paired with html). */
  companions?: { html?: string; css?: string; js?: string };
}

const normalizeLang = (raw?: string): string => {
  const l = (raw || "").toLowerCase().trim();
  const map: Record<string, string> = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    py: "python",
    sh: "bash",
    shell: "bash",
    html: "markup",
    xml: "markup",
    json: "json",
    css: "css",
  };
  return map[l] || l || "markup";
};

const labelFor = (raw?: string) => {
  const l = (raw || "").toLowerCase();
  if (l === "markup" || l === "html") return "HTML";
  if (l === "js" || l === "javascript") return "JavaScript";
  if (l === "ts" || l === "typescript") return "TypeScript";
  if (l === "py" || l === "python") return "Python";
  if (l === "css") return "CSS";
  if (l === "json") return "JSON";
  if (l === "bash" || l === "sh" || l === "shell") return "Bash";
  return (raw || "Code").toUpperCase();
};

const isPreviewableLang = (l?: string) => {
  const x = (l || "").toLowerCase();
  return ["html", "markup", "css", "js", "javascript"].includes(x);
};

const InteractiveCodeBlock = ({
  code,
  language,
  enablePreview = true,
  companions,
}: InteractiveCodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const lang = normalizeLang(language);
  const label = labelFor(language);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const showPreview = enablePreview && isPreviewableLang(language);
  const previewProps = showPreview
    ? (() => {
        const l = (language || "").toLowerCase();
        if (l === "html" || l === "markup") return { html: code, ...companions };
        if (l === "css") return { html: companions?.html || "", css: code, js: companions?.js };
        return { html: companions?.html || "", css: companions?.css, js: code };
      })()
    : null;

  return (
    <div className="my-3">
      <div className="rounded-lg overflow-hidden border border-border/60 bg-[#1e1e1e]">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40 bg-black/40">
          <span className="text-[11px] font-mono text-primary uppercase tracking-wider">{label}</span>
          <button
            onClick={handleCopy}
            className="text-[11px] font-mono text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
            aria-label="Copy code"
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="overflow-x-auto text-[12px]">
          <SyntaxHighlighter
            language={lang}
            style={vscDarkPlus}
            showLineNumbers
            wrapLongLines={false}
            customStyle={{
              margin: 0,
              padding: "12px",
              background: "transparent",
              fontSize: "12px",
              lineHeight: 1.5,
            }}
            lineNumberStyle={{ color: "rgba(148,163,184,0.5)", paddingRight: "12px", minWidth: "1.5em" }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      </div>

      {showPreview && previewProps && <LivePreview {...previewProps} />}
    </div>
  );
};

export default InteractiveCodeBlock;
