import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Users, UserCircle, Building2, FileQuestion,
  BookOpen, ClipboardCheck, GraduationCap, Calendar, Sparkles,
  LogOut, Menu, X, ChevronDown, CalendarClock, Trophy, Heart,
  Settings, ClipboardEdit, FileText, Key, School, Shield, MapPin,
  Bell, Search, Plus, Wallet, Receipt, Stamp, MessageSquare,
} from 'lucide-react'

export const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin_pusat', 'admin_cabang', 'guru', 'siswa'] },
  { to: '/asisten', icon: MessageSquare, label: 'Asisten', roles: ['admin_pusat', 'admin_cabang', 'guru'] },
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
  { to: '/notifications', icon: Bell, label: 'Notifikasi WA', roles: ['admin_pusat', 'admin_cabang'] },
  // Keuangan
  { to: '/billing', icon: Wallet, label: 'Keuangan', roles: ['admin_pusat', 'admin_cabang'] },
  { to: '/billing/tagihan', icon: Receipt, label: 'Tagihan', roles: ['admin_pusat', 'admin_cabang'] },
  { to: '/school-settings', icon: School, label: 'Pengaturan Sekolah', roles: ['admin_pusat'] },
  { to: '/document-assets', icon: Stamp, label: 'Kop & TTD', roles: ['admin_pusat', 'admin_cabang'] },
  { to: '/location-settings', icon: MapPin, label: 'Lokasi & GPS', roles: ['admin_pusat'] },
  // Superadmin
  { to: '/super', icon: Shield, label: 'Overview', roles: ['superadmin'] },
  { to: '/super/schools', icon: Building2, label: 'Kelola Sekolah', roles: ['superadmin'] },
  { to: '/super/admins', icon: Users, label: 'Kelola Admin', roles: ['superadmin'] },
  { to: '/super/ai-config', icon: Sparkles, label: 'AI Config', roles: ['superadmin'] },
]

// Bottom nav items for mobile (4 + center FAB)
const mobileBottomNav = [
  { to: '/', icon: LayoutDashboard, label: 'Beranda' },
  { to: '/students', icon: Users, label: 'Siswa' },
  { to: '/exams', icon: FileQuestion, label: 'Ujian' },
  { to: '/raport', icon: GraduationCap, label: 'Raport' },
]

