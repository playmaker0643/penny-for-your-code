import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, RefreshCw } from "lucide-react";

interface LivePreviewProps {
  html?: string;
  css?: string;
  js?: string;
}

/**
 * Sandboxed live preview for HTML/CSS/JS lesson snippets.
 * Runs inside an isolated iframe with `sandbox="allow-scripts"` (NO allow-same-origin),
 * so the preview cannot read cookies, localStorage, or reach window.parent of the host app.
 */
const LivePreview = ({ html = "", css = "", js = "" }: LivePreviewProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const srcDoc = useMemo(() => {
    const safeJs = (js || "").replace(/<\/script>/gi, "<\\/script>");
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  html,body{margin:0;padding:12px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;background:#ffffff;}
  ${css}
</style>
</head>
<body>
${html}
<script>
  try { ${safeJs} } catch (e) {
    const pre = document.createElement('pre');
    pre.style.cssText = 'color:#dc2626;background:#fef2f2;padding:8px;border-radius:6px;font:12px ui-monospace,monospace;white-space:pre-wrap;';
    pre.textContent = 'Error: ' + (e && e.message ? e.message : e);
    document.body.appendChild(pre);
  }
</script>
</body></html>`;
  }, [html, css, js]);

  useEffect(() => {
    // Debounced reload handled via key on iframe element.
  }, [srcDoc]);

  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden my-3">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/60 bg-muted/40">
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
          <Eye className="h-3 w-3 text-primary" /> Live Preview
        </div>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          className="text-[11px] font-mono text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
          aria-label="Reload preview"
        >
          <RefreshCw className="h-3 w-3" /> Reload
        </button>
      </div>
      <iframe
        key={reloadKey}
        ref={iframeRef}
        title="Lesson live preview"
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        className="w-full h-64 bg-white"
        loading="lazy"
      />
    </div>
  );
};

export default LivePreview;
