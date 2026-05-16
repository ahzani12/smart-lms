import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Users, UserCircle, Building2, FileQuestion, TrendingUp, Calendar, Sparkles, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { navItems } from '../components/Layout'

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [holiday, setHoliday] = useState<{ is_holiday: boolean; title: string } | null>(null)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    axios.get('/api/dashboard/').then(res => {
      setStats(res.data)
      setLoading(false)
    }).catch(() => setLoading(false))
    // Check holiday
    const today = new Date().toISOString().slice(0, 10)
    axios.get('/api/calendar/check-holiday', { params: { date: today } }).then(r => setHoliday(r.data)).catch(() => {})
  }, [])

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>

  const s = stats?.stats || {}
  const statCards = [
    { icon: Users, label: 'Siswa', value: s.students ?? 0, color: 'bg-blue-500' },
    { icon: UserCircle, label: 'Guru', value: s.teachers ?? 0, color: 'bg-green-500' },
    { icon: Building2, label: 'Kelas', value: s.classes ?? 0, color: 'bg-yellow-500' },
    { icon: FileQuestion, label: 'Ujian Aktif', value: s.exams ?? 0, color: 'bg-purple-500' },
  ]

  // Menu items for mobile grid - grouped
  const menuItems = navItems.filter(item => item.to !== '/' && (!user?.role || item.roles.includes(user.role)))
  const menuGroups = [
    { title: 'Akademik', items: menuItems.filter(i => ['/students', '/teachers', '/classes', '/schedules'].includes(i.to)) },
    { title: 'Penilaian', items: menuItems.filter(i => ['/exams', '/question-banks', '/input-scores', '/raport', '/generate-raport'].includes(i.to)) },
    { title: 'Kehadiran', items: menuItems.filter(i => ['/attendance', '/calendar'].includes(i.to)) },
    { title: 'Lainnya', items: menuItems.filter(i => !['/students', '/teachers', '/classes', '/schedules', '/exams', '/question-banks', '/input-scores', '/raport', '/generate-raport', '/attendance', '/calendar'].includes(i.to)) },
  ].filter(g => g.items.length > 0)

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Selamat datang, {user?.name}</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-medium">AI-powered</span>
        </div>
      </div>

      {/* Holiday Banner */}
      {holiday?.is_holiday && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl">🏖️</span>
          <div>
            <div className="font-semibold text-green-800">Hari Ini Libur</div>
            <div className="text-sm text-green-600">{holiday.title}</div>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((card, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 lg:p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs lg:text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl lg:text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
              </div>
              <div className={`${card.color} p-2.5 lg:p-3 rounded-xl`}>
                <card.icon className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile Menu Grid - Grouped */}
      <div className="lg:hidden space-y-4">
        {menuGroups.map(group => (
          <div key={group.title}>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{group.title}</h3>
            <div className="grid grid-cols-4 gap-2">
              {group.items.map(item => (
                <button
                  key={item.to}
                  onClick={() => navigate(item.to)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white border border-gray-100 shadow-sm active:scale-95 transition-transform"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-indigo-600" />
                  </div>
                  <span className="text-[10px] text-gray-600 text-center leading-tight font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Attendance Today */}
      <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-500" />
          Absensi Hari Ini
        </h3>
        <div className="grid grid-cols-3 lg:grid-cols-5 gap-2 lg:gap-3">
          {[
            { k: 'hadir', label: 'Hadir', color: 'bg-green-50 text-green-700' },
            { k: 'terlambat', label: 'Terlambat', color: 'bg-yellow-50 text-yellow-700' },
            { k: 'sakit', label: 'Sakit', color: 'bg-blue-50 text-blue-700' },
            { k: 'izin', label: 'Izin', color: 'bg-purple-50 text-purple-700' },
            { k: 'alfa', label: 'Alfa', color: 'bg-red-50 text-red-700' },
          ].map(item => (
            <div key={item.k} className={`${item.color} rounded-xl p-3 lg:p-4 text-center`}>
              <div className="text-xl lg:text-2xl font-bold">{stats?.attendance_today?.[item.k] ?? 0}</div>
              <div className="text-[10px] lg:text-xs mt-1">{item.label}</div>
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-400 mt-3">{stats?.attendance_today?.sessions ?? 0} sesi absen hari ini</div>
      </div>

      {/* Charts - hidden on small mobile */}
      <div className="hidden sm:grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Class Distribution */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            Distribusi Siswa per Kelas
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats?.class_distribution || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="class_name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="student_count" fill="#6366f1" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Exams */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-500" />
            Ujian Terbaru
          </h3>
          <div className="space-y-3">
            {(stats?.recent_exams || []).map((exam: any) => (
              <div key={exam.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                <div>
                  <p className="font-medium text-gray-900">{exam.title}</p>
                  <p className="text-sm text-gray-500">{exam.subject?.name} • {exam.class?.name}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  exam.status === 'active' ? 'bg-green-100 text-green-700' :
                  exam.status === 'ended' ? 'bg-gray-100 text-gray-600' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {exam.status === 'active' ? 'Berlangsung' : exam.status === 'ended' ? 'Selesai' : 'Draft'}
                </span>
              </div>
            ))}
            {(!stats?.recent_exams || stats.recent_exams.length === 0) && (
              <p className="text-gray-400 text-center py-4">Belum ada ujian</p>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-500" />
          Agenda Mendatang
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {(stats?.upcoming_events || []).map((event: any) => (
            <div key={event.id} className="flex-shrink-0 w-48 lg:w-56 p-3 lg:p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100">
              <p className="text-xs text-indigo-600 font-medium mb-1">
                {new Date(event.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              </p>
              <p className="font-medium text-gray-900 text-sm">{event.title}</p>
              <p className="text-xs text-gray-500 mt-1 capitalize">{event.type}</p>
            </div>
          ))}
          {(!stats?.upcoming_events || stats.upcoming_events.length === 0) && (
            <p className="text-gray-400 py-4">Tidak ada agenda mendatang</p>
          )}
        </div>
      </div>
    </div>
  )
}
