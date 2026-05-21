import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Users, Plus, Trash2, Search } from 'lucide-react'

export default function Parents() {
  const [parents, setParents] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', student_id: 0, relation: 'ayah' })

  const load = () => {
    axios.get('/api/parents').then(r => setParents(r.data || []))
    axios.get('/api/students').then(r => setStudents(r.data?.students || r.data || []))
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password || !form.student_id) {
      toast.error('Lengkapi semua field wajib')
      return
    }
    try {
      await axios.post('/api/parents', form)
      toast.success('Akun orang tua berhasil dibuat')
      setShowForm(false)
      setForm({ name: '', email: '', phone: '', password: '', student_id: 0, relation: 'ayah' })
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal membuat akun')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus akun orang tua ini?')) return
    try {
      await axios.delete(`/api/parents/${id}`)
      toast.success('Akun dihapus')
      load()
    } catch {
      toast.error('Gagal menghapus')
    }
  }

  const filtered = parents.filter(p =>
    p.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.student?.user?.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-warm" />
            Orang Tua
          </h1>
          <p className="text-navy/60">Kelola akun orang tua/wali siswa</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 gradient-warm text-white rounded-xl hover:bg-amber-warm">
          <Plus className="w-4 h-4" /> Tambah
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border p-6 space-y-4">
          <h3 className="font-semibold text-navy">Buat Akun Orang Tua</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-navy/80 mb-1">Nama *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy/80 mb-1">Email *</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy/80 mb-1">No. HP</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy/80 mb-1">Password *</label>
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy/80 mb-1">Siswa *</label>
              <select value={form.student_id} onChange={e => setForm({ ...form, student_id: Number(e.target.value) })}
                className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none">
                <option value={0}>Pilih siswa...</option>
                {students.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.user?.name || s.name} - {s.nis}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-navy/80 mb-1">Hubungan</label>
              <select value={form.relation} onChange={e => setForm({ ...form, relation: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none">
                <option value="ayah">Ayah</option>
                <option value="ibu">Ibu</option>
                <option value="wali">Wali</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate}
              className="px-6 py-2 gradient-warm text-white rounded-xl hover:bg-amber-warm">Simpan</button>
            <button onClick={() => setShowForm(false)}
              className="px-6 py-2 bg-amber-soft/40 text-navy/80 rounded-xl hover:bg-warm">Batal</button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy/40" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama orang tua atau siswa..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-cream-soft border-b">
              <th className="px-4 py-3 text-left text-xs font-medium text-navy/60 uppercase">Orang Tua</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-navy/60 uppercase">Siswa</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-navy/60 uppercase">Hubungan</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-navy/60 uppercase">Email</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-navy/60 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-navy/40">Belum ada data orang tua</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-cream-soft">
                <td className="px-4 py-3 font-medium text-navy">{p.user?.name}</td>
                <td className="px-4 py-3 text-sm text-navy/70">
                  {p.student?.user?.name} <span className="text-navy/40">({p.student?.nis})</span>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-soft/40 text-amber-warm capitalize">{p.relation}</span>
                </td>
                <td className="px-4 py-3 text-sm text-navy/60">{p.user?.email}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => handleDelete(p.id)} className="p-2 text-rose hover:bg-rose/10 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
