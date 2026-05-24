import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Toaster } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import Layout from './components/Layout'
import Login from './pages/Login'
import ChangePassword from './pages/ChangePassword'
import Dashboard from './pages/Dashboard'
import Students from './pages/Students'
import Teachers from './pages/Teachers'
import Classes from './pages/Classes'
import Exams from './pages/Exams'
import ExamTake from './pages/ExamTake'
import ExamMonitor from './pages/ExamMonitor'
import QuestionBanks from './pages/QuestionBanks'
import Attendance from './pages/Attendance'
import Schedules from './pages/Schedules'
import Raport from './pages/Raport'
import Calendar from './pages/Calendar'
import AIHub from './pages/AIHub'
import NotificationSettings from './pages/NotificationSettings'
import Leaderboard from './pages/Leaderboard'
import Parents from './pages/Parents'
import ReportComponents from './pages/ReportComponents'
import InputScores from './pages/InputScores'
import GenerateRaport from './pages/GenerateRaport'
import ParentAccessPage from './pages/ParentAccessPage'
import ParentLogin from './pages/ParentLogin'
import ParentPortal from './pages/ParentPortal'
import Semesters from './pages/Semesters'
import SchoolSettings from './pages/SchoolSettings'
import LocationSettings from './pages/LocationSettings'
import SuperDashboard from './pages/super/SuperDashboard'
import SuperSchools from './pages/super/SuperSchools'
import SuperAdmins from './pages/super/SuperAdmins'
import SuperAIConfig from './pages/super/SuperAIConfig'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" />

  // Force change password kalau admin baru reset
  if ((user as any).must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password?forced=true" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
          <Route path="/parent-login" element={<ParentLogin />} />
          <Route path="/exams/:id/take" element={<ProtectedRoute><ExamTake /></ProtectedRoute>} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="students" element={<Students />} />
            <Route path="teachers" element={<Teachers />} />
            <Route path="classes" element={<Classes />} />
            <Route path="exams" element={<Exams />} />
            <Route path="exams/:id/monitor" element={<ExamMonitor />} />
            <Route path="question-banks" element={<QuestionBanks />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="schedules" element={<Schedules />} />
            <Route path="raport" element={<Raport />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="parents" element={<Parents />} />
            <Route path="parent" element={<ParentPortal />} />
            <Route path="parent-access" element={<ParentAccessPage />} />
            <Route path="semesters" element={<Semesters />} />
            <Route path="school-settings" element={<SchoolSettings />} />
            <Route path="location-settings" element={<LocationSettings />} />
            <Route path="report-components" element={<ReportComponents />} />
            <Route path="input-scores" element={<InputScores />} />
            <Route path="generate-raport" element={<GenerateRaport />} />
            <Route path="ai-hub" element={<AIHub />} />
            <Route path="notifications" element={<NotificationSettings />} />
            {/* Superadmin */}
            <Route path="super" element={<SuperDashboard />} />
            <Route path="super/schools" element={<SuperSchools />} />
            <Route path="super/admins" element={<SuperAdmins />} />
            <Route path="super/ai-config" element={<SuperAIConfig />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
