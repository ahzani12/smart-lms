import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Settings, Plus, Trash2, Save, AlertCircle } from 'lucide-react'

interface Component {
  id: number
  name: string
  weight: number
  source_type: string
  exam_type: string
  sort_order: number
}

export default function ReportComponents() {
  const [components, setComponents] = useState<Component[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', weight: 0, source_type: 'manual', exam_type: '', sort_order: 0 })
  const [editId, setEditId] = useState<number | null>(null)

  const load = () => {
    axios.get('/api/report-components').then(r => setComponents(r.data || []))
  }

  useEffect(() => { load() }, [])

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0)

  const handleSave = async () => {
    if (!form.name || form.weight <= 0) {
      toast.error('Nama dan bobot wajib diisi')
      return
    }
    if (form.source_type === 'exam' && !form.exam_type) {
      toast.error('Pilih tipe ujian untuk sumber otomatis')
      return
    }

    try {
      if (editId) {
        await axios.put(`/api/report-components/${editId}`, form)
        toast.success('Komponen diupdate')
      } else {
        await axios.post('/api/report-components', form)
        toast.success('Komponen ditambahkan')
      }
      setShowForm(false)
      setEditId(null)
      setForm({ name: '', weight: 0, source_type: 'manual', exam_type: '', sort_order: 0 })
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan')
    }
  }

  const handleEdit = (c: Component) => {
    setForm({ name: c.name, weight: c.weight, source_type: c.source_type, exam_type: c.exam_type, sort_order: c.sort_order })
    setEditId(c.id)
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus komponen ini?')) return
    try {
      await axios.delete(`/api/report-components/${id}`)
      toast.success('Komponen dihapus')
      load()
    } catch {
      toast.error('Gagal menghapus')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <Settings className="w-6 h-6 text-amber-warm" />
            Komponen Raport
          </h1>
          <p className="text-navy/60">Atur komponen penilaian dan bobot untuk raport</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', weight: 0, source_type: 'manual', exam_type: '', sort_order: 0 }) }}
          className="flex items-center gap-2 px-4 py-2 gradient-warm text-white rounded-xl hover:bg-amber-warm">
          <Plus className="w-4 h-4" /> Tambah Komponen
        </button>
      </div>

      {/* Total Weight Warning */}
      {components.length > 0 && totalWeight !== 100 && (
        <div className={`flex items-center gap-2 p-4 rounded-xl ${totalWeight > 100 ? 'bg-rose/10 text-rose' : 'bg-amber-50 text-amber-700'}`}>
          <AlertCircle className="w-5 h-5" />
          <span>Total bobot: <strong>{totalWeight}%</strong> — {totalWeight > 100 ? 'melebihi' : 'belum mencapai'} 100%</span>
        </div>
      )}
      {components.length > 0 && totalWeight === 100 && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-mint/10 text-mint">
          <Save className="w-5 h-5" />
          <span>Total bobot: <strong>100%</strong> — sudah sesuai</span>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border p-6 space-y-4">
          <h3 className="font-semibold text-navy">{editId ? 'Edit' : 'Tambah'} Komponen</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-navy/80 mb-1">Nama Komponen *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Ulangan Harian, UTS, UAS, Sikap"
                className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy/80 mb-1">Bobot (%) *</label>
              <input type="number" min={1} max={100} value={form.weight || ''} onChange={e => setForm({ ...form, weight: Number(e.target.value) })}
                className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy/80 mb-1">Sumber Nilai</label>
              <select value={form.source_type} onChange={e => setForm({ ...form, source_type: e.target.value, exam_type: '' })}
                className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none">
                <option value="manual">Manual (guru input)</option>
                <option value="exam">Otomatis dari Ujian</option>
              </select>
            </div>
            {form.source_type === 'exam' && (
              <div>
                <label className="block text-sm font-medium text-navy/80 mb-1">Tipe Ujian</label>
                <select value={form.exam_type} onChange={e => setForm({ ...form, exam_type: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none">
                  <option value="">Pilih...</option>
                  <option value="ulangan_harian">Ulangan Harian</option>
                  <option value="uts">UTS</option>
                  <option value="uas">UAS</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-navy/80 mb-1">Urutan</label>
              <input type="number" min={0} value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })}
                className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave}
              className="px-6 py-2 gradient-warm text-white rounded-xl hover:bg-amber-warm">
              {editId ? 'Update' : 'Simpan'}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null) }}
              className="px-6 py-2 bg-amber-soft/40 text-navy/80 rounded-xl hover:bg-warm">Batal</button>
          </div>
        </div>
      )}

      {/* Components List */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-cream-soft border-b">
              <th className="px-4 py-3 text-left text-xs font-medium text-navy/60 uppercase">No</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-navy/60 uppercase">Komponen</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-navy/60 uppercase">Bobot</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-navy/60 uppercase">Sumber</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-navy/60 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {components.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-navy/40">Belum ada komponen. Tambahkan komponen penilaian.</td></tr>
            ) : components.map((c, i) => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-cream-soft">
                <td className="px-4 py-3 text-navy/60">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-navy">{c.name}</td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex px-3 py-1 rounded-full text-sm font-semibold bg-amber-soft/40 text-amber-warm">{c.weight}%</span>
                </td>
                <td className="px-4 py-3 text-center">
                  {c.source_type === 'manual' ? (
                    <span className="px-2 py-1 rounded-full text-xs bg-amber-soft/40 text-navy/70">Manual</span>
                  ) : (
                    <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-sky-warm">Ujian ({c.exam_type})</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => handleEdit(c)} className="p-2 text-amber-warm hover:bg-amber-soft/40 rounded-lg text-xs font-medium">Edit</button>
                    <button onClick={() => handleDelete(c.id)} className="p-2 text-rose hover:bg-rose/10 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
