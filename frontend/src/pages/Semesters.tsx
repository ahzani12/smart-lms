import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { CalendarClock, Plus, Edit2, Trash2, X, CheckCircle2 } from 'lucide-react'

interface Semester {
  id: number
  name: string
  year: string
  period: string
  start_date: string
  end_date: string
  active: boolean
}

export default function Semesters() {
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Semester | null>(null)
  const [form, setForm] = useState({ name: '', year: '', period: 'ganjil', start_date: '', end_date: '' })

  const load = () => {
    axios.get('/api/semesters').then(r => setSemesters(r.data || []))
  }

  useEffect(() => { load() }, [])

  // Auto-generate name from year + period
  const updateName = (year: string, period: string) => {
    const label = period === 'ganjil' ? 'Ganjil' : 'Genap'
    return `${label} ${year}`
  }

  const handleSave = async () => {
    if (!form.year || !form.period) {
      toast.error('Tahun pelajaran dan periode wajib diisi')
      return
    }
    if (!form.start_date || !form.end_date) {
      toast.error('Tanggal mulai dan selesai wajib diisi')
      return
    }

    const payload = {
      ...form,
      name: updateName(form.year, form.period),
    }

    try {
      if (editItem) {
        await axios.put(`/api/semesters/${editItem.id}`, payload)
        toast.success('Semester diupdate')
      } else {
        await axios.post('/api/semesters', payload)
        toast.success('Semester ditambahkan')
      }
      setShowModal(false)
      setEditItem(null)
      setForm({ name: '', year: '', period: 'ganjil', start_date: '', end_date: '' })
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin hapus semester ini?')) return
    try {
      await axios.delete(`/api/semesters/${id}`)
      toast.success('Semester dihapus')
      load()
    } catch { toast.error('Gagal menghapus') }
  }

  const handleSetActive = async (sem: Semester) => {
    try {
      await axios.put(`/api/semesters/${sem.id}`, { ...sem, active: true })
      toast.success(`${sem.name} diset sebagai semester aktif`)
      load()
    } catch { toast.error('Gagal mengaktifkan') }
  }

  const openEdit = (s: Semester) => {
    setEditItem(s)
    setForm({
      name: s.name,
      year: s.year,
      period: s.period,
      start_date: s.start_date ? s.start_date.split('T')[0] : '',
      end_date: s.end_date ? s.end_date.split('T')[0] : '',
    })
    setShowModal(true)
  }

  const openCreate = () => {
    setEditItem(null)
    setForm({ name: '', year: '', period: 'ganjil', start_date: '', end_date: '' })
    setShowModal(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-amber-warm" />
            Semester & Tahun Pelajaran
          </h1>
          <p className="text-navy/60">Kelola semester dan tahun pelajaran</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 gradient-warm text-white rounded-xl hover:bg-amber-warm">
          <Plus className="w-4 h-4" /> Tambah Semester
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {semesters.map(s => (
          <div key={s.id} className={`bg-white rounded-2xl border p-5 ${s.active ? 'ring-2 ring-amber-warm/40 border-warm' : ''}`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-navy">{s.name}</h3>
                <p className="text-sm text-navy/60">TP {s.year}</p>
              </div>
              {s.active && (
                <span className="px-2 py-0.5 bg-mint/15 text-mint rounded-full text-xs font-medium">Aktif</span>
              )}
            </div>
            <div className="mt-3 text-sm text-navy/70 space-y-1">
              <div>Periode: <span className="font-medium capitalize">{s.period}</span></div>
              <div>Mulai: {s.start_date ? new Date(s.start_date).toLocaleDateString('id-ID') : '-'}</div>
              <div>Selesai: {s.end_date ? new Date(s.end_date).toLocaleDateString('id-ID') : '-'}</div>
            </div>
            <div className="mt-4 flex gap-2">
              {!s.active && (
                <button onClick={() => handleSetActive(s)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-mint/10 text-mint rounded-lg hover:bg-green-100">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Aktifkan
                </button>
              )}
              <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-amber-soft/40 text-amber-warm">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg hover:bg-rose/10 text-rose">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {semesters.length === 0 && (
          <div className="col-span-full text-center py-12 text-navy/40">Belum ada semester. Tambah dulu.</div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{editItem ? 'Edit' : 'Tambah'} Semester</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-amber-soft/40 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            <div>
              <label className="block text-sm font-medium text-navy/80 mb-1">Tahun Pelajaran</label>
              <input type="text" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })}
                placeholder="2025/2026"
                className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-navy/80 mb-1">Periode</label>
              <select value={form.period} onChange={e => setForm({ ...form, period: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none">
                <option value="ganjil">Ganjil</option>
                <option value="genap">Genap</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-navy/80 mb-1">Tanggal Mulai</label>
              <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-navy/80 mb-1">Tanggal Selesai</label>
              <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none" />
            </div>

            <div className="bg-cream-soft rounded-xl p-3 text-sm text-navy/70">
              Nama otomatis: <span className="font-medium">{updateName(form.year || '...', form.period)}</span>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-warm/60 text-navy/70 hover:bg-cream-soft">Batal</button>
              <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl gradient-warm text-white hover:shadow-warm">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
