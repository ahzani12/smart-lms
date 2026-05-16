import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Building2, Plus, Pencil, Trash2, X } from 'lucide-react'

interface School {
  id: number
  name: string
  address: string
  phone: string
  email: string
  npsn: string
  level: string
  student_count: number
  teacher_count: number
  admin_count: number
}

const emptyForm = { name: '', address: '', phone: '', email: '', npsn: '', level: 'SMA' }

export default function SuperSchools() {
  const [schools, setSchools] = useState<School[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<School | null>(null)
  const [form, setForm] = useState(emptyForm)

  const load = () => axios.get('/api/super/schools').then(r => setSchools(r.data || []))
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true) }
  const openEdit = (s: School) => {
    setEditing(s)
    setForm({ name: s.name, address: s.address, phone: s.phone, email: s.email, npsn: s.npsn, level: s.level })
    setShowModal(true)
  }

  const handleSave = async () => {
    try {
      if (editing) {
        await axios.put(`/api/super/schools/${editing.id}`, form)
        toast.success('Sekolah diupdate')
      } else {
        await axios.post('/api/super/schools', form)
        toast.success('Sekolah dibuat')
      }
      setShowModal(false)
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan')
    }
  }

  const handleDelete = async (s: School) => {
    if (!confirm(`Hapus sekolah "${s.name}"?`)) return
    try {
      await axios.delete(`/api/super/schools/${s.id}`)
      toast.success('Sekolah dihapus')
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menghapus')
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-7 h-7 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Kelola Sekolah</h1>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> Tambah Sekolah
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Nama</th>
                <th className="px-4 py-3 font-medium">Level</th>
                <th className="px-4 py-3 font-medium">NPSN</th>
                <th className="px-4 py-3 font-medium text-center">Siswa</th>
                <th className="px-4 py-3 font-medium text-center">Guru</th>
                <th className="px-4 py-3 font-medium text-center">Admin</th>
                <th className="px-4 py-3 font-medium text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {schools.map(s => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{s.name}</div>
                    <div className="text-xs text-gray-500">{s.email}</div>
                  </td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium">{s.level}</span></td>
                  <td className="px-4 py-3 text-gray-600">{s.npsn}</td>
                  <td className="px-4 py-3 text-center">{s.student_count}</td>
                  <td className="px-4 py-3 text-center">{s.teacher_count}</td>
                  <td className="px-4 py-3 text-center">{s.admin_count}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(s)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {schools.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Belum ada sekolah</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{editing ? 'Edit Sekolah' : 'Tambah Sekolah'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Nama Sekolah" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
              <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Alamat" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Telepon" className="px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
                <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Email" className="px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input value={form.npsn} onChange={e => setForm({...form, npsn: e.target.value})} placeholder="NPSN" className="px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
                <select value={form.level} onChange={e => setForm({...form, level: e.target.value})} className="px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="SD">SD</option>
                  <option value="SMP">SMP</option>
                  <option value="SMA">SMA</option>
                  <option value="SMK">SMK</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50">Batal</button>
              <button onClick={handleSave} className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
