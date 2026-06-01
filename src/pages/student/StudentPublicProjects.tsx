import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Folder, FileText, Trash2, Save, Eye, X, Globe, Lock, ChevronRight, ArrowLeft, Unlock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import Editor from "@monaco-editor/react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type FileNode = { path: string; content: string };

const detectLang = (path: string) => {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: any = { js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript", html: "html", css: "css", json: "json", md: "markdown", py: "python" };
  return map[ext || ""] || "plaintext";
};

const buildPreview = (files: FileNode[]) => {
  const html = files.find((f) => f.path.endsWith("index.html"))?.content || "<h1>No index.html</h1>";
  const css = files.filter((f) => f.path.endsWith(".css")).map((f) => f.content).join("\n");
  const js = files.filter((f) => f.path.endsWith(".js")).map((f) => f.content).join("\n");
  return `<!doctype html><html><head><style>${css}</style></head><body>${html}<script>${js}<\/script></body></html>`;
};

export default function StudentPublicProjects() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [active, setActive] = useState<any>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const { data: projects } = useQuery({
    queryKey: ["my-public-projects", user?.id],
    queryFn: async () => (await supabase.from("public_projects").select("*").eq("user_id", user!.id).order("updated_at", { ascending: false })).data || [],
    enabled: !!user,
  });

  const createProject = useMutation({
    mutationFn: async () => {
      const initialFiles: FileNode[] = [
        { path: "index.html", content: "<!doctype html>\n<html>\n<head>\n  <link rel='stylesheet' href='style.css'>\n</head>\n<body>\n  <h1>Hello!</h1>\n  <script src='script.js'></script>\n</body>\n</html>" },
        { path: "style.css", content: "body { font-family: sans-serif; padding: 20px; }" },
        { path: "script.js", content: "console.log('Hello world');" },
      ];
      const { data, error } = await supabase.from("public_projects").insert({
        user_id: user!.id, name: newName, description: newDesc, files: initialFiles, is_public: true,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["my-public-projects"] });
      setShowNew(false); setNewName(""); setNewDesc("");
      setActive(data);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (active) return <ProjectEditor project={active} onClose={() => { setActive(null); qc.invalidateQueries({ queryKey: ["my-public-projects"] }); }} />;

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold font-display">Public Projects</h1>
        <Button onClick={() => setShowNew(true)} size="sm" className="bg-primary text-primary-foreground"><Plus className="h-4 w-4 mr-1" /> NEW</Button>
      </div>

      <Tabs defaultValue="mine">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="mine">My Projects</TabsTrigger>
          <TabsTrigger value="discover">Discover</TabsTrigger>
        </TabsList>
        <TabsContent value="mine" className="space-y-2 mt-4">
          {projects?.map((p: any) => (
            <div key={p.id} onClick={() => setActive(p)} className="cyber-card rounded-xl p-3 cursor-pointer hover:border-primary/40 flex justify-between items-center">
              <div>
                <p className="font-bold text-sm">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">{p.files.length} files • {p.is_public ? <Globe className="inline h-3 w-3" /> : <Lock className="inline h-3 w-3" />}</p>
              </div>
              <ChevronRight className="h-4 w-4" />
            </div>
          ))}
          {(!projects || projects.length === 0) && <p className="text-center py-12 text-muted-foreground text-sm">No projects yet. Click NEW.</p>}
        </TabsContent>
        <TabsContent value="discover" className="space-y-2 mt-4">
          <DiscoverMyPublic projects={(projects || []).filter((p: any) => p.is_public)} onOpen={setActive} />
        </TabsContent>
      </Tabs>

      {showNew && (
        <div className="fixed inset-0 z-50 bg-background/95 p-4" onClick={() => setShowNew(false)}>
          <div className="max-w-md mx-auto cyber-card rounded-xl p-4 mt-20" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold mb-3">New Project</h3>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Project name" className="mb-2" />
            <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description" className="mb-3" />
            <Button onClick={() => createProject.mutate()} disabled={!newName} className="w-full bg-primary text-primary-foreground">Create</Button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function DiscoverMyPublic({ projects, onOpen }: { projects: any[]; onOpen: (p: any) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: comments } = useQuery({
    queryKey: ["my-public-comments", openId],
    queryFn: async () => {
      const { data } = await supabase.from("project_comments").select("*").eq("project_id", openId!).order("created_at");
      const userIds = [...new Set((data || []).map((c: any) => c.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      return (data || []).map((c: any) => ({ ...c, author: profiles?.find((p) => p.user_id === c.user_id) }));
    },
    enabled: !!openId,
  });

  if (projects.length === 0) {
    return <p className="text-center py-12 text-muted-foreground text-sm">You haven't published any public projects yet.</p>;
  }

  return (
    <div className="space-y-2">
      {projects.map((p) => (
        <div key={p.id} className="cyber-card rounded-xl p-3">
          <div className="flex justify-between items-center">
            <div className="flex-1 cursor-pointer" onClick={() => onOpen(p)}>
              <p className="font-bold text-sm">{p.name}</p>
              <p className="text-[10px] text-muted-foreground">{p.files.length} files • <Globe className="inline h-3 w-3" /> Public</p>
            </div>
            <button
              onClick={() => setOpenId(openId === p.id ? null : p.id)}
              className="text-[10px] font-mono text-primary px-2 py-1 rounded bg-primary/10 hover:bg-primary/20"
            >
              {openId === p.id ? "Hide comments" : "View comments"}
            </button>
          </div>
          {openId === p.id && (
            <div className="mt-3 space-y-2 border-t border-border/50 pt-2">
              {comments?.length === 0 && <p className="text-xs text-muted-foreground">No comments yet.</p>}
              {comments?.map((c: any) => (
                <div key={c.id} className="bg-muted rounded p-2 text-xs">
                  <p className="font-bold">{c.author?.full_name || "User"}</p>
                  <p>{c.content}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(c.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ProjectEditor({ project, onClose }: { project: any; onClose: () => void }) {
  const [files, setFiles] = useState<FileNode[]>(project.files || []);
  const [activePath, setActivePath] = useState<string>(files[0]?.path || "");
  const [showPreview, setShowPreview] = useState(false);
  const [isPublic, setIsPublic] = useState(project.is_public);
  const [allowClone, setAllowClone] = useState(project.allow_clone ?? true);
  const [name, setName] = useState(project.name);

  const activeFile = files.find((f) => f.path === activePath);

  const save = async () => {
    const { error } = await supabase.from("public_projects").update({ files, name, is_public: isPublic, allow_clone: allowClone, updated_at: new Date().toISOString() }).eq("id", project.id);
    if (error) toast.error(error.message);
    else toast.success("Saved!");
  };

  const addFile = () => {
    const path = prompt("File or folder/file path (e.g. src/app.js):");
    if (!path) return;
    if (files.find((f) => f.path === path)) return toast.error("Exists");
    setFiles([...files, { path, content: "" }]);
    setActivePath(path);
  };

  const deleteFile = (path: string) => {
    if (!confirm("Delete?")) return;
    const next = files.filter((f) => f.path !== path);
    setFiles(next);
    if (activePath === path) setActivePath(next[0]?.path || "");
  };

  // Folder grouping
  const tree: any = {};
  files.forEach((f) => {
    const parts = f.path.split("/");
    let curr = tree;
    parts.forEach((p, i) => {
      if (i === parts.length - 1) curr[p] = f;
      else { curr[p] = curr[p] || {}; curr = curr[p]; }
    });
  });

  const renderTree = (node: any, prefix = ""): JSX.Element[] =>
    Object.entries(node).flatMap(([key, val]: any) => {
      const path = prefix ? `${prefix}/${key}` : key;
      if (val.path) {
        return [
          <div key={path} className={`flex items-center justify-between px-2 py-1 text-xs cursor-pointer rounded ${activePath === val.path ? "bg-primary/20 text-primary" : "hover:bg-muted"}`}>
            <span onClick={() => setActivePath(val.path)} className="flex items-center gap-1 flex-1 truncate"><FileText className="h-3 w-3 shrink-0" />{key}</span>
            <button onClick={() => deleteFile(val.path)}><Trash2 className="h-3 w-3 text-destructive/70" /></button>
          </div>,
        ];
      }
      return [
        <div key={path}>
          <div className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground"><Folder className="h-3 w-3" />{key}</div>
          <div className="pl-3">{renderTree(val, path)}</div>
        </div>,
      ];
    });

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="h-12 border-b border-border/50 flex items-center justify-between px-3 gap-2">
        <button onClick={onClose}><ArrowLeft className="h-5 w-5" /></button>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-muted text-sm h-8 max-w-xs" />
        <div className="flex items-center gap-2">
          <button onClick={() => setIsPublic(!isPublic)} title={isPublic ? "Public" : "Private"}>
            {isPublic ? <Globe className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4" />}
          </button>
          <div className="flex items-center gap-1 text-[10px] font-mono" title="Allow other users to clone source">
            {allowClone ? <Unlock className="h-3 w-3 text-primary" /> : <Lock className="h-3 w-3" />}
            <span className="hidden sm:inline">Open source</span>
            <Switch checked={allowClone} onCheckedChange={setAllowClone} />
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowPreview(!showPreview)}><Eye className="h-4 w-4" /></Button>
          <Button size="sm" onClick={save} className="bg-primary text-primary-foreground"><Save className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="flex-1 flex min-h-0">
        <div className="w-44 border-r border-border/50 overflow-y-auto p-1">
          <button onClick={addFile} className="w-full text-xs flex items-center gap-1 px-2 py-1.5 mb-2 bg-primary/10 text-primary rounded hover:bg-primary/20">
            <Plus className="h-3 w-3" /> Add file
          </button>
          {renderTree(tree)}
        </div>
        <div className="flex-1 min-w-0">
          {showPreview ? (
            <iframe srcDoc={buildPreview(files)} className="w-full h-full bg-white" sandbox="allow-scripts" />
          ) : activeFile ? (
            <Editor
              height="100%"
              language={detectLang(activeFile.path)}
              value={activeFile.content}
              onChange={(v) => setFiles(files.map((f) => f.path === activePath ? { ...f, content: v || "" } : f))}
              theme="vs-dark"
              options={{ minimap: { enabled: false }, fontSize: 13 }}
            />
          ) : <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Select a file</div>}
        </div>
      </div>
    </div>
  );
}
