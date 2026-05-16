import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Key, Download, RefreshCw, Users, Edit2, Check, X } from 'lucide-react'

export default function ParentAccessPage() {
  const [accesses, setAccesses] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [classFilter, setClassFilter] = useState(0)
  const [generateClassId, setGenerateClassId] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editData, setEditData] = useState({ parent_name: '', phone: '', relation: '' })

  const fetchAccesses = () => {
    const params: any = {}
    if (classFilter > 0) params.class_id = classFilter
    axios.get('/api/parent-access', { params }).then(r => setAccesses(r.data || []))
  }

  useEffect(() => {
    axios.get('/api/classes').then(r => setClasses(r.data?.classes || r.data || []))
  }, [])

  useEffect(() => { fetchAccesses() }, [classFilter])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await axios.post('/api/parent-access/generate', { class_id: generateClassId || undefined })
      toast.success(res.data.message)
      fetchAccesses()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal generate')
    }
    setGenerating(false)
  }

  const handleExportCSV = () => {
    window.open('/api/parent-access/export-csv', '_blank')
  }

  const handleRegenerate = async (id: number) => {
    if (!confirm('Kode lama akan tidak berlaku. Lanjutkan?')) return
    try {
      await axios.post(`/api/parent-access/${id}/regenerate`)
      toast.success('Kode baru digenerate')
      fetchAccesses()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal regenerate')
    }
  }

  const startEdit = (item: any) => {
    setEditId(item.id)
    setEditData({ parent_name: item.parent_name, phone: item.phone, relation: item.relation })
  }

  const saveEdit = async () => {
    try {
      await axios.put(`/api/parent-access/${editId}`, editData)
      toast.success('Data ortu diupdate')
      setEditId(null)
      fetchAccesses()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal update')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Key className="w-6 h-6 text-indigo-600" />
          Kode Akses Orang Tua
        </h1>
        <p className="text-gray-500">Generate dan kelola kode akses untuk login portal orang tua</p>
      </div>

      {/* Generate Section */}
      <div className="bg-white rounded-2xl border p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Generate Kode Akses</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Kelas (kosong = semua)</label>
            <select value={generateClassId} onChange={e => setGenerateClassId(Number(e.target.value))}
              className="px-4 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value={0}>Semua Kelas</option>
              {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">
            <Users className="w-4 h-4" />
            {generating ? 'Generating...' : 'Generate Kode'}
          </button>
          <button onClick={handleExportCSV}
            className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Siswa yang sudah punya kode tidak akan digenerate ulang. Gunakan tombol regenerate per siswa jika perlu ganti kode.
        </p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">Filter:</span>
        <select value={classFilter} onChange={e => setClassFilter(Number(e.target.value))}
          className="px-3 py-1.5 rounded-lg border text-sm">
          <option value={0}>Semua Kelas</option>
          {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Siswa</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">NIS</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Kelas</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Kode Akses</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nama Ortu</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">No HP</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Relasi</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {accesses.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{item.student_name}</td>
                  <td className="px-4 py-3 text-gray-600">{item.nis}</td>
                  <td className="px-4 py-3 text-gray-600">{item.class_name}</td>
                  <td className="px-4 py-3">
                    <code className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-mono text-base">
                      {item.access_code}
                    </code>
                  </td>
                  {editId === item.id ? (
                    <>
                      <td className="px-4 py-3">
                        <input value={editData.parent_name} onChange={e => setEditData({...editData, parent_name: e.target.value})}
                          className="w-full px-2 py-1 border rounded text-sm" placeholder="Nama ortu" />
                      </td>
                      <td className="px-4 py-3">
                        <input value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})}
                          className="w-full px-2 py-1 border rounded text-sm" placeholder="08xxx" />
                      </td>
                      <td className="px-4 py-3">
                        <select value={editData.relation} onChange={e => setEditData({...editData, relation: e.target.value})}
                          className="px-2 py-1 border rounded text-sm">
                          <option value="">-</option>
                          <option value="ayah">Ayah</option>
                          <option value="ibu">Ibu</option>
                          <option value="wali">Wali</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 flex gap-1">
                        <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-50 rounded">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditId(null)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-gray-600">{item.parent_name || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{item.phone || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{item.relation || '-'}</td>
                      <td className="px-4 py-3 flex gap-1">
                        <button onClick={() => startEdit(item)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Edit data ortu">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleRegenerate(item.id)} className="p-1 text-orange-600 hover:bg-orange-50 rounded" title="Generate kode baru">
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {accesses.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Belum ada kode akses. Generate dulu.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
