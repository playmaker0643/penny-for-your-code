import { supabase } from "@/integrations/supabase/client";

// Weighted grade: Exams 30, Projects 20, Assignments 20, Lessons 15, Challenges 10, Attendance 5
export const WEIGHTS = {
  exams: 30,
  projects: 20,
  assignments: 20,
  lessons: 15,
  challenges: 10,
  attendance: 5,
};

export interface StudentScore {
  user_id: string;
  full_name: string;
  registration_number: string | null;
  avatar_url: string | null;
  lesson_score: number;
  assignment_score: number;
  exam_score: number;
  project_score: number;
  challenge_score: number;
  attendance_score: number;
  total: number;
  public_likes: number;
  public_comments: number;
}

const pct = (num: number, den: number) => (den > 0 ? Math.min(100, (num / den) * 100) : 0);

export async function computeAllStudentScores(): Promise<StudentScore[]> {
  // Get all students
  const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "student");
  const studentIds = (roles || []).map((r) => r.user_id);
  if (studentIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name, registration_number, avatar_url")
    .in("user_id", studentIds);

  // Bulk fetch
  const [
    { data: lessonProgress },
    { data: lessonsAll },
    { data: examSubs },
    { data: studentProjects },
    { data: matches },
    { data: attendance },
    { data: publicProjects },
    { data: projectLikes },
    { data: projectComments },
  ] = await Promise.all([
    supabase.from("lesson_progress").select("user_id, completed").in("user_id", studentIds),
    supabase.from("lessons").select("id"),
    supabase.from("exam_submissions").select("user_id, score, ai_score, exam_id, exams(max_score, exam_type)").in("user_id", studentIds),
    supabase.from("student_projects").select("user_id, mark, graded").in("user_id", studentIds),
    supabase
      .from("challenge_matches")
      .select("player_one_id, player_two_id, player_one_score, player_two_score, status, question_ids"),
    supabase.from("attendance").select("user_id, status").in("user_id", studentIds),
    supabase.from("public_projects").select("id, user_id").in("user_id", studentIds),
    supabase.from("project_likes").select("project_id"),
    supabase.from("project_comments").select("project_id"),
  ]);

  const totalLessons = lessonsAll?.length || 0;
  const likeCountByProject: Record<string, number> = {};
  (projectLikes || []).forEach((l: any) => {
    likeCountByProject[l.project_id] = (likeCountByProject[l.project_id] || 0) + 1;
  });
  const commentCountByProject: Record<string, number> = {};
  (projectComments || []).forEach((c: any) => {
    commentCountByProject[c.project_id] = (commentCountByProject[c.project_id] || 0) + 1;
  });

  return studentIds.map((uid) => {
    const profile = profiles?.find((p) => p.user_id === uid);

    const completedLessons = (lessonProgress || []).filter((p: any) => p.user_id === uid && p.completed).length;
    const lesson_score = pct(completedLessons, totalLessons);

    const userExamSubs = (examSubs || []).filter((s: any) => s.user_id === uid);
    const examScores = userExamSubs.map((s: any) => {
      const max = s.exams?.max_score || 100;
      const got = s.ai_score ?? s.score ?? 0;
      return (got / max) * 100;
    });
    const exam_score = examScores.length > 0 ? examScores.reduce((a, b) => a + b, 0) / examScores.length : 0;
    // Treat all exam_submissions same as assignment+exam — split by exam_type
    const assignmentSubs = userExamSubs.filter((s: any) => s.exams?.exam_type === "assignment");
    const assignment_score =
      assignmentSubs.length > 0
        ? assignmentSubs
            .map((s: any) => ((s.ai_score ?? s.score ?? 0) / (s.exams?.max_score || 100)) * 100)
            .reduce((a: number, b: number) => a + b, 0) / assignmentSubs.length
        : 0;

    const userProjects = (studentProjects || []).filter((p: any) => p.user_id === uid && p.graded);
    const project_score =
      userProjects.length > 0
        ? userProjects.reduce((a: number, b: any) => a + (b.mark || 0), 0) / userProjects.length
        : 0;

    const userMatches = (matches || []).filter((m: any) => m.player_one_id === uid || m.player_two_id === uid);
    const matchScores = userMatches.map((m: any) => {
      const total = (m.question_ids?.length || 10) || 10;
      const score = m.player_one_id === uid ? m.player_one_score : m.player_two_score;
      return (score / total) * 100;
    });
    const challenge_score =
      matchScores.length > 0 ? matchScores.reduce((a: number, b: number) => a + b, 0) / matchScores.length : 0;

    const userAtt = (attendance || []).filter((a: any) => a.user_id === uid);
    const presentDays = userAtt.filter((a: any) => a.status === "present").length;
    const attendance_score = pct(presentDays, Math.max(userAtt.length, 1));

    const userPublic = (publicProjects || []).filter((p: any) => p.user_id === uid);
    const public_likes = userPublic.reduce((a, p: any) => a + (likeCountByProject[p.id] || 0), 0);
    const public_comments = userPublic.reduce((a, p: any) => a + (commentCountByProject[p.id] || 0), 0);

    // Engagement bonus from public projects: +0.25 per like, +0.5 per comment, capped at 10
    const engagementBonus = Math.min(10, public_likes * 0.25 + public_comments * 0.5);

    const baseTotal =
      (exam_score * WEIGHTS.exams +
        project_score * WEIGHTS.projects +
        assignment_score * WEIGHTS.assignments +
        lesson_score * WEIGHTS.lessons +
        challenge_score * WEIGHTS.challenges +
        attendance_score * WEIGHTS.attendance) /
      100;
    const total = Math.min(100, baseTotal + engagementBonus);

    return {
      user_id: uid,
      full_name: profile?.full_name || "Unknown",
      registration_number: profile?.registration_number || null,
      avatar_url: profile?.avatar_url || null,
      lesson_score: Math.round(lesson_score),
      assignment_score: Math.round(assignment_score),
      exam_score: Math.round(exam_score),
      project_score: Math.round(project_score),
      challenge_score: Math.round(challenge_score),
      attendance_score: Math.round(attendance_score),
      total: Math.round(total * 10) / 10,
      public_likes,
      public_comments,
    };
  });
}

export function gradeFromTotal(total: number): { letter: string; tier: string } {
  if (total >= 80) return { letter: "A+", tier: "Distinction" };
  if (total >= 70) return { letter: "A", tier: "Excellent" };
  if (total >= 60) return { letter: "B", tier: "Very Good" };
  if (total >= 50) return { letter: "C", tier: "Credit" };
  if (total >= 40) return { letter: "D", tier: "Pass" };
  return { letter: "F", tier: "Fail" };
}
