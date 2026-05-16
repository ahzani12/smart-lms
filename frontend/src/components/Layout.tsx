import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Users, UserCircle, Building2, FileQuestion,
  BookOpen, ClipboardCheck, GraduationCap, Calendar, Sparkles,
  LogOut, Menu, X, ChevronDown, CalendarClock, Trophy, Heart,
  Settings, ClipboardEdit, FileText, Key, School, Shield
} from 'lucide-react'

export const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin_pusat', 'admin_cabang', 'guru', 'siswa'] },
  { to: '/students', icon: Users, label: 'Siswa', roles: ['admin_pusat', 'admin_cabang', 'guru'] },
  { to: '/teachers', icon: UserCircle, label: 'Guru', roles: ['admin_pusat', 'admin_cabang'] },
  { to: '/classes', icon: Building2, label: 'Kelas', roles: ['admin_pusat', 'admin_cabang', 'guru'] },
  { to: '/exams', icon: FileQuestion, label: 'Ujian', roles: ['admin_pusat', 'admin_cabang', 'guru', 'siswa'] },
  { to: '/question-banks', icon: BookOpen, label: 'Bank Soal', roles: ['admin_pusat', 'admin_cabang', 'guru'] },
  { to: '/schedules', icon: CalendarClock, label: 'Jadwal', roles: ['admin_pusat', 'admin_cabang', 'guru'] },
  { to: '/attendance', icon: ClipboardCheck, label: 'Absensi', roles: ['admin_pusat', 'admin_cabang', 'guru', 'siswa'] },
  { to: '/input-scores', icon: ClipboardEdit, label: 'Input Nilai', roles: ['admin_pusat', 'admin_cabang', 'guru'] },
  { to: '/raport', icon: GraduationCap, label: 'Raport', roles: ['admin_pusat', 'admin_cabang', 'guru', 'siswa'] },
  { to: '/generate-raport', icon: FileText, label: 'Generate Raport', roles: ['admin_pusat', 'admin_cabang'] },
  { to: '/calendar', icon: Calendar, label: 'Kalender', roles: ['admin_pusat', 'admin_cabang', 'guru', 'siswa'] },
  { to: '/leaderboard', icon: Trophy, label: 'Leaderboard', roles: ['admin_pusat', 'admin_cabang', 'guru', 'siswa'] },
  { to: '/parents', icon: Heart, label: 'Orang Tua', roles: ['admin_pusat', 'admin_cabang'] },
  { to: '/parent-access', icon: Key, label: 'Kode Akses Ortu', roles: ['admin_pusat', 'admin_cabang'] },
  { to: '/semesters', icon: CalendarClock, label: 'Semester', roles: ['admin_pusat', 'admin_cabang'] },
  { to: '/parent', icon: Heart, label: 'Portal Anak', roles: ['orang_tua'] },
  { to: '/report-components', icon: Settings, label: 'Komponen Raport', roles: ['admin_pusat', 'admin_cabang'] },
  { to: '/ai-hub', icon: Sparkles, label: 'AI Hub', roles: ['admin_pusat', 'admin_cabang', 'guru'] },
  { to: '/school-settings', icon: School, label: 'Pengaturan Sekolah', roles: ['admin_pusat'] },
  // Superadmin
  { to: '/super', icon: Shield, label: 'Overview', roles: ['superadmin'] },
  { to: '/super/schools', icon: Building2, label: 'Kelola Sekolah', roles: ['superadmin'] },
  { to: '/super/admins', icon: Users, label: 'Kelola Admin', roles: ['superadmin'] },
  { to: '/super/ai-config', icon: Sparkles, label: 'AI Config', roles: ['superadmin'] },
]

// Bottom nav items for mobile (max 5)
const mobileBottomNav = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/attendance', icon: ClipboardCheck, label: 'Absensi' },
  { to: '/exams', icon: FileQuestion, label: 'Ujian' },
  { to: '/raport', icon: GraduationCap, label: 'Raport' },
  { to: '/calendar', icon: Calendar, label: 'Kalender' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/login') }

  const filteredNav = navItems.filter(item => !user?.role || item.roles.includes(user.role))

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Sidebar - desktop only */}
      <aside className={`hidden lg:flex ${sidebarOpen ? 'w-64' : 'w-20'} bg-white shadow-lg transition-all duration-300 flex-col`}>
        <div className="p-4 flex items-center justify-between border-b">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">SSD</span>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-gray-100">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {filteredNav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User profile at bottom */}
        <div className="p-4 border-t">
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-xl hover:bg-gray-50"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                <span className="text-sm font-medium text-indigo-600">{user?.name?.charAt(0)}</span>
              </div>
              {sidebarOpen && (
                <>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-gray-900">{user?.name}</div>
                    <div className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ')}</div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </>
              )}
            </button>
            {profileOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-lg border p-2">
                <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm">
                  <LogOut className="w-4 h-4" /> Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile sidebar (slide-in) */}
      <aside className={`fixed top-0 left-0 h-full w-72 bg-white shadow-xl z-50 transform transition-transform duration-300 lg:hidden ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 flex items-center justify-between border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">SSD</span>
          </div>
          <button onClick={() => setMobileSidebarOpen(false)} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)]">
          {filteredNav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMobileSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t">
          <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm">
            <LogOut className="w-4 h-4" /> Keluar ({user?.name})
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-20 lg:pb-0">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-30 bg-white border-b px-4 py-3 flex items-center justify-between">
          <button onClick={() => setMobileSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-lg bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">SSD</span>
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
            <span className="text-xs font-medium text-indigo-600">{user?.name?.charAt(0)}</span>
          </div>
        </div>
        <Outlet />
      </main>

      {/* Mobile bottom navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-30 safe-bottom">
        <div className="flex justify-around items-center py-2">
          {mobileBottomNav.map(item => {
            const isActive = location.pathname === item.to
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex flex-col items-center gap-0.5 px-3 py-1"
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
                <span className={`text-[10px] ${isActive ? 'text-indigo-600 font-medium' : 'text-gray-400'}`}>{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
