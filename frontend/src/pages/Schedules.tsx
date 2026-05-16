import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Calendar, Clock, MapPin, Loader2, X } from 'lucide-react'

interface Schedule {
  id: number
  class_id: number
  class?: { id: number; name: string; grade?: string; major?: string }
  subject_id: number
  subject?: { id: number; name: string }
  teacher_id: number
  teacher?: { id: number; user?: { name: string } }
  semester_id: number
  day_of_week: number
  start_time: string
  end_time: string
  room: string
  kind: string
}

interface OptLite { id: number; name?: string; user?: { name: string } }

const DAYS = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const DAY_COLORS: Record<number, string> = {
  1: 'bg-blue-50 border-blue-200',
  2: 'bg-green-50 border-green-200',
  3: 'bg-yellow-50 border-yellow-200',
  4: 'bg-purple-50 border-purple-200',
  5: 'bg-pink-50 border-pink-200',
  6: 'bg-indigo-50 border-indigo-200',
  7: 'bg-gray-50 border-gray-200',
}

export default function Schedules() {
  const [items, setItems] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<OptLite[]>([])
  const [subjects, setSubjects] = useState<OptLite[]>([])
  const [teachers, setTeachers] = useState<OptLite[]>([])
  const [semesters, setSemesters] = useState<OptLite[]>([])
  const [filterClass, setFilterClass] = useState<string>('')
  const [filterTeacher, setFilterTeacher] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Schedule | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (filterClass) params.class_id = filterClass
      if (filterTeacher) params.teacher_id = filterTeacher
      const res = await axios.get('/api/schedules/', { params })
      setItems(res.data || [])
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal memuat jadwal')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    axios.get('/api/classes/').then(r => setClasses(r.data || []))
    axios.get('/api/subjects/').then(r => setSubjects(r.data || []))
    axios.get('/api/teachers/').then(r => setTeachers(r.data || []))
    axios.get('/api/semesters/').then(r => setSemesters(r.data || []))
  }, [])

  useEffect(() => { load() }, [filterClass, filterTeacher])

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus jadwal ini?')) return
    try {
      await axios.delete(`/api/schedules/${id}`)
      toast.success('Jadwal dihapus')
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menghapus')
    }
  }

  // Group by day for display
  const grouped: Record<number, Schedule[]> = {}
  for (const s of items) {
    if (!grouped[s.day_of_week]) grouped[s.day_of_week] = []
    grouped[s.day_of_week].push(s)
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jadwal Mengajar</h1>
          <div className="text-sm text-gray-500">Jadwal pelajaran per kelas & guru</div>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Tambah Jadwal
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm">
          <option value="">Semua Kelas</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm">
          <option value="">Semua Guru</option>
          {teachers.map(t => <option key={t.id} value={t.id}>{t.user?.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          Belum ada jadwal. Klik "Tambah Jadwal" untuk mulai.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(d => (
            <div key={d} className={`rounded-2xl border-2 ${DAY_COLORS[d]} p-4`}>
              <h3 className="font-bold text-gray-900 mb-3">{DAYS[d]}</h3>
              {(!grouped[d] || grouped[d].length === 0) ? (
                <div className="text-xs text-gray-400">Kosong</div>
              ) : (
                <div className="space-y-2">
                  {grouped[d].map(s => (
                    <div key={s.id} className="bg-white rounded-xl p-3 border border-gray-100 text-sm">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">{s.subject?.name}</div>
                          <div className="text-xs text-gray-600 mt-0.5">{s.class?.name} · {s.teacher?.user?.name}</div>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.start_time}–{s.end_time}</span>
                            {s.room && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.room}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button onClick={() => { setEditing(s); setShowForm(true) }}
                                  className="p-1 hover:bg-indigo-50 rounded text-indigo-600" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(s.id)}
                                  className="p-1 hover:bg-red-50 rounded text-red-600" title="Hapus">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ScheduleForm
          initial={editing}
          classes={classes} subjects={subjects} teachers={teachers} semesters={semesters}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}
    </div>
  )
}

function ScheduleForm({ initial, classes, subjects, teachers, semesters, onClose, onSaved }: {
  initial: Schedule | null
  classes: OptLite[]; subjects: OptLite[]; teachers: OptLite[]; semesters: OptLite[]
  onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    class_id: initial?.class_id || '',
    subject_id: initial?.subject_id || '',
    teacher_id: initial?.teacher_id || '',
    semester_id: initial?.semester_id || (semesters[0]?.id || ''),
    day_of_week: initial?.day_of_week || 1,
    start_time: initial?.start_time || '07:00',
    end_time: initial?.end_time || '08:30',
    room: initial?.room || '',
    kind: initial?.kind || 'mapel',
  })
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!form.class_id || !form.subject_id || !form.teacher_id || !form.semester_id) {
      toast.error('Lengkapi kelas, mapel, guru, dan semester')
      return
    }
    if (form.start_time >= form.end_time) {
      toast.error('Jam selesai harus setelah jam mulai')
      return
    }
    setSaving(true)
    const payload = {
      class_id: Number(form.class_id),
      subject_id: Number(form.subject_id),
      teacher_id: Number(form.teacher_id),
      semester_id: Number(form.semester_id),
      day_of_week: Number(form.day_of_week),
      start_time: form.start_time,
      end_time: form.end_time,
      room: form.room,
      kind: form.kind,
    }
    try {
      if (initial) await axios.put(`/api/schedules/${initial.id}`, payload)
      else await axios.post('/api/schedules/', payload)
      toast.success(initial ? 'Jadwal diupdate' : 'Jadwal dibuat')
      onSaved()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{initial ? 'Edit Jadwal' : 'Tambah Jadwal'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-600">Semester</label>
            <select value={form.semester_id} onChange={e => setForm({ ...form, semester_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm">
              <option value="">Pilih semester...</option>
              {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600">Kelas</label>
            <select value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm">
              <option value="">Pilih...</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600">Mata Pelajaran</label>
            <select value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm">
              <option value="">Pilih...</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-600">Guru</label>
            <select value={form.teacher_id} onChange={e => setForm({ ...form, teacher_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm">
              <option value="">Pilih...</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.user?.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600">Hari</label>
            <select value={form.day_of_week} onChange={e => setForm({ ...form, day_of_week: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm">
              {[1,2,3,4,5,6].map(d => <option key={d} value={d}>{DAYS[d]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600">Ruangan</label>
            <input type="text" value={form.room} onChange={e => setForm({ ...form, room: e.target.value })}
                   placeholder="R. 101" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-600">Jam Mulai</label>
            <input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })}
                   className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-600">Jam Selesai</label>
            <input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })}
                   className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50">Batal</button>
          <button onClick={submit} disabled={saving}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Menyimpan...' : (initial ? 'Update' : 'Simpan')}
          </button>
        </div>
      </div>
    </div>
  )
}
