import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  Calendar, Clock, QrCode, Loader2, ArrowLeft, Users, BarChart3,
  PartyPopper, ClipboardCheck, Save, Lock, BookOpen, GraduationCap, Sparkles,
} from 'lucide-react'
import { getCurrentPositionSafe } from '../utils/geolocation'

type View = 'today' | 'session' | 'summary' | 'teacher'

interface Schedule {
  id: number
  day_of_week: number
  start_time: string
  end_time: string
  class?: { id: number; name: string }
  subject?: { id: number; name: string }
  teacher?: { user?: { name: string } }
  session?: AttendanceSession | null
}

interface AttendanceSession {
  id: number
  schedule_id: number
  date: string
  status: 'open' | 'closed'
  method: 'manual' | 'qr'
  qr_token?: string
  qr_expires?: string
  schedule?: Schedule
  presences?: Presence[]
}

interface Presence {
  id: number
  session_id: number
  student_id: number
  status: 'hadir' | 'terlambat' | 'sakit' | 'izin' | 'alfa'
  note?: string
  late_min?: number
  student?: { id: number; nis: string; user?: { name: string } }
}

const STATUS_STYLE: Record<string, { bg: string; text: string; ring: string; label: string; emoji: string }> = {
  hadir: { bg: 'bg-mint', text: 'text-mint', ring: 'ring-mint/30', label: 'Hadir', emoji: '✓' },
  terlambat: { bg: 'bg-amber-warm', text: 'text-amber-warm', ring: 'ring-amber-warm/30', label: 'Telat', emoji: '⏱' },
  sakit: { bg: 'bg-sky-warm', text: 'text-sky-warm', ring: 'ring-sky-warm/30', label: 'Sakit', emoji: 'S' },
  izin: { bg: 'bg-navy', text: 'text-navy', ring: 'ring-navy/30', label: 'Izin', emoji: 'I' },
  alfa: { bg: 'bg-rose', text: 'text-rose', ring: 'ring-rose/30', label: 'Alfa', emoji: '✗' },
}

const STATUS_LABEL: Record<string, string> = {
  hadir: 'H', terlambat: 'T', sakit: 'S', izin: 'I', alfa: 'A',
}

const DAYS = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

