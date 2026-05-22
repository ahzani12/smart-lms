import CRUDPage from '../components/CRUDPage'
import ResetPasswordButton from '../components/ResetPasswordButton'
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
        rowExtraActions={(row) =>
          row.user?.id ? (
            <ResetPasswordButton
              userId={row.user.id}
              userName={row.user.name || 'Siswa'}
            />
          ) : null
        }
        extraActions={
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-mint text-white rounded-2xl hover:opacity-90 transition font-bold text-sm shadow-warm-sm"
          >
            <Upload className="w-4 h-4" strokeWidth={2.5} />
            Import
          </button>
        }
      />

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm flex items-end lg:items-center justify-center z-50 p-0 lg:p-4">
          <div className="bg-cream w-full max-w-lg rounded-t-3xl lg:rounded-3xl shadow-card-lg max-h-[92vh] overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-warm/40 flex items-center justify-between bg-white">
              <div>
                <h3 className="text-lg font-extrabold text-navy">Import Siswa</h3>
                <p className="text-xs text-navy/60 mt-0.5">Tambah banyak siswa sekaligus</p>
              </div>
              <button
                onClick={() => setShowImport(false)}
                className="p-2 rounded-xl hover:bg-amber-soft text-navy/60 hover:text-navy transition"
              >
                <X className="w-5 h-5" strokeWidth={2.4} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-extrabold text-navy uppercase tracking-wide mb-1.5">
                  Kelas (opsional)
                </label>
                <select
                  value={importClassId}
                  onChange={e => setImportClassId(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-warm/60 focus:ring-4 focus:ring-amber-warm/15 focus:border-amber-warm outline-none transition text-sm font-semibold text-navy"
                >
                  <option value="">— Pilih Kelas —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-navy uppercase tracking-wide mb-1.5">
                  Data Siswa
                </label>
                <textarea
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-warm/60 focus:ring-4 focus:ring-amber-warm/15 focus:border-amber-warm outline-none transition font-mono text-sm resize-none"
                  placeholder={'Satu nama per baris:\nAhmad Rizki\nDewi Lestari\nBudi Santoso\n\nAtau JSON:\n[{"name":"Ahmad","nis":"001","gender":"L"}]'}
                />
              </div>

              <div className="bg-amber-soft/50 border border-warm rounded-2xl p-3 text-xs text-navy/70 leading-relaxed">
                <span className="font-bold text-navy">Catatan:</span> Setiap siswa otomatis dapat ID 6 digit. Password default = <b>NIS</b> (atau ID Siswa kalau NIS kosong). Siswa wajib ganti password saat login pertama.
              </div>
            </div>

            <div className="px-6 py-4 bg-white border-t border-warm/40 flex gap-3 safe-bottom">
              <button
                onClick={() => setShowImport(false)}
                className="flex-1 py-3 rounded-2xl border-2 border-warm/60 text-navy font-bold text-sm hover:bg-amber-soft/40 transition"
              >
                Batal
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex-1 py-3 rounded-2xl bg-mint text-white font-bold text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {importing ? 'Mengimport...' : (<><Upload className="w-4 h-4" strokeWidth={2.5} /> Import</>)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
