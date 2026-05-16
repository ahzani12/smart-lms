import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Plus, Search, Edit2, Trash2, Loader2, X } from 'lucide-react'

interface Column { key: string; label: string; render?: (val: any, row: any) => string }

export default function CRUDPage({ title, endpoint, columns, formFields, extraActions }: {
  title: string
  endpoint: string
  columns: Column[]
  formFields: { key: string; label: string; type?: string; options?: { label: string; value: any }[] }[]
  extraActions?: React.ReactNode
}) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState<any>({})

  const fetchData = () => {
    setLoading(true)
    axios.get(`/api/${endpoint}`).then(res => {
      setData(Array.isArray(res.data) ? res.data : res.data.data || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [endpoint])

  const handleSave = async () => {
    try {
      if (editItem) {
        await axios.put(`/api/${endpoint}/${editItem.id}`, form)
        toast.success('Berhasil diupdate')
      } else {
        await axios.post(`/api/${endpoint}`, form)
        toast.success('Berhasil ditambahkan')
      }
      setShowModal(false)
      setEditItem(null)
      setForm({})
      fetchData()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin hapus data ini?')) return
    try {
      await axios.delete(`/api/${endpoint}/${id}`)
      toast.success('Berhasil dihapus')
      fetchData()
    } catch { toast.error('Gagal menghapus') }
  }

  const openEdit = (item: any) => {
    setEditItem(item)
    setForm({ ...item })
    setShowModal(true)
  }

  const openCreate = () => {
    setEditItem(null)
    setForm({})
    setShowModal(true)
  }

  const filtered = data.filter(row =>
    columns.some(col => String(row[col.key] || '').toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <div className="flex items-center gap-2">
          {extraActions}
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition">
            <Plus className="w-4 h-4" /> Tambah
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {columns.map(col => <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{col.label}</th>)}
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {columns.map(col => (
                    <td key={col.key} className="px-6 py-4 text-sm text-gray-900">
                      {col.render ? col.render(row[col.key], row) : (row[col.key] || '-')}
                    </td>
                  ))}
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(row.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={columns.length + 1} className="px-6 py-8 text-center text-gray-400">Tidak ada data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{editItem ? 'Edit' : 'Tambah'} {title}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            {formFields.map(field => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                {field.type === 'select' ? (
                  <select value={form[field.key] || ''} onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="">Pilih...</option>
                    {field.options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea value={form[field.key] || ''} onChange={e => setForm({ ...form, [field.key]: e.target.value })} rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
                ) : (
                  <input type={field.type || 'text'} value={form[field.key] || ''} onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
                )}
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">Batal</button>
              <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
