import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Shield, Plus, Pencil, Trash2, Key, X } from 'lucide-react'

interface Admin {
  id: number
  name: string
  email: string
  role: string
  phone: string
  active: boolean
  school_id: number
  school?: { id: number; name: string }
}

interface School {
  id: number
  name: string
}

const emptyForm = { name: '', email: '', password: '', role: 'admin_pusat', phone: '', school_id: 0 }

export default function SuperAdmins() {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [filterSchool, setFilterSchool] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Admin | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [resetId, setResetId] = useState<number | null>(null)
  const [newPass, setNewPass] = useState('')

  const load = () => {
    const params = filterSchool ? `?school_id=${filterSchool}` : ''
    axios.get(`/api/super/admins${params}`).then(r => setAdmins(r.data || []))
  }
  useEffect(() => {
    axios.get('/api/super/schools').then(r => setSchools((r.data || []).map((s: any) => ({ id: s.id, name: s.name }))))
  }, [])
  useEffect(() => { load() }, [filterSchool])

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true) }
  const openEdit = (a: Admin) => {
    setEditing(a)
    setForm({ name: a.name, email: a.email, password: '', role: a.role, phone: a.phone, school_id: a.school_id })
    setShowModal(true)
  }

  const handleSave = async () => {
    try {
      if (editing) {
        const { password, ...data } = form
        await axios.put(`/api/super/admins/${editing.id}`, data)
        toast.success('Admin diupdate')
      } else {
        if (!form.password) { toast.error('Password wajib diisi'); return }
        if (!form.school_id) { toast.error('Pilih sekolah'); return }
        await axios.post('/api/super/admins', form)
        toast.success('Admin dibuat')
      }
      setShowModal(false)
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan')
    }
  }

  const handleDelete = async (a: Admin) => {
    if (!confirm(`Hapus admin "${a.name}"?`)) return
    try {
      await axios.delete(`/api/super/admins/${a.id}`)
      toast.success('Admin dihapus')
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menghapus')
    }
  }

  const handleResetPassword = async () => {
    if (!newPass || !resetId) return
    try {
      await axios.post(`/api/super/admins/${resetId}/reset-password`, { password: newPass })
      toast.success('Password direset')
      setResetId(null)
      setNewPass('')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal reset')
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Kelola Admin</h1>
        </div>
        <div className="flex items-center gap-3">
          <select value={filterSchool} onChange={e => setFilterSchool(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-sm">
            <option value="">Semua Sekolah</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Tambah Admin
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Nama</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Sekolah</th>
                <th className="px-4 py-3 font-medium text-center">Status</th>
                <th className="px-4 py-3 font-medium text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {admins.map(a => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                  <td className="px-4 py-3 text-gray-600">{a.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.role === 'admin_pusat' ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'}`}>
                      {a.role === 'admin_pusat' ? 'Admin Pusat' : 'Admin Cabang'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.school?.name || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.active ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      {a.active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => { setResetId(a.id); setNewPass('') }} className="p-1.5 rounded-lg hover:bg-yellow-50 text-yellow-600" title="Reset Password"><Key className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(a)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {admins.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Belum ada admin</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{editing ? 'Edit Admin' : 'Tambah Admin'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Nama" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
              <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Email" type="email" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
              {!editing && (
                <input value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Password" type="password" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
              )}
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Telepon" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="admin_pusat">Admin Pusat</option>
                  <option value="admin_cabang">Admin Cabang</option>
                </select>
                <select value={form.school_id} onChange={e => setForm({...form, school_id: Number(e.target.value)})} className="px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value={0}>Pilih Sekolah</option>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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

      {/* Reset Password Modal */}
      {resetId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold">Reset Password</h2>
            <input value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Password baru" type="password" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setResetId(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50">Batal</button>
              <button onClick={handleResetPassword} className="px-4 py-2 rounded-xl bg-yellow-500 text-white hover:bg-yellow-600">Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
