import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import BrandedLoader from "@/components/BrandedLoader";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";

// Eagerly load landing page for fastest first paint
import Index from "./pages/Index";

// Defer non-critical providers/overlays
const IncomingCallOverlay = lazy(() => import("@/components/IncomingCallOverlay"));
const FloatingNotificationBell = lazy(() =>
  import("@/components/notifications/FloatingNotificationBell").then((m) => ({
    default: m.FloatingNotificationBell,
  }))
);
const NotificationBootstrap = lazy(() =>
  import("@/components/notifications/NotificationBootstrap").then((m) => ({
    default: m.NotificationBootstrap,
  }))
);
const NewMessageToast = lazy(() => import("@/components/NewMessageToast"));

// Lazy-load every route to enable code splitting
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Courses = lazy(() => import("./pages/Courses"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PublicProjectPreview = lazy(() => import("./pages/PublicProjectPreview"));

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminCourses = lazy(() => import("./pages/admin/AdminCourses"));
const AdminLessons = lazy(() => import("./pages/admin/AdminLessons"));
const AdminStudents = lazy(() => import("./pages/admin/AdminStudents"));
const AdminExams = lazy(() => import("./pages/admin/AdminExams"));
const AdminAttendance = lazy(() => import("./pages/admin/AdminAttendance"));
const AdminMessages = lazy(() => import("./pages/admin/AdminMessages"));
const AdminPosts = lazy(() => import("./pages/admin/AdminPosts"));
const AdminCodeAI = lazy(() => import("./pages/admin/AdminCodeAI"));
const AdminChallenges = lazy(() => import("./pages/admin/AdminChallenges"));
const AdminLeaderboard = lazy(() => import("./pages/admin/AdminLeaderboard"));
const AdminCertificates = lazy(() => import("./pages/admin/AdminCertificates"));
const AdminProjects = lazy(() => import("./pages/admin/AdminProjects"));
const AdminGroups = lazy(() => import("./pages/admin/AdminGroups"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));

const StudentDashboard = lazy(() => import("./pages/student/StudentDashboard"));
const StudentCourseLessons = lazy(() => import("./pages/student/StudentCourseLessons"));
const StudentLessons = lazy(() => import("./pages/student/StudentLessons"));
const StudentExams = lazy(() => import("./pages/student/StudentExams"));
const StudentSandbox = lazy(() => import("./pages/student/StudentSandbox"));
const StudentGrades = lazy(() => import("./pages/student/StudentGrades"));
const StudentAttendance = lazy(() => import("./pages/student/StudentAttendance"));
const StudentMessages = lazy(() => import("./pages/student/StudentMessages"));
const StudentChat = lazy(() => import("./pages/student/StudentChat"));
const StudentChatConversation = lazy(() => import("./pages/student/StudentChatConversation"));
const StudentCreateGroup = lazy(() => import("./pages/student/StudentCreateGroup"));
const StudentFeed = lazy(() => import("./pages/student/StudentFeed"));
const StudentProfile = lazy(() => import("./pages/student/StudentProfile"));
const StudentCodeAI = lazy(() => import("./pages/student/StudentCodeAI"));
const StudentSupport = lazy(() => import("./pages/student/StudentSupport"));
const StudentVideoCall = lazy(() => import("./pages/student/StudentVideoCall"));
const StudentVoiceCall = lazy(() => import("./pages/student/StudentVoiceCall"));
const StudentChallenge = lazy(() => import("./pages/student/StudentChallenge"));
const StudentLeaderboard = lazy(() => import("./pages/student/StudentLeaderboard"));
const StudentCertificates = lazy(() => import("./pages/student/StudentCertificates"));
const StudentPublicProjects = lazy(() => import("./pages/student/StudentPublicProjects"));
const StudentDiscover = lazy(() => import("./pages/student/StudentDiscover"));
const StudentProjectsPage = lazy(() => import("./pages/student/StudentProjects"));
const StudentCamera = lazy(() => import("./pages/student/StudentCamera"));
const StudentGroupInfo = lazy(() => import("./pages/student/StudentGroupInfo"));
const StudentNotifications = lazy(() => import("./pages/student/StudentNotifications"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const RouteFallback = () => <BrandedLoader label="Loading..." />;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={null}>
            <IncomingCallOverlay />
            <NewMessageToast />
            <NotificationBootstrap />
            <FloatingNotificationBell />
          </Suspense>
          <RouteErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
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
          </Suspense>
          </RouteErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
