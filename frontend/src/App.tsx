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
import Subjects from './pages/Subjects'
import Raport from './pages/Raport'
import Calendar from './pages/Calendar'
import AIHub from './pages/AIHub'
import Asisten from './pages/Asisten'
import NotificationSettings from './pages/NotificationSettings'
import DocumentAssets from './pages/DocumentAssets'
import BillingDashboard from './pages/billing/BillingDashboard'
import JenisTagihanPage from './pages/billing/JenisTagihanPage'
import GenerateTagihan from './pages/billing/GenerateTagihan'
import TagihanList from './pages/billing/TagihanList'
import TagihanSiswa from './pages/billing/TagihanSiswa'
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
import LandingPage from './pages/LandingPage'
import PricingPage from './pages/PricingPage'

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

// RootGate: render LandingPage publik kalau belum login, render Layout (app)
// kalau sudah login. Path "/" smart-detects auth state. Sub-paths (students,
// attendance, dll) di-protect via ProtectedRoute wrapper.
function RootGate() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }
  // Root path: belum login → landing, sudah login → app dashboard
  if (location.pathname === '/') {
    return user ? <Layout /> : <LandingPage />
  }
  // Sub-paths require auth
  if (!user) return <Navigate to="/login" />
  if ((user as any).must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password?forced=true" replace />
  }
  return <Layout />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          {/* Public marketing pages */}
          <Route path="/pricing" element={<PricingPage />} />

          {/* Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
          <Route path="/parent-login" element={<ParentLogin />} />
          <Route path="/exams/:id/take" element={<ProtectedRoute><ExamTake /></ProtectedRoute>} />

          {/* Root: smart-gate (landing kalau belum login, app kalau sudah) */}
          <Route path="/" element={<RootGate />}>
            <Route index element={<Dashboard />} />
            <Route path="students" element={<Students />} />
            <Route path="teachers" element={<Teachers />} />
            <Route path="classes" element={<Classes />} />
            <Route path="exams" element={<Exams />} />
            <Route path="exams/:id/monitor" element={<ExamMonitor />} />
            <Route path="question-banks" element={<QuestionBanks />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="schedules" element={<Schedules />} />
            <Route path="subjects" element={<Subjects />} />
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
            <Route path="asisten" element={<Asisten />} />
            <Route path="notifications" element={<NotificationSettings />} />
            <Route path="document-assets" element={<DocumentAssets />} />
            {/* Keuangan / Billing */}
            <Route path="billing" element={<BillingDashboard />} />
            <Route path="billing/jenis" element={<JenisTagihanPage />} />
            <Route path="billing/generate" element={<GenerateTagihan />} />
            <Route path="billing/tagihan" element={<TagihanList />} />
            <Route path="billing/siswa/:id" element={<TagihanSiswa />} />
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
