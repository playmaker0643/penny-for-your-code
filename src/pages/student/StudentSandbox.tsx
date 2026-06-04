import { useState, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Play, RotateCcw, Copy, Maximize2, X, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import Editor from "@monaco-editor/react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const languages = [
  { value: "html", label: "HTML/CSS/JS" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "nodejs", label: "Node.js" },
];

const defaultHtml = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Hello, CodeBreakers! 🚀</h1>
  <p id="demo"></p>
  <script src="script.js"></script>
</body>
</html>`;

const defaultCss = `body {
  font-family: sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  margin: 0;
  background: #0a0f1a;
  color: #00ffaa;
}
h1 { font-size: 2rem; }`;

const defaultJs = `document.getElementById('demo').textContent = 'JavaScript is working!';
console.log("Welcome to the sandbox!");`;

const defaultCode: Record<string, string> = {
  javascript: `// JavaScript Sandbox\nconsole.log("Hello from JavaScript!");`,
  python: `# Python Sandbox\nprint("Hello from Python!")`,
  java: `// Java Sandbox\npublic class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello from Java!");\n  }\n}`,
  cpp: `// C++ Sandbox\n#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << "Hello from C++!" << endl;\n  return 0;\n}`,
  nodejs: `// Node.js Sandbox\nconst http = require('http');\nconsole.log("Hello from Node.js!");`,
};

