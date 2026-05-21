import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import {
  Users, UserCircle, Building2, FileQuestion, TrendingUp, Calendar,
  Sparkles, Loader2, ArrowUpRight, ClipboardCheck, ClipboardEdit,
  GraduationCap, Trophy, Sun, Cloud, PartyPopper, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

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
    const today = new Date().toISOString().slice(0, 10)
    axios.get('/api/calendar/check-holiday', { params: { date: today } })
      .then(r => setHoliday(r.data)).catch(() => {})
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-amber-warm mx-auto mb-3" strokeWidth={2.4} />
          <p className="text-navy/60 text-sm font-semibold">Memuat dashboard...</p>
        </div>
      </div>
    )
  }

  const s = stats?.stats || {}
  const a = stats?.attendance_today || {}
  const totalAttendance = (a.hadir ?? 0) + (a.terlambat ?? 0) + (a.sakit ?? 0) + (a.izin ?? 0) + (a.alfa ?? 0)
  const attendanceRate = totalAttendance > 0
    ? Math.round(((a.hadir ?? 0) + (a.terlambat ?? 0)) / totalAttendance * 100)
    : 0

  // Greeting based on time
  const hour = new Date().getHours()
  const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam'
  const GreetIcon = hour < 15 ? Sun : Cloud

  const dateLabel = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // Stat cards with mixed colors
  const statCards = [
    { icon: Users, label: 'Siswa', value: s.students ?? 0, accent: 'amber-warm', bg: 'bg-amber-soft', to: '/students', delta: '+12 minggu ini' },
    { icon: UserCircle, label: 'Guru', value: s.teachers ?? 0, accent: 'mint', bg: 'bg-mint/10', to: '/teachers' },
    { icon: Building2, label: 'Kelas', value: s.classes ?? 0, accent: 'navy', bg: 'bg-navy/5', to: '/classes' },
    { icon: FileQuestion, label: 'Ujian Aktif', value: s.exams ?? 0, accent: 'coral', bg: 'bg-coral/10', to: '/exams', delta: 'Berlangsung sekarang' },
  ]

  const quickActions = [
    { to: '/attendance', icon: ClipboardCheck, label: 'Absensi', color: 'gradient-warm' },
    { to: '/input-scores', icon: ClipboardEdit, label: 'Input Nilai', color: 'bg-mint' },
    { to: '/exams', icon: FileQuestion, label: 'Buat Ujian', color: 'bg-navy' },
    { to: '/raport', icon: GraduationCap, label: 'Raport', color: 'bg-coral' },
    { to: '/leaderboard', icon: Trophy, label: 'Leaderboard', color: 'bg-rose' },
    { to: '/ai-hub', icon: Sparkles, label: 'AI Hub', color: 'bg-sky-warm' },
  ]

  const attendanceItems = [
    { k: 'hadir', label: 'Hadir', color: 'bg-mint', text: 'text-mint', emoji: '✓' },
    { k: 'terlambat', label: 'Terlambat', color: 'bg-amber-warm', text: 'text-amber-warm', emoji: '⏱' },
    { k: 'sakit', label: 'Sakit', color: 'bg-sky-warm', text: 'text-sky-warm', emoji: '🤒' },
    { k: 'izin', label: 'Izin', color: 'bg-navy', text: 'text-navy', emoji: '✋' },
    { k: 'alfa', label: 'Alfa', color: 'bg-rose', text: 'text-rose', emoji: '✗' },
  ]

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ===== Hero Greeting Card ===== */}
      <div className="relative overflow-hidden rounded-3xl bg-navy text-white p-6 lg:p-8 shadow-card-lg">
        <div className="absolute inset-0 grid-pattern opacity-20"></div>
        <div className="absolute -right-20 -top-20 w-72 h-72 bg-amber-warm/20 rounded-full blur-3xl"></div>
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-coral/20 rounded-full blur-3xl"></div>

        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-warm/15 border border-amber-warm/30 rounded-full mb-4">
              <GreetIcon className="w-3.5 h-3.5 text-amber-warm" strokeWidth={2.5} />
              <span className="text-xs font-semibold text-amber-200 tracking-wide">{dateLabel}</span>
            </div>
            <h1 className="text-2xl lg:text-4xl font-extrabold leading-tight mb-2">
              {greeting}, {user?.name?.split(' ')[0] || 'Admin'} 👋
            </h1>
            <p className="text-white/70 leading-relaxed max-w-lg">
              {attendanceRate > 90
                ? 'Kehadiran hari ini sangat baik. Semoga proses belajar lancar.'
                : 'Yuk pantau kehadiran dan ujian hari ini agar tetap on track.'}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/attendance')}
              className="px-5 py-3 bg-amber-warm text-navy rounded-2xl font-bold text-sm hover:shadow-warm transition flex items-center gap-2"
            >
              <ClipboardCheck className="w-4 h-4" strokeWidth={2.5} /> Absensi
            </button>
            <button
              onClick={() => navigate('/ai-hub')}
              className="px-5 py-3 bg-white/10 border border-white/20 text-white rounded-2xl font-bold text-sm hover:bg-white/15 transition flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" strokeWidth={2.5} /> AI Hub
            </button>
          </div>
        </div>
      </div>

      {/* ===== Holiday Banner ===== */}
      {holiday?.is_holiday && (
        <div className="bg-gradient-to-r from-coral/10 to-amber-soft border-2 border-coral/20 rounded-3xl p-5 flex items-center gap-4">
          <div className="w-14 h-14 bg-coral/15 rounded-2xl flex items-center justify-center flex-shrink-0">
            <PartyPopper className="w-7 h-7 text-coral" strokeWidth={2.4} />
          </div>
          <div>
            <div className="font-extrabold text-navy text-lg">Hari Ini Libur</div>
            <div className="text-sm text-navy/70">{holiday.title}</div>
          </div>
        </div>
      )}

      {/* ===== Stat Cards ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {statCards.map((card, i) => (
          <button
            key={i}
            onClick={() => navigate(card.to)}
            className="group relative bg-white border border-warm/40 rounded-3xl p-4 lg:p-5 shadow-card hover:shadow-card-lg hover:-translate-y-0.5 transition-all text-left overflow-hidden"
          >
            <div className={`absolute -top-4 -right-4 w-20 h-20 ${card.bg} rounded-full opacity-60 group-hover:scale-110 transition-transform`}></div>
            <div className="relative">
              <div className={`w-11 h-11 ${card.bg} rounded-2xl flex items-center justify-center mb-3`}>
                <card.icon className={`w-5 h-5 text-${card.accent}`} strokeWidth={2.4} />
              </div>
              <div className="text-2xl lg:text-3xl font-extrabold text-navy leading-none">
                {card.value}
              </div>
              <div className="text-xs lg:text-sm text-navy/60 mt-1.5 font-semibold">{card.label}</div>
              {card.delta && (
                <div className="hidden lg:flex items-center gap-1 text-[10px] text-navy/40 mt-2">
                  <ArrowUpRight className="w-3 h-3" /> {card.delta}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* ===== Quick Actions (Mobile-friendly) ===== */}
      <div className="bg-white border border-warm/40 rounded-3xl p-5 lg:p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-navy text-base lg:text-lg">Aksi Cepat</h3>
          <Sparkles className="w-4 h-4 text-amber-warm" strokeWidth={2.4} />
        </div>
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {quickActions.map(action => (
            <button
              key={action.to}
              onClick={() => navigate(action.to)}
              className="group flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-amber-soft/40 transition active:scale-95"
            >
              <div className={`w-12 h-12 ${action.color} rounded-2xl flex items-center justify-center shadow-warm-sm group-hover:shadow-warm transition`}>
                <action.icon className="w-5 h-5 text-white" strokeWidth={2.4} />
              </div>
              <span className="text-[11px] lg:text-xs font-bold text-navy text-center leading-tight">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ===== Attendance Today ===== */}
      <div className="bg-white border border-warm/40 rounded-3xl p-5 lg:p-6 shadow-card">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-extrabold text-navy text-base lg:text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-warm" strokeWidth={2.4} />
              Absensi Hari Ini
            </h3>
            <p className="text-xs text-navy/60 mt-0.5">{a.sessions ?? 0} sesi absen tercatat</p>
          </div>
          <div className="text-right">
            <div className="text-2xl lg:text-3xl font-extrabold text-mint">{attendanceRate}%</div>
            <div className="text-[10px] text-navy/50 font-semibold">KEHADIRAN</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2.5 bg-amber-soft rounded-full overflow-hidden mb-5 flex">
          {attendanceItems.map(item => {
            const count = a[item.k] ?? 0
            const pct = totalAttendance > 0 ? (count / totalAttendance) * 100 : 0
            if (pct === 0) return null
            return (
              <div
                key={item.k}
                className={`${item.color} h-full transition-all`}
                style={{ width: `${pct}%` }}
                title={`${item.label}: ${count}`}
              />
            )
          })}
        </div>

        <div className="grid grid-cols-5 gap-2 lg:gap-3">
          {attendanceItems.map(item => (
            <div key={item.k} className="text-center">
              <div className={`text-xl lg:text-2xl font-extrabold ${item.text}`}>
                {a[item.k] ?? 0}
              </div>
              <div className="text-[10px] lg:text-xs text-navy/60 font-semibold mt-0.5">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== Charts row ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Class distribution */}
        <div className="bg-white border border-warm/40 rounded-3xl p-5 lg:p-6 shadow-card">
          <h3 className="font-extrabold text-navy text-base mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-warm" strokeWidth={2.4} />
            Distribusi Siswa per Kelas
          </h3>
          {(stats?.class_distribution || []).length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats?.class_distribution || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#FDE68A" vertical={false} />
                <XAxis dataKey="class_name" tick={{ fontSize: 11, fill: '#0F1B3D' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#0F1B3D' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '16px',
                    border: '1px solid #FDE68A',
                    boxShadow: '0 8px 28px rgba(15,27,61,0.10)',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                />
                <Bar dataKey="student_count" fill="#F59E0B" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-navy/40 text-sm">Belum ada data kelas</div>
          )}
        </div>

        {/* Recent exams */}
        <div className="bg-white border border-warm/40 rounded-3xl p-5 lg:p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-navy text-base flex items-center gap-2">
              <FileQuestion className="w-5 h-5 text-amber-warm" strokeWidth={2.4} />
              Ujian Terbaru
            </h3>
            <button
              onClick={() => navigate('/exams')}
              className="text-xs font-bold text-amber-warm hover:underline flex items-center gap-1"
            >
              Lihat semua <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2.5">
            {(stats?.recent_exams || []).slice(0, 5).map((exam: any) => (
              <button
                key={exam.id}
                onClick={() => navigate('/exams')}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-cream-soft hover:bg-amber-soft/50 transition border border-warm/30 text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-amber-soft rounded-xl flex items-center justify-center flex-shrink-0">
                    <FileQuestion className="w-5 h-5 text-amber-warm" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-navy text-sm truncate">{exam.title}</p>
                    <p className="text-xs text-navy/60 truncate">
                      {exam.subject?.name || '—'} · {exam.class?.name || '—'}
                    </p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold flex-shrink-0 ml-2 ${
                  exam.status === 'active' ? 'bg-mint/15 text-mint' :
                  exam.status === 'ended' ? 'bg-navy/10 text-navy/60' :
                  'bg-amber-soft text-amber-warm'
                }`}>
                  {exam.status === 'active' ? 'BERLANGSUNG' : exam.status === 'ended' ? 'SELESAI' : 'DRAFT'}
                </span>
              </button>
            ))}
            {(!stats?.recent_exams || stats.recent_exams.length === 0) && (
              <div className="text-center py-8">
                <FileQuestion className="w-10 h-10 text-navy/20 mx-auto mb-2" />
                <p className="text-navy/50 text-sm font-semibold">Belum ada ujian</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Upcoming Events ===== */}
      <div className="bg-white border border-warm/40 rounded-3xl p-5 lg:p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-navy text-base flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-warm" strokeWidth={2.4} />
            Agenda Mendatang
          </h3>
          <button
            onClick={() => navigate('/calendar')}
            className="text-xs font-bold text-amber-warm hover:underline flex items-center gap-1"
          >
            Buka kalender <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {(stats?.upcoming_events || []).map((event: any) => (
            <div
              key={event.id}
              className="flex-shrink-0 w-52 lg:w-56 p-4 rounded-2xl border-2 border-warm/40 bg-gradient-to-br from-amber-soft to-cream-soft hover:border-amber-warm transition cursor-pointer"
              onClick={() => navigate('/calendar')}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 bg-white rounded-xl flex flex-col items-center justify-center text-amber-warm shadow-warm-sm">
                  <span className="text-[8px] font-bold uppercase leading-none">
                    {new Date(event.start_date).toLocaleDateString('id-ID', { month: 'short' })}
                  </span>
                  <span className="text-sm font-extrabold leading-none">
                    {new Date(event.start_date).getDate()}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-amber-warm uppercase tracking-wide">{event.type}</span>
              </div>
              <p className="font-bold text-navy text-sm leading-snug line-clamp-2">{event.title}</p>
            </div>
          ))}
          {(!stats?.upcoming_events || stats.upcoming_events.length === 0) && (
            <div className="w-full text-center py-8">
              <Calendar className="w-10 h-10 text-navy/20 mx-auto mb-2" />
              <p className="text-navy/50 text-sm font-semibold">Tidak ada agenda mendatang</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