const roleLabel: Record<string, string> = {
  admin_pusat: 'Admin Pusat',
  admin_cabang: 'Admin Cabang',
  guru: 'Guru',
  siswa: 'Siswa',
  orang_tua: 'Orang Tua',
  superadmin: 'Superadmin',
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileFabOpen, setMobileFabOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/login') }

  const filteredNav = navItems.filter(item => !user?.role || item.roles.includes(user.role))

  // Find current page label for mobile topbar title
  const currentNav = filteredNav.find(item =>
    item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
  )
  const pageTitle = currentNav?.label || 'SSD'

  // Mobile FAB quick actions (top 4 from sidebar that aren't in bottom nav)
  const fabActions = [
    { to: '/attendance', icon: ClipboardCheck, label: 'Absensi' },
    { to: '/asisten', icon: MessageSquare, label: 'Asisten' },
    { to: '/input-scores', icon: ClipboardEdit, label: 'Input Nilai' },
    { to: '/ai-hub', icon: Sparkles, label: 'AI Hub' },
  ]

  return (
    <div className="flex h-screen bg-cream">
      {/* Mobile overlay */}
      {(mobileSidebarOpen || mobileFabOpen) && (
        <div
          className="fixed inset-0 bg-navy/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => { setMobileSidebarOpen(false); setMobileFabOpen(false) }}
        />
      )}

      {/* ===== Sidebar — desktop ===== */}
      <aside className={`hidden lg:flex ${sidebarOpen ? 'w-64' : 'w-20'} bg-navy text-white transition-all duration-300 flex-col`}>
        <div className="p-5 flex items-center justify-between border-b border-white/10">
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 gradient-warm rounded-xl flex items-center justify-center shadow-warm flex-shrink-0">
                <GraduationCap className="w-5 h-5 text-white" strokeWidth={2.4} />
              </div>
              <div className="leading-tight">
                <div className="font-extrabold text-lg text-white">SSD</div>
                <div className="text-[10px] text-amber-200">Sistem Sekolah Digital</div>
              </div>
            </div>
          ) : (
            <div className="w-10 h-10 gradient-warm rounded-xl flex items-center justify-center shadow-warm mx-auto">
              <GraduationCap className="w-5 h-5 text-white" strokeWidth={2.4} />
            </div>
          )}
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="mx-auto mt-3 p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {filteredNav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  isActive
                    ? 'bg-amber-warm text-navy font-bold shadow-warm-sm'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                } ${!sidebarOpen ? 'justify-center' : ''}`
              }
              title={!sidebarOpen ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" strokeWidth={2.2} />
              {sidebarOpen && <span className="text-sm">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User profile */}
        <div className="p-3 border-t border-white/10">
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-white/10 ${!sidebarOpen ? 'justify-center' : ''}`}
            >
              <div className="w-9 h-9 rounded-xl gradient-warm flex items-center justify-center text-white font-extrabold flex-shrink-0">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              {sidebarOpen && (
                <>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{user?.name}</div>
                    <div className="text-[10px] text-amber-200 truncate">
                      {roleLabel[user?.role || ''] || user?.role}
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-white/60 transition ${profileOpen ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>
            {profileOpen && sidebarOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-card-lg border border-warm p-1.5">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-rose hover:bg-rose/5 rounded-lg text-sm font-semibold"
                >
                  <LogOut className="w-4 h-4" /> Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ===== Mobile sidebar (slide-in) ===== */}
      <aside className={`fixed top-0 left-0 h-full w-72 bg-navy text-white shadow-2xl z-50 transform transition-transform duration-300 lg:hidden flex flex-col ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 gradient-warm rounded-xl flex items-center justify-center shadow-warm">
              <GraduationCap className="w-5 h-5 text-white" strokeWidth={2.4} />
            </div>
            <div className="leading-tight">
              <div className="font-extrabold text-lg">SSD</div>
              <div className="text-[10px] text-amber-200">Sistem Sekolah Digital</div>
            </div>
          </div>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User card */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl gradient-warm flex items-center justify-center text-white font-extrabold">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">{user?.name}</div>
            <div className="text-xs text-amber-200">{roleLabel[user?.role || ''] || user?.role}</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {filteredNav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMobileSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  isActive
                    ? 'bg-amber-warm text-navy font-bold'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" strokeWidth={2.2} />
              <span className="text-sm">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-3 bg-rose/15 text-rose hover:bg-rose/25 rounded-xl text-sm font-bold"
          >
            <LogOut className="w-4 h-4" /> Keluar
          </button>
        </div>
      </aside>

      {/* ===== Main content ===== */}
      <main className="flex-1 overflow-auto pb-24 lg:pb-0 bg-cream">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-30 bg-navy text-white px-4 py-3 flex items-center justify-between shadow-card">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-white/10"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 gradient-warm rounded-lg flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" strokeWidth={2.4} />
            </div>
            <span className="font-extrabold text-base">{pageTitle}</span>
          </div>
          <button className="p-2 rounded-lg hover:bg-white/10 relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-rose rounded-full ring-2 ring-navy"></span>
          </button>
        </div>

        {/* Desktop top bar (search + bell + user condensed) */}
        <div className="hidden lg:flex sticky top-0 z-20 bg-cream/85 backdrop-blur border-b border-warm/40 px-8 py-3 items-center justify-between">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy/40" />
              <input
                type="text"
                placeholder="Cari siswa, ujian, atau bank soal..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-warm/60 text-sm placeholder:text-navy/40 focus:outline-none focus:ring-4 focus:ring-amber-warm/15 focus:border-amber-warm transition"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-10 h-10 bg-white border border-warm/60 rounded-xl flex items-center justify-center text-navy hover:bg-amber-soft transition relative">
              <Bell className="w-5 h-5" strokeWidth={2.2} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose rounded-full ring-2 ring-white"></span>
            </button>
            <div className="text-right pr-2">
              <div className="text-xs text-navy/60">{roleLabel[user?.role || ''] || user?.role}</div>
              <div className="text-sm font-bold text-navy">{user?.name}</div>
            </div>
          </div>
        </div>

        <Outlet />
      </main>

      {/* ===== Mobile bottom navigation ===== */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-warm/40 z-30 safe-bottom shadow-[0_-4px_20px_rgba(15,27,61,0.08)]">
        <div className="flex justify-around items-center py-2 relative">
          {mobileBottomNav.slice(0, 2).map(item => {
            const isActive = location.pathname === item.to ||
              (item.to !== '/' && location.pathname.startsWith(item.to))
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex flex-col items-center gap-0.5 py-1 px-3 flex-1"
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-amber-warm' : 'text-navy/40'}`} strokeWidth={2.2} />
                <span className={`text-[10px] font-bold ${isActive ? 'text-amber-warm' : 'text-navy/40'}`}>
                  {item.label}
                </span>
              </NavLink>
            )
          })}

          {/* Center FAB */}
          <button
            onClick={() => setMobileFabOpen(!mobileFabOpen)}
            className="-mt-7 w-14 h-14 gradient-warm rounded-2xl flex items-center justify-center shadow-warm border-4 border-cream relative z-10"
          >
            <Plus className={`w-6 h-6 text-white transition ${mobileFabOpen ? 'rotate-45' : ''}`} strokeWidth={3} />
          </button>

          {mobileBottomNav.slice(2).map(item => {
            const isActive = location.pathname === item.to ||
              (item.to !== '/' && location.pathname.startsWith(item.to))
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex flex-col items-center gap-0.5 py-1 px-3 flex-1"
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-amber-warm' : 'text-navy/40'}`} strokeWidth={2.2} />
                <span className={`text-[10px] font-bold ${isActive ? 'text-amber-warm' : 'text-navy/40'}`}>
                  {item.label}
                </span>
              </NavLink>
            )
          })}
        </div>

        {/* FAB quick actions popup */}
        {mobileFabOpen && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 bg-white rounded-2xl shadow-card-lg border border-warm p-2 grid grid-cols-2 gap-2 w-72 z-50">
            {fabActions.map(action => (
              <NavLink
                key={action.to}
                to={action.to}
                onClick={() => setMobileFabOpen(false)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-amber-soft/50 hover:bg-amber-soft transition"
              >
                <div className="w-10 h-10 gradient-warm rounded-xl flex items-center justify-center">
                  <action.icon className="w-5 h-5 text-white" strokeWidth={2.2} />
                </div>
                <span className="text-xs font-bold text-navy">{action.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </nav>
    </div>
  )
}
