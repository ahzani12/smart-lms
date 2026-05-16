import { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Play, CheckCircle2, Plus, Search, Edit2, Trash2, Loader2, X, Square, Eye } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface Exam {
  id: number
  title: string
  description: string
  subject?: { name: string }
  class?: { name: string, id: number }
  teacher?: { user?: { name: string } }
  subject_id: number
  class_id: number
  teacher_id: number
  semester_id: number
  exam_type: string
  question_bank_id?: number
  duration: number
  total_questions: number
  status: string
}

export default function Exams() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isSiswa = user?.role === 'siswa'
  const canManage = user?.role === 'guru' || user?.role === 'admin_pusat' || user?.role === 'admin_cabang'

  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Exam | null>(null)
  const [form, setForm] = useState<any>({})
  const [attempts, setAttempts] = useState<Record<number, any>>({})

  // Dropdown sources
  const [subjects, setSubjects] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [semesters, setSemesters] = useState<any[]>([])
  const [banks, setBanks] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])

  // Filters
  const [filterSemester, setFilterSemester] = useState(0)
  const [filterExamType, setFilterExamType] = useState('')

  const examTypes = [
    { value: 'ulangan_harian', label: 'Ulangan Harian' },
    { value: 'uts', label: 'UTS' },
    { value: 'uas', label: 'UAS' },
  ]
  const fetchExams = () => {
    setLoading(true)
    axios.get('/api/exams/').then(res => {
      setExams(Array.isArray(res.data) ? res.data : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchExams()
    if (canManage) {
      axios.get('/api/subjects/').then(r => setSubjects(r.data || []))
      axios.get('/api/classes/').then(r => setClasses(r.data || []))
      axios.get('/api/semesters/').then(r => setSemesters(r.data || []))
      axios.get('/api/question-banks/').then(r => setBanks(r.data || []))
      axios.get('/api/teachers/').then(r => setTeachers(r.data || []))
    }
    if (isSiswa) {
      // Fetch my attempts to know which exams are done
      axios.get('/api/my-attempts').then(r => {
        const map: Record<number, any> = {}
        ;(r.data || []).forEach((a: any) => { map[a.exam_id] = a })
        setAttempts(map)
      }).catch(() => {})
    }
  }, [])

  const handleSave = async () => {
    // Client-side validation — prevents "instant submit" bug caused by
    // saving an exam with duration=0 or total_questions=0.
    const required: [string, string][] = [
      ['title', 'Judul'],
      ['subject_id', 'Mapel'],
      ['class_id', 'Kelas'],
      ['teacher_id', 'Guru pengampu'],
      ['semester_id', 'Semester'],
      ['question_bank_id', 'Bank soal'],
    ]
    for (const [k, label] of required) {
      if (!form[k]) { toast.error(`${label} wajib diisi`); return }
    }
    const dur = Number(form.duration) || 0
    const qty = Number(form.total_questions) || 0
    if (dur <= 0) { toast.error('Durasi harus lebih dari 0 menit'); return }
    if (qty <= 0) { toast.error('Jumlah soal harus lebih dari 0'); return }

    try {
      const payload = {
        ...form,
        subject_id: Number(form.subject_id) || 0,
        class_id: Number(form.class_id) || 0,
        teacher_id: Number(form.teacher_id) || 0,
        semester_id: Number(form.semester_id) || 0,
        exam_type: form.exam_type || '',
        question_bank_id: form.question_bank_id ? Number(form.question_bank_id) : null,
        duration: dur,
        total_questions: qty,
      }
      if (editItem) {
        await axios.put(`/api/exams/${editItem.id}`, payload)
        toast.success('Ujian diupdate')
      } else {
        await axios.post(`/api/exams`, payload)
        toast.success('Ujian dibuat')
      }
      setShowModal(false)
      setEditItem(null)
      setForm({})
      fetchExams()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin hapus ujian ini?')) return
    try {
      await axios.delete(`/api/exams/${id}`)
      toast.success('Ujian dihapus')
      fetchExams()
    } catch { toast.error('Gagal menghapus') }
  }

  const handleStart = async (id: number) => {
    try {
      await axios.post(`/api/exams/${id}/start`)
      toast.success('Ujian dimulai')
      fetchExams()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal memulai')
    }
  }

  const handleEnd = async (id: number) => {
    if (!confirm('Akhiri ujian? Siswa tidak bisa submit lagi.')) return
    try { await axios.post(`/api/exams/${id}/end`); toast.success('Ujian diakhiri'); fetchExams() }
    catch { toast.error('Gagal mengakhiri') }
  }

  const openEdit = (e: Exam) => {
    setEditItem(e)
    setForm({ ...e })
    setShowModal(true)
  }

  const openCreate = () => {
    setEditItem(null)
    setForm({})
    setShowModal(true)
  }

  const filtered = exams.filter(e => {
    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.subject?.name?.toLowerCase().includes(search.toLowerCase())
    const matchSemester = filterSemester === 0 || e.semester_id === filterSemester
    const matchType = !filterExamType || e.exam_type === filterExamType
    return matchSearch && matchSemester && matchType
  })

  const statusBadge = (s: string) => {
    const cls = s === 'active' ? 'bg-green-100 text-green-700' :
                s === 'ended' || s === 'finished' ? 'bg-gray-100 text-gray-600' :
                'bg-yellow-100 text-yellow-700'
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${cls}`}>{s || 'draft'}</span>
  }

  // Siswa view - card grid
  if (isSiswa) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Ujian Saya</h1>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari ujian..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">Belum ada ujian yang tersedia</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(e => {
              const att = attempts[e.id]
              const done = att && att.status !== 'in_progress'
              const inProgress = att && att.status === 'in_progress'
              const canTake = e.status === 'active' && !done
              return (
                <div key={e.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3 hover:shadow-md transition">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-gray-900 leading-tight">{e.title}</h3>
                    {statusBadge(e.status)}
                  </div>
                  <div className="text-sm text-gray-500 space-y-1">
                    <div>📚 {e.subject?.name || '-'}</div>
                    <div>⏱️ {e.duration} menit · {e.total_questions} soal</div>
                    {e.teacher?.user?.name && <div>👨‍🏫 {e.teacher.user.name}</div>}
                  </div>
                  {done && att.score != null && (
                    <div className="bg-green-50 rounded-xl p-3 text-center">
                      <div className="text-xs text-green-600">Nilai</div>
                      <div className="text-2xl font-bold text-green-700">{Number(att.score).toFixed(1)}</div>
                    </div>
                  )}
                  <div className="mt-auto pt-2">
                    {done ? (
                      <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" /> Sudah dikerjakan
                      </div>
                    ) : canTake ? (
                      <button
                        onClick={() => navigate(`/exams/${e.id}/take`)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700"
                      >
                        <Play className="w-4 h-4" /> {inProgress ? 'Lanjut Ujian' : 'Kerjakan'}
                      </button>
                    ) : (
                      <div className="text-center text-sm text-gray-400 py-2">Belum dimulai</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Guru/Admin view - table + CRUD
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Ujian</h1>
        {canManage && (
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition">
            <Plus className="w-4 h-4" /> Tambah
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={filterSemester} onChange={e => setFilterSemester(Number(e.target.value))}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm">
          <option value={0}>Semua Semester</option>
          {semesters.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterExamType} onChange={e => setFilterExamType(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm">
          <option value="">Semua Tipe</option>
          {examTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Judul</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipe</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mapel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kelas</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guru</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durasi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{e.title}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      e.exam_type === 'uts' ? 'bg-blue-100 text-blue-700' :
                      e.exam_type === 'uas' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {e.exam_type === 'uts' ? 'UTS' : e.exam_type === 'uas' ? 'UAS' : e.exam_type === 'ulangan_harian' ? 'UH' : '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{e.subject?.name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{e.class?.name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{e.teacher?.user?.name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{e.duration} mnt</td>
                  <td className="px-6 py-4">{statusBadge(e.status)}</td>
                  <td className="px-6 py-4 text-right space-x-1">
                    {canManage && e.status === 'draft' && (
                      <button onClick={() => handleStart(e.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100" title="Mulai">
                        <Play className="w-3.5 h-3.5" /> Mulai
                      </button>
                    )}
                    {canManage && e.status === 'active' && (
                      <button onClick={() => handleEnd(e.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100" title="Akhiri">
                        <Square className="w-3.5 h-3.5" /> Akhiri
                      </button>
                    )}
                    {canManage && (e.status === 'active' || e.status === 'finished' || e.status === 'ended') && (
                      <button onClick={() => navigate(`/exams/${e.id}/monitor`)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100" title="Pantau & Nilai">
                        <Eye className="w-3.5 h-3.5" /> Pantau
                      </button>
                    )}
                    <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(e.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-400">Tidak ada data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{editItem ? 'Edit' : 'Tambah'} Ujian</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            {[
              { key: 'title', label: 'Judul Ujian', type: 'text' },
              { key: 'description', label: 'Deskripsi', type: 'textarea' },
              { key: 'subject_id', label: 'Mapel', type: 'select', options: subjects.map(s => ({ label: s.name, value: s.id })) },
              { key: 'class_id', label: 'Kelas', type: 'select', options: classes.map(c => ({ label: c.name, value: c.id })) },
              { key: 'teacher_id', label: 'Guru Pengampu', type: 'select', options: teachers.map(t => ({ label: t.user?.name || `Guru #${t.id}`, value: t.id })) },
              { key: 'semester_id', label: 'Semester', type: 'select', options: semesters.map(s => ({ label: s.name, value: s.id })) },
              { key: 'exam_type', label: 'Tipe Ujian', type: 'select', options: examTypes.map(t => ({ label: t.label, value: t.value })) },
              { key: 'question_bank_id', label: 'Bank Soal', type: 'select', options: banks.map(b => ({ label: b.title, value: b.id })) },
              { key: 'duration', label: 'Durasi (menit)', type: 'number' },
              { key: 'total_questions', label: 'Jumlah Soal', type: 'number' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                {f.type === 'select' ? (
                  <select value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="">Pilih...</option>
                    {f.options?.map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
                ) : (
                  <input type={f.type} value={form[f.key] ?? ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
                )}
              </div>
            ))}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">Batal</button>
              <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
