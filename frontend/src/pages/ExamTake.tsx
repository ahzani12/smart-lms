import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Loader2, Clock, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'

interface Question {
  id: number
  number: number
  type: string
  content: string
  options: string
  points: number
}

interface ExamData {
  id: number
  title: string
  description: string
  duration: number
  total_questions: number
  lock_tab: boolean
  max_tab_switches: number
  show_results: boolean
}

interface Attempt {
  id: number
  exam_id: number
  student_id: number
  start_time: string
  status: string
  tab_switches: number
}

export default function ExamTake() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [exam, setExam] = useState<ExamData | null>(null)
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [current, setCurrent] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [finalScore, setFinalScore] = useState<number | null>(null)
  const tabSwitchCount = useRef(0)
  const [showWarning, setShowWarning] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Load exam data
  useEffect(() => {
    axios.get(`/api/exams/${id}/questions`)
      .then(res => {
        const { exam, attempt, questions } = res.data
        setExam(exam)
        setAttempt(attempt)
        setQuestions(questions || [])
        // Calculate time left from attempt.start_time + duration
        const start = new Date(attempt.start_time).getTime()
        const end = start + (exam.duration * 60 * 1000)
        const left = Math.max(0, Math.floor((end - Date.now()) / 1000))
        setTimeLeft(left)
      })
      .catch(err => {
        toast.error(err.response?.data?.error || 'Gagal memuat ujian')
        navigate('/exams')
      })
      .finally(() => setLoading(false))
  }, [id])

  // Timer countdown
  useEffect(() => {
    if (submitted || !exam) return
    if (timeLeft <= 0) {
      if (exam) handleSubmit(true)
      return
    }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft, submitted, exam])

  // Tab switch detection
  useEffect(() => {
    if (!exam?.lock_tab || submitted) return
    const onVisibility = () => {
      if (document.hidden) {
        tabSwitchCount.current++
        axios.post(`/api/exams/${id}/tab-switch`).catch(() => {})
        toast.error(`⚠️ Pindah tab terdeteksi (${tabSwitchCount.current}/${exam.max_tab_switches})`, { duration: 3000 })
        if (tabSwitchCount.current >= exam.max_tab_switches) {
          toast.error('Batas pindah tab tercapai. Ujian disubmit otomatis.')
          handleSubmit(true)
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [exam, submitted])

  // Block browser back / refresh
  useEffect(() => {
    if (submitted) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [submitted])

  // === ANTI CHEAT: Fullscreen mode ===
  const enterFullscreen = () => {
    const el = document.documentElement
    if (el.requestFullscreen) el.requestFullscreen()
    else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen()
    else if ((el as any).msRequestFullscreen) (el as any).msRequestFullscreen()
  }

  useEffect(() => {
    if (!exam?.lock_tab || submitted) return
    // Request fullscreen on start
    enterFullscreen()

    const onFsChange = () => {
      const isFull = !!document.fullscreenElement
      setIsFullscreen(isFull)
      if (!isFull && !submitted) {
        // Exited fullscreen — count as tab switch
        tabSwitchCount.current++
        axios.post(`/api/exams/${id}/tab-switch`).catch(() => {})
        toast.error(`⚠️ Keluar fullscreen terdeteksi (${tabSwitchCount.current}/${exam.max_tab_switches})`)
        if (tabSwitchCount.current >= exam.max_tab_switches) {
          toast.error('Batas pelanggaran tercapai. Ujian disubmit otomatis.')
          handleSubmit(true)
        }
      }
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [exam, submitted])

  // === ANTI CHEAT: Disable copy, paste, right-click, keyboard shortcuts ===
  useEffect(() => {
    if (submitted) return

    const blockContext = (e: MouseEvent) => { e.preventDefault() }
    const blockCopy = (e: ClipboardEvent) => { e.preventDefault(); toast.error('Copy/Paste tidak diizinkan', { id: 'no-copy' }) }
    const blockKeys = (e: KeyboardEvent) => {
      // Block Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, Ctrl+U, Ctrl+S, Ctrl+P, F12, Ctrl+Shift+I/J
      if (e.ctrlKey && ['c', 'v', 'x', 'a', 'u', 's', 'p'].includes(e.key.toLowerCase())) {
        e.preventDefault()
        toast.error('Shortcut tidak diizinkan', { id: 'no-shortcut' })
      }
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase()))) {
        e.preventDefault()
        toast.error('DevTools tidak diizinkan', { id: 'no-devtools' })
      }
      // Block PrintScreen
      if (e.key === 'PrintScreen') {
        e.preventDefault()
        toast.error('Screenshot tidak diizinkan', { id: 'no-screenshot' })
      }
    }
    const blockDrag = (e: DragEvent) => { e.preventDefault() }
    const blockSelect = (e: Event) => {
      // Allow selection in textarea/input only
      const target = e.target as HTMLElement
      if (target.tagName !== 'TEXTAREA' && target.tagName !== 'INPUT') {
        e.preventDefault()
      }
    }

    document.addEventListener('contextmenu', blockContext)
    document.addEventListener('copy', blockCopy)
    document.addEventListener('cut', blockCopy)
    document.addEventListener('paste', blockCopy)
    document.addEventListener('keydown', blockKeys)
    document.addEventListener('dragstart', blockDrag)
    document.addEventListener('selectstart', blockSelect)

    return () => {
      document.removeEventListener('contextmenu', blockContext)
      document.removeEventListener('copy', blockCopy)
      document.removeEventListener('cut', blockCopy)
      document.removeEventListener('paste', blockCopy)
      document.removeEventListener('keydown', blockKeys)
      document.removeEventListener('dragstart', blockDrag)
      document.removeEventListener('selectstart', blockSelect)
    }
  }, [submitted])

  // === ANTI CHEAT: Warning overlay when tab switch detected ===
  useEffect(() => {
    if (!exam?.lock_tab || submitted) return
    const onFocus = () => setShowWarning(false)
    const onBlur = () => setShowWarning(true)
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
    }
  }, [exam, submitted])

  const handleSubmit = async (force = false) => {
    if (submitting || submitted) return
    if (!force && !confirm('Yakin submit jawaban? Tidak bisa dikoreksi lagi.')) return
    if (!attempt) return
    setSubmitting(true)
    try {
      const payload = {
        attempt_id: attempt.id,
        answers: Object.entries(answers).map(([qid, ans]) => ({
          question_id: Number(qid),
          answer: ans,
        })),
      }
      const res = await axios.post(`/api/exams/${id}/submit`, payload)
      setSubmitted(true)
      if (typeof res.data.score === 'number') setFinalScore(res.data.score)
      toast.success('Ujian berhasil disubmit')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal submit')
    } finally {
      setSubmitting(false)
    }
  }

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const parseOptions = (raw: string): { key: string; text: string }[] => {
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
      return []
    } catch {
      return []
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center space-y-4">
          <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900">Ujian Selesai</h1>
          <p className="text-gray-600">Jawaban kamu sudah tersimpan.</p>
          {finalScore !== null && exam?.show_results && (
            <div className="bg-indigo-50 rounded-2xl p-6">
              <div className="text-sm text-indigo-600 font-medium">Nilai Sementara</div>
              <div className="text-5xl font-bold text-indigo-700 mt-1">{finalScore.toFixed(1)}</div>
            </div>
          )}
          <button onClick={() => navigate('/exams')} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700">
            Kembali ke Daftar Ujian
          </button>
        </div>
      </div>
    )
  }

  if (!exam || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold">Soal belum tersedia</h2>
          <p className="text-gray-600 mt-2">Bank soal untuk ujian ini kosong.</p>
          <button onClick={() => navigate('/exams')} className="mt-4 px-6 py-2 rounded-xl bg-indigo-600 text-white">Kembali</button>
        </div>
      </div>
    )
  }

  const q = questions[current]
  const opts = parseOptions(q.options)
  const timeWarning = timeLeft < 300
  const answered = Object.keys(answers).length

  return (
    <div className="min-h-screen bg-gray-50 select-none">
      {/* Anti-cheat warning overlay */}
      {showWarning && (
        <div className="fixed inset-0 bg-red-900/95 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md text-center space-y-4">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold text-red-700">PERINGATAN!</h2>
            <p className="text-gray-700">Anda terdeteksi meninggalkan halaman ujian. Kembali ke halaman ujian sekarang.</p>
            <p className="text-sm text-red-600 font-medium">Pelanggaran: {tabSwitchCount.current} / {exam?.max_tab_switches || 3}</p>
            <button onClick={() => { setShowWarning(false); enterFullscreen() }}
              className="w-full py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700">
              Kembali ke Ujian
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen reminder bar */}
      {exam?.lock_tab && !isFullscreen && !submitted && !showWarning && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-yellow-900 text-center py-2 text-sm font-medium z-50 flex items-center justify-center gap-3">
          <AlertTriangle className="w-4 h-4" />
          Mode fullscreen diperlukan untuk ujian ini
          <button onClick={enterFullscreen} className="px-3 py-1 bg-yellow-700 text-white rounded-lg text-xs hover:bg-yellow-800">
            Aktifkan Fullscreen
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{exam.title}</h1>
            <div className="text-xs text-gray-500">
              {answered} / {questions.length} dijawab
              {exam.lock_tab && <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-600 rounded-full font-medium">🔒 Mode Aman</span>}
            </div>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-bold ${timeWarning ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-indigo-100 text-indigo-700'}`}>
            <Clock className="w-5 h-5" />
            {formatTime(timeLeft)}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Question area */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">Soal {current + 1} dari {questions.length}</div>
            <div className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 font-medium uppercase">{q.type.replace('_', ' ')}</div>
          </div>

          <div className="prose max-w-none">
            <div className="text-base text-gray-900 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: q.content }} />
          </div>

          {/* Input by type */}
          {(q.type === 'pilihan_ganda' || q.type === 'true_false') && (
            <div className="space-y-2">
              {opts.map(opt => (
                <label key={opt.key} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${answers[q.id] === opt.key ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    value={opt.key}
                    checked={answers[q.id] === opt.key}
                    onChange={() => setAnswers({ ...answers, [q.id]: opt.key })}
                    className="mt-1"
                  />
                  <div>
                    <span className="font-medium">{opt.key}.</span> {opt.text}
                  </div>
                </label>
              ))}
            </div>
          )}

          {q.type === 'multi_answer' && (
            <div className="space-y-2">
              <div className="text-xs text-gray-500">Boleh pilih lebih dari satu</div>
              {opts.map(opt => {
                const selected = (answers[q.id] || '').split(',').filter(Boolean)
                const isOn = selected.includes(opt.key)
                return (
                  <label key={opt.key} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${isOn ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input
                      type="checkbox"
                      checked={isOn}
                      onChange={e => {
                        const next = e.target.checked ? [...selected, opt.key] : selected.filter(k => k !== opt.key)
                        setAnswers({ ...answers, [q.id]: next.sort().join(',') })
                      }}
                      className="mt-1"
                    />
                    <div><span className="font-medium">{opt.key}.</span> {opt.text}</div>
                  </label>
                )
              })}
            </div>
          )}

          {(q.type === 'essay' || q.type === 'fill_blank' || q.type === 'numeric') && (
            <textarea
              value={answers[q.id] || ''}
              onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
              rows={q.type === 'essay' ? 8 : 3}
              placeholder="Tulis jawaban di sini..."
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
            />
          )}

          {/* Nav buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <button
              onClick={() => setCurrent(c => Math.max(0, c - 1))}
              disabled={current === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" /> Sebelumnya
            </button>
            {current < questions.length - 1 ? (
              <button
                onClick={() => setCurrent(c => c + 1)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Selanjutnya <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Submit Ujian
              </button>
            )}
          </div>
        </div>

        {/* Question navigator */}
        <div className="bg-white rounded-2xl shadow-sm border p-4 h-fit lg:sticky lg:top-24">
          <div className="text-sm font-medium text-gray-700 mb-3">Navigasi Soal</div>
          <div className="grid grid-cols-5 gap-2">
            {questions.map((qq, i) => {
              const isAnswered = !!answers[qq.id]
              const isActive = i === current
              return (
                <button
                  key={qq.id}
                  onClick={() => setCurrent(i)}
                  className={`aspect-square rounded-lg text-sm font-medium transition ${
                    isActive ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' :
                    isAnswered ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                    'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
          <div className="mt-4 pt-4 border-t space-y-2 text-xs text-gray-500">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-green-100 border border-green-300"></span> Sudah dijawab</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-gray-100 border border-gray-300"></span> Belum dijawab</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-indigo-600"></span> Aktif</div>
          </div>
          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="w-full mt-4 py-2.5 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50"
          >
            Submit Sekarang
          </button>
        </div>
      </div>
    </div>
  )
}
