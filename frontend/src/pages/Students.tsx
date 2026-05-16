import CRUDPage from '../components/CRUDPage'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Students() {
  const [classes, setClasses] = useState<any[]>([])
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importClassId, setImportClassId] = useState<string>('')
  const [importing, setImporting] = useState(false)

  useEffect(() => { axios.get('/api/classes/').then(r => setClasses(r.data || [])) }, [])

  const handleImport = async () => {
    if (!importText.trim()) {
      toast.error('Data siswa kosong')
      return
    }
    setImporting(true)
    try {
      // Parse: each line is a student name, or JSON array
      let students: any[] = []
      const trimmed = importText.trim()
      if (trimmed.startsWith('[')) {
        // JSON format
        students = JSON.parse(trimmed)
      } else {
        // Simple format: one name per line
        const lines = trimmed.split('\n').filter(l => l.trim())
        students = lines.map(name => ({
          name: name.trim(),
          class_id: importClassId ? Number(importClassId) : undefined,
        }))
      }
      // Add class_id if set and not already in data
      if (importClassId) {
        students = students.map(s => ({ ...s, class_id: s.class_id || Number(importClassId) }))
      }
      const res = await axios.post('/api/students/import', { students })
      toast.success(res.data.message || 'Import berhasil')
      setShowImport(false)
      setImportText('')
      setImportClassId('')
      // Reload page to refresh list
      window.location.reload()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Import gagal')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      <CRUDPage
        title="Siswa"
        endpoint="students"
        columns={[
          { key: 'student_id', label: 'ID Siswa', render: (_, row) => row.user?.student_id || '-' },
          { key: 'nis', label: 'NIS' },
          { key: 'name', label: 'Nama', render: (_, row) => row.user?.name || '-' },
          { key: 'class_name', label: 'Kelas', render: (_, row) => row.class?.name || '-' },
          { key: 'gender', label: 'JK' },
        ]}
        formFields={[
          { key: 'name', label: 'Nama Lengkap' },
          { key: 'nis', label: 'NIS' },
          { key: 'nisn', label: 'NISN' },
          { key: 'gender', label: 'Jenis Kelamin', type: 'select', options: [{ label: 'Laki-laki', value: 'L' }, { label: 'Perempuan', value: 'P' }] },
          { key: 'class_id', label: 'Kelas', type: 'select', options: classes.map(c => ({ label: c.name, value: c.id })) },
        ]}
        extraActions={
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition"
          >
            <Upload className="w-4 h-4" />
            Import Siswa
          </button>
        }
      />

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Import Siswa</h3>
              <button onClick={() => setShowImport(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kelas (opsional)</label>
                <select
                  value={importClassId}
                  onChange={e => setImportClassId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">-- Pilih Kelas --</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data Siswa (satu nama per baris, atau JSON)
                </label>
                <textarea
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                  placeholder={'Ahmad Rizki\nDewi Lestari\nBudi Santoso\n\natau JSON:\n[{"name":"Ahmad","nis":"001","nisn":"0012345678","gender":"L"}]'}
                />
              </div>

              <p className="text-xs text-gray-500">
                Setiap siswa akan mendapat ID Siswa 6 digit otomatis dan password default: siswa123
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowImport(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
                >
                  Batal
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
                >
                  {importing ? 'Mengimport...' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
