import { useEffect, useState } from 'react'
import axios from 'axios'
import { Sparkles, BookOpen, FileText, ClipboardList, Send, Loader2, Copy, Check, Settings, Trash2, CheckCircle2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

const features = [
  { id: 'questions', icon: BookOpen, label: 'Generate Soal', desc: 'Buat soal otomatis dari topik', color: 'from-blue-500 to-cyan-500' },
  { id: 'essay', icon: FileText, label: 'Koreksi Esai', desc: 'Koreksi jawaban esai otomatis', color: 'from-green-500 to-emerald-500' },
  { id: 'rpp', icon: ClipboardList, label: 'Generate RPP', desc: 'Buat RPP lengkap otomatis', color: 'from-purple-500 to-violet-500' },
  { id: 'prota', icon: ClipboardList, label: 'Prota & Promes', desc: 'Generate program tahunan & semester', color: 'from-orange-500 to-amber-500' },
  { id: 'config', icon: Settings, label: 'Konfigurasi AI', desc: 'Atur provider, API key & model', color: 'from-slate-500 to-gray-600', adminOnly: true },
]

const PROVIDER_PRESETS = [
  { label: 'OpenAI', base_url: 'https://api.openai.com/v1', auth_type: 'apikey' },
  { label: 'OpenRouter', base_url: 'https://openrouter.ai/api/v1', auth_type: 'apikey' },
  { label: 'xAI (Grok)', base_url: 'https://api.x.ai/v1', auth_type: 'apikey' },
  { label: 'Groq', base_url: 'https://api.groq.com/openai/v1', auth_type: 'apikey' },
  { label: 'DeepSeek', base_url: 'https://api.deepseek.com/v1', auth_type: 'apikey' },
  { label: 'Together AI', base_url: 'https://api.together.xyz/v1', auth_type: 'apikey' },
  { label: 'Mistral', base_url: 'https://api.mistral.ai/v1', auth_type: 'apikey' },
  { label: 'Ollama (local)', base_url: 'http://localhost:11434/v1', auth_type: 'apikey' },
  { label: 'ChatGPT Free (Session)', base_url: '', auth_type: 'chatgpt_session' },
  { label: 'Custom', base_url: '', auth_type: 'apikey' },
]

interface AIConfig {
  id: number
  name: string
  auth_type: string
  base_url: string
  api_key: string
  session_token: string
  model: string
  active: boolean
}

export default function AIHub() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin_pusat'

  const [activeFeature, setActiveFeature] = useState('questions')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Async job state for generate-questions (backend now runs in background)
  const [jobProgress, setJobProgress] = useState(0)
  const [jobMessage, setJobMessage] = useState('')
  const [jobId, setJobId] = useState<number | null>(null)

  const [qForm, setQForm] = useState<any>({ topic: '', subject: '', subject_id: '', count: 5, type: 'pilihan_ganda', difficulty: 'sedang', bank_id: '' })
  const [eForm, setEForm] = useState({ exam_attempt_id: '' })
  const [rForm, setRForm] = useState({ subject: '', class: '', topic: '', kurikulum: 'Kurikulum Merdeka', duration: '2 x 45 menit' })
  const [pForm, setPForm] = useState({ subject: '', class: '', kurikulum: 'Kurikulum Merdeka', tahun: '2025/2026' })

  // Banks & subjects for dropdowns in the "Generate Soal" form
  const [banks, setBanks] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  // Rendered questions (pretty view) in addition to raw result
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([])

  useEffect(() => {
    axios.get('/api/question-banks/').then(r => setBanks(r.data || [])).catch(() => {})
    axios.get('/api/subjects/').then(r => setSubjects(r.data || [])).catch(() => {})
  }, [])

  // Config tab state
  const [configs, setConfigs] = useState<AIConfig[]>([])
  const [cForm, setCForm] = useState<AIConfig>({ id: 0, name: '', auth_type: 'apikey', base_url: '', api_key: '', session_token: '', model: '', active: false })
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [fetchingModels, setFetchingModels] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  useEffect(() => {
    if (activeFeature === 'config' && isAdmin) loadConfigs()
  }, [activeFeature])

  const loadConfigs = () => {
    axios.get('/api/ai/configs').then(r => setConfigs(r.data || [])).catch(() => {})
  }

  const handleFetchModels = async () => {
    if (!cForm.base_url) { toast.error('Isi base URL dulu'); return }
    setFetchingModels(true)
    try {
      const res = await axios.post('/api/ai/fetch-models', { base_url: cForm.base_url, api_key: cForm.api_key })
      const list = res.data.models || []
      setAvailableModels(list)
      if (list.length === 0) toast('Provider tidak mengembalikan model')
      else toast.success(`${list.length} model ditemukan`)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal ambil model')
      setAvailableModels([])
    }
    setFetchingModels(false)
  }

  const handleSaveConfig = async () => {
    if (!cForm.name || !cForm.model) {
      toast.error('Nama dan Model wajib diisi')
      return
    }
    if (cForm.auth_type === 'chatgpt_session' && !cForm.session_token) {
      toast.error('Access Token wajib diisi')
      return
    }
    if (cForm.auth_type === 'apikey' && !cForm.base_url) {
      toast.error('Base URL wajib diisi')
      return
    }
    try {
      if (editingId) {
        await axios.put(`/api/ai/configs/${editingId}`, cForm)
        toast.success('Konfigurasi diupdate')
      } else {
        await axios.post('/api/ai/configs', cForm)
        toast.success('Konfigurasi disimpan')
      }
      setCForm({ id: 0, name: '', auth_type: 'apikey', base_url: '', api_key: '', session_token: '', model: '', active: false })
      setAvailableModels([])
      setEditingId(null)
      loadConfigs()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan')
    }
  }

  const handleActivate = async (id: number) => {
    try {
      await axios.post(`/api/ai/configs/${id}/activate`)
      toast.success('Diaktifkan')
      loadConfigs()
    } catch { toast.error('Gagal') }
  }

  const handleDeleteConfig = async (id: number) => {
    if (!confirm('Hapus konfigurasi ini?')) return
    try {
      await axios.delete(`/api/ai/configs/${id}`)
      toast.success('Dihapus')
      loadConfigs()
    } catch { toast.error('Gagal hapus') }
  }

  const handleEditConfig = (cfg: AIConfig) => {
    setCForm(cfg)
    setEditingId(cfg.id)
    setAvailableModels(cfg.model ? [cfg.model] : [])
  }

  const handleSubmit = async () => {
    setLoading(true)
    setResult(null)
    setGeneratedQuestions([])
    setJobProgress(0)
    setJobMessage('')
    setJobId(null)

    // Generic poll helper — polls /api/ai/jobs/:id until done/failed/timeout
    const pollJob = async (jid: number, onDone: (result: any) => void) => {
      setJobId(jid)
      setJobMessage('Menunggu AI...')
      const started = Date.now()
      while (Date.now() - started < 5 * 60 * 1000) {
        await new Promise(r => setTimeout(r, 2000))
        let job: any
        try {
          const poll = await axios.get(`/api/ai/jobs/${jid}`)
          job = poll.data
        } catch { continue }
        setJobProgress(job.progress || 0)
        setJobMessage(job.message || '')
        if (job.status === 'done') {
          try {
            const parsed = JSON.parse(job.result || '{}')
            onDone(parsed)
            toast.success(parsed.message || 'Berhasil')
          } catch {
            setResult('Selesai, tapi gagal parse hasil.')
          }
          return
        }
        if (job.status === 'failed') {
          toast.error('Gagal: ' + (job.error?.split('\n')[0] || 'unknown'))
          setResult(job.error || 'Gagal')
          return
        }
      }
      toast.error('Timeout menunggu AI (>5 menit).')
      setResult('Timeout — job masih jalan di background.')
    }

    try {
      let res
      switch (activeFeature) {
        case 'questions': {
          if (!qForm.topic) { toast.error('Topik wajib diisi'); setLoading(false); return }
          if (!qForm.subject_id && !qForm.bank_id) { toast.error('Pilih mapel atau bank soal'); setLoading(false); return }
          const create = await axios.post('/api/ai/generate-questions', {
            ...qForm,
            subject_id: qForm.subject_id ? Number(qForm.subject_id) : undefined,
            bank_id: qForm.bank_id ? Number(qForm.bank_id) : undefined,
          })
          await pollJob(create.data.job_id, (parsed) => {
            setGeneratedQuestions(parsed.questions || [])
            setResult(parsed.message || 'Berhasil')
          })
          setLoading(false)
          return
        }
        case 'essay':
          res = await axios.post('/api/ai/grade-essay', eForm)
          setResult(JSON.stringify(res.data, null, 2))
          toast.success('Berhasil!')
          break
        case 'rpp': {
          if (!rForm.subject || !rForm.topic) { toast.error('Mapel dan topik wajib diisi'); setLoading(false); return }
          const create = await axios.post('/api/ai/generate-rpp', rForm)
          await pollJob(create.data.job_id, (parsed) => {
            setResult(typeof parsed.rpp === 'string' ? parsed.rpp : JSON.stringify(parsed.rpp, null, 2))
          })
          setLoading(false)
          return
        }
        case 'prota': {
          if (!pForm.subject) { toast.error('Mapel wajib diisi'); setLoading(false); return }
          const create = await axios.post('/api/ai/generate-protapromes', pForm)
          await pollJob(create.data.job_id, (parsed) => {
            setResult(typeof parsed.data === 'string' ? parsed.data : JSON.stringify(parsed.data, null, 2))
          })
          setLoading(false)
          return
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal memproses')
    }
    setLoading(false)
  }

  // Parse `options` field that backend stores as JSON string
  const parseOptions = (opt: any): any[] => {
    if (!opt) return []
    if (Array.isArray(opt)) return opt
    try { const v = JSON.parse(opt); return Array.isArray(v) ? v : [] }
    catch { return [] }
  }

  const copyResult = () => {
    const txt = generatedQuestions.length > 0
      ? JSON.stringify(generatedQuestions, null, 2)
      : result
    if (txt) {
      navigator.clipboard.writeText(txt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const visibleFeatures = features.filter(f => !f.adminOnly || isAdmin)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-navy">AI Hub</h1>
          <p className="text-navy/60">Fitur kecerdasan buatan untuk membantu guru</p>
        </div>
      </div>

      {/* Feature Tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {visibleFeatures.map(f => (
          <button
            key={f.id}
            onClick={() => { setActiveFeature(f.id); setResult(null) }}
            className={`p-4 rounded-2xl text-left transition ${activeFeature === f.id ? 'bg-gradient-to-br ' + f.color + ' text-white shadow-lg' : 'bg-white border border-warm/60 hover:border-indigo-300'}`}
          >
            <f.icon className={`w-6 h-6 mb-2 ${activeFeature === f.id ? 'text-white' : 'text-navy/70'}`} />
            <div className="font-semibold text-sm">{f.label}</div>
            <div className={`text-xs mt-1 ${activeFeature === f.id ? 'text-white/80' : 'text-navy/60'}`}>{f.desc}</div>
          </button>
        ))}
      </div>

      {/* ── Config Tab ── */}
      {activeFeature === 'config' && isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <div className="bg-white rounded-2xl shadow-sm border border-warm/40 p-6 space-y-4">
            <h3 className="font-bold text-lg">{editingId ? 'Edit' : 'Tambah'} Konfigurasi AI</h3>

            <div>
              <label className="block text-sm font-medium text-navy/80 mb-1">Nama (label)</label>
              <input value={cForm.name} onChange={e => setCForm({ ...cForm, name: e.target.value })}
                placeholder="contoh: OpenRouter utama"
                className="w-full px-4 py-2.5 rounded-xl border border-warm/60 focus:ring-2 focus:ring-amber-warm/40 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-navy/80 mb-1">Provider (preset)</label>
              <select onChange={e => {
                const p = PROVIDER_PRESETS[Number(e.target.value)]
                if (p) setCForm({ ...cForm, base_url: p.base_url, auth_type: p.auth_type, name: cForm.name || p.label, model: p.auth_type === 'chatgpt_session' ? 'auto' : cForm.model })
              }} className="w-full px-4 py-2.5 rounded-xl border border-warm/60 focus:ring-2 focus:ring-amber-warm/40 outline-none">
                <option value="">Pilih preset...</option>
                {PROVIDER_PRESETS.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
              </select>
            </div>

            {cForm.auth_type === 'chatgpt_session' ? (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-medium text-amber-800">🔑 Pilih metode koneksi ChatGPT:</p>
                  <p className="text-xs text-amber-700">Klik tombol di bawah untuk login otomatis via OAuth, atau paste token manual.</p>
                </div>

                <button onClick={async () => {
                  try {
                    const res = await axios.post('/api/ai/oauth/chatgpt/start')
                    window.open(res.data.url, '_blank', 'width=600,height=700')
                    toast.success('Tab login ChatGPT dibuka. Setelah login, config otomatis tersimpan.')
                  } catch (err: any) {
                    toast.error(err.response?.data?.error || 'Gagal memulai OAuth')
                  }
                }} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 text-white hover:bg-green-700 font-medium">
                  🔗 Login ChatGPT (OAuth - Otomatis)
                </button>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-warm/60"></div>
                  <span className="flex-shrink mx-3 text-xs text-navy/40">atau paste manual</span>
                  <div className="flex-grow border-t border-warm/60"></div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-navy/80 mb-1">Access Token (manual)</label>
                  <textarea value={cForm.session_token} onChange={e => setCForm({ ...cForm, session_token: e.target.value })}
                    placeholder="eyJhbGciOiJSUzI1NiI..."
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-warm/60 focus:ring-2 focus:ring-amber-warm/40 outline-none font-mono text-xs" />
                  <p className="text-xs text-navy/40 mt-1">Buka <code>https://chatgpt.com/api/auth/session</code> → copy accessToken</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-navy/80 mb-1">Model</label>
                  <select value={cForm.model} onChange={e => setCForm({ ...cForm, model: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-warm/60 focus:ring-2 focus:ring-amber-warm/40 outline-none">
                    <option value="auto">Auto (default)</option>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                    <option value="o4-mini">o4-mini</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-navy/80 mb-1">Base URL</label>
                  <input value={cForm.base_url} onChange={e => setCForm({ ...cForm, base_url: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                    className="w-full px-4 py-2.5 rounded-xl border border-warm/60 focus:ring-2 focus:ring-amber-warm/40 outline-none font-mono text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-navy/80 mb-1">API Key</label>
                  <input type="password" value={cForm.api_key} onChange={e => setCForm({ ...cForm, api_key: e.target.value })}
                    placeholder="sk-..."
                    className="w-full px-4 py-2.5 rounded-xl border border-warm/60 focus:ring-2 focus:ring-amber-warm/40 outline-none font-mono text-sm" />
                </div>

                <button onClick={handleFetchModels} disabled={fetchingModels || !cForm.base_url}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-indigo-300 text-amber-warm hover:bg-amber-soft/40 disabled:opacity-50">
                  {fetchingModels ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Ambil Daftar Model
                </button>

                <div>
                  <label className="block text-sm font-medium text-navy/80 mb-1">
                    Model Aktif {availableModels.length > 0 && <span className="text-xs text-mint">({availableModels.length} tersedia)</span>}
                  </label>
                  {availableModels.length > 0 ? (
                    <select value={cForm.model} onChange={e => setCForm({ ...cForm, model: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-warm/60 focus:ring-2 focus:ring-amber-warm/40 outline-none">
                      <option value="">Pilih model...</option>
                      {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  ) : (
                    <input value={cForm.model} onChange={e => setCForm({ ...cForm, model: e.target.value })}
                      placeholder="gpt-4o-mini atau ketik manual"
                      className="w-full px-4 py-2.5 rounded-xl border border-warm/60 focus:ring-2 focus:ring-amber-warm/40 outline-none font-mono text-sm" />
                  )}
                  <p className="text-xs text-navy/40 mt-1">Klik "Ambil Daftar Model" untuk auto-populate. Boleh juga ketik manual.</p>
                </div>
              </>
            )}

            <div className="flex gap-3">
              {editingId && (
                <button onClick={() => { setCForm({ id: 0, name: '', auth_type: 'apikey', base_url: '', api_key: '', session_token: '', model: '', active: false }); setEditingId(null); setAvailableModels([]) }}
                  className="flex-1 py-2.5 rounded-xl border border-warm/60 text-navy/70 hover:bg-cream-soft">Batal</button>
              )}
              <button onClick={handleSaveConfig} className="flex-1 py-2.5 rounded-xl gradient-warm text-white hover:shadow-warm">
                {editingId ? 'Update' : 'Simpan'}
              </button>
            </div>
          </div>

          {/* List */}
          <div className="bg-white rounded-2xl shadow-sm border border-warm/40 p-6 space-y-3">
            <h3 className="font-bold text-lg">Konfigurasi Tersimpan</h3>
            {configs.length === 0 ? (
              <div className="text-center py-8 text-navy/40 text-sm">Belum ada konfigurasi. Tambahkan di form sebelah.</div>
            ) : configs.map(c => (
              <div key={c.id} className={`rounded-xl border p-4 space-y-2 ${c.active ? 'border-green-300 bg-mint/10' : 'border-warm/60'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{c.name}</span>
                    {c.auth_type === 'chatgpt_session' && <span className="text-xs bg-coral/15 text-coral px-2 py-0.5 rounded-full">Session</span>}
                    {c.active && <span className="inline-flex items-center gap-1 text-xs bg-green-600 text-white px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Aktif</span>}
                  </div>
                </div>
                <div className="text-xs text-navy/60 font-mono truncate">{c.auth_type === 'chatgpt_session' ? 'chatgpt.com (free session)' : c.base_url}</div>
                <div className="text-xs text-navy/80">Model: <span className="font-mono">{c.model}</span></div>
                <div className="flex gap-2 pt-2">
                  {!c.active && (
                    <button onClick={() => handleActivate(c.id)} className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-green-600 text-white hover:bg-green-700">Aktifkan</button>
                  )}
                  <button onClick={() => handleEditConfig(c)} className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-indigo-300 text-amber-warm hover:bg-amber-soft/40">Edit</button>
                  <button onClick={() => handleDeleteConfig(c.id)} className="px-3 py-1.5 text-xs rounded-lg border border-rose/40 text-rose hover:bg-rose/10"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Generator Forms ── */}
      {activeFeature !== 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-warm/40 p-6 space-y-4">
            <h3 className="font-bold text-lg">Form</h3>

            {activeFeature === 'questions' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-navy/80 mb-1">Topik</label>
                  <input value={qForm.topic} onChange={e => setQForm({ ...qForm, topic: e.target.value })} placeholder="contoh: Trigonometri dasar"
                    className="w-full px-4 py-2.5 rounded-xl border border-warm/60 focus:ring-2 focus:ring-amber-warm/40 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-navy/80 mb-1">Mapel</label>
                    <select value={qForm.subject_id} onChange={e => {
                      const sid = e.target.value
                      const sub = subjects.find(s => String(s.id) === sid)
                      setQForm({ ...qForm, subject_id: sid, subject: sub?.name || '', level: sub?.level || '' })
                    }}
                      className="w-full px-4 py-2.5 rounded-xl border border-warm/60 focus:ring-2 focus:ring-amber-warm/40 outline-none">
                      <option value="">Pilih mapel...</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name} {s.level ? `(${s.level})` : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-navy/80 mb-1">Simpan ke Bank</label>
                    <select value={qForm.bank_id} onChange={e => setQForm({ ...qForm, bank_id: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-warm/60 focus:ring-2 focus:ring-amber-warm/40 outline-none">
                      <option value="">Tanpa bank (draft)</option>
                      {banks.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-navy/80 mb-1">Jumlah</label>
                    <input type="number" value={qForm.count} onChange={e => setQForm({ ...qForm, count: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-xl border border-warm/60 focus:ring-2 focus:ring-amber-warm/40 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-navy/80 mb-1">Tipe</label>
                    <select value={qForm.type} onChange={e => setQForm({ ...qForm, type: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-warm/60 focus:ring-2 focus:ring-amber-warm/40 outline-none">
                      <option value="pilihan_ganda">PG</option>
                      <option value="essay">Esai</option>
                      <option value="true_false">B/S</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-navy/80 mb-1">Tingkat</label>
                    <select value={qForm.difficulty} onChange={e => setQForm({ ...qForm, difficulty: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-warm/60 focus:ring-2 focus:ring-amber-warm/40 outline-none">
                      <option value="mudah">Mudah</option>
                      <option value="sedang">Sedang</option>
                      <option value="sulit">Sulit</option>
                    </select>
                  </div>
                </div>
                {qForm.bank_id && (
                  <div className="text-xs text-mint bg-mint/10 rounded-lg p-2.5">
                    ✓ Soal akan otomatis masuk ke bank: <b>{banks.find(b => b.id === Number(qForm.bank_id))?.title}</b>
                  </div>
                )}
              </>
            )}

            {activeFeature === 'essay' && (
              <div>
                <label className="block text-sm font-medium text-navy/80 mb-1">ID Attempt Ujian</label>
                <input value={eForm.exam_attempt_id} onChange={e => setEForm({ exam_attempt_id: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-warm/60 focus:ring-2 focus:ring-amber-warm/40 outline-none" />
              </div>
            )}

            {activeFeature === 'rpp' && (
              <>
                {['subject', 'class', 'topic', 'kurikulum', 'duration'].map(k => (
                  <div key={k}>
                    <label className="block text-sm font-medium text-navy/80 mb-1 capitalize">{k}</label>
                    <input value={(rForm as any)[k]} onChange={e => setRForm({ ...rForm, [k]: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-warm/60 focus:ring-2 focus:ring-amber-warm/40 outline-none" />
                  </div>
                ))}
              </>
            )}

            {activeFeature === 'prota' && (
              <>
                {['subject', 'class', 'kurikulum', 'tahun'].map(k => (
                  <div key={k}>
                    <label className="block text-sm font-medium text-navy/80 mb-1 capitalize">{k}</label>
                    <input value={(pForm as any)[k]} onChange={e => setPForm({ ...pForm, [k]: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-warm/60 focus:ring-2 focus:ring-amber-warm/40 outline-none" />
                  </div>
                ))}
              </>
            )}

            <button onClick={handleSubmit} disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl gradient-warm text-white hover:shadow-warm disabled:opacity-50 font-medium">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Generate
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-warm/40 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Hasil</h3>
              {(result || generatedQuestions.length > 0) && (
                <button onClick={copyResult} className="flex items-center gap-1 text-sm text-amber-warm hover:text-amber-warm">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Tersalin' : 'Salin'}
                </button>
              )}
            </div>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-navy/40 w-full">
                <Loader2 className="w-8 h-8 animate-spin mb-3" />
                <p className="text-sm text-navy/70 mb-3 text-center px-4">{jobMessage || 'AI sedang memproses...'}</p>
                {activeFeature === 'questions' && jobId !== null && (
                  <div className="w-full max-w-xs px-4">
                    <div className="h-2 bg-amber-soft/40 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-warm transition-all duration-500" style={{ width: `${jobProgress}%` }} />
                    </div>
                    <div className="text-xs text-navy/40 mt-1 text-center">{jobProgress}% • Job #{jobId}</div>
                  </div>
                )}
              </div>
            ) : generatedQuestions.length > 0 ? (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                <div className="bg-mint/10 border border-green-200 rounded-xl p-3 text-sm text-mint flex items-center gap-2">
                  <Check className="w-4 h-4" /> {result}
                  {qForm.bank_id && <span className="ml-auto text-xs">Tersimpan di bank</span>}
                </div>
                {generatedQuestions.map((q, i) => {
                  const opts = parseOptions(q.options)
                  return (
                    <div key={i} className="border border-warm/60 rounded-xl p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-semibold text-navy">Soal {i + 1}</div>
                        <div className="flex gap-1 text-xs">
                          <span className="px-2 py-0.5 rounded-full bg-amber-soft/40 text-amber-warm">{q.type}</span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{q.points || 10} pt</span>
                        </div>
                      </div>
                      <div className="text-sm text-navy whitespace-pre-wrap">{q.content}</div>
                      {opts.length > 0 && (
                        <div className="space-y-1 pt-1">
                          {opts.map((o: any, j: number) => (
                            <div key={j} className={`text-sm px-3 py-1.5 rounded-lg flex items-start gap-2 ${q.answer === o.key ? 'bg-mint/10 text-mint font-medium' : 'bg-cream-soft text-navy/80'}`}>
                              <span className="font-semibold">{o.key}.</span>
                              <span>{o.text}</span>
                              {q.answer === o.key && <Check className="w-4 h-4 ml-auto text-mint shrink-0" />}
                            </div>
                          ))}
                        </div>
                      )}
                      {opts.length === 0 && q.answer && (
                        <div className="text-sm bg-mint/10 text-mint rounded-lg px-3 py-2">
                          <span className="font-semibold">Kunci: </span>{q.answer}
                        </div>
                      )}
                      {q.explanation && (
                        <div className="text-xs text-navy/60 border-t pt-2 mt-2">
                          <b>Pembahasan:</b> {q.explanation}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : result ? (
              <pre className="text-xs bg-cream-soft rounded-xl p-4 whitespace-pre-wrap max-h-[600px] overflow-y-auto font-mono">{result}</pre>
            ) : (
              <div className="text-center py-12 text-navy/40 text-sm">Hasil akan muncul di sini</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
