import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import IncomingCallOverlay from "@/components/IncomingCallOverlay";
import { FloatingNotificationBell } from "@/components/notifications/FloatingNotificationBell";
import { NotificationBootstrap } from "@/components/notifications/NotificationBootstrap";
import StudentNotifications from "./pages/student/StudentNotifications";
import AdminNotifications from "./pages/admin/AdminNotifications";
import Index from "./pages/Index";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Privacy from "./pages/Privacy";
import Courses from "./pages/Courses";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminCourses from "./pages/admin/AdminCourses";
import AdminLessons from "./pages/admin/AdminLessons";
import AdminStudents from "./pages/admin/AdminStudents";
import AdminExams from "./pages/admin/AdminExams";
import AdminAttendance from "./pages/admin/AdminAttendance";
import AdminMessages from "./pages/admin/AdminMessages";
import AdminPosts from "./pages/admin/AdminPosts";
import AdminCodeAI from "./pages/admin/AdminCodeAI";
import AdminChallenges from "./pages/admin/AdminChallenges";
import AdminLeaderboard from "./pages/admin/AdminLeaderboard";
import AdminCertificates from "./pages/admin/AdminCertificates";
import AdminProjects from "./pages/admin/AdminProjects";
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentCourseLessons from "./pages/student/StudentCourseLessons";
import StudentLessons from "./pages/student/StudentLessons";
import StudentExams from "./pages/student/StudentExams";
import StudentSandbox from "./pages/student/StudentSandbox";
import StudentGrades from "./pages/student/StudentGrades";
import StudentAttendance from "./pages/student/StudentAttendance";
import StudentMessages from "./pages/student/StudentMessages";
import StudentChat from "./pages/student/StudentChat";
import StudentChatConversation from "./pages/student/StudentChatConversation";
import StudentCreateGroup from "./pages/student/StudentCreateGroup";
import StudentFeed from "./pages/student/StudentFeed";
import StudentProfile from "./pages/student/StudentProfile";
import StudentCodeAI from "./pages/student/StudentCodeAI";
import StudentSupport from "./pages/student/StudentSupport";
import StudentVideoCall from "./pages/student/StudentVideoCall";
import StudentVoiceCall from "./pages/student/StudentVoiceCall";
import StudentChallenge from "./pages/student/StudentChallenge";
import StudentLeaderboard from "./pages/student/StudentLeaderboard";
import StudentCertificates from "./pages/student/StudentCertificates";
import StudentPublicProjects from "./pages/student/StudentPublicProjects";
import StudentDiscover from "./pages/student/StudentDiscover";
import StudentProjectsPage from "./pages/student/StudentProjects";
import StudentCamera from "./pages/student/StudentCamera";
import StudentGroupInfo from "./pages/student/StudentGroupInfo";
import AdminGroups from "./pages/admin/AdminGroups";
import NewMessageToast from "@/components/NewMessageToast";
import NotFound from "./pages/NotFound";
import PublicProjectPreview from "./pages/PublicProjectPreview";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <IncomingCallOverlay />
          <NewMessageToast />
          <NotificationBootstrap />
          <FloatingNotificationBell />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/preview/:id" element={<PublicProjectPreview />} />
            <Route path="/p/:id" element={<PublicProjectPreview />} />
            
            {/* Admin routes */}
            <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/courses" element={<ProtectedRoute requiredRole="admin"><AdminCourses /></ProtectedRoute>} />
            <Route path="/admin/lessons" element={<ProtectedRoute requiredRole="admin"><AdminLessons /></ProtectedRoute>} />
            <Route path="/admin/students" element={<ProtectedRoute requiredRole="admin"><AdminStudents /></ProtectedRoute>} />
            <Route path="/admin/exams" element={<ProtectedRoute requiredRole="admin"><AdminExams /></ProtectedRoute>} />
            <Route path="/admin/attendance" element={<ProtectedRoute requiredRole="admin"><AdminAttendance /></ProtectedRoute>} />
            <Route path="/admin/messages" element={<ProtectedRoute requiredRole="admin"><AdminMessages /></ProtectedRoute>} />
            <Route path="/admin/posts" element={<ProtectedRoute requiredRole="admin"><AdminPosts /></ProtectedRoute>} />
            <Route path="/admin/code-ai" element={<ProtectedRoute requiredRole="admin"><AdminCodeAI /></ProtectedRoute>} />
            <Route path="/admin/challenges" element={<ProtectedRoute requiredRole="admin"><AdminChallenges /></ProtectedRoute>} />
            <Route path="/admin/leaderboard" element={<ProtectedRoute requiredRole="admin"><AdminLeaderboard /></ProtectedRoute>} />
            <Route path="/admin/certificates" element={<ProtectedRoute requiredRole="admin"><AdminCertificates /></ProtectedRoute>} />
            <Route path="/admin/projects" element={<ProtectedRoute requiredRole="admin"><AdminProjects /></ProtectedRoute>} />
            <Route path="/admin/groups" element={<ProtectedRoute requiredRole="admin"><AdminGroups /></ProtectedRoute>} />
            <Route path="/admin/notifications" element={<ProtectedRoute requiredRole="admin"><AdminNotifications /></ProtectedRoute>} />
            
            {/* Student routes */}
            <Route path="/student" element={<ProtectedRoute requiredRole="student"><StudentDashboard /></ProtectedRoute>} />
            <Route path="/student/courses/:courseId" element={<ProtectedRoute requiredRole="student"><StudentCourseLessons /></ProtectedRoute>} />
            <Route path="/student/lessons" element={<ProtectedRoute requiredRole="student"><StudentLessons /></ProtectedRoute>} />
            <Route path="/student/exams" element={<ProtectedRoute requiredRole="student"><StudentExams /></ProtectedRoute>} />
            <Route path="/student/sandbox" element={<ProtectedRoute requiredRole="student"><StudentSandbox /></ProtectedRoute>} />
            <Route path="/student/grades" element={<ProtectedRoute requiredRole="student"><StudentGrades /></ProtectedRoute>} />
            <Route path="/student/attendance" element={<ProtectedRoute requiredRole="student"><StudentAttendance /></ProtectedRoute>} />
            <Route path="/student/messages" element={<ProtectedRoute requiredRole="student"><StudentMessages /></ProtectedRoute>} />
            <Route path="/student/chat" element={<ProtectedRoute requiredRole="student"><StudentChat /></ProtectedRoute>} />
            <Route path="/student/chat/create-group" element={<ProtectedRoute requiredRole="student"><StudentCreateGroup /></ProtectedRoute>} />
            <Route path="/student/chat/:chatId" element={<ProtectedRoute requiredRole="student"><StudentChatConversation /></ProtectedRoute>} />
            <Route path="/student/feed" element={<ProtectedRoute requiredRole="student"><StudentFeed /></ProtectedRoute>} />
            <Route path="/student/profile" element={<ProtectedRoute requiredRole="student"><StudentProfile /></ProtectedRoute>} />
            <Route path="/student/code-ai" element={<ProtectedRoute requiredRole="student"><StudentCodeAI /></ProtectedRoute>} />
            <Route path="/student/support" element={<ProtectedRoute requiredRole="student"><StudentSupport /></ProtectedRoute>} />
            <Route path="/student/call/video/:callId" element={<ProtectedRoute requiredRole="student"><StudentVideoCall /></ProtectedRoute>} />
            <Route path="/student/call/voice/:callId" element={<ProtectedRoute requiredRole="student"><StudentVoiceCall /></ProtectedRoute>} />
            <Route path="/student/challenges" element={<ProtectedRoute requiredRole="student"><StudentChallenge /></ProtectedRoute>} />
            <Route path="/student/leaderboard" element={<ProtectedRoute requiredRole="student"><StudentLeaderboard /></ProtectedRoute>} />
            <Route path="/student/certificates" element={<ProtectedRoute requiredRole="student"><StudentCertificates /></ProtectedRoute>} />
            <Route path="/student/projects" element={<ProtectedRoute requiredRole="student"><StudentPublicProjects /></ProtectedRoute>} />
            <Route path="/student/my-projects" element={<ProtectedRoute requiredRole="student"><StudentProjectsPage /></ProtectedRoute>} />
            <Route path="/student/discover" element={<ProtectedRoute requiredRole="student"><StudentDiscover /></ProtectedRoute>} />
            <Route path="/student/camera" element={<ProtectedRoute requiredRole="student"><StudentCamera /></ProtectedRoute>} />
            <Route path="/student/group/:chatId" element={<ProtectedRoute requiredRole="student"><StudentGroupInfo /></ProtectedRoute>} />
            <Route path="/student/notifications" element={<ProtectedRoute requiredRole="student"><StudentNotifications /></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