export default function Attendance() {
  const [view, setView] = useState<View>('today')
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [todaySessions, setTodaySessions] = useState<AttendanceSession[]>([])
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [isTeacher, setIsTeacher] = useState(true)
  const [holiday, setHoliday] = useState<{ is_holiday: boolean; title: string } | null>(null)

  useEffect(() => { if (view === 'today') fetchToday() }, [view])

  const fetchToday = async () => {
    setLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const hol = await axios.get('/api/calendar/check-holiday', { params: { date: today } })
      setHoliday(hol.data)

      const r = await axios.get('/api/schedules/today')
      setSchedules(r.data || [])
      setIsTeacher(true)
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setIsTeacher(false)
        try {
          const today = new Date().toISOString().slice(0, 10)
          const r2 = await axios.get(`/api/attendance/sessions`, { params: { date: today } })
          setTodaySessions(r2.data || [])
        } catch { /* noop */ }
      } else {
        toast.error('Gagal load jadwal')
      }
    } finally {
      setLoading(false)
    }
  }

  const openSession = async (scheduleId: number, method: 'manual' | 'qr') => {
    try {
      const today = new Date().toISOString().slice(0, 10)

      // ─── Anti fake-GPS: cek dulu apakah sekolah require GPS ───
      let gpsPayload: any = undefined
      try {
        const cfg = await axios.get('/api/school/location')
        if (cfg.data?.gps_required) {
          const toastId = toast.loading('📍 Memeriksa lokasi...')
          const result = await getCurrentPositionSafe({
            maxAccuracyM: cfg.data.gps_max_accuracy_m || 100,
            timeoutMs: 12000,
          })
          toast.dismiss(toastId)
          if (!result.ok) {
            toast.error(result.error.message, { duration: 5000 })
            return
          }
          gpsPayload = result.reading
        }
      } catch {
        /* school config gagal di-fetch — lanjut tanpa GPS, biar backend yang reject */
      }

      const res = await axios.post('/api/attendance/sessions/open', {
        schedule_id: scheduleId, date: today, method, qr_duration_minutes: 15,
        gps: gpsPayload,
      })
      toast.success('Sesi dibuka')
      await loadSession(res.data.id)
    } catch (e: any) {
      const data = e.response?.data
      // Tampilkan reject reason GPS lebih informatif
      if (data?.reject_reason === 'distance' && data?.distance_m) {
        toast.error(
          `📍 Anda di luar area sekolah (${data.distance_m}m, max ${data.radius_m}m)`,
          { duration: 6000 },
        )
      } else if (data?.gps_required && data?.reject_reason) {
        toast.error(data.error || 'Validasi lokasi gagal', { duration: 6000 })
      } else {
        toast.error(data?.error || 'Gagal buka sesi')
      }
    }
  }

  const loadSession = async (id: number) => {
    const res = await axios.get(`/api/attendance/sessions/${id}`)
    setActiveSession(res.data)
    setView('session')
  }

  const closeSession = async () => {
    if (!activeSession) return
    if (!confirm('Tutup sesi? Setelah ditutup, tidak bisa absen lagi.')) return
    try {
      await axios.post(`/api/attendance/sessions/${activeSession.id}/close`)
      toast.success('Sesi ditutup')
      setView('today')
      setActiveSession(null)
    } catch { toast.error('Gagal menutup sesi') }
  }

  const tabs: { key: View; label: string; icon: any }[] = [
    { key: 'today', label: 'Hari Ini', icon: Calendar },
    { key: 'summary', label: 'Rekap', icon: BarChart3 },
    { key: 'teacher', label: 'Guru', icon: Users },
  ]

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          {view !== 'today' && (
            <button
              onClick={() => { setView('today'); setActiveSession(null) }}
              className="p-2.5 rounded-2xl bg-white border border-warm/60 hover:bg-amber-soft text-navy transition shadow-card"
            >
              <ArrowLeft className="w-5 h-5" strokeWidth={2.4} />
            </button>
          )}
          <div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-navy">
              {view === 'today' && (isTeacher ? 'Absensi Hari Ini' : 'Sesi Absensi Hari Ini')}
              {view === 'session' && 'Sesi Absensi'}
              {view === 'summary' && 'Rekap Absensi'}
              {view === 'teacher' && 'Rekap Kehadiran Guru'}
            </h1>
            <p className="text-sm text-navy/60 mt-0.5">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Tab pills */}
        {view !== 'session' && (
          <div className="flex gap-1.5 bg-white border border-warm/60 rounded-2xl p-1.5 shadow-card">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setView(tab.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  view === tab.key
                    ? 'gradient-warm text-white shadow-warm-sm'
                    : 'text-navy/60 hover:text-navy hover:bg-amber-soft/50'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" strokeWidth={2.4} /> {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ===== TODAY view ===== */}
      {view === 'today' && (
        loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-amber-warm" strokeWidth={2.4} />
          </div>
        ) : holiday?.is_holiday ? (
          <div className="bg-gradient-to-r from-coral/10 to-amber-soft border-2 border-coral/20 rounded-3xl p-8 text-center shadow-card">
            <div className="w-20 h-20 bg-coral/15 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <PartyPopper className="w-10 h-10 text-coral" strokeWidth={2.2} />
            </div>
            <div className="text-2xl font-extrabold text-navy mb-1">Hari Libur</div>
            <div className="text-navy/70 text-base">{holiday.title}</div>
            <div className="text-sm text-navy/50 mt-2">Absensi tidak aktif hari ini.</div>
          </div>
        ) : isTeacher ? (
          schedules.length === 0 ? (
            <div className="bg-white border border-warm/40 rounded-3xl p-12 text-center shadow-card">
              <ClipboardCheck className="w-12 h-12 text-navy/20 mx-auto mb-3" />
              <p className="text-navy/60 text-sm font-semibold">
                Tidak ada jadwal mengajar hari ini ({DAYS[new Date().getDay() || 7]})
              </p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {schedules.map(s => (
                <div
                  key={s.id}
                  className="bg-white border border-warm/40 rounded-3xl p-5 shadow-card hover:shadow-card-lg transition-all"
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-12 h-12 bg-amber-soft rounded-2xl flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-5 h-5 text-amber-warm" strokeWidth={2.4} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs text-navy/60 font-semibold mb-1">
                          <Clock className="w-3.5 h-3.5 text-amber-warm" />
                          {s.start_time} – {s.end_time}
                        </div>
                        <div className="font-bold text-navy text-base leading-tight">{s.subject?.name || '-'}</div>
                        <div className="text-sm text-navy/60 flex items-center gap-1 mt-0.5">
                          <GraduationCap className="w-3.5 h-3.5" /> Kelas {s.class?.name || '-'}
                        </div>
                      </div>
                    </div>
                    {s.session && (
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wide flex-shrink-0 ${
                        s.session.status === 'open' ? 'bg-mint/15 text-mint' : 'bg-navy/10 text-navy/60'
                      }`}>
                        {s.session.status === 'open' ? 'DIBUKA' : 'DITUTUP'}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-warm/30">
                    {s.session ? (
                      <button
                        onClick={() => loadSession(s.session!.id)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 gradient-warm text-white rounded-2xl font-bold text-sm hover:shadow-warm transition shadow-warm-sm"
                      >
                        <ClipboardCheck className="w-4 h-4" strokeWidth={2.5} />
                        Lanjut Sesi
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => openSession(s.id, 'manual')}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-navy text-white rounded-2xl font-bold text-sm hover:opacity-90 transition"
                        >
                          <Users className="w-4 h-4" strokeWidth={2.4} /> Manual
                        </button>
                        <button
                          onClick={() => openSession(s.id, 'qr')}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 gradient-warm text-white rounded-2xl font-bold text-sm hover:shadow-warm transition shadow-warm-sm"
                        >
                          <QrCode className="w-4 h-4" strokeWidth={2.4} /> QR Code
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          // Admin view
          todaySessions.length === 0 ? (
            <div className="bg-white border border-warm/40 rounded-3xl p-12 text-center shadow-card">
              <ClipboardCheck className="w-12 h-12 text-navy/20 mx-auto mb-3" />
              <p className="text-navy/60 text-sm font-semibold mb-1">Belum ada sesi absen dibuka hari ini</p>
              <p className="text-navy/40 text-xs">Admin melihat sesi yang dibuka guru. Untuk membuat sesi, login sebagai guru.</p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {todaySessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => loadSession(s.id)}
                  className="bg-white border border-warm/40 rounded-3xl p-5 shadow-card hover:shadow-card-lg transition-all text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-12 h-12 bg-amber-soft rounded-2xl flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-5 h-5 text-amber-warm" strokeWidth={2.4} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs text-navy/60 font-semibold mb-1">
                          <Clock className="w-3.5 h-3.5 text-amber-warm" />
                          {s.schedule?.start_time} – {s.schedule?.end_time}
                        </div>
                        <div className="font-bold text-navy text-base">{s.schedule?.subject?.name || '-'}</div>
                        <div className="text-sm text-navy/60">Kelas {s.schedule?.class?.name || '-'}</div>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wide flex-shrink-0 ${
                      s.status === 'open' ? 'bg-mint/15 text-mint' : 'bg-navy/10 text-navy/60'
                    }`}>
                      {s.status === 'open' ? 'DIBUKA' : 'DITUTUP'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )
        )
      )}

      {view === 'session' && activeSession && (
        <SessionPanel session={activeSession} onReload={() => loadSession(activeSession.id)} onClose={closeSession} />
      )}

      {view === 'summary' && <SummaryPanel />}

      {view === 'teacher' && <TeacherSummaryPanel />}
    </div>
  )
}

function SessionPanel({ session, onReload, onClose }: { session: AttendanceSession; onReload: () => void; onClose: () => void }) {
  const [marks, setMarks] = useState<Record<number, { status: string; note: string; late_min: number }>>(() => {
    const m: any = {}
    session.presences?.forEach(p => {
      m[p.student_id] = { status: p.status, note: p.note || '', late_min: p.late_min || 0 }
    })
    return m
  })
  const [saving, setSaving] = useState(false)

  const setMark = (sid: number, patch: Partial<{ status: string; note: string; late_min: number }>) => {
    setMarks(prev => ({ ...prev, [sid]: { ...prev[sid], ...patch } }))
  }

  const save = async () => {
    setSaving(true)
    try {
      const items = Object.entries(marks).map(([sid, m]) => ({
        student_id: Number(sid), status: m.status, note: m.note, late_min: m.late_min,
      }))
      await axios.post(`/api/attendance/sessions/${session.id}/mark`, { items })
      toast.success('Tersimpan')
      onReload()
    } catch { toast.error('Gagal menyimpan') }
    finally { setSaving(false) }
  }

  const stats = session.presences?.reduce((acc: any, p) => {
    const s = marks[p.student_id]?.status || p.status
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {}) || {}

  // Quick mark all hadir
  const markAllHadir = () => {
    const next: any = { ...marks }
    session.presences?.forEach(p => {
      next[p.student_id] = { ...next[p.student_id], status: 'hadir' }
    })
    setMarks(next)
    toast.success('Semua ditandai Hadir. Klik Simpan untuk konfirmasi.')
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-navy text-white rounded-3xl p-6 shadow-card-lg relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-20"></div>
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-amber-warm/15 rounded-full blur-3xl"></div>

        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-warm/20 border border-amber-warm/30 rounded-full mb-2">
              <ClipboardCheck className="w-3 h-3 text-amber-warm" strokeWidth={2.5} />
              <span className="text-[10px] font-extrabold text-amber-200 tracking-wide uppercase">
                Sesi {session.method === 'qr' ? 'QR Code' : 'Manual'} — {session.status === 'open' ? 'Dibuka' : 'Ditutup'}
              </span>
            </div>
            <h2 className="text-xl lg:text-2xl font-extrabold leading-tight">
              {session.schedule?.subject?.name} · Kelas {session.schedule?.class?.name}
            </h2>
            <p className="text-white/60 text-sm mt-1">
              {new Date(session.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex gap-2">
            {session.status === 'open' && (
              <>
                <button
                  onClick={markAllHadir}
                  className="px-4 py-2.5 bg-white/10 border border-white/20 text-white rounded-2xl font-bold text-sm hover:bg-white/15 flex items-center gap-2 transition"
                >
                  <Sparkles className="w-4 h-4" strokeWidth={2.4} /> Semua Hadir
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 bg-rose/20 border border-rose/30 text-rose-300 rounded-2xl font-bold text-sm hover:bg-rose/30 flex items-center gap-2 transition"
                >
                  <Lock className="w-4 h-4" strokeWidth={2.4} /> Tutup Sesi
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats pills */}
        <div className="relative mt-5 flex flex-wrap gap-2">
          {(['hadir', 'terlambat', 'sakit', 'izin', 'alfa'] as const).map(s => (
            <div key={s} className={`flex items-center gap-2 px-3 py-1.5 ${STATUS_STYLE[s].bg} bg-opacity-90 rounded-full text-white text-xs font-extrabold`}>
              <span>{STATUS_STYLE[s].label}</span>
              <span className="bg-white/25 px-2 py-0.5 rounded-full text-[11px]">{stats[s] || 0}</span>
            </div>
          ))}
        </div>
      </div>

      {/* QR section */}
      {session.method === 'qr' && session.qr_token && (
        <div className="bg-white border border-warm/40 rounded-3xl p-6 shadow-card text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-soft border border-warm rounded-full mb-3">
            <QrCode className="w-3.5 h-3.5 text-amber-warm" strokeWidth={2.5} />
            <span className="text-xs font-extrabold text-amber-warm uppercase tracking-wide">Scan untuk absen</span>
          </div>
          <div className="text-sm text-navy/60 mb-4">Siswa scan QR di app mereka untuk menandai kehadiran</div>
          <div className="inline-block p-4 bg-cream-soft border-2 border-warm/60 rounded-3xl">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(session.qr_token)}`}
              alt="QR Code"
              className="rounded-2xl"
            />
          </div>
          <div className="text-xs text-navy/40 mt-3 font-mono">{session.qr_token}</div>
          {session.qr_expires && (
            <div className="text-xs text-navy/60 mt-1 font-semibold">
              Berlaku sampai {new Date(session.qr_expires).toLocaleTimeString('id-ID')}
            </div>
          )}
        </div>
      )}

      {/* Student list — desktop table */}
      <div className="hidden lg:block bg-white border border-warm/40 rounded-3xl overflow-hidden shadow-card">
        <table className="w-full">
          <thead className="bg-amber-soft/40 border-b border-warm/40">
            <tr>
              <th className="px-5 py-4 text-left text-[11px] font-extrabold text-navy uppercase tracking-wider">Siswa</th>
              <th className="px-5 py-4 text-left text-[11px] font-extrabold text-navy uppercase tracking-wider">Status</th>
              <th className="px-5 py-4 text-left text-[11px] font-extrabold text-navy uppercase tracking-wider">Telat (mnt)</th>
              <th className="px-5 py-4 text-left text-[11px] font-extrabold text-navy uppercase tracking-wider">Catatan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warm/30">
            {session.presences?.map(p => {
              const m = marks[p.student_id] || { status: p.status, note: '', late_min: 0 }
              return (
                <tr key={p.id} className="hover:bg-cream-soft transition">
                  <td className="px-5 py-3">
                    <div className="font-bold text-navy text-sm">{p.student?.user?.name || '-'}</div>
                    <div className="text-xs text-navy/50 font-mono">{p.student?.nis || '-'}</div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      {(['hadir', 'terlambat', 'sakit', 'izin', 'alfa'] as const).map(s => {
                        const active = m.status === s
                        return (
                          <button
                            key={s}
                            onClick={() => setMark(p.student_id, { status: s })}
                            className={`w-9 h-9 rounded-xl text-xs font-extrabold transition ${
                              active
                                ? `${STATUS_STYLE[s].bg} text-white shadow-warm-sm`
                                : 'bg-cream-soft text-navy/40 hover:bg-amber-soft hover:text-navy'
                            }`}
                            title={STATUS_STYLE[s].label}
                          >
                            {STATUS_LABEL[s]}
                          </button>
                        )
                      })}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <input
                      type="number"
                      value={m.late_min}
                      onChange={e => setMark(p.student_id, { late_min: Number(e.target.value) })}
                      disabled={m.status !== 'terlambat'}
                      className="w-20 px-3 py-1.5 rounded-xl border border-warm/60 text-sm font-semibold text-navy disabled:opacity-40 disabled:bg-cream-soft focus:outline-none focus:border-amber-warm"
                    />
                  </td>
                  <td className="px-5 py-3">
                    <input
                      value={m.note}
                      onChange={e => setMark(p.student_id, { note: e.target.value })}
                      placeholder="—"
                      className="w-full px-3 py-1.5 rounded-xl border border-warm/60 text-sm text-navy focus:outline-none focus:border-amber-warm"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {session.presences?.map(p => {
          const m = marks[p.student_id] || { status: p.status, note: '', late_min: 0 }
          return (
            <div key={p.id} className="bg-white border border-warm/40 rounded-2xl p-4 shadow-card">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="font-bold text-navy text-sm truncate">{p.student?.user?.name || '-'}</div>
                  <div className="text-xs text-navy/50 font-mono">{p.student?.nis || '-'}</div>
                </div>
                <div className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${STATUS_STYLE[m.status]?.bg || 'bg-navy/10'} text-white`}>
                  {STATUS_STYLE[m.status]?.label.toUpperCase() || '—'}
                </div>
              </div>

              <div className="grid grid-cols-5 gap-1.5 mb-2">
                {(['hadir', 'terlambat', 'sakit', 'izin', 'alfa'] as const).map(s => {
                  const active = m.status === s
                  return (
                    <button
                      key={s}
                      onClick={() => setMark(p.student_id, { status: s })}
                      className={`py-2.5 rounded-xl text-xs font-extrabold transition ${
                        active
                          ? `${STATUS_STYLE[s].bg} text-white shadow-warm-sm`
                          : 'bg-cream-soft text-navy/40'
                      }`}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  )
                })}
              </div>

              {m.status === 'terlambat' && (
                <input
                  type="number"
                  value={m.late_min}
                  onChange={e => setMark(p.student_id, { late_min: Number(e.target.value) })}
                  placeholder="Telat berapa menit?"
                  className="w-full px-3 py-2 rounded-xl border border-warm/60 text-sm font-semibold text-navy mb-2 focus:outline-none focus:border-amber-warm"
                />
              )}

              <input
                value={m.note}
                onChange={e => setMark(p.student_id, { note: e.target.value })}
                placeholder="Catatan (opsional)"
                className="w-full px-3 py-2 rounded-xl border border-warm/60 text-sm text-navy focus:outline-none focus:border-amber-warm"
              />
            </div>
          )
        })}
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-20 lg:bottom-4 z-20 flex justify-end">
        <button
          onClick={save}
          disabled={saving || session.status === 'closed'}
          className="px-6 py-3.5 gradient-warm text-white rounded-2xl shadow-warm font-bold text-sm hover:shadow-card-lg transition disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
          ) : (
            <><Save className="w-4 h-4" strokeWidth={2.5} /> Simpan Absensi</>
          )}
        </button>
      </div>
    </div>
  )
}

function SummaryPanel() {
  const [classId, setClassId] = useState('')
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [classes, setClasses] = useState<any[]>([])
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { axios.get('/api/classes/').then(r => setClasses(r.data || [])) }, [])

  const load = () => {
    setLoading(true)
    const params: any = { month }
    if (classId) params.class_id = classId
    axios.get('/api/attendance/summary', { params })
      .then(r => setRows(r.data || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { if (classId) load() }, [classId, month])

  return (
    <div className="space-y-4">
      <div className="bg-white border border-warm/40 rounded-3xl p-5 shadow-card grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-extrabold text-navy uppercase tracking-wide mb-1.5">Kelas</label>
          <select
            value={classId}
            onChange={e => setClassId(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-warm/60 focus:ring-4 focus:ring-amber-warm/15 focus:border-amber-warm outline-none transition text-sm font-semibold text-navy"
          >
            <option value="">Pilih kelas...</option>
            {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-extrabold text-navy uppercase tracking-wide mb-1.5">Bulan</label>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-warm/60 focus:ring-4 focus:ring-amber-warm/15 focus:border-amber-warm outline-none transition text-sm font-semibold text-navy"
          />
        </div>
      </div>

      {!classId ? (
        <div className="bg-white border border-warm/40 rounded-3xl py-12 text-center shadow-card">
          <BarChart3 className="w-12 h-12 text-navy/20 mx-auto mb-3" />
          <p className="text-navy/60 text-sm font-semibold">Pilih kelas dulu untuk melihat rekap</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-amber-warm" strokeWidth={2.4} />
        </div>
      ) : (
        <div className="bg-white border border-warm/40 rounded-3xl shadow-card overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-amber-soft/40 border-b border-warm/40">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-extrabold text-navy uppercase tracking-wider">Siswa</th>
                <th className="px-3 py-3 text-center text-[11px] font-extrabold text-mint uppercase">H</th>
                <th className="px-3 py-3 text-center text-[11px] font-extrabold text-amber-warm uppercase">T</th>
                <th className="px-3 py-3 text-center text-[11px] font-extrabold text-sky-warm uppercase">S</th>
                <th className="px-3 py-3 text-center text-[11px] font-extrabold text-navy uppercase">I</th>
                <th className="px-3 py-3 text-center text-[11px] font-extrabold text-rose uppercase">A</th>
                <th className="px-3 py-3 text-center text-[11px] font-extrabold text-navy uppercase">Total</th>
                <th className="px-4 py-3 text-center text-[11px] font-extrabold text-navy uppercase">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm/30">
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-navy/40 text-sm font-semibold">Belum ada data</td></tr>
              ) : rows.map(r => {
                const p = Number(r.persentase ?? 0)
                const pColor = p >= 80 ? 'text-mint' : p >= 60 ? 'text-amber-warm' : 'text-rose'
                return (
                  <tr key={r.student_id} className="hover:bg-cream-soft transition">
                    <td className="px-4 py-3">
                      <div className="font-bold text-navy text-sm">{r.name}</div>
                      <div className="text-xs text-navy/50 font-mono">{r.nis}</div>
                    </td>
                    <td className="px-3 py-3 text-center text-mint font-extrabold">{r.hadir ?? 0}</td>
                    <td className="px-3 py-3 text-center text-amber-warm font-extrabold">{r.terlambat ?? 0}</td>
                    <td className="px-3 py-3 text-center text-sky-warm font-bold">{r.sakit ?? 0}</td>
                    <td className="px-3 py-3 text-center text-navy font-bold">{r.izin ?? 0}</td>
                    <td className="px-3 py-3 text-center text-rose font-extrabold">{r.alfa ?? 0}</td>
                    <td className="px-3 py-3 text-center font-bold text-navy">{r.total ?? 0}</td>
                    <td className={`px-4 py-3 text-center font-extrabold ${pColor}`}>{p.toFixed(1)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function TeacherSummaryPanel() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    axios.get('/api/attendance/teacher-summary', { params: { month } })
      .then(r => setRows(r.data || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [month])

  return (
    <div className="space-y-4">
      <div className="bg-white border border-warm/40 rounded-3xl p-5 shadow-card">
        <label className="block text-xs font-extrabold text-navy uppercase tracking-wide mb-1.5">Bulan</label>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="w-full sm:w-64 px-4 py-3 rounded-2xl bg-white border-2 border-warm/60 focus:ring-4 focus:ring-amber-warm/15 focus:border-amber-warm outline-none transition text-sm font-semibold text-navy"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-amber-warm" strokeWidth={2.4} />
        </div>
      ) : (
        <div className="bg-white border border-warm/40 rounded-3xl shadow-card overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-amber-soft/40 border-b border-warm/40">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-extrabold text-navy uppercase tracking-wider">Guru</th>
                <th className="px-4 py-3 text-left text-[11px] font-extrabold text-navy uppercase tracking-wider">NIP</th>
                <th className="px-3 py-3 text-center text-[11px] font-extrabold text-navy uppercase">Jadwal</th>
                <th className="px-3 py-3 text-center text-[11px] font-extrabold text-mint uppercase">Hadir</th>
                <th className="px-3 py-3 text-center text-[11px] font-extrabold text-rose uppercase">Tidak Hadir</th>
                <th className="px-4 py-3 text-center text-[11px] font-extrabold text-navy uppercase">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm/30">
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-navy/40 text-sm font-semibold">Belum ada data</td></tr>
              ) : rows.map(r => {
                const p = Number(r.persentase ?? 0)
                const pColor = p >= 80 ? 'text-mint' : p >= 60 ? 'text-amber-warm' : 'text-rose'
                return (
                  <tr key={r.teacher_id} className="hover:bg-cream-soft transition">
                    <td className="px-4 py-3 font-bold text-navy text-sm">{r.teacher_name}</td>
                    <td className="px-4 py-3 text-sm text-navy/60 font-mono">{r.nip}</td>
                    <td className="px-3 py-3 text-center font-bold text-navy">{r.total_jadwal}</td>
                    <td className="px-3 py-3 text-center text-mint font-extrabold">{r.hadir}</td>
                    <td className="px-3 py-3 text-center text-rose font-extrabold">{r.tidak_hadir}</td>
                    <td className={`px-4 py-3 text-center font-extrabold ${pColor}`}>{p.toFixed(1)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
