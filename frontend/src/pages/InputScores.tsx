import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { ClipboardEdit, Save, Filter } from 'lucide-react'

interface Component {
  id: number
  name: string
  weight: number
  source_type: string
  exam_type: string
}

interface StudentRow {
  student_id: number
  student_name: string
  nis: string
  scores: Record<number, number>
  final_score: number
}

export default function InputScores() {
  const [classes, setClasses] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [semesters, setSemesters] = useState<any[]>([])
  const [components, setComponents] = useState<Component[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [classId, setClassId] = useState(0)
  const [subjectId, setSubjectId] = useState(0)
  const [semesterId, setSemesterId] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    axios.get('/api/classes').then(r => setClasses(r.data?.classes || r.data || []))
    axios.get('/api/subjects').then(r => setSubjects(r.data?.subjects || r.data || []))
    axios.get('/api/semesters').then(r => setSemesters(r.data || []))
  }, [])

  const loadScores = () => {
    if (!classId || !subjectId || !semesterId) return
    setLoading(true)
    axios.get(`/api/student-scores?class_id=${classId}&subject_id=${subjectId}&semester_id=${semesterId}`)
      .then(r => {
        setComponents(r.data.components || [])
        setStudents(r.data.students || [])
        setLoading(false)
      })
      .catch(() => { setLoading(false); toast.error('Gagal memuat data') })
  }

  useEffect(() => { loadScores() }, [classId, subjectId, semesterId])

  const updateScore = (studentIdx: number, componentId: number, value: number) => {
    const updated = [...students]
    if (!updated[studentIdx].scores) updated[studentIdx].scores = {}
    updated[studentIdx].scores[componentId] = value

    // Recalculate final score
    let weightedSum = 0
    let totalWeight = 0
    for (const comp of components) {
      const score = updated[studentIdx].scores[comp.id]
      if (score !== undefined && score > 0) {
        weightedSum += score * comp.weight / 100
        totalWeight += comp.weight
      }
    }
    updated[studentIdx].final_score = totalWeight > 0 ? Math.round(weightedSum / totalWeight * 100 * 100) / 100 : 0

    setStudents(updated)
  }

  const handleSave = async () => {
    const scores: any[] = []
    for (const student of students) {
      for (const comp of components) {
        if (comp.source_type === 'manual' && student.scores[comp.id] !== undefined) {
          scores.push({
            student_id: student.student_id,
            component_id: comp.id,
            score: student.scores[comp.id]
          })
        }
      }
    }

    if (scores.length === 0) {
      toast.error('Tidak ada nilai untuk disimpan')
      return
    }

    setSaving(true)
    try {
      await axios.post('/api/student-scores', {
        subject_id: subjectId,
        semester_id: semesterId,
        scores
      })
      toast.success(`${scores.length} nilai berhasil disimpan`)
      loadScores()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan')
    }
    setSaving(false)
  }

  const manualComponents = components.filter(c => c.source_type === 'manual')
  const examComponents = components.filter(c => c.source_type === 'exam')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <ClipboardEdit className="w-6 h-6 text-amber-warm" />
            Input Nilai
          </h1>
          <p className="text-navy/60">Input nilai per komponen untuk setiap siswa</p>
        </div>
        {students.length > 0 && (
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan Nilai'}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border p-4">
        <div className="flex items-center gap-2 mb-3 text-navy/70">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filter</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select value={classId} onChange={e => setClassId(Number(e.target.value))}
            className="px-4 py-2 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none">
            <option value={0}>Pilih Kelas...</option>
            {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={subjectId} onChange={e => setSubjectId(Number(e.target.value))}
            className="px-4 py-2 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none">
            <option value={0}>Pilih Mapel...</option>
            {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={semesterId} onChange={e => setSemesterId(Number(e.target.value))}
            className="px-4 py-2 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none">
            <option value={0}>Pilih Semester...</option>
            {semesters.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* Score Table */}
      {loading ? (
        <div className="text-center py-12 text-navy/40">Memuat...</div>
      ) : !classId || !subjectId || !semesterId ? (
        <div className="text-center py-12 text-navy/40">Pilih kelas, mapel, dan semester untuk mulai input nilai</div>
      ) : components.length === 0 ? (
        <div className="bg-amber-50 rounded-2xl p-6 text-center text-amber-700">
          Belum ada komponen raport. Admin harus mengatur komponen di menu "Komponen Raport" terlebih dahulu.
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-12 text-navy/40">Tidak ada siswa di kelas ini</div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream-soft border-b">
                <th className="px-3 py-3 text-left font-medium text-navy/60 sticky left-0 bg-cream-soft">No</th>
                <th className="px-3 py-3 text-left font-medium text-navy/60 sticky left-8 bg-cream-soft min-w-[150px]">Siswa</th>
                {manualComponents.map(c => (
                  <th key={c.id} className="px-3 py-3 text-center font-medium text-navy/60 min-w-[100px]">
                    <div>{c.name}</div>
                    <div className="text-xs text-navy/40 font-normal">{c.weight}%</div>
                  </th>
                ))}
                {examComponents.map(c => (
                  <th key={c.id} className="px-3 py-3 text-center font-medium text-sky-warm min-w-[100px]">
                    <div>{c.name}</div>
                    <div className="text-xs text-blue-400 font-normal">{c.weight}% (auto)</div>
                  </th>
                ))}
                <th className="px-3 py-3 text-center font-medium text-navy min-w-[80px]">Final</th>
              </tr>
            </thead>
            <tbody>
              {students.map((st, i) => (
                <tr key={st.student_id} className="border-b last:border-0 hover:bg-cream-soft">
                  <td className="px-3 py-2 text-navy/40 sticky left-0 bg-white">{i + 1}</td>
                  <td className="px-3 py-2 sticky left-8 bg-white">
                    <div className="font-medium text-navy">{st.student_name}</div>
                    <div className="text-xs text-navy/40">{st.nis}</div>
                  </td>
                  {manualComponents.map(c => (
                    <td key={c.id} className="px-2 py-2 text-center">
                      <input
                        type="number" min={0} max={100}
                        value={st.scores[c.id] || ''}
                        onChange={e => updateScore(i, c.id, Number(e.target.value))}
                        className="w-16 px-2 py-1 text-center rounded-lg border focus:ring-2 focus:ring-amber-warm/40 outline-none"
                      />
                    </td>
                  ))}
                  {examComponents.map(c => (
                    <td key={c.id} className="px-2 py-2 text-center">
                      <span className="text-sky-warm font-medium">
                        {st.scores[c.id] ? Math.round(st.scores[c.id]) : '-'}
                      </span>
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex px-2 py-1 rounded-full text-sm font-bold ${
                      st.final_score >= 80 ? 'bg-mint/15 text-mint' :
                      st.final_score >= 60 ? 'bg-amber-warm/15 text-amber-warm' :
                      st.final_score > 0 ? 'bg-rose/15 text-rose' : 'text-navy/40'
                    }`}>
                      {st.final_score > 0 ? st.final_score : '-'}
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
