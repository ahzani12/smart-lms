import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, BookOpen, Loader2, X, Search } from 'lucide-react'

interface Subject {
  id: number
  code: string
  name: string
  level: string
}

const LEVELS = ['', 'X', 'XI', 'XII', 'all']
const LEVEL_LABEL: Record<string, string> = {
  '': 'Semua',
  'X': 'Kelas X',
  'XI': 'Kelas XI',
  'XII': 'Kelas XII',
  'all': 'Semua Tingkat',
}

export default function Subjects() {
  const [items, setItems] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/subjects/')
      setItems(res.data || [])
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal memuat mata pelajaran')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Hapus mata pelajaran "${name}"?\n\nJadwal/nilai yang sudah memakai mapel ini bisa rusak.`)) return
    try {
      await axios.delete(`/api/subjects/${id}`)
      toast.success('Mata pelajaran dihapus')
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menghapus')
    }
  }

  const filtered = items.filter(s => {
    if (filterLevel && s.level !== filterLevel) return false
    if (search) {
      const q = search.toLowerCase()
      return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Mata Pelajaran</h1>
          <div className="text-sm text-navy/60">Kelola daftar mata pelajaran sekolah</div>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="px-4 py-2 rounded-xl gradient-warm text-white hover:shadow-warm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Tambah Mapel
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy/40" />
          <input
            type="text"
            placeholder="Cari nama atau kode..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-warm/60 rounded-xl text-sm bg-white"
          />
        </div>
        <select
          value={filterLevel}
          onChange={e => setFilterLevel(e.target.value)}
          className="px-3 py-2 border border-warm/60 rounded-xl text-sm bg-white"
        >
          {LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
        </select>
        <div className="text-xs text-navy/50 ml-auto">
          {filtered.length} dari {items.length} mapel
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-amber-warm" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-warm/40 p-12 text-center text-navy/40">
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-navy/25" />
          {items.length === 0
            ? 'Belum ada mata pelajaran. Klik "Tambah Mapel" untuk mulai.'
            : 'Tidak ada mapel yang cocok dengan filter.'}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-warm/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-soft border-b border-warm/40 text-navy">
              <tr>
                <th className="text-left px-4 py-3 font-bold">Kode</th>
                <th className="text-left px-4 py-3 font-bold">Nama Mata Pelajaran</th>
                <th className="text-left px-4 py-3 font-bold">Tingkat</th>
                <th className="text-right px-4 py-3 font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm/30">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-amber-soft/20">
                  <td className="px-4 py-3 font-mono text-xs text-navy/70">{s.code || '-'}</td>
                  <td className="px-4 py-3 font-medium text-navy">{s.name}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-md bg-amber-soft/50 text-navy text-xs font-semibold">
                      {s.level || 'all'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => { setEditing(s); setShowForm(true) }}
                        className="p-2 hover:bg-amber-soft/40 rounded-lg text-amber-warm"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id, s.name)}
                        className="p-2 hover:bg-rose/10 rounded-lg text-rose"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <SubjectForm
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}
    </div>
  )
}

export function SubjectForm({ initial, onClose, onSaved }: {
  initial: Subject | null
  onClose: () => void
  onSaved: (created?: Subject) => void
}) {
  const [form, setForm] = useState({
    code: initial?.code || '',
    name: initial?.name || '',
    level: initial?.level || 'all',
  })
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error('Nama mata pelajaran wajib diisi')
      return
    }
    setSaving(true)
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      level: form.level,
    }
    try {
      let saved: Subject | undefined
      if (initial) {
        await axios.put(`/api/subjects/${initial.id}`, payload)
        saved = { ...initial, ...payload }
      } else {
        const res = await axios.post('/api/subjects/', payload)
        saved = { id: res.data.id, ...payload }
      }
      toast.success(initial ? 'Mapel diupdate' : 'Mapel ditambahkan')
      onSaved(saved)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{initial ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-amber-soft/40 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-navy/70 font-semibold">Nama Mata Pelajaran *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Contoh: Matematika"
              autoFocus
              className="w-full px-3 py-2 border border-warm/60 rounded-xl text-sm mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-navy/70 font-semibold">Kode (opsional)</label>
              <input
                type="text"
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value })}
                placeholder="MTK"
                className="w-full px-3 py-2 border border-warm/60 rounded-xl text-sm mt-1 font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-navy/70 font-semibold">Tingkat</label>
              <select
                value={form.level}
                onChange={e => setForm({ ...form, level: e.target.value })}
                className="w-full px-3 py-2 border border-warm/60 rounded-xl text-sm mt-1"
              >
                <option value="all">Semua tingkat</option>
                <option value="X">Kelas X</option>
                <option value="XI">Kelas XI</option>
                <option value="XII">Kelas XII</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-warm/60 hover:bg-cream-soft">Batal</button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 rounded-xl gradient-warm text-white hover:shadow-warm disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : (initial ? 'Update' : 'Simpan')}
          </button>
        </div>
      </div>
    </div>
  )
}
