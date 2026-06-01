import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const buildPreview = (files: any[]) => {
  const html = files.find((f: any) => f.path?.endsWith("index.html"))?.content || "<h1>No preview</h1>";
  const css = files.filter((f: any) => f.path?.endsWith(".css")).map((f: any) => f.content).join("\n");
  const js = files.filter((f: any) => f.path?.endsWith(".js")).map((f: any) => f.content).join("\n");
  return `<!doctype html><html><head><style>${css}</style></head><body>${html}<script>${js}<\/script></body></html>`;
};

export default function PublicProjectPreview() {
  const { id } = useParams();
  const [doc, setDoc] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data, error } = await supabase
        .from("public_projects")
        .select("files, is_public, name")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return setErr("Project not found");
      if (!data.is_public) return setErr("This project is private");
      document.title = data.name || "Project Preview";
      setDoc(buildPreview(data.files as any));
    })();
  }, [id]);

  if (err) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground font-mono text-sm">
        {err}
      </div>
    );
  }
  if (!doc) return null;
  return (
    <iframe
      title="Project Preview"
      srcDoc={doc}
      className="fixed inset-0 w-screen h-screen bg-white border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  );
}
