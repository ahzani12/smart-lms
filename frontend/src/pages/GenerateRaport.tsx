import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { FileText, Zap, CheckCircle } from 'lucide-react'

export default function GenerateRaport() {
  const [classes, setClasses] = useState<any[]>([])
  const [semesters, setSemesters] = useState<any[]>([])
  const [classId, setClassId] = useState(0)
  const [semesterId, setSemesterId] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    axios.get('/api/classes').then(r => setClasses(r.data?.classes || r.data || []))
    axios.get('/api/semesters').then(r => setSemesters(r.data || []))
  }, [])

  const handleGenerate = async () => {
    if (!classId || !semesterId) {
      toast.error('Pilih kelas dan semester')
      return
    }
    if (!confirm('Generate raport akan menghitung ulang semua nilai. Lanjutkan?')) return

    setGenerating(true)
    setResult(null)
    try {
      const res = await axios.post('/api/generate-raport', {
        class_id: classId,
        semester_id: semesterId
      })
      setResult(res.data)
      toast.success(res.data.message)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal generate raport')
    }
    setGenerating(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-indigo-600" />
          Generate Raport
        </h1>
        <p className="text-gray-500">Hitung nilai akhir dan generate raport otomatis berdasarkan komponen yang sudah diatur</p>
      </div>

      <div className="bg-white rounded-2xl border p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
            <select value={classId} onChange={e => setClassId(Number(e.target.value))}
              className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value={0}>Pilih Kelas...</option>
              {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
            <select value={semesterId} onChange={e => setSemesterId(Number(e.target.value))}
              className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value={0}>Pilih Semester...</option>
              {semesters.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-1">
          <p className="font-medium text-gray-700">Cara kerja:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Sistem mengambil semua komponen raport yang sudah diatur</li>
            <li>Komponen manual: diambil dari nilai yang sudah diinput guru</li>
            <li>Komponen ujian: otomatis dihitung rata-rata dari hasil ujian (UTS/UAS)</li>
            <li>Nilai akhir = jumlah (nilai × bobot) per komponen</li>
            <li>Grade otomatis: A (≥90), B (≥80), C (≥70), D (&lt;70)</li>
          </ul>
        </div>

        <button onClick={handleGenerate} disabled={generating || !classId || !semesterId}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
          <Zap className="w-5 h-5" />
          {generating ? 'Generating...' : 'Generate Raport'}
        </button>

        {result && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 text-green-700">
            <CheckCircle className="w-6 h-6" />
            <div>
              <p className="font-medium">{result.message}</p>
              <p className="text-sm">Raport berhasil digenerate untuk {result.generated} siswa</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
