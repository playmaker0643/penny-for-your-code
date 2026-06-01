import { useState } from "react";
import { X, Send, Eye, Copy } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onClose: () => void;
  onSend: (code: string) => void;
}

const CodeSpaceComposer = ({ onClose, onSend }: Props) => {
  const [code, setCode] = useState("<h1>Hello</h1>\n<style>h1{color:#CCFF00}</style>");
  const [previewing, setPreviewing] = useState(false);

  return (
    <div className="fixed inset-0 z-[150] bg-black/70 flex items-end">
      <div className="w-full bg-card border-t border-primary/30 rounded-t-2xl flex flex-col" style={{ height: "70vh" }}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
          <p className="text-sm font-bold">Code Space</p>
          <div className="flex gap-2">
            <button onClick={() => { navigator.clipboard.writeText(code); toast.success("Copied!"); }} className="p-1 text-muted-foreground"><Copy className="h-4 w-4" /></button>
            <button onClick={() => setPreviewing(true)} className="p-1 text-muted-foreground"><Eye className="h-4 w-4" /></button>
            <button onClick={onClose} className="p-1 text-muted-foreground"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="flex-1 bg-background text-foreground font-mono text-sm p-3 outline-none resize-none"
          style={{ fontSize: 16 }}
          placeholder="Write code..."
        />
        <div className="p-2 border-t border-border/30 flex justify-end">
          <button onClick={() => { onSend(code); onClose(); }} className="bg-primary text-primary-foreground font-mono font-bold text-sm px-4 py-2 rounded-xl flex items-center gap-2">
            <Send className="h-3.5 w-3.5" /> Send
          </button>
        </div>
        {previewing && (
          <div className="fixed inset-0 z-[200] bg-background flex flex-col">
            <div className="h-12 flex items-center justify-between px-4 bg-card border-b">
              <span className="text-sm font-mono">Preview</span>
              <button onClick={() => setPreviewing(false)} className="text-xs text-primary font-mono">Close</button>
            </div>
            <iframe srcDoc={code} className="flex-1 bg-white" sandbox="allow-scripts" title="preview" />
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeSpaceComposer;
