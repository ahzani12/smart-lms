import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Loader2, CheckCircle2, Clock, AlertTriangle,
  RotateCcw, Edit3, X, Award, Users, FileText,
} from 'lucide-react'

interface MonitoringRow {
  student_name: string
  student_nis: string
  status: string
  start_time: string
  end_time: string | null
  score: number | null
  tab_switches: number
  flagged: boolean
  progress: number
}

interface MonitoringData {
  exam: {
    id: number
    title: string
    duration: number
    total_questions: number
    status: string
  }
  total_students: number
  total_questions: number
  monitoring: MonitoringRow[]
}

interface AnswerView {
  id: number
  question_id: number
  question_type: string
  question_content: string
  options: string
  correct_answer: string
  explanation: string
  answer: string
  is_correct: boolean | null
  score: number | null
  max_points: number
}

interface AttemptDetail {
  attempt: {
    id: number
    exam_id: number
    student_id: number
    status: string
    score: number | null
    start_time: string
    end_time: string | null
    tab_switches: number
    flagged: boolean
    student?: { user?: { name: string }, nis: string }
  }
  answers: AnswerView[]
}

const statusLabel = (s: string) => {
  const map: Record<string, { label: string, cls: string }> = {
    in_progress: { label: 'Sedang Ujian', cls: 'bg-yellow-100 text-yellow-800' },
    submitted:   { label: 'Menunggu Nilai', cls: 'bg-blue-100 text-blue-800' },
    graded:      { label: 'Sudah Dinilai', cls: 'bg-green-100 text-green-800' },
  }
  const x = map[s] || { label: s, cls: 'bg-gray-100 text-gray-700' }
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${x.cls}`}>{x.label}</span>
}

export default function ExamMonitor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<MonitoringData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshAt, setRefreshAt] = useState(Date.now())
  const [detailAttemptId, setDetailAttemptId] = useState<number | null>(null)
  const [attemptIds, setAttemptIds] = useState<Record<string, number>>({})

  // We need attempt IDs to open the detail. Monitor endpoint returns rows
  // without IDs, so fetch them via monitoring + matching. Trick: fetch all
  // attempts for this exam separately.
  const load = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`/api/exams/${id}/monitoring`)
      setData(res.data)
      // Pull raw attempts to get IDs (need a dedicated endpoint; for now,
      // infer by re-calling monitoring would not help). Best: let each row
      // carry attempt_id from the backend — but older GetExamMonitoring
      // doesn't expose it. We read the attempt list via /exam-attempts/:id
      // one by one when the user clicks. So here we query a sibling path.
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal memuat data pantauan')
    } finally {
      setLoading(false)
    }
  }

  const loadAttemptIds = async () => {
    // Backend does not expose a "list attempts by exam with ids" endpoint.
    // Workaround: call monitoring — it preloads Student.User; we supplement by
    // scanning attempts table through a tiny probe — fallback: add endpoint.
    try {
      const res = await axios.get(`/api/exams/${id}/attempts-list`)
      const map: Record<string, number> = {}
      for (const a of res.data || []) {
        map[a.student_nis] = a.id
      }
      setAttemptIds(map)
    } catch {
      // endpoint may not exist yet; detail button will just be disabled
    }
  }

  useEffect(() => { load(); loadAttemptIds() }, [id, refreshAt])

  // Auto-refresh every 15s while any attempt is in progress
  useEffect(() => {
    if (!data) return
    const list = data.monitoring || []
    const anyInProgress = list.some(m => m.status === 'in_progress')
    if (!anyInProgress) return
    const t = setInterval(() => setRefreshAt(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [data])

  const resetAttempt = async (studentNis: string, studentName: string) => {
    const aid = attemptIds[studentNis]
    if (!aid) { toast.error('Tidak dapat menemukan attempt ID'); return }
    if (!confirm(`Reset ujian untuk ${studentName}? Semua jawaban akan dihapus dan siswa bisa mengerjakan ulang.`)) return
    try {
      await axios.delete(`/api/exam-attempts/${aid}`)
      toast.success('Attempt di-reset')
      setRefreshAt(Date.now())
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal reset')
    }
  }

  const openGrading = (studentNis: string) => {
    const aid = attemptIds[studentNis]
    if (!aid) { toast.error('Attempt ID tidak ditemukan'); return }
    setDetailAttemptId(aid)
  }

  if (loading || !data) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
  }

  const rows = data.monitoring || []
  const inProgressCount = rows.filter(r => r.status === 'in_progress').length
  const submittedCount  = rows.filter(r => r.status === 'submitted').length
  const gradedCount     = rows.filter(r => r.status === 'graded').length
  const flaggedCount    = rows.filter(r => r.flagged).length

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/exams')} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Pantau & Nilai: {data.exam.title}</h1>
          <div className="text-sm text-gray-500">{data.exam.duration} menit · {data.total_questions} soal</div>
        </div>
        <button onClick={() => setRefreshAt(Date.now())} className="px-3 py-2 text-sm rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center gap-2">
          <RotateCcw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm"><Users className="w-4 h-4" /> Peserta</div>
          <div className="text-2xl font-bold mt-1">{data.total_students}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-yellow-700 text-sm"><Clock className="w-4 h-4" /> Sedang</div>
          <div className="text-2xl font-bold mt-1">{inProgressCount}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-blue-700 text-sm"><FileText className="w-4 h-4" /> Menunggu Nilai</div>
          <div className="text-2xl font-bold mt-1">{submittedCount}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-green-700 text-sm"><CheckCircle2 className="w-4 h-4" /> Selesai Dinilai</div>
          <div className="text-2xl font-bold mt-1">{gradedCount}</div>
        </div>
      </div>

      {flaggedCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {flaggedCount} siswa di-flag karena pindah tab berulang
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Siswa</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">NIS</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progres</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nilai</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pindah Tab</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Belum ada siswa yang mengerjakan</td></tr>
            )}
            {rows.map((r, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.student_name}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{r.student_nis}</td>
                <td className="px-4 py-3">{statusLabel(r.status)}</td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${r.progress}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-10 text-right">{r.progress.toFixed(0)}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                  {r.score != null ? <span className="flex items-center gap-1 text-green-700"><Award className="w-4 h-4" /> {Number(r.score).toFixed(1)}</span> : '-'}
                </td>
                <td className="px-4 py-3 text-sm">
                  {r.tab_switches > 0 ? (
                    <span className={r.flagged ? 'text-red-700 font-semibold' : 'text-gray-700'}>{r.tab_switches}×</span>
                  ) : <span className="text-gray-400">0</span>}
                  {r.flagged && <AlertTriangle className="w-4 h-4 text-red-600 inline ml-1" />}
                </td>
                <td className="px-4 py-3 text-right space-x-1">
                  <button
                    onClick={() => openGrading(r.student_nis)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium hover:bg-indigo-100"
                    title="Lihat jawaban / nilai manual"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Nilai
                  </button>
                  <button
                    onClick={() => resetAttempt(r.student_nis, r.student_name)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100"
                    title="Reset — siswa bisa mengerjakan ulang"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailAttemptId !== null && (
        <AttemptGradingModal
          attemptId={detailAttemptId}
          onClose={() => { setDetailAttemptId(null); setRefreshAt(Date.now()) }}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Attempt Grading Modal — shows each answer, highlights correct/wrong,
// lets teacher grade essay manually, recomputes attempt score.
// ════════════════════════════════════════════════════════════════

function AttemptGradingModal({ attemptId, onClose }: { attemptId: number, onClose: () => void }) {
  const [data, setData] = useState<AttemptDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [grading, setGrading] = useState<Record<number, { score: string, comment: string }>>({})

  const load = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`/api/exam-attempts/${attemptId}`)
      setData(res.data)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal memuat detail')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [attemptId])

  const gradeEssay = async (answerId: number) => {
    const g = grading[answerId]
    if (!g || g.score === '') { toast.error('Isi nilai dulu'); return }
    const score = Number(g.score)
    if (isNaN(score) || score < 0) { toast.error('Nilai harus angka ≥ 0'); return }
    try {
      await axios.put(`/api/exam-answers/${answerId}/grade`, { score, comment: g.comment || '' })
      toast.success('Nilai disimpan')
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan')
    }
  }

  if (loading || !data) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
      </div>
    )
  }

  const stu = data.attempt.student?.user?.name || 'Siswa'
  const needsGrade = data.answers.filter(a => a.question_type === 'essay' && a.score == null).length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold">Penilaian: {stu}</h2>
            <div className="text-sm text-gray-500">
              Status: {data.attempt.status} · Nilai: {data.attempt.score != null ? Number(data.attempt.score).toFixed(1) : '-'}
              {needsGrade > 0 && <span className="ml-3 text-orange-600 font-medium">{needsGrade} essay belum dinilai</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {data.answers.length === 0 && (
            <div className="text-center text-gray-400 py-8">Tidak ada jawaban tersimpan</div>
          )}
          {data.answers.map((a, idx) => {
            const isEssay = a.question_type === 'essay'
            const ring = a.is_correct == null ? 'border-gray-200' : a.is_correct ? 'border-green-300 bg-green-50/30' : 'border-red-300 bg-red-50/30'
            return (
              <div key={a.id} className={`border rounded-xl p-4 ${ring}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-1">
                      Soal {idx + 1} · {a.question_type} · max {a.max_points} poin
                    </div>
                    <div className="text-sm font-medium text-gray-900 mb-2 whitespace-pre-wrap">{a.question_content}</div>
                    <div className="text-sm">
                      <span className="text-gray-500">Jawaban siswa:</span>{' '}
                      <span className="font-semibold text-gray-900">{a.answer || <em className="text-gray-400">kosong</em>}</span>
                    </div>
                    {!isEssay && (
                      <div className="text-sm mt-1">
                        <span className="text-gray-500">Jawaban benar:</span>{' '}
                        <span className="font-semibold text-green-700">{a.correct_answer}</span>
                      </div>
                    )}
                    {a.explanation && (
                      <div className="text-xs text-gray-500 mt-2 italic">Pembahasan: {a.explanation}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Nilai</div>
                    <div className="text-xl font-bold text-gray-900">
                      {a.score != null ? `${Number(a.score).toFixed(1)} / ${a.max_points}` : '-'}
                    </div>
                  </div>
                </div>

                {isEssay && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <label className="text-gray-600">Nilai:</label>
                      <input
                        type="number"
                        min={0}
                        max={a.max_points}
                        step="0.5"
                        value={grading[a.id]?.score ?? (a.score != null ? String(a.score) : '')}
                        onChange={e => setGrading(g => ({ ...g, [a.id]: { ...(g[a.id] || { score: '', comment: '' }), score: e.target.value } }))}
                        className="w-24 px-2 py-1 border border-gray-200 rounded-lg"
                      />
                      <span className="text-gray-400 text-xs">/ {a.max_points}</span>
                      <button
                        onClick={() => gradeEssay(a.id)}
                        className="ml-auto px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                      >
                        Simpan
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Komentar (opsional)"
                      value={grading[a.id]?.comment ?? ''}
                      onChange={e => setGrading(g => ({ ...g, [a.id]: { ...(g[a.id] || { score: '', comment: '' }), comment: e.target.value } }))}
                      className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="p-4 border-t border-gray-100 text-right">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50">Tutup</button>
        </div>
      </div>
    </div>
  )
}
