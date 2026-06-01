import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Award, Check, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { computeAllStudentScores } from "@/lib/grades";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function AdminCertificates() {
  const qc = useQueryClient();
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const { data: courses } = useQuery({
    queryKey: ["all-courses"],
    queryFn: async () => (await supabase.from("courses").select("*").order("title")).data || [],
  });

  const { data: certs } = useQuery({
    queryKey: ["all-certificates"],
    queryFn: async () => {
      const { data } = await supabase.from("certificates").select("*");
      return data || [];
    },
  });

  const { data: scores } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => computeAllStudentScores(),
  });

  const updateCert = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const upd: any = { status };
      if (status === "awarded") upd.awarded_at = new Date().toISOString();
      if (status === "revoked") upd.revoked_at = new Date().toISOString();
      const { error } = await supabase.from("certificates").update(upd).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-certificates"] });
      toast.success("Updated");
      setSelectedStudent(null);
    },
  });

  const waiting = (certs || []).filter((c) => c.status === "waiting");
  const awarded = (certs || []).filter((c) => c.status === "awarded");

  const getCourseTitle = (id: string) => courses?.find((c: any) => c.id === id)?.title || "—";
  const getStudent = (uid: string) => scores?.find((s) => s.user_id === uid);

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold font-display mb-4">Certificates</h1>
      <Tabs defaultValue="waiting">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="waiting">Waiting Confirm ({waiting.length})</TabsTrigger>
          <TabsTrigger value="awarded">Awarded ({awarded.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="waiting" className="space-y-4">
          {!selectedCourse ? (
            <div className="space-y-2">
              {courses?.map((c: any) => {
                const count = waiting.filter((w) => w.course_id === c.id).length;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCourse(c.id)}
                    className="cyber-card rounded-xl p-4 cursor-pointer flex justify-between items-center hover:border-primary/40"
                  >
                    <span className="font-mono text-sm">{c.title}</span>
                    <span className="text-xs font-mono text-primary">{count} waiting</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setSelectedCourse(null)} className="mb-2 text-xs">← Courses</Button>
              <div className="space-y-2">
                {waiting.filter((w) => w.course_id === selectedCourse).map((w) => {
                  const stu = getStudent(w.user_id);
                  return (
                    <div key={w.id} onClick={() => setSelectedStudent({ ...w, ...stu })} className="cyber-card rounded-xl p-3 cursor-pointer flex justify-between items-center">
                      <div>
                        <p className="text-sm font-mono">{stu?.full_name || "Loading..."}</p>
                        <p className="text-[10px] text-muted-foreground">{stu?.registration_number}</p>
                      </div>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  );
                })}
                {waiting.filter((w) => w.course_id === selectedCourse).length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-8">None waiting</p>
                )}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="awarded" className="space-y-2">
          {awarded.map((a) => {
            const stu = getStudent(a.user_id);
            return (
              <div key={a.id} className="cyber-card rounded-xl p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-mono">{stu?.full_name}</p>
                    <p className="text-[10px] text-muted-foreground">{getCourseTitle(a.course_id)} • {a.certificate_no}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => updateCert.mutate({ id: a.id, status: "revoked" })} className="text-xs">Revoke</Button>
                </div>
              </div>
            );
          })}
          {awarded.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">None awarded</p>}
        </TabsContent>
      </Tabs>

      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-background/95 overflow-y-auto p-4" onClick={() => setSelectedStudent(null)}>
          <div className="max-w-md mx-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between mb-3">
              <h2 className="font-bold">Review</h2>
              <button onClick={() => setSelectedStudent(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="cyber-card rounded-xl p-4 space-y-3">
              <p className="font-bold">{selectedStudent.full_name}</p>
              <p className="text-xs text-muted-foreground">{selectedStudent.registration_number}</p>
              <p className="text-xs">Course: {getCourseTitle(selectedStudent.course_id)}</p>
              <div className="border-t border-border/50 pt-3 space-y-1 text-xs font-mono">
                <p>Lessons: {selectedStudent.lesson_score}%</p>
                <p>Assignments: {selectedStudent.assignment_score}%</p>
                <p>Exams: {selectedStudent.exam_score}%</p>
                <p>Projects: {selectedStudent.project_score}%</p>
                <p>Challenges: {selectedStudent.challenge_score}%</p>
                <p>Attendance: {selectedStudent.attendance_score}%</p>
                <p className="font-bold text-primary text-base pt-2">Total: {selectedStudent.total}%</p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button onClick={() => updateCert.mutate({ id: selectedStudent.id, status: "awarded" })} className="bg-primary text-primary-foreground">
                  <Check className="h-4 w-4 mr-1" /> Certify
                </Button>
                <Button variant="outline" onClick={() => updateCert.mutate({ id: selectedStudent.id, status: "revoked" })}>
                  Revoke
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