const StudentSandbox = () => {
  const [language, setLanguage] = useState("html");
  const [htmlCode, setHtmlCode] = useState(defaultHtml);
  const [cssCode, setCssCode] = useState(defaultCss);
  const [jsCode, setJsCode] = useState(defaultJs);
  const [activeTab, setActiveTab] = useState<"html" | "css" | "js">("html");
  const [singleCode, setSingleCode] = useState(defaultCode.javascript);
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [fullPreview, setFullPreview] = useState(false);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    setOutput("");
    if (lang !== "html") {
      setSingleCode(defaultCode[lang] || "");
    }
  };

  const copyCode = () => {
    const code = getCurrentCode();
    navigator.clipboard.writeText(code);
    toast.success("Code copied!");
  };

  const clearCode = () => {
    if (language === "html") {
      setHtmlCode("");
      setCssCode("");
      setJsCode("");
    } else {
      setSingleCode("");
    }
    toast.success("Code cleared");
  };

  const runCode = async () => {
    if (language === "html") {
      // Auto-wrap if no <html> document structure
      const hasDoc = /<html[\s>]/i.test(htmlCode) || /<!DOCTYPE/i.test(htmlCode);
      let combined: string;
      if (hasDoc) {
        combined = htmlCode
          .replace('<link rel="stylesheet" href="style.css">', `<style>${cssCode}</style>`)
          .replace('<script src="script.js"></script>', `<script>${jsCode}</script>`);
      } else {
        combined = `<!DOCTYPE html><html><head><style>${cssCode}</style></head><body>${htmlCode}<script>${jsCode}<\/script></body></html>`;
      }
      setOutput(combined);
    } else if (language === "javascript" || language === "nodejs") {
      try {
        const logs: string[] = [];
        const mockConsole = {
          log: (...args: any[]) => logs.push(args.map(a => typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)).join(" ")),
          error: (...args: any[]) => logs.push("ERROR: " + args.join(" ")),
          warn: (...args: any[]) => logs.push("WARN: " + args.join(" ")),
        };
        const fn = new Function("console", "require", singleCode);
        fn(mockConsole, () => ({}));
        setOutput(`<pre style="color:#00ffaa;font-family:monospace;padding:1rem;background:#0a0f1a;margin:0;min-height:100%">${logs.join("\n") || "(no output)"}</pre>`);
      } catch (err: any) {
        setOutput(`<pre style="color:#ff5555;font-family:monospace;padding:1rem;background:#0a0f1a;margin:0">${err.message}</pre>`);
      }
    } else {
      // Python, Java, C++ - use AI-powered execution
      setIsRunning(true);
      try {
        const { data, error } = await supabase.functions.invoke("run-code", {
          body: { code: singleCode, language },
        });
        if (error) throw error;
        const result = data.output || data.error || "(no output)";
        setOutput(`<pre style="color:#00ffaa;font-family:monospace;padding:1rem;background:#0a0f1a;margin:0;min-height:100%;white-space:pre-wrap">${result.replace(/</g, "&lt;")}</pre>`);
      } catch (err: any) {
        setOutput(`<pre style="color:#ff5555;font-family:monospace;padding:1rem;background:#0a0f1a;margin:0">Error: ${err.message || "Failed to execute code"}</pre>`);
      } finally {
        setIsRunning(false);
      }
    }
  };

  const getEditorLanguage = () => {
    if (language === "html") {
      return activeTab === "html" ? "html" : activeTab === "css" ? "css" : "javascript";
    }
    if (language === "nodejs") return "javascript";
    if (language === "cpp") return "cpp";
    return language;
  };

  const getCurrentCode = () => {
    if (language === "html") {
      return activeTab === "html" ? htmlCode : activeTab === "css" ? cssCode : jsCode;
    }
    return singleCode;
  };

  const handleCodeChange = (val: string | undefined) => {
    const v = val || "";
    if (language === "html") {
      if (activeTab === "html") setHtmlCode(v);
      else if (activeTab === "css") setCssCode(v);
      else setJsCode(v);
    } else {
      setSingleCode(v);
    }
  };

  const getFileName = () => {
    if (language === "html") {
      return activeTab === "html" ? "index.html" : activeTab === "css" ? "style.css" : "script.js";
    }
    const ext: Record<string, string> = { javascript: "js", python: "py", java: "java", cpp: "cpp", nodejs: "js" };
    return `main.${ext[language] || "txt"}`;
  };

  // Full page preview modal
  if (fullPreview && output) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col">
        <div className="h-12 bg-card border-b border-border/50 flex items-center justify-between px-4">
          <span className="text-sm font-mono text-muted-foreground">Full Preview</span>
          <Button variant="ghost" size="sm" onClick={() => setFullPreview(false)}>
            Close
          </Button>
        </div>
        <iframe
          srcDoc={output}
          className="flex-1 w-full bg-background"
          sandbox="allow-scripts"
          title="full-preview"
        />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold font-display text-foreground">Code Sandbox</h2>
            <p className="text-sm text-muted-foreground">Write, run, and experiment with code</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            >
              {languages.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
            <Button onClick={runCode} disabled={isRunning} className="glow-btn bg-primary text-primary-foreground hover:bg-primary/90">
              <Play className="h-4 w-4 mr-2" /> {isRunning ? "Running..." : "Run"}
            </Button>
            <Button onClick={clearCode} variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10">
              <Eraser className="h-4 w-4 mr-2" /> Clear Code
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ height: "calc(100vh - 220px)" }}>
          <div className="cyber-card rounded-xl overflow-hidden border border-border/50 flex flex-col">
            {language === "html" ? (
              <div className="bg-muted px-2 py-1.5 border-b border-border/50 flex items-center justify-between">
                <div className="flex gap-1">
                  {(["html", "css", "js"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                        activeTab === tab
                          ? "bg-primary/20 text-primary font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tab === "html" ? "index.html" : tab === "css" ? "style.css" : "script.js"}
                    </button>
                  ))}
                </div>
                <button onClick={copyCode} className="text-muted-foreground hover:text-foreground p-1" title="Copy code">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="bg-muted px-4 py-2 border-b border-border/50 flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground">{getFileName()}</span>
                <button onClick={copyCode} className="text-muted-foreground hover:text-foreground p-1" title="Copy code">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="flex-1">
              <Editor
                height="100%"
                language={getEditorLanguage()}
                value={getCurrentCode()}
                onChange={handleCodeChange}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  fontFamily: "JetBrains Mono, monospace",
                  padding: { top: 16 },
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
          </div>

          <div className="cyber-card rounded-xl overflow-hidden border border-border/50 flex flex-col">
            <div className="bg-muted px-4 py-2 border-b border-border/50 flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground">output</span>
              {output && (
                <button onClick={() => setFullPreview(true)} className="text-muted-foreground hover:text-foreground p-1" title="Full page preview">
                  <Maximize2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex-1">
              {output ? (
                <iframe
                  srcDoc={output}
                  className="w-full h-full bg-background"
                  sandbox="allow-scripts"
                  title="output"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Click "Run" to see output
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentSandbox;
