import { useState, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Award, Download, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useNavigate } from "react-router-dom";
import SearchBar from "@/components/SearchBar";
import { filterByQuery } from "@/lib/search";

export default function StudentCertificates() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<any>(null);
  const [searchQ, setSearchQ] = useState("");
  const certRef = useRef<HTMLDivElement>(null);

  const { data: certs } = useQuery({
    queryKey: ["my-certificates", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("certificates")
        .select("*, courses(title)")
        .eq("user_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const requestRedo = useMutation({
    mutationFn: async (cert: any) => {
      // delete cert so they can re-request later when they pass exam
      await supabase.from("certificates").delete().eq("id", cert.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-certificates"] });
      toast.success("Redo requested. Take the final exam again.");
      navigate("/student/exams");
    },
  });

  const downloadPDF = async () => {
    if (!certRef.current) return;
    const canvas = await html2canvas(certRef.current, { scale: 2, backgroundColor: "#ffffff" });
    const pdf = new jsPDF("landscape", "mm", "a4");
    const imgData = canvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", 0, 0, 297, 210);
    pdf.save(`certificate-${selected.certificate_no}.pdf`);
    toast.success("Downloaded!");
  };

  const awarded = (certs || []).filter((c: any) => c.status === "awarded");
  const waiting = (certs || []).filter((c: any) => c.status === "waiting");
  const revoked = (certs || []).filter((c: any) => c.status === "revoked");

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold font-display mb-4">Certificates</h1>
      <SearchBar value={searchQ} onChange={setSearchQ} placeholder="Search by course name..." className="mb-4" />
      <Tabs defaultValue="my">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="my">My Certificates ({awarded.length})</TabsTrigger>
          <TabsTrigger value="waiting">Waiting ({waiting.length + revoked.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="space-y-3 mt-4">
          {filterByQuery(awarded, searchQ, (c: any) => c.courses?.title, (c: any) => c.certificate_no).map((c: any) => (
            <div key={c.id} onClick={() => setSelected(c)} className="cyber-card rounded-xl p-4 cursor-pointer hover:border-primary/40">
              <div className="flex items-center gap-3">
                <Award className="h-10 w-10 text-primary" />
                <div className="flex-1">
                  <p className="font-bold text-sm">{c.courses?.title}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{c.certificate_no}</p>
                  <p className="text-[10px] text-muted-foreground">Awarded: {new Date(c.awarded_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          ))}
          {awarded.length === 0 && <p className="text-center py-12 text-muted-foreground text-sm">No certificates yet.</p>}
        </TabsContent>

        <TabsContent value="waiting" className="space-y-3 mt-4">
          {filterByQuery(waiting, searchQ, (c: any) => c.courses?.title, () => "").map((c: any) => (
            <div key={c.id} className="cyber-card rounded-xl p-3">
              <p className="font-bold text-sm">{c.courses?.title}</p>
              <p className="text-xs text-muted-foreground">Waiting admin approval</p>
            </div>
          ))}
          {filterByQuery(revoked, searchQ, (c: any) => c.courses?.title, () => "").map((c: any) => (
            <div key={c.id} className="cyber-card rounded-xl p-3 border-destructive/40">
              <p className="font-bold text-sm">{c.courses?.title}</p>
              <p className="text-xs text-destructive">Revoked</p>
              <Button size="sm" onClick={() => requestRedo.mutate(c)} className="mt-2 text-xs">
                <RotateCcw className="h-3 w-3 mr-1" /> Redo Final Exam
              </Button>
            </div>
          ))}
          {waiting.length === 0 && revoked.length === 0 && <p className="text-center py-12 text-muted-foreground text-sm">No pending certificates.</p>}
        </TabsContent>
      </Tabs>

      {selected && (
        <div className="fixed inset-0 z-50 bg-background/95 overflow-y-auto p-4" onClick={() => setSelected(null)}>
          <div className="max-w-2xl mx-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between mb-3">
              <Button variant="outline" size="sm" onClick={downloadPDF}>
                <Download className="h-4 w-4 mr-1" /> Download PDF
              </Button>
              <button onClick={() => setSelected(null)}><X className="h-5 w-5" /></button>
            </div>
            <div ref={certRef} className="bg-white text-gray-900 p-12 border-8 border-double border-yellow-600 aspect-[1.414/1] flex flex-col items-center justify-center text-center">
              <p className="text-sm tracking-widest text-yellow-700">CODEBREAKERS</p>
              <h1 className="text-4xl font-bold mt-2 mb-1">Certificate of Completion</h1>
              <p className="text-sm text-gray-600 italic mb-6">This is to certify that</p>
              <p className="text-3xl font-serif font-bold text-yellow-800 border-b-2 border-yellow-600 px-8 pb-2">{profile?.full_name}</p>
              <p className="text-sm mt-4 max-w-md">has successfully completed the course</p>
              <p className="text-2xl font-bold mt-2">{selected.courses?.title}</p>
              <div className="flex justify-between w-full mt-12 text-xs">
                <div className="text-left">
                  <p className="border-t border-gray-700 pt-1 px-4">Date</p>
                  <p>{new Date(selected.awarded_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="border-t border-gray-700 pt-1 px-4">Cert No</p>
                  <p>{selected.certificate_no}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
