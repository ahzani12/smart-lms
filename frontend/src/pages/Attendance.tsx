import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Calendar, Clock, QrCode, CheckCircle2, Loader2, ArrowLeft, Users, BarChart3 } from 'lucide-react'

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

const STATUS_COLOR: Record<string, string> = {
  hadir: 'bg-green-100 text-green-700',
  terlambat: 'bg-yellow-100 text-yellow-700',
  sakit: 'bg-blue-100 text-blue-700',
  izin: 'bg-purple-100 text-purple-700',
  alfa: 'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<string, string> = {
  hadir: 'H', terlambat: 'T', sakit: 'S', izin: 'I', alfa: 'A',
}

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
      // Check holiday first
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
      const res = await axios.post('/api/attendance/sessions/open', {
        schedule_id: scheduleId, date: today, method, qr_duration_minutes: 15,
      })
      toast.success('Sesi dibuka')
      await loadSession(res.data.id)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Gagal buka sesi')
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

  const DAYS = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {view !== 'today' && (
            <button onClick={() => { setView('today'); setActiveSession(null) }}
              className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft className="w-5 h-5" /></button>
          )}
          <h1 className="text-2xl font-bold text-gray-900">
            {view === 'today' && (isTeacher ? 'Absensi Hari Ini' : 'Sesi Absensi Hari Ini')}
            {view === 'session' && 'Sesi Absensi'}
            {view === 'summary' && 'Rekap Absensi'}
            {view === 'teacher' && 'Rekap Kehadiran Guru'}
          </h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('today')}
            className={`px-3 py-2 rounded-lg text-sm font-medium ${view === 'today' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            <Calendar className="w-4 h-4 inline mr-1" /> Hari Ini
          </button>
          <button onClick={() => setView('summary')}
            className={`px-3 py-2 rounded-lg text-sm font-medium ${view === 'summary' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            <BarChart3 className="w-4 h-4 inline mr-1" /> Rekap
          </button>
          <button onClick={() => setView('teacher')}
            className={`px-3 py-2 rounded-lg text-sm font-medium ${view === 'teacher' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            <Users className="w-4 h-4 inline mr-1" /> Guru
          </button>
        </div>
      </div>

      {view === 'today' && (
        loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
        ) : holiday?.is_holiday ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-2">🏖️</div>
            <div className="text-lg font-bold text-green-800">Hari Libur</div>
            <div className="text-green-600 mt-1">{holiday.title}</div>
            <div className="text-sm text-green-500 mt-2">Absensi tidak aktif hari ini</div>
          </div>
        ) : isTeacher ? (
          schedules.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
              Tidak ada jadwal mengajar hari ini ({DAYS[new Date().getDay() || 7]})
            </div>
          ) : (
            <div className="grid gap-3">
              {schedules.map(s => (
                <div key={s.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between hover:shadow-sm">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                      <Clock className="w-4 h-4" /> {s.start_time} - {s.end_time}
                    </div>
                    <div className="font-semibold text-gray-900">{s.subject?.name || '-'}</div>
                    <div className="text-sm text-gray-600">Kelas {s.class?.name || '-'}</div>
                  </div>
                  <div className="flex gap-2">
                    {s.session ? (
                      <>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${s.session.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {s.session.status === 'open' ? 'Sesi Dibuka' : 'Ditutup'}
                        </span>
                        <button onClick={() => loadSession(s.session!.id)}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
                          Lanjut
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => openSession(s.id, 'manual')}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm flex items-center gap-1">
                          <Users className="w-4 h-4" /> Manual
                        </button>
                        <button onClick={() => openSession(s.id, 'qr')}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm flex items-center gap-1">
                          <QrCode className="w-4 h-4" /> QR
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          // Admin view: list all open/closed sessions across school today
          todaySessions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
              Belum ada sesi absen dibuka hari ini.
              <div className="text-xs mt-2">Admin melihat sesi yang dibuka guru. Untuk membuat sesi, login sebagai guru.</div>
            </div>
          ) : (
            <div className="grid gap-3">
              {todaySessions.map(s => (
                <div key={s.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between hover:shadow-sm cursor-pointer"
                  onClick={() => loadSession(s.id)}>
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                      <Clock className="w-4 h-4" /> {s.schedule?.start_time} - {s.schedule?.end_time}
                    </div>
                    <div className="font-semibold text-gray-900">{s.schedule?.subject?.name || '-'}</div>
                    <div className="text-sm text-gray-600">Kelas {s.schedule?.class?.name || '-'}</div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${s.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {s.status === 'open' ? 'Dibuka' : 'Ditutup'}
                  </span>
                </div>
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

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm text-gray-500">{session.schedule?.subject?.name} — Kelas {session.schedule?.class?.name}</div>
            <div className="text-xl font-bold">{new Date(session.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
          <div className="flex gap-2">
            {session.status === 'open' && (
              <button onClick={onClose} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm">
                Tutup Sesi
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {['hadir', 'terlambat', 'sakit', 'izin', 'alfa'].map(s => (
            <span key={s} className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[s]}`}>
              {s}: {stats[s] || 0}
            </span>
          ))}
        </div>
      </div>

      {session.method === 'qr' && session.qr_token && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
          <div className="text-sm text-gray-500 mb-2">Siswa scan QR di app-nya</div>
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(session.qr_token)}`}
            alt="QR Code" className="mx-auto rounded-lg" />
          <div className="text-xs text-gray-400 mt-2">Token: {session.qr_token}</div>
          {session.qr_expires && (
            <div className="text-xs text-gray-500 mt-1">
              Berlaku sampai {new Date(session.qr_expires).toLocaleTimeString('id-ID')}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Siswa</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telat (min)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Catatan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {session.presences?.map(p => {
              const m = marks[p.student_id] || { status: p.status, note: '', late_min: 0 }
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm">
                    <div className="font-medium">{p.student?.user?.name || '-'}</div>
                    <div className="text-xs text-gray-400">{p.student?.nis || '-'}</div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      {(['hadir', 'terlambat', 'sakit', 'izin', 'alfa'] as const).map(s => (
                        <button key={s} onClick={() => setMark(p.student_id, { status: s })}
                          className={`w-9 h-9 rounded-lg text-xs font-semibold ${m.status === s ? STATUS_COLOR[s] + ' ring-2 ring-offset-1 ring-indigo-400' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                          title={s}>
                          {STATUS_LABEL[s]}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <input type="number" value={m.late_min} onChange={e => setMark(p.student_id, { late_min: Number(e.target.value) })}
                      className="w-16 px-2 py-1 border rounded-lg text-sm" disabled={m.status !== 'terlambat'} />
                  </td>
                  <td className="px-4 py-2">
                    <input value={m.note} onChange={e => setMark(p.student_id, { note: e.target.value })}
                      placeholder="-" className="w-full px-2 py-1 border rounded-lg text-sm" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving || session.status === 'closed'}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Simpan Absensi
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
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-sm text-gray-600 mb-1">Kelas</label>
          <select value={classId} onChange={e => setClassId(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg">
            <option value="">Pilih kelas...</option>
            {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm text-gray-600 mb-1">Bulan</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg" />
        </div>
      </div>

      {!classId ? (
        <div className="text-center text-gray-400 py-12">Pilih kelas dulu</div>
      ) : loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Siswa</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">H</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">T</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">S</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">I</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">A</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Belum ada data</td></tr>
              ) : rows.map(r => (
                <tr key={r.student_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-gray-400">{r.nis}</div>
                  </td>
                  <td className="px-4 py-2 text-center text-green-600 font-semibold">{r.hadir ?? 0}</td>
                  <td className="px-4 py-2 text-center text-yellow-600 font-semibold">{r.terlambat ?? 0}</td>
                  <td className="px-4 py-2 text-center text-blue-600">{r.sakit ?? 0}</td>
                  <td className="px-4 py-2 text-center text-purple-600">{r.izin ?? 0}</td>
                  <td className="px-4 py-2 text-center text-red-600 font-semibold">{r.alfa ?? 0}</td>
                  <td className="px-4 py-2 text-center">{r.total ?? 0}</td>
                  <td className="px-4 py-2 text-center font-semibold">
                    {(() => {
                      const p = Number(r.persentase ?? 0)
                      return <span className={p >= 80 ? 'text-green-600' : p >= 60 ? 'text-yellow-600' : 'text-red-600'}>{p.toFixed(1)}%</span>
                    })()}
                  </td>
                </tr>
              ))}
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
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-sm text-gray-600 mb-1">Bulan</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guru</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">NIP</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Jadwal</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Hadir</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tidak Hadir</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Belum ada data</td></tr>
              ) : rows.map(r => (
                <tr key={r.teacher_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{r.teacher_name}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">{r.nip}</td>
                  <td className="px-4 py-2 text-center">{r.total_jadwal}</td>
                  <td className="px-4 py-2 text-center text-green-600 font-semibold">{r.hadir}</td>
                  <td className="px-4 py-2 text-center text-red-600 font-semibold">{r.tidak_hadir}</td>
                  <td className="px-4 py-2 text-center font-semibold">
                    <span className={r.persentase >= 80 ? 'text-green-600' : r.persentase >= 60 ? 'text-yellow-600' : 'text-red-600'}>
                      {r.persentase.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
