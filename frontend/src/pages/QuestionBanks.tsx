import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  Plus, Search, Trash2, Loader2, X, ArrowLeft, BookOpen, Layers,
  ChevronRight, ChevronDown, Check, Filter, Edit2,
  FileDown, FileUp, AlertCircle,
} from 'lucide-react'

type View = 'list' | 'detail'

interface Subject { id: number; name: string; code: string; level?: string }
interface Topic {
  id: number; subject_id: number; parent_id?: number | null
  code: string; name: string; level: string; order: number
  children?: Topic[]
}
interface Question {
  id: number; subject_id: number; level: string; type: string
  content: string; options?: string; answer: string; explanation?: string
  difficulty: string; points: number
  subject?: Subject; topics?: Topic[]
}
interface Bank {
  id: number; title: string; description: string
  subject_id: number; level: string; visibility: string
  subject?: Subject
  item_count?: number
}
interface BankItem {
  id: number; question_bank_id: number; question_id: number
  order: number; question?: Question
}

const DIFF_COLOR: Record<string, string> = {
  mudah: 'bg-mint/15 text-mint',
  sedang: 'bg-amber-warm/15 text-amber-warm',
  sulit: 'bg-rose/15 text-rose',
}

export default function QuestionBanks() {
  const [view, setView] = useState<View>('list')
  const [banks, setBanks] = useState<Bank[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editBank, setEditBank] = useState<Bank | null>(null)
  const [form, setForm] = useState<any>({ title: '', description: '', subject_id: '', level: 'X' })
  const [activeBankId, setActiveBankId] = useState<number | null>(null)

  useEffect(() => {
    axios.get('/api/subjects').then(r => setSubjects(r.data || []))
    fetchBanks()
  }, [])

  const fetchBanks = () => {
    setLoading(true)
    axios.get('/api/question-banks').then(r => {
      setBanks(Array.isArray(r.data) ? r.data : [])
    }).finally(() => setLoading(false))
  }

  const openCreate = () => {
    setEditBank(null)
    setForm({ title: '', description: '', subject_id: subjects[0]?.id || '', level: 'X', visibility: 'private' })
    setShowModal(true)
  }

  const openEdit = (b: Bank) => {
    setEditBank(b)
    setForm({ title: b.title, description: b.description, subject_id: b.subject_id, level: b.level, visibility: b.visibility })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.title || !form.subject_id) {
      toast.error('Judul dan mapel wajib diisi')
      return
    }
    try {
      if (editBank) {
        await axios.put(`/api/question-banks/${editBank.id}`, form)
        toast.success('Bank diupdate')
      } else {
        await axios.post('/api/question-banks', { ...form, subject_id: Number(form.subject_id) })
        toast.success('Bank dibuat')
      }
      setShowModal(false)
      fetchBanks()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Gagal')
    }
  }

  const del = async (id: number) => {
    if (!confirm('Yakin hapus bank ini? Soal di pool tetap ada.')) return
    try {
      await axios.delete(`/api/question-banks/${id}`)
      toast.success('Dihapus')
      fetchBanks()
    } catch { toast.error('Gagal menghapus') }
  }

  const filtered = banks.filter(b =>
    b.title?.toLowerCase().includes(search.toLowerCase()) ||
    b.subject?.name?.toLowerCase().includes(search.toLowerCase())
  )

  if (view === 'detail' && activeBankId) {
    return <BankDetail bankId={activeBankId} subjects={subjects} onBack={() => { setView('list'); fetchBanks() }} />
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">Bank Soal</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 gradient-warm text-white rounded-xl hover:bg-amber-warm">
          <Plus className="w-4 h-4" /> Bank Baru
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-navy/40" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari bank soal..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-warm/60 focus:ring-2 focus:ring-amber-warm/40 outline-none" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-warm" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-warm/40 p-12 text-center text-navy/40">
          Belum ada bank soal. Klik "Bank Baru" untuk mulai.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(b => (
            <div key={b.id} className="bg-white rounded-2xl border border-warm/40 p-5 hover:shadow-md transition cursor-pointer group"
              onClick={() => { setActiveBankId(b.id); setView('detail') }}>
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 bg-amber-soft/40 rounded-lg"><BookOpen className="w-5 h-5 text-amber-warm" /></div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(b) }}
                    className="p-1.5 hover:bg-amber-soft/40 rounded"><Edit2 className="w-4 h-4 text-navy/60" /></button>
                  <button onClick={(e) => { e.stopPropagation(); del(b.id) }}
                    className="p-1.5 hover:bg-rose/10 rounded"><Trash2 className="w-4 h-4 text-rose" /></button>
                </div>
              </div>
              <div className="font-semibold text-navy mb-1">{b.title}</div>
              {b.description && <div className="text-sm text-navy/60 mb-3 line-clamp-2">{b.description}</div>}
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="px-2 py-0.5 bg-amber-soft/40 text-amber-warm rounded">{b.subject?.name || '-'}</span>
                <span className="px-2 py-0.5 bg-amber-soft/40 text-navy/70 rounded">{b.level || '-'}</span>
                <span className="text-navy/40 ml-auto">{b.item_count ?? 0} soal</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{editBank ? 'Edit' : 'Buat'} Bank Soal</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-amber-soft/40 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="block text-sm font-medium text-navy/80 mb-1">Judul</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-warm/60" />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy/80 mb-1">Mapel</label>
              <select value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-warm/60">
                <option value="">Pilih mapel...</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-navy/80 mb-1">Jenjang</label>
                <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-warm/60">
                  <option value="X">X</option><option value="XI">XI</option><option value="XII">XII</option>
                  <option value="all">Semua</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-navy/80 mb-1">Visibility</label>
                <select value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-warm/60">
                  <option value="private">Private</option>
                  <option value="school">Sekolah</option>
                  <option value="public">Public</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-navy/80 mb-1">Deskripsi</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3} className="w-full px-4 py-2.5 rounded-xl border border-warm/60" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-warm/60 hover:bg-cream-soft">Batal</button>
              <button onClick={save} className="flex-1 py-2.5 rounded-xl gradient-warm text-white hover:shadow-warm">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// BANK DETAIL — Topic tree + pool picker
// ════════════════════════════════════════════════════════════════

function BankDetail({ bankId, subjects, onBack }: { bankId: number; subjects: Subject[]; onBack: () => void }) {
  const [bank, setBank] = useState<Bank | null>(null)
  const [items, setItems] = useState<BankItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [showQEdit, setShowQEdit] = useState(false)
  const [editQ, setEditQ] = useState<Question | null>(null)
  const [showImport, setShowImport] = useState(false)

  const load = async () => {
    setLoading(true)
    const res = await axios.get(`/api/question-banks/${bankId}`)
    setBank(res.data.bank)
    setItems(res.data.items || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [bankId])

  const removeItem = async (itemId: number) => {
    if (!confirm('Hapus soal dari bank? Soal tetap ada di pool.')) return
    try {
      await axios.delete(`/api/question-banks/${bankId}/items/${itemId}`)
      toast.success('Dihapus dari bank')
      load()
    } catch { toast.error('Gagal') }
  }

  if (loading || !bank) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-amber-warm" /></div>
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-amber-soft/40"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-navy">{bank.title}</h1>
          <div className="text-sm text-navy/60">{bank.subject?.name} • {bank.level} • {items.length} soal</div>
        </div>
        <button onClick={() => { setEditQ(null); setShowQEdit(true) }}
          className="px-4 py-2 bg-white border border-warm/60 text-navy/80 rounded-xl hover:bg-cream-soft flex items-center gap-2">
          <Plus className="w-4 h-4" /> Soal Baru
        </button>
        <a
          href="/api/question-banks/template-docx"
          className="px-4 py-2 bg-white border border-warm/60 text-navy/80 rounded-xl hover:bg-cream-soft flex items-center gap-2"
          title="Download template Word untuk diisi soal"
        >
          <FileDown className="w-4 h-4" /> Template
        </a>
        <button onClick={() => setShowImport(true)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 flex items-center gap-2">
          <FileUp className="w-4 h-4" /> Import Word
        </button>
        <button onClick={() => setShowPicker(true)}
          className="px-4 py-2 gradient-warm text-white rounded-xl hover:bg-amber-warm flex items-center gap-2">
          <Layers className="w-4 h-4" /> Pilih dari Pool
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-warm/40 p-12 text-center text-navy/40">
          Bank ini masih kosong. Tambah soal baru atau pilih dari pool.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((it, idx) => (
            <div key={it.id} className="bg-white rounded-2xl border border-warm/40 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-none w-8 h-8 rounded-lg bg-amber-soft/40 text-amber-warm font-semibold flex items-center justify-center text-sm">{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs px-2 py-0.5 bg-amber-soft/40 rounded">{it.question?.type || '-'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${DIFF_COLOR[it.question?.difficulty || ''] || 'bg-amber-soft/40'}`}>
                      {it.question?.difficulty || '-'}
                    </span>
                    <span className="text-xs text-navy/40">{it.question?.points || 0} poin</span>
                    {it.question?.topics?.map(t => (
                      <span key={t.id} className="text-xs px-2 py-0.5 bg-purple-50 text-coral rounded">{t.code} {t.name}</span>
                    ))}
                  </div>
                  <div className="text-sm text-navy whitespace-pre-wrap">{it.question?.content}</div>
                  {it.question?.options && (
                    <div className="mt-2 text-xs text-navy/60">
                      Pilihan tersedia, jawaban: <span className="font-semibold text-navy/80">{it.question?.answer}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditQ(it.question!); setShowQEdit(true) }}
                    className="p-1.5 hover:bg-amber-soft/40 rounded"><Edit2 className="w-4 h-4 text-navy/60" /></button>
                  <button onClick={() => removeItem(it.id)}
                    className="p-1.5 hover:bg-rose/10 rounded"><Trash2 className="w-4 h-4 text-rose" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showPicker && (
        <PoolPicker
          bankId={bankId}
          subjectId={bank.subject_id}
          existingIds={new Set(items.map(i => i.question_id))}
          onClose={() => setShowPicker(false)}
          onDone={() => { setShowPicker(false); load() }}
        />
      )}

      {showQEdit && (
        <QuestionEditor
          bankId={bankId}
          subjectId={bank.subject_id}
          level={bank.level}
          question={editQ}
          subjects={subjects}
          onClose={() => setShowQEdit(false)}
          onSaved={() => { setShowQEdit(false); load() }}
        />
      )}

      {showImport && (
        <ImportDocxModal
          bankId={bankId}
          bankTitle={bank.title}
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); load() }}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// POOL PICKER — filter + topic tree + multi-select
// ════════════════════════════════════════════════════════════════

function PoolPicker({ bankId, subjectId, existingIds, onClose, onDone }:
  { bankId: number; subjectId: number; existingIds: Set<number>; onClose: () => void; onDone: () => void }) {
  const [topics, setTopics] = useState<Topic[]>([])
  const [expandedTopics, setExpandedTopics] = useState<Set<number>>(new Set())
  const [activeTopic, setActiveTopic] = useState<number | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [filters, setFilters] = useState<any>({ difficulty: '', type: '', search: '' })
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [showTopicModal, setShowTopicModal] = useState(false)

  useEffect(() => { loadTopics() }, [subjectId])
  useEffect(() => { loadQuestions() }, [subjectId, activeTopic, filters, page])

  const loadTopics = async () => {
    const res = await axios.get('/api/topics', { params: { subject_id: subjectId } })
    setTopics(res.data || [])
  }

  const loadQuestions = async () => {
    setLoading(true)
    const params: any = { subject_id: subjectId, page, limit: 20 }
    if (activeTopic) params.topic_id = activeTopic
    if (filters.difficulty) params.difficulty = filters.difficulty
    if (filters.type) params.type = filters.type
    if (filters.search) params.search = filters.search
    try {
      const res = await axios.get('/api/questions/pool', { params })
      setQuestions(res.data.data || [])
      setTotal(res.data.total || 0)
    } finally { setLoading(false) }
  }

  const toggle = (id: number) => {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const addSelected = async () => {
    if (selected.size === 0) return
    try {
      const res = await axios.post(`/api/question-banks/${bankId}/items`, { question_ids: Array.from(selected) })
      toast.success(res.data.message)
      onDone()
    } catch { toast.error('Gagal menambah') }
  }

  // Build tree from flat list
  const rootTopics = topics.filter(t => !t.parent_id)
  const childrenOf = (pid: number) => topics.filter(t => t.parent_id === pid)

  const renderTopic = (t: Topic, depth = 0) => {
    const kids = childrenOf(t.id)
    const isOpen = expandedTopics.has(t.id)
    const isActive = activeTopic === t.id
    return (
      <div key={t.id}>
        <div className={`flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer text-sm ${isActive ? 'bg-amber-soft text-amber-warm font-medium' : 'hover:bg-amber-soft/40'}`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => { setActiveTopic(isActive ? null : t.id); setPage(1) }}>
          {kids.length > 0 ? (
            <button onClick={(e) => {
              e.stopPropagation()
              setExpandedTopics(prev => {
                const n = new Set(prev)
                n.has(t.id) ? n.delete(t.id) : n.add(t.id)
                return n
              })
            }} className="p-0.5">
              {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          ) : <span className="w-4" />}
          <span className="font-mono text-xs text-navy/40">{t.code}</span>
          <span className="truncate">{t.name}</span>
        </div>
        {isOpen && kids.map(k => renderTopic(k, depth + 1))}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold">Pilih Soal dari Pool</h2>
          <button onClick={onClose} className="p-1 hover:bg-amber-soft/40 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left: Topic tree */}
          <div className="w-64 border-r flex flex-col">
            <div className="p-3 border-b flex items-center justify-between">
              <div className="text-xs font-semibold text-navy/60 uppercase">Topik / KD</div>
              <button onClick={() => setShowTopicModal(true)}
                className="p-1 hover:bg-amber-soft/40 rounded" title="Tambah topik baru">
                <Plus className="w-4 h-4 text-navy/60" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-2 space-y-0.5">
              <div className={`px-2 py-1.5 rounded-lg cursor-pointer text-sm ${!activeTopic ? 'bg-amber-soft text-amber-warm font-medium' : 'hover:bg-amber-soft/40'}`}
                onClick={() => { setActiveTopic(null); setPage(1) }}>
                Semua Topik
              </div>
              {rootTopics.map(t => renderTopic(t))}
              {topics.length === 0 && (
                <div className="text-center text-xs text-navy/40 py-4">Belum ada topik</div>
              )}
            </div>
          </div>

          {/* Right: Questions */}
          <div className="flex-1 flex flex-col">
            <div className="p-3 border-b flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy/40" />
                <input value={filters.search}
                  onChange={e => { setFilters({ ...filters, search: e.target.value }); setPage(1) }}
                  placeholder="Cari soal..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-warm/60 text-sm" />
              </div>
              <select value={filters.difficulty}
                onChange={e => { setFilters({ ...filters, difficulty: e.target.value }); setPage(1) }}
                className="px-3 py-1.5 rounded-lg border border-warm/60 text-sm">
                <option value="">Semua Kesulitan</option>
                <option value="mudah">Mudah</option>
                <option value="sedang">Sedang</option>
                <option value="sulit">Sulit</option>
              </select>
              <select value={filters.type}
                onChange={e => { setFilters({ ...filters, type: e.target.value }); setPage(1) }}
                className="px-3 py-1.5 rounded-lg border border-warm/60 text-sm">
                <option value="">Semua Tipe</option>
                <option value="pilihan_ganda">Pilgan</option>
                <option value="essay">Essay</option>
                <option value="benar_salah">Benar/Salah</option>
              </select>
            </div>

            <div className="flex-1 overflow-auto p-3 space-y-2">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-amber-warm" /></div>
              ) : questions.length === 0 ? (
                <div className="text-center text-navy/40 py-8 text-sm">Tidak ada soal yang cocok.</div>
              ) : questions.map(q => {
                const isIn = existingIds.has(q.id)
                const isSel = selected.has(q.id)
                return (
                  <div key={q.id}
                    onClick={() => !isIn && toggle(q.id)}
                    className={`p-3 rounded-lg border cursor-pointer text-sm ${
                      isIn ? 'bg-cream-soft border-warm/60 opacity-60 cursor-not-allowed' :
                      isSel ? 'bg-amber-soft/40 border-indigo-300 ring-1 ring-amber-warm/30' : 'bg-white border-warm/60 hover:border-indigo-300'
                    }`}>
                    <div className="flex items-start gap-2">
                      <div className={`flex-none w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 ${
                        isIn ? 'bg-green-100 border-green-300' :
                        isSel ? 'gradient-warm border-amber-warm' : 'border-warm/60'
                      }`}>
                        {(isSel || isIn) && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap text-xs">
                          <span className="px-1.5 py-0.5 bg-amber-soft/40 rounded">{q.type}</span>
                          <span className={`px-1.5 py-0.5 rounded ${DIFF_COLOR[q.difficulty] || 'bg-amber-soft/40'}`}>{q.difficulty}</span>
                          <span className="text-navy/40">{q.points}p</span>
                          {isIn && <span className="text-mint font-medium">sudah di bank</span>}
                          {q.topics?.map(t => (
                            <span key={t.id} className="px-1.5 py-0.5 bg-purple-50 text-coral rounded">{t.code}</span>
                          ))}
                        </div>
                        <div className="text-navy line-clamp-2">{q.content}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="p-3 border-t flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-navy/60">
                <Filter className="w-4 h-4" />
                {total} soal • {selected.size} dipilih
              </div>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-warm/60 disabled:opacity-40">Prev</button>
                <span className="text-sm text-navy/60">hal {page}</span>
                <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-warm/60 disabled:opacity-40">Next</button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-warm/60 hover:bg-cream-soft">Batal</button>
          <button onClick={addSelected} disabled={selected.size === 0}
            className="px-6 py-2 rounded-xl gradient-warm text-white hover:shadow-warm disabled:opacity-50">
            Tambahkan {selected.size > 0 && `(${selected.size})`}
          </button>
        </div>

        {showTopicModal && (
          <TopicEditor
            subjectId={subjectId}
            parentOptions={topics}
            onClose={() => setShowTopicModal(false)}
            onSaved={() => { setShowTopicModal(false); loadTopics() }}
          />
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// TOPIC EDITOR — create new topic
// ════════════════════════════════════════════════════════════════

function TopicEditor({ subjectId, parentOptions, onClose, onSaved }:
  { subjectId: number; parentOptions: Topic[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<any>({ code: '', name: '', level: 'X', parent_id: '', order: 1 })
  const save = async () => {
    if (!form.name) { toast.error('Nama wajib'); return }
    try {
      await axios.post('/api/topics', {
        ...form, subject_id: subjectId,
        parent_id: form.parent_id ? Number(form.parent_id) : null,
        order: Number(form.order),
      })
      toast.success('Topik dibuat')
      onSaved()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Gagal') }
  }
  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Topik Baru</h3>
          <button onClick={onClose} className="p-1 hover:bg-amber-soft/40 rounded"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Kode</label>
            <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}
              placeholder="BAB1 / 3.1" className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm mb-1">Jenjang</label>
            <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg">
              <option value="X">X</option><option value="XI">XI</option><option value="XII">XII</option><option value="all">Semua</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1">Nama</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm mb-1">Parent (opsional)</label>
          <select value={form.parent_id} onChange={e => setForm({ ...form, parent_id: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg">
            <option value="">— Root —</option>
            {parentOptions.map(t => <option key={t.id} value={t.id}>{t.code} {t.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border">Batal</button>
          <button onClick={save} className="flex-1 py-2 rounded-xl gradient-warm text-white">Simpan</button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// QUESTION EDITOR — create/edit soal dengan topics
// ════════════════════════════════════════════════════════════════

function QuestionEditor({ bankId, subjectId, level, question, onClose, onSaved }:
  { bankId: number; subjectId: number; level: string; question: Question | null; subjects: Subject[]; onClose: () => void; onSaved: () => void }) {
  const [topics, setTopics] = useState<Topic[]>([])
  const [form, setForm] = useState<any>(() => {
    if (question) {
      let opts: any[] = []
      try { opts = JSON.parse(question.options || '[]') } catch {}
      return {
        type: question.type, content: question.content,
        options: opts.length ? opts : [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }],
        answer: question.answer, explanation: question.explanation || '',
        difficulty: question.difficulty, points: question.points,
        topic_ids: question.topics?.map(t => t.id) || [],
      }
    }
    return {
      type: 'pilihan_ganda', content: '',
      options: [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }],
      answer: 'A', explanation: '', difficulty: 'sedang', points: 10, topic_ids: [],
    }
  })

  useEffect(() => {
    axios.get('/api/topics', { params: { subject_id: subjectId } }).then(r => setTopics(r.data || []))
  }, [subjectId])

  const save = async () => {
    if (!form.content) { toast.error('Konten soal wajib'); return }
    try {
      const payload: any = {
        subject_id: subjectId, level, type: form.type,
        content: form.content,
        options: form.type === 'pilihan_ganda' ? JSON.stringify(form.options) : '',
        answer: form.answer, explanation: form.explanation,
        difficulty: form.difficulty, points: Number(form.points),
        topic_ids: form.topic_ids,
      }
      if (question) {
        await axios.put(`/api/questions/${question.id}`, payload)
        toast.success(`Soal diupdate`)
      } else {
        payload.bank_id = bankId
        await axios.post('/api/questions', payload)
        toast.success('Soal dibuat')
      }
      onSaved()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Gagal') }
  }

  const toggleTopic = (id: number) => {
    setForm((f: any) => ({
      ...f,
      topic_ids: f.topic_ids.includes(id) ? f.topic_ids.filter((x: number) => x !== id) : [...f.topic_ids, id],
    }))
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-bold">{question ? 'Edit' : 'Buat'} Soal</h2>
          <button onClick={onClose} className="p-1 hover:bg-amber-soft/40 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1">Tipe</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg">
                <option value="pilihan_ganda">Pilihan Ganda</option>
                <option value="essay">Essay</option>
                <option value="benar_salah">Benar/Salah</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Kesulitan</label>
              <select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg">
                <option value="mudah">Mudah</option>
                <option value="sedang">Sedang</option>
                <option value="sulit">Sulit</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Poin</label>
              <input type="number" value={form.points} onChange={e => setForm({ ...form, points: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">Pertanyaan</label>
            <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
              rows={4} className="w-full px-3 py-2 border rounded-lg" />
          </div>

          {form.type === 'pilihan_ganda' && (
            <div>
              <label className="block text-sm mb-1">Pilihan</label>
              <div className="space-y-2">
                {form.options.map((opt: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <button onClick={() => setForm({ ...form, answer: opt.key })}
                      className={`w-8 h-8 rounded-lg font-semibold text-sm ${form.answer === opt.key ? 'bg-mint/15 text-mint ring-2 ring-green-400' : 'bg-amber-soft/40 text-navy/60'}`}
                      title="Tandai sebagai jawaban benar">
                      {opt.key}
                    </button>
                    <input value={opt.text}
                      onChange={e => {
                        const o = [...form.options]; o[i] = { ...o[i], text: e.target.value }
                        setForm({ ...form, options: o })
                      }}
                      className="flex-1 px-3 py-2 border rounded-lg" placeholder={`Pilihan ${opt.key}`} />
                  </div>
                ))}
              </div>
              <div className="text-xs text-navy/40 mt-1">Klik huruf untuk menandai jawaban benar.</div>
            </div>
          )}

          {(form.type === 'essay' || form.type === 'benar_salah') && (
            <div>
              <label className="block text-sm mb-1">Jawaban{form.type === 'benar_salah' ? ' (benar/salah)' : ''}</label>
              <input value={form.answer} onChange={e => setForm({ ...form, answer: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" />
            </div>
          )}

          <div>
            <label className="block text-sm mb-1">Penjelasan (opsional)</label>
            <textarea value={form.explanation} onChange={e => setForm({ ...form, explanation: e.target.value })}
              rows={2} className="w-full px-3 py-2 border rounded-lg" />
          </div>

          <div>
            <label className="block text-sm mb-1">Topik / KD</label>
            <div className="flex flex-wrap gap-2">
              {topics.length === 0 && <span className="text-xs text-navy/40">Belum ada topik. Buat dulu lewat tombol di pool picker.</span>}
              {topics.map(t => (
                <button key={t.id} onClick={() => toggleTopic(t.id)}
                  className={`px-2 py-1 rounded-lg text-xs font-medium ${form.topic_ids.includes(t.id) ? 'bg-coral text-white' : 'bg-amber-soft/40 text-navy/70'}`}>
                  {t.code} {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border">Batal</button>
          <button onClick={save} className="px-6 py-2 rounded-xl gradient-warm text-white hover:shadow-warm">
            {question ? 'Update' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// IMPORT DOCX MODAL — preview + commit
// ════════════════════════════════════════════════════════════════

interface ParsedQ {
  number: number
  type: string
  difficulty: string
  points: number
  content: string
  options?: { key: string; text: string }[]
  answer: string
  explanation?: string
  accepted_answers?: string
  keywords?: string
  errors?: string[]
}

const TYPE_LABEL: Record<string, string> = {
  pilihan_ganda: 'Pilihan Ganda',
  essay: 'Essay',
  true_false: 'Benar/Salah',
  fill_blank: 'Isian',
}

const DIFF_BADGE: Record<string, string> = {
  mudah: 'bg-emerald-100 text-emerald-700',
  sedang: 'bg-amber-soft/60 text-amber-warm',
  sulit: 'bg-rose-100 text-rose-700',
}

function ImportDocxModal({ bankId, bankTitle, onClose, onDone }: {
  bankId: number
  bankTitle: string
  onClose: () => void
  onDone: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [preview, setPreview] = useState<ParsedQ[] | null>(null)
  const [stats, setStats] = useState<{ total: number; valid: number; with_errors: number } | null>(null)

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.docx')) {
      toast.error('File harus .docx')
      return
    }
    setFile(f)
    setPreview(null)
    setStats(null)
  }

  const doPreview = async () => {
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await axios.post(
        `/api/question-banks/${bankId}/import-docx-preview`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      setPreview(res.data.questions || [])
      setStats({ total: res.data.total, valid: res.data.valid, with_errors: res.data.with_errors })
      if ((res.data.valid || 0) === 0) {
        toast.error('Semua soal punya error. Cek detail di bawah.')
      } else {
        toast.success(`${res.data.valid} dari ${res.data.total} soal valid`)
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal parse file')
    }
    setUploading(false)
  }

  const doCommit = async () => {
    if (!preview) return
    const valid = preview.filter(q => !q.errors || q.errors.length === 0)
    if (valid.length === 0) {
      toast.error('Tidak ada soal valid untuk disimpan')
      return
    }
    setCommitting(true)
    try {
      const res = await axios.post(`/api/question-banks/${bankId}/import-docx-commit`, {
        questions: preview,
      })
      toast.success(res.data.message || `${res.data.created} soal disimpan`)
      onDone()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Commit gagal')
    }
    setCommitting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-warm/40 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-navy flex items-center gap-2">
              <FileUp className="w-5 h-5 text-emerald-600" /> Import Soal dari Word
            </h2>
            <div className="text-sm text-navy/60">Bank: {bankTitle}</div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-cream-soft rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!preview && (
            <>
              <div className="bg-amber-soft/30 border border-warm/40 rounded-xl p-4 text-sm text-navy/70">
                <div className="font-semibold mb-1">Cara pakai:</div>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Download <a href="/api/question-banks/template-docx" className="text-emerald-600 underline">template Word</a> kalau belum punya.</li>
                  <li>Edit di MS Word / Google Docs / LibreOffice. Tambah / hapus blok <code className="bg-white px-1 rounded">=== SOAL N ===</code>.</li>
                  <li>Save sebagai <strong>.docx</strong>, lalu upload di sini.</li>
                  <li>Preview soal yang ke-parse, fix error kalau ada, lalu Simpan.</li>
                </ol>
              </div>

              <label className="block">
                <div className="text-sm font-medium text-navy/80 mb-2">File .docx</div>
                <input
                  type="file"
                  accept=".docx"
                  onChange={onPickFile}
                  className="block w-full text-sm text-navy/70 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-emerald-600 file:text-white file:cursor-pointer hover:file:bg-emerald-700"
                />
              </label>

              {file && (
                <div className="bg-cream-soft border border-warm/40 rounded-xl p-3 flex items-center justify-between text-sm">
                  <span>📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                  <button onClick={() => setFile(null)} className="text-rose-600 hover:underline">Hapus</button>
                </div>
              )}

              <button
                onClick={doPreview}
                disabled={!file || uploading}
                className="w-full bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold"
              >
                {uploading ? <><Loader2 className="w-5 h-5 animate-spin" /> Parsing...</> : <><FileUp className="w-5 h-5" /> Preview Soal</>}
              </button>
            </>
          )}

          {preview && stats && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-cream-soft border border-warm/40 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-navy">{stats.total}</div>
                  <div className="text-xs text-navy/60">Total Soal</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-700">{stats.valid}</div>
                  <div className="text-xs text-emerald-700">Valid</div>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-rose-700">{stats.with_errors}</div>
                  <div className="text-xs text-rose-700">Ada Error</div>
                </div>
              </div>

              {/* Question list */}
              <div className="space-y-2">
                {preview.map((q, idx) => (
                  <div
                    key={idx}
                    className={`border rounded-xl p-3 ${q.errors?.length ? 'border-rose-300 bg-rose-50/40' : 'border-warm/40 bg-white'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-none w-8 h-8 rounded-lg bg-cream-soft text-navy/70 font-semibold flex items-center justify-center text-sm">
                        {q.number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap text-xs">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">
                            {TYPE_LABEL[q.type] || q.type || '?'}
                          </span>
                          <span className={`px-2 py-0.5 rounded ${DIFF_BADGE[q.difficulty] || 'bg-amber-soft/40'}`}>
                            {q.difficulty}
                          </span>
                          <span className="text-navy/40">{q.points} poin</span>
                        </div>
                        <div className="text-sm text-navy mb-1 line-clamp-2">{q.content}</div>
                        {q.options && q.options.length > 0 && (
                          <div className="text-xs text-navy/60 grid grid-cols-2 gap-1 mt-1">
                            {q.options.map(o => (
                              <div key={o.key}>
                                <span className="font-mono">{o.key}.</span> {o.text}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="text-xs text-navy/60 mt-1">
                          <span className="font-medium">Jawaban:</span> {q.answer || <em className="text-rose-500">kosong</em>}
                        </div>
                        {q.keywords && (
                          <div className="text-xs text-navy/60">
                            <span className="font-medium">Kata kunci:</span> {q.keywords.split('\n').join(', ')}
                          </div>
                        )}
                        {q.accepted_answers && (
                          <div className="text-xs text-navy/60">
                            <span className="font-medium">Alternatif:</span> {q.accepted_answers.split('\n').join(', ')}
                          </div>
                        )}
                        {q.errors && q.errors.length > 0 && (
                          <div className="mt-2 flex items-start gap-1.5 text-xs text-rose-700 bg-white border border-rose-200 rounded p-2">
                            <AlertCircle className="w-3.5 h-3.5 flex-none mt-0.5" />
                            <div>{q.errors.join(' • ')}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {preview && (
          <div className="px-6 py-4 border-t border-warm/40 flex items-center justify-between gap-3">
            <button
              onClick={() => { setPreview(null); setStats(null); setFile(null) }}
              className="px-4 py-2 text-navy/70 hover:bg-cream-soft rounded-xl"
            >
              ← Upload ulang
            </button>
            <button
              onClick={doCommit}
              disabled={committing || (stats?.valid || 0) === 0}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
            >
              {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Simpan {stats?.valid || 0} Soal
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
