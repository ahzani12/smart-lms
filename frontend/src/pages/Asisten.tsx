import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Sparkles, Send, Undo2, Loader2, CheckCircle2, AlertCircle, Lightbulb, History, X } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────
type ParseResolved = {
  school_id?: number
  kelas?: { id: number; name: string }
  mapel?: { id: number; name: string }
  schedule?: { id: number; name: string; extra: string }
  tanggal?: string
  default?: string
  kecuali?: { student_id: number; name: string; nis: string; class_name: string; status: string; note?: string }[]
  student_count?: number
  // POS-style:
  amount?: number
  metode?: string
  bulan?: string
  // Generic:
  [k: string]: any
}

type JadwalItem = {
  schedule_id: number
  day_of_week: number
  day_label: string
  start_time: string
  end_time: string
  subject: string
  class_name: string
  teacher_name?: string
}

type ResolvedJadwal = {
  scope: string
  title: string
  day_label?: string
  tanggal?: string
  kelas_name?: string
  guru_name?: string
  items: JadwalItem[]
  errors?: string[]
  ambiguous?: { slot_name: string; raw_input: string; question: string; choices: { id: number; name: string; extra?: string }[] }[]
}

type AbsenItem = {
  student_id: number
  name: string
  nis: string
  class_name: string
  subject?: string
  start_time?: string
  note?: string
}

type StatusGroup = {
  status: string
  label: string
  count: number
  items: AbsenItem[]
}

type ResolvedRekap = {
  scope: string
  title: string
  tanggal?: string
  status_filt?: string
  kelas_name?: string
  total: number
  by_status?: StatusGroup[]
  // utk absen_student
  student?: { id: number; name: string; nis: string; class_name: string }
  stats?: { hadir: number; sakit: number; izin: number; alfa: number; terlambat: number; total: number }
  history?: {
    date: string; date_label: string; status: string; status_label: string
    subject?: string; start_time?: string; note?: string
  }[]
  errors?: string[]
}

type TagihanItem = {
  student_id: number
  name: string
  nis: string
  class_name: string
  bulan_nunggak: number
  total_rp: number
  periode: string
}

type TagihanRow = {
  id: number
  jenis_name: string
  periode: string
  nominal: number
  terbayar: number
  sisa: number
  status: string
  status_label: string
  jatuh_tempo?: string
}

type ResolvedTagihan = {
  scope: string
  title: string
  jenis_name?: string
  kelas_name?: string
  min_bulan?: number
  total: number
  total_rp: number
  items?: TagihanItem[]
  student?: { id: number; name: string; nis: string; class_name: string }
  history?: TagihanRow[]
  errors?: string[]
}

type NotifTarget = {
  user_id?: number
  name: string
  phone: string
  relation?: string
}

type ResolvedNotif = {
  scope: string
  title: string
  student?: { id: number; name: string; nis: string; class_name: string }
  recipients?: NotifTarget[]
  pesan: string
  pesan_raw: string
  template?: string
  provider?: string
  notif_enabled: boolean
  errors?: string[]
  warnings?: string[]
}

type ParseResponse = {
  action_id: string
  intent: string
  confidence: number
  resolved?: ParseResolved
  jadwal?: ResolvedJadwal
  rekap?: ResolvedRekap
  tagihan?: ResolvedTagihan
  notif?: ResolvedNotif
  errors?: string[]
  suggestions?: string[]
}

type ExecuteResponse = {
  success: boolean
  message?: string
  session_id?: number
  counts?: Record<string, number>
  undo_token?: string
  undo_until?: string
  errors?: string[]
}

type ChatItem =
  | { id: string; kind: 'user'; text: string; ts: Date }
  | { id: string; kind: 'parsed'; parse: ParseResponse; rawInput: string; ts: Date; executed?: boolean; result?: ExecuteResponse }
  | { id: string; kind: 'error'; text: string; suggestions?: string[]; ts: Date }
  | { id: string; kind: 'system'; text: string; ts: Date }

