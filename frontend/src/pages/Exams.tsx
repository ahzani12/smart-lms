import { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Play, CheckCircle2, Plus, Search, Edit2, Trash2, Loader2, X, Square, Eye,
  FileQuestion, BookOpen, Clock, User, Filter, GraduationCap, Save, Trophy,
} from 'lucide-react'
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

const examTypeStyles: Record<string, string> = {
  ulangan_harian: 'bg-amber-soft text-amber-warm',
  uts: 'bg-sky-warm/15 text-sky-warm',
  uas: 'bg-coral/15 text-coral',
}

const examTypeLabels: Record<string, string> = {
  ulangan_harian: 'UH',
  uts: 'UTS',
  uas: 'UAS',
}

const statusStyles: Record<string, { cls: string; label: string }> = {
  active: { cls: 'bg-mint/15 text-mint', label: 'BERLANGSUNG' },
  ended: { cls: 'bg-navy/10 text-navy/60', label: 'SELESAI' },
  finished: { cls: 'bg-navy/10 text-navy/60', label: 'SELESAI' },
  draft: { cls: 'bg-amber-soft text-amber-warm', label: 'DRAFT' },
}

function StatusBadge({ status }: { status: string }) {
  const s = statusStyles[status] || statusStyles.draft
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wide ${s.cls}`}>
      {s.label}
    </span>
  )
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
  const [saving, setSaving] = useState(false)
  const [attempts, setAttempts] = useState<Record<number, any>>({})

  const [subjects, setSubjects] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [semesters, setSemesters] = useState<any[]>([])
  const [banks, setBanks] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])

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
      axios.get('/api/my-attempts').then(r => {
        const map: Record<number, any> = {}
        ;(r.data || []).forEach((a: any) => { map[a.exam_id] = a })
        setAttempts(map)
      }).catch(() => {})
    }
  }, [])

  const handleSave = async () => {
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

    setSaving(true)
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
    } finally {
      setSaving(false)
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

  // ===== Siswa view: card grid =====
  if (isSiswa) {
    return (
      <div className="p-4 lg:p-8 space-y-5 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-navy">Ujian Saya</h1>
          <p className="text-sm text-navy/60 mt-0.5">Daftar ujian yang tersedia untukmu</p>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-navy/40" strokeWidth={2.4} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari ujian..."
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white border-2 border-warm/60 focus:ring-4 focus:ring-amber-warm/15 focus:border-amber-warm outline-none transition placeholder:text-navy/40 text-sm font-semibold"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-amber-warm" strokeWidth={2.4} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-warm/40 rounded-3xl py-16 text-center shadow-card">
            <FileQuestion className="w-12 h-12 text-navy/20 mx-auto mb-3" />
            <p className="text-navy/60 text-sm font-semibold">Belum ada ujian tersedia</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(e => {
              const att = attempts[e.id]
              const done = att && att.status !== 'in_progress'
              const inProgress = att && att.status === 'in_progress'
              const canTake = e.status === 'active' && !done
              return (
                <div
                  key={e.id}
                  className="bg-white border border-warm/40 rounded-3xl p-5 shadow-card hover:shadow-card-lg hover:-translate-y-0.5 transition-all flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 bg-amber-soft rounded-2xl flex items-center justify-center flex-shrink-0">
                        <FileQuestion className="w-5 h-5 text-amber-warm" strokeWidth={2.4} />
                      </div>
                      <div className="min-w-0">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wide mb-1 ${examTypeStyles[e.exam_type] || 'bg-navy/10 text-navy/60'}`}>
                          {examTypeLabels[e.exam_type] || '—'}
                        </span>
                        <h3 className="font-bold text-navy leading-tight line-clamp-2">{e.title}</h3>
                      </div>
                    </div>
                    <StatusBadge status={e.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-warm/30 text-xs">
                    <div className="flex items-center gap-1.5 text-navy/70">
                      <BookOpen className="w-3.5 h-3.5 text-amber-warm" /> {e.subject?.name || '-'}
                    </div>
                    <div className="flex items-center gap-1.5 text-navy/70">
                      <Clock className="w-3.5 h-3.5 text-amber-warm" /> {e.duration} menit
                    </div>
                    <div className="flex items-center gap-1.5 text-navy/70 col-span-2">
                      <User className="w-3.5 h-3.5 text-amber-warm" /> {e.teacher?.user?.name || '-'}
                      <span className="ml-auto font-bold text-navy">{e.total_questions} soal</span>
                    </div>
                  </div>

                  {done && att.score != null && (
                    <div className="bg-mint/10 border border-mint/20 rounded-2xl p-3 flex items-center gap-3">
                      <Trophy className="w-7 h-7 text-mint" strokeWidth={2.4} />
                      <div>
                        <div className="text-[10px] font-extrabold text-mint uppercase tracking-wide">Nilai</div>
                        <div className="text-2xl font-extrabold text-mint leading-none">{Number(att.score).toFixed(1)}</div>
                      </div>
                    </div>
                  )}

                  <div className="mt-auto pt-1">
                    {done ? (
                      <div className="flex items-center justify-center gap-2 text-sm text-navy/60 py-2.5 bg-cream-soft rounded-2xl font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-mint" /> Sudah dikerjakan
                      </div>
                    ) : canTake ? (
                      <button
                        onClick={() => navigate(`/exams/${e.id}/take`)}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl gradient-warm text-white font-bold text-sm hover:shadow-warm transition shadow-warm-sm"
                      >
                        <Play className="w-4 h-4" strokeWidth={2.5} fill="currentColor" />
                        {inProgress ? 'Lanjut Ujian' : 'Kerjakan Sekarang'}
                      </button>
                    ) : (
                      <div className="text-center text-sm text-navy/40 py-2.5 bg-cream-soft rounded-2xl font-semibold">
                        Belum dimulai
                      </div>
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

  // ===== Guru/Admin view =====
  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-navy">Ujian</h1>
          <p className="text-sm text-navy/60 mt-0.5">{exams.length} ujian terdaftar</p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2.5 gradient-warm text-white rounded-2xl font-bold text-sm hover:shadow-warm transition shadow-warm-sm"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} /> Buat Ujian
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-navy/40" strokeWidth={2.4} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari ujian..."
          className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white border-2 border-warm/60 focus:ring-4 focus:ring-amber-warm/15 focus:border-amber-warm outline-none transition placeholder:text-navy/40 text-sm font-semibold"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-navy/60">
          <Filter className="w-3.5 h-3.5" /> Filter:
        </div>
        <select
          value={filterSemester}
          onChange={e => setFilterSemester(Number(e.target.value))}
          className="px-3 py-2 rounded-xl bg-white border border-warm/60 text-sm font-semibold text-navy focus:outline-none focus:border-amber-warm"
        >
          <option value={0}>Semua Semester</option>
          {semesters.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          value={filterExamType}
          onChange={e => setFilterExamType(e.target.value)}
          className="px-3 py-2 rounded-xl bg-white border border-warm/60 text-sm font-semibold text-navy focus:outline-none focus:border-amber-warm"
        >
          <option value="">Semua Tipe</option>
          {examTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-amber-warm" strokeWidth={2.4} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-warm/40 rounded-3xl py-16 text-center shadow-card">
          <FileQuestion className="w-12 h-12 text-navy/20 mx-auto mb-3" />
          <p className="text-navy/60 text-sm font-semibold">Tidak ada ujian</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block bg-white rounded-3xl shadow-card border border-warm/40 overflow-hidden">
            <table className="w-full">
              <thead className="bg-amber-soft/40 border-b border-warm/40">
                <tr>
                  <th className="px-6 py-4 text-left text-[11px] font-extrabold text-navy uppercase tracking-wider">Judul</th>
                  <th className="px-6 py-4 text-left text-[11px] font-extrabold text-navy uppercase tracking-wider">Tipe</th>
                  <th className="px-6 py-4 text-left text-[11px] font-extrabold text-navy uppercase tracking-wider">Mapel</th>
                  <th className="px-6 py-4 text-left text-[11px] font-extrabold text-navy uppercase tracking-wider">Kelas</th>
                  <th className="px-6 py-4 text-left text-[11px] font-extrabold text-navy uppercase tracking-wider">Guru</th>
                  <th className="px-6 py-4 text-left text-[11px] font-extrabold text-navy uppercase tracking-wider">Durasi</th>
                  <th className="px-6 py-4 text-left text-[11px] font-extrabold text-navy uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-[11px] font-extrabold text-navy uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm/30">
                {filtered.map(e => (
                  <tr key={e.id} className="hover:bg-cream-soft transition">
                    <td className="px-6 py-4 text-sm font-bold text-navy">{e.title}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${examTypeStyles[e.exam_type] || 'bg-navy/10 text-navy/60'}`}>
                        {examTypeLabels[e.exam_type] || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-navy/80">{e.subject?.name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-navy/80">{e.class?.name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-navy/80">{e.teacher?.user?.name || '-'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-navy">{e.duration} mnt</td>
                    <td className="px-6 py-4"><StatusBadge status={e.status} /></td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-1 flex-wrap justify-end">
                        {canManage && e.status === 'draft' && (
                          <button onClick={() => handleStart(e.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-mint/15 text-mint text-[11px] font-extrabold hover:bg-mint/25 transition">
                            <Play className="w-3 h-3" fill="currentColor" /> Mulai
                          </button>
                        )}
                        {canManage && e.status === 'active' && (
                          <button onClick={() => handleEnd(e.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose/15 text-rose text-[11px] font-extrabold hover:bg-rose/25 transition">
                            <Square className="w-3 h-3" fill="currentColor" /> Akhiri
                          </button>
                        )}
                        {canManage && (e.status === 'active' || e.status === 'finished' || e.status === 'ended') && (
                          <button onClick={() => navigate(`/exams/${e.id}/monitor`)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-warm/15 text-sky-warm text-[11px] font-extrabold hover:bg-sky-warm/25 transition">
                            <Eye className="w-3 h-3" /> Pantau
                          </button>
                        )}
                        <button onClick={() => openEdit(e)} className="p-2 rounded-lg hover:bg-amber-soft text-amber-warm transition">
                          <Edit2 className="w-3.5 h-3.5" strokeWidth={2.4} />
                        </button>
                        <button onClick={() => handleDelete(e.id)} className="p-2 rounded-lg hover:bg-rose/10 text-rose transition">
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={2.4} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {filtered.map(e => (
              <div key={e.id} className="bg-white border border-warm/40 rounded-2xl p-4 shadow-card">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wide mb-1 ${examTypeStyles[e.exam_type] || 'bg-navy/10 text-navy/60'}`}>
                      {examTypeLabels[e.exam_type] || '—'}
                    </span>
                    <h3 className="font-bold text-navy text-base leading-tight">{e.title}</h3>
                  </div>
                  <StatusBadge status={e.status} />
                </div>

                <div className="grid grid-cols-2 gap-2 pb-3 mb-3 border-b border-warm/30 text-xs">
                  <div className="flex items-center gap-1.5 text-navy/70">
                    <BookOpen className="w-3 h-3 text-amber-warm" /> {e.subject?.name || '-'}
                  </div>
                  <div className="flex items-center gap-1.5 text-navy/70">
                    <GraduationCap className="w-3 h-3 text-amber-warm" /> {e.class?.name || '-'}
                  </div>
                  <div className="flex items-center gap-1.5 text-navy/70">
                    <Clock className="w-3 h-3 text-amber-warm" /> {e.duration} menit
                  </div>
                  <div className="flex items-center gap-1.5 text-navy/70">
                    <FileQuestion className="w-3 h-3 text-amber-warm" /> {e.total_questions} soal
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {canManage && e.status === 'draft' && (
                    <button onClick={() => handleStart(e.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-mint/15 text-mint text-[11px] font-extrabold">
                      <Play className="w-3 h-3" fill="currentColor" /> Mulai
                    </button>
                  )}
                  {canManage && e.status === 'active' && (
                    <button onClick={() => handleEnd(e.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose/15 text-rose text-[11px] font-extrabold">
                      <Square className="w-3 h-3" fill="currentColor" /> Akhiri
                    </button>
                  )}
                  {canManage && (e.status === 'active' || e.status === 'finished' || e.status === 'ended') && (
                    <button onClick={() => navigate(`/exams/${e.id}/monitor`)} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-warm/15 text-sky-warm text-[11px] font-extrabold">
                      <Eye className="w-3 h-3" /> Pantau
                    </button>
                  )}
                  <button onClick={() => openEdit(e)} className="ml-auto p-2 rounded-xl bg-amber-soft text-amber-warm">
                    <Edit2 className="w-3.5 h-3.5" strokeWidth={2.4} />
                  </button>
                  <button onClick={() => handleDelete(e.id)} className="p-2 rounded-xl bg-rose/10 text-rose">
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={2.4} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm flex items-end lg:items-center justify-center z-50 p-0 lg:p-4">
          <div className="bg-cream w-full max-w-lg rounded-t-3xl lg:rounded-3xl shadow-card-lg max-h-[92vh] overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-warm/40 flex items-center justify-between bg-white">
              <div>
                <h2 className="text-lg font-extrabold text-navy">{editItem ? 'Edit' : 'Buat'} Ujian</h2>
                <p className="text-xs text-navy/60 mt-0.5">Lengkapi detail di bawah</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-amber-soft text-navy/60 hover:text-navy transition">
                <X className="w-5 h-5" strokeWidth={2.4} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto">
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
                  <label className="block text-xs font-extrabold text-navy uppercase tracking-wide mb-1.5">{f.label}</label>
                  {f.type === 'select' ? (
                    <select value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-warm/60 focus:ring-4 focus:ring-amber-warm/15 focus:border-amber-warm outline-none transition text-sm font-semibold text-navy">
                      <option value="">Pilih...</option>
                      {f.options?.map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} rows={3}
                      className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-warm/60 focus:ring-4 focus:ring-amber-warm/15 focus:border-amber-warm outline-none transition text-sm font-semibold text-navy resize-none" />
                  ) : (
                    <input type={f.type} value={form[f.key] ?? ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-warm/60 focus:ring-4 focus:ring-amber-warm/15 focus:border-amber-warm outline-none transition text-sm font-semibold text-navy" />
                  )}
                </div>
              ))}
            </div>

            <div className="px-6 py-4 bg-white border-t border-warm/40 flex gap-3 safe-bottom">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-2xl border-2 border-warm/60 text-navy font-bold text-sm hover:bg-amber-soft/40 transition">
                Batal
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-2xl gradient-warm text-white font-bold text-sm hover:shadow-warm transition shadow-warm-sm disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</> : <><Save className="w-4 h-4" strokeWidth={2.5} /> Simpan</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