type LogEntry = {
  id: number
  raw_input: string
  intent: string
  confidence: number
  status: string
  duration_ms: number
  created_at: string
}

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  hadir: { label: 'Hadir', cls: 'bg-green-100 text-green-700 border-green-300' },
  sakit: { label: 'Sakit', cls: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  izin: { label: 'Izin', cls: 'bg-blue-100 text-blue-700 border-blue-300' },
  alfa: { label: 'Alfa', cls: 'bg-red-100 text-red-700 border-red-300' },
  terlambat: { label: 'Terlambat', cls: 'bg-orange-100 text-orange-700 border-orange-300' },
}

const EXAMPLE_PROMPTS = [
  'absen X IPA 1 semua hadir',
  'siswa tidak masuk hari ini',
  'rekap absen Ahmad bulan ini',
  'siapa nunggak SPP',
  'tagihan Ahmad',
  'kirim wa ke ortu Ahmad: anak sakit',
  'jadwal hari ini',
]

// ─── Helpers ─────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function formatTanggal(iso?: string) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch { return iso }
}

// ─── Component ───────────────────────────────────────────────────
export default function Asisten() {
  const [items, setItems] = useState<ChatItem[]>([
    { id: uid(), kind: 'system', ts: new Date(),
      text: 'Halo! Aku asisten kamu. Coba ketik perintah pakai bahasa sehari-hari, contoh: "absen X IPA 1 semua hadir kecuali Ahmad sakit"' },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [items])

  // ─── Send / Parse ───
  async function handleSend(text?: string) {
    const raw = (text ?? input).trim()
    if (!raw || busy) return
    setBusy(true)
    setInput('')
    const userId = uid()
    setItems(p => [...p, { id: userId, kind: 'user', text: raw, ts: new Date() }])

    try {
      const { data } = await axios.post<ParseResponse>('/api/assistant/parse', { input: raw })

      if (!data.intent || data.intent === '') {
        setItems(p => [...p, {
          id: uid(), kind: 'error', ts: new Date(),
          text: data.errors?.[0] || 'Hmm, aku belum ngerti perintahnya.',
          suggestions: data.suggestions,
        }])
      } else {
        setItems(p => [...p, {
          id: uid(), kind: 'parsed', ts: new Date(),
          parse: data, rawInput: raw,
        }])
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Gagal terhubung ke server'
      setItems(p => [...p, { id: uid(), kind: 'error', text: msg, ts: new Date() }])
    } finally {
      setBusy(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  // ─── Execute ───
  async function handleExecute(itemId: string, actionId: string) {
    setBusy(true)
    try {
      const { data } = await axios.post<ExecuteResponse>('/api/assistant/execute', { action_id: actionId })
      if (data.success) {
        toast.success(data.message || 'Berhasil tersimpan')
        setItems(p => p.map(it =>
          it.id === itemId && it.kind === 'parsed' ? { ...it, executed: true, result: data } : it
        ))
      } else {
        toast.error(data.errors?.[0] || data.message || 'Gagal menyimpan')
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Gagal menjalankan aksi')
    } finally {
      setBusy(false)
    }
  }

  // ─── Undo ───
  async function handleUndo(itemId: string, undoToken: string) {
    if (!confirm('Batalkan aksi tadi?')) return
    setBusy(true)
    try {
      const { data } = await axios.post('/api/assistant/undo', { undo_token: undoToken })
      if (data.success) {
        toast.success(data.message || 'Aksi dibatalkan')
        setItems(p => p.map(it =>
          it.id === itemId && it.kind === 'parsed'
            ? { ...it, result: { ...(it.result || { success: true }), undo_token: undefined } as any }
            : it
        ))
        setItems(p => [...p, {
          id: uid(), kind: 'system', ts: new Date(),
          text: data.message || 'Aksi terakhir dibatalkan.',
        }])
      } else {
        toast.error(data.error || 'Gagal undo')
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Gagal undo')
    } finally {
      setBusy(false)
    }
  }

  // ─── History ───
  async function loadHistory() {
    try {
      const { data } = await axios.get('/api/assistant/log?limit=20')
      setLogs(Array.isArray(data) ? data : [])
      setShowHistory(true)
    } catch (e: any) {
      toast.error('Gagal load history')
    }
  }

  // ─── Render ───
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-slate-800">Asisten</h1>
            <p className="text-xs text-slate-500">Ketik perintah pakai bahasa sehari-hari</p>
          </div>
        </div>
        <button
          onClick={loadHistory}
          className="text-sm text-slate-600 hover:text-indigo-600 flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100"
        >
          <History className="w-4 h-4" /> Riwayat
        </button>
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {items.map(it => <ChatBubble key={it.id} item={it} onExecute={handleExecute} onUndo={handleUndo} onSuggest={handleSend} />)}
          {busy && (
            <div className="flex items-center gap-2 text-slate-500 text-sm pl-2">
              <Loader2 className="w-4 h-4 animate-spin" /> sebentar...
            </div>
          )}
        </div>
      </div>

      {/* Quick suggestions */}
      {items.length <= 2 && (
        <div className="px-4 pb-2">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
              <Lightbulb className="w-3.5 h-3.5" /> Coba salah satu:
            </div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(p)}
                  className="text-xs px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700 transition"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
            placeholder="Ketik perintah, contoh: absen X IPA 1 semua hadir..."
            disabled={busy}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
          />
          <button
            onClick={() => handleSend()}
            disabled={busy || !input.trim()}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white flex items-center gap-2 transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* History modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowHistory(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="font-semibold">Riwayat Perintah</h2>
              <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {logs.length === 0 && <p className="text-sm text-slate-500">Belum ada riwayat.</p>}
              <div className="space-y-2">
                {logs.map(l => (
                  <div key={l.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        l.status === 'executed' ? 'bg-green-100 text-green-700' :
                        l.status === 'undone' ? 'bg-amber-100 text-amber-700' :
                        l.status === 'parsed' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>{l.status}</span>
                      <span className="text-xs text-slate-400">{new Date(l.created_at).toLocaleString('id-ID')}</span>
                    </div>
                    <p className="text-sm text-slate-700 font-mono">{l.raw_input || '(kosong)'}</p>
                    {l.intent && <p className="text-xs text-slate-500 mt-1">{l.intent} · conf {(l.confidence * 100).toFixed(0)}%</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Chat bubble ─────────────────────────────────────────────────
function ChatBubble({
  item, onExecute, onUndo, onSuggest,
}: {
  item: ChatItem
  onExecute: (id: string, actionId: string) => void
  onUndo: (id: string, undoToken: string) => void
  onSuggest: (text: string) => void
}) {
  if (item.kind === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-indigo-600 text-white rounded-2xl rounded-tr-md px-4 py-2.5">
          {item.text}
        </div>
      </div>
    )
  }

  if (item.kind === 'system') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[80%] bg-white border border-slate-200 rounded-2xl rounded-tl-md px-4 py-2.5 text-slate-700 text-sm">
          {item.text}
        </div>
      </div>
    )
  }

  if (item.kind === 'error') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[80%] bg-red-50 border border-red-200 rounded-2xl rounded-tl-md px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-800">{item.text}</p>
              {item.suggestions && item.suggestions.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-red-600">Coba:</p>
                  {item.suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => onSuggest(s)}
                      className="block text-left text-xs text-red-700 hover:text-red-900 underline"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // parsed item
  const { parse, rawInput, executed, result } = item
  const r = parse.resolved || {}
  const isJadwal = parse.intent.startsWith('JADWAL.')
  const isRekap = parse.intent.startsWith('REKAP.')
  const isTagihan = parse.intent.startsWith('TAGIHAN.')
  const isNotif = parse.intent.startsWith('NOTIF.')
  const isReadOnly = isJadwal || isRekap || isTagihan
  const showButton = !isReadOnly

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] bg-white border border-slate-200 rounded-2xl rounded-tl-md p-4 shadow-sm w-full">
        {/* Intent badge */}
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-medium text-indigo-600">{intentLabel(parse.intent)}</span>
          <span className="text-xs text-slate-400">· {(parse.confidence * 100).toFixed(0)}% yakin</span>
        </div>

        {isJadwal && parse.jadwal && <JadwalPreview jadwal={parse.jadwal} />}
        {isRekap && parse.rekap && <RekapPreview rekap={parse.rekap} />}
        {isTagihan && parse.tagihan && <TagihanPreview tagihan={parse.tagihan} />}
        {isNotif && parse.notif && <NotifPreview notif={parse.notif} />}
        {!isReadOnly && !isNotif && <ResolvedPreview resolved={r} intent={parse.intent} />}

        {/* Action buttons */}
        {!executed && showButton && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => onExecute(item.id, parse.action_id)}
              disabled={!canExecute(parse)}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-medium flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> {isNotif ? 'Kirim WA' : 'Jalankan'}
            </button>
            <span className="text-xs text-slate-400 self-center">{rawInput && `"${rawInput}"`}</span>
          </div>
        )}

        {/* After execute */}
        {executed && result && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" />
              {result.message || 'Berhasil tersimpan'}
            </div>
            {result.counts && (
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(result.counts).map(([k, v]) => (
                  <span key={k} className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGES[k]?.cls || 'bg-slate-100 text-slate-700'}`}>
                    {STATUS_BADGES[k]?.label || k}: {v}
                  </span>
                ))}
              </div>
            )}
            {result.undo_token && result.undo_token !== '0' && (
              <button
                onClick={() => onUndo(item.id, result.undo_token!)}
                className="mt-3 text-xs text-amber-700 hover:text-amber-900 flex items-center gap-1.5"
              >
                <Undo2 className="w-3.5 h-3.5" /> Batalkan (5 menit)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Resolved preview ────────────────────────────────────────────
function ResolvedPreview({ resolved, intent }: { resolved: ParseResolved; intent: string }) {
  const isAbsen = intent.startsWith('ABSEN.')
  const single = intent === 'ABSEN.SINGLE'

  return (
    <div className="space-y-2 text-sm">
      {/* Tanggal */}
      {resolved.tanggal && (
        <Row label="Tanggal" value={formatTanggal(resolved.tanggal)} />
      )}

      {/* Kelas / Mapel / Jadwal — only for class-level intents */}
      {!single && resolved.kelas && (
        <Row label="Kelas" value={resolved.kelas.name} />
      )}
      {!single && resolved.schedule && (
        <Row label="Mapel" value={`${resolved.schedule.name} · ${resolved.schedule.extra}`} />
      )}

      {/* Default + counts */}
      {isAbsen && resolved.default && resolved.student_count != null && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-slate-500">Default:</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGES[resolved.default]?.cls || ''}`}>
            {STATUS_BADGES[resolved.default]?.label} (semua {resolved.student_count} siswa)
          </span>
        </div>
      )}

      {/* Kecuali list */}
      {resolved.kecuali && resolved.kecuali.length > 0 && (
        <div className="pt-2">
          <p className="text-xs text-slate-500 mb-1.5">{single ? 'Siswa:' : 'Pengecualian:'}</p>
          <div className="space-y-1.5">
            {resolved.kecuali.map((k, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGES[k.status]?.cls || ''}`}>
                  {STATUS_BADGES[k.status]?.label || k.status}
                </span>
                <span className="font-medium text-slate-800">{k.name}</span>
                {k.class_name && <span className="text-xs text-slate-500">({k.class_name})</span>}
                {k.note && <span className="text-xs text-slate-500 italic">— {k.note}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-slate-500 min-w-[60px]">{label}:</span>
      <span className="text-slate-800">{value}</span>
    </div>
  )
}

// ─── Jadwal preview ───────────────────────────────────────────────
function JadwalPreview({ jadwal }: { jadwal: ResolvedJadwal }) {
  // Group items by day
  const byDay = new Map<number, JadwalItem[]>()
  for (const it of jadwal.items) {
    if (!byDay.has(it.day_of_week)) byDay.set(it.day_of_week, [])
    byDay.get(it.day_of_week)!.push(it)
  }
  const days = Array.from(byDay.keys()).sort((a, b) => a - b)

  return (
    <div className="space-y-3">
      <div className="font-semibold text-slate-800">{jadwal.title}</div>

      {jadwal.errors && jadwal.errors.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          {jadwal.errors[0]}
        </div>
      )}

      {jadwal.ambiguous && jadwal.ambiguous.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
          <p className="text-blue-800 font-medium mb-2">{jadwal.ambiguous[0].question}</p>
          <div className="space-y-1">
            {jadwal.ambiguous[0].choices.map(c => (
              <div key={c.id} className="text-blue-700">
                · {c.name} {c.extra && <span className="text-xs text-blue-500">({c.extra})</span>}
              </div>
            ))}
          </div>
          <p className="text-xs text-blue-600 mt-2">Tambah info biar lebih spesifik (mis: nama lengkap)</p>
        </div>
      )}

      {jadwal.items.length > 0 && (
        <div className="space-y-3">
          {days.map(d => {
            const dayItems = byDay.get(d)!
            const dayLabel = dayItems[0]?.day_label || ''
            return (
              <div key={d} className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{dayLabel}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {dayItems.map((it, idx) => (
                    <div key={idx} className="px-3 py-2 flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-500 min-w-[88px]">{it.start_time} – {it.end_time}</span>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-800">{it.subject}</div>
                        <div className="text-xs text-slate-500">
                          {it.class_name}
                          {it.teacher_name && ` · ${it.teacher_name}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Rekap preview ────────────────────────────────────────────────
function RekapPreview({ rekap }: { rekap: ResolvedRekap }) {
  const isStudent = rekap.scope === 'absen_student'
  const colors: Record<string, { bg: string; border: string; text: string; chip: string }> = {
    sakit:     { bg: 'bg-rose-50',   border: 'border-rose-200',   text: 'text-rose-800',   chip: 'bg-rose-100 text-rose-700' },
    izin:      { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-800',  chip: 'bg-amber-100 text-amber-700' },
    alfa:      { bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-900',    chip: 'bg-red-200 text-red-800' },
    terlambat: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', chip: 'bg-orange-100 text-orange-700' },
    hadir:     { bg: 'bg-emerald-50',border: 'border-emerald-200',text: 'text-emerald-800',chip: 'bg-emerald-100 text-emerald-700' },
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div className="font-semibold text-slate-800">{rekap.title}</div>
        {rekap.total > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
            {rekap.total} {isStudent ? 'absen' : 'siswa'}
          </span>
        )}
      </div>

      {rekap.errors && rekap.errors.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
          ✨ {rekap.errors[0]}
        </div>
      )}

      {/* Per-siswa view */}
      {isStudent && rekap.student && rekap.stats && (
        <div className="space-y-3">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <div className="font-semibold text-indigo-900">{rekap.student.name}</div>
            <div className="text-xs text-indigo-700">
              {rekap.student.class_name}
              {rekap.student.nis && ` · NIS ${rekap.student.nis}`}
            </div>
            <div className="grid grid-cols-5 gap-2 mt-3">
              {(['hadir','sakit','izin','alfa','terlambat'] as const).map(k => (
                <div key={k} className={`text-center rounded-md py-2 ${colors[k].bg} border ${colors[k].border}`}>
                  <div className={`text-xl font-bold ${colors[k].text}`}>{rekap.stats![k]}</div>
                  <div className={`text-[10px] uppercase tracking-wide ${colors[k].text}`}>{k}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-indigo-700 text-center">
              total: {rekap.stats.total} sesi
            </div>
          </div>

          {rekap.history && rekap.history.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-700">Detail kehadiran</div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {rekap.history.map((h, i) => {
                  const c = colors[h.status] || { chip: 'bg-slate-100 text-slate-700' }
                  return (
                    <div key={i} className="px-3 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-slate-500">{h.date_label}</div>
                        <div className="text-sm text-slate-800">
                          {h.subject || '-'} {h.start_time && <span className="text-xs text-slate-400">· {h.start_time}</span>}
                        </div>
                        {h.note && <div className="text-xs text-slate-400 italic">"{h.note}"</div>}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.chip}`}>{h.status_label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Today by-status view */}
      {!isStudent && (rekap.by_status || []).map(g => {
        const c = colors[g.status] || { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-800', chip: 'bg-slate-100 text-slate-700' }
        return (
          <div key={g.status} className={`border rounded-lg overflow-hidden ${c.border}`}>
            <div className={`px-3 py-2 flex items-center justify-between ${c.bg}`}>
              <span className={`text-sm font-semibold ${c.text}`}>{g.label}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.chip}`}>{g.count}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {g.items.map(it => (
                <div key={it.student_id} className="px-3 py-2">
                  <div className="text-sm font-medium text-slate-800">{it.name}</div>
                  <div className="text-xs text-slate-500">
                    {it.class_name}
                    {it.nis && ` · NIS ${it.nis}`}
                    {it.subject && ` · ${it.subject}`}
                    {it.start_time && ` ${it.start_time}`}
                  </div>
                  {it.note && <div className="text-xs text-slate-400 italic mt-0.5">"{it.note}"</div>}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Tagihan preview ───────────────────────────────────────────────
function TagihanPreview({ tagihan }: { tagihan: ResolvedTagihan }) {
  const isStudent = tagihan.scope === 'student'
  const statusColor = (st: string) => {
    if (st === 'lunas') return 'bg-emerald-100 text-emerald-700 border-emerald-300'
    if (st === 'cicilan') return 'bg-amber-100 text-amber-700 border-amber-300'
    if (st === 'void') return 'bg-slate-100 text-slate-500 border-slate-300 line-through'
    return 'bg-rose-100 text-rose-700 border-rose-300'
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div className="font-semibold text-slate-800">{tagihan.title}</div>
        {tagihan.total > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
            {tagihan.total} {isStudent ? 'tagihan' : 'siswa'}
          </span>
        )}
      </div>

      {tagihan.errors && tagihan.errors.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
          {tagihan.errors[0]}
        </div>
      )}

      {/* Summary card */}
      {tagihan.total > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
          <div className="text-xs text-rose-600 uppercase tracking-wide">
            {isStudent ? 'Total tagihan belum lunas' : 'Total tunggakan'}
          </div>
          <div className="text-2xl font-bold text-rose-800">{rupiah(tagihan.total_rp)}</div>
        </div>
      )}

      {/* Nunggak: per-siswa */}
      {!isStudent && tagihan.items && tagihan.items.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-700 flex justify-between">
            <span>Siswa nunggak (urut: terbanyak)</span>
            <span>Total nominal</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {tagihan.items.map(it => (
              <div key={it.student_id} className="px-3 py-2 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800">{it.name}</div>
                  <div className="text-xs text-slate-500">
                    {it.class_name}
                    {it.nis && ` · NIS ${it.nis}`}
                  </div>
                  <div className="text-xs text-rose-600 mt-0.5">
                    {it.bulan_nunggak} bulan · {it.periode}
                  </div>
                </div>
                <div className="text-sm font-semibold text-rose-700 whitespace-nowrap">
                  {rupiah(it.total_rp)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-siswa: list tagihan detail */}
      {isStudent && tagihan.student && (
        <>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <div className="font-semibold text-indigo-900">{tagihan.student.name}</div>
            <div className="text-xs text-indigo-700">
              {tagihan.student.class_name}
              {tagihan.student.nis && ` · NIS ${tagihan.student.nis}`}
            </div>
          </div>
          {tagihan.history && tagihan.history.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-700">Daftar tagihan</div>
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {tagihan.history.map(h => (
                  <div key={h.id} className="px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-800">{h.jenis_name} · {h.periode}</div>
                      <div className="text-xs text-slate-500">
                        {rupiah(h.nominal)} · sisa {rupiah(h.sisa)}
                        {h.jatuh_tempo && ` · jatuh tempo ${h.jatuh_tempo}`}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor(h.status)}`}>
                      {h.status_label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Notif preview ─────────────────────────────────────────────────
function NotifPreview({ notif }: { notif: ResolvedNotif }) {
  return (
    <div className="space-y-3">
      <div className="font-semibold text-slate-800">{notif.title}</div>

      {notif.errors && notif.errors.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-800">
          ⚠️ {notif.errors[0]}
        </div>
      )}

      {notif.warnings && notif.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 space-y-1">
          {notif.warnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}

      {notif.student && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
          <div className="text-xs text-indigo-600 uppercase tracking-wide">Tentang siswa</div>
          <div className="font-semibold text-indigo-900">{notif.student.name}</div>
          <div className="text-xs text-indigo-700">{notif.student.class_name}</div>
        </div>
      )}

      {notif.recipients && notif.recipients.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-700">
            Penerima ({notif.recipients.length})
          </div>
          <div className="divide-y divide-slate-100">
            {notif.recipients.map((r, i) => (
              <div key={i} className="px-3 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800">{r.name}</div>
                  <div className="text-xs text-slate-500">{r.relation || 'wali'}</div>
                </div>
                <div className="text-xs font-mono text-slate-600">{r.phone}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
        <div className="text-xs text-emerald-700 uppercase tracking-wide mb-1">📝 Pesan akhir</div>
        <div className="text-sm text-emerald-900 whitespace-pre-wrap leading-relaxed">{notif.pesan}</div>
      </div>

      <div className="text-xs text-slate-500 flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded-full ${notif.notif_enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
          {notif.provider || 'none'}
        </span>
        {notif.template && <span>· template: {notif.template}</span>}
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────
function intentLabel(intent: string) {
  const map: Record<string, string> = {
    'ABSEN.BULK_HADIR': 'Absen kelas (semua hadir)',
    'ABSEN.MARK_KECUALI': 'Absen kelas dgn pengecualian',
    'ABSEN.SINGLE': 'Absen 1 siswa',
    'JADWAL.TODAY': 'Jadwal hari ini',
    'JADWAL.KELAS': 'Jadwal kelas',
    'JADWAL.GURU': 'Jadwal guru',
    'REKAP.ABSEN_TODAY': 'Rekap siswa absen',
    'REKAP.ABSEN_STUDENT': 'Rekap absen siswa',
    'TAGIHAN.NUNGGAK': 'Tunggakan SPP',
    'TAGIHAN.STUDENT': 'Tagihan siswa',
    'NOTIF.WA_ORTU': 'Kirim WA ke ortu',
  }
  return map[intent] || intent
}

function canExecute(parse: ParseResponse): boolean {
  // Read-only intents — no execute button
  if (parse.intent.startsWith('JADWAL.') || parse.intent.startsWith('REKAP.') || parse.intent.startsWith('TAGIHAN.')) return false
  // Notif: bisa execute kalo ada recipient & gak ada error
  if (parse.intent.startsWith('NOTIF.')) {
    return !!(parse.notif && parse.notif.recipients && parse.notif.recipients.length > 0
              && (!parse.notif.errors || parse.notif.errors.length === 0))
  }
  if (parse.intent === 'ABSEN.SINGLE') return false
  return !!parse.resolved?.schedule
}

function rupiah(n: number): string {
  return 'Rp' + (n || 0).toLocaleString('id-ID')
}
