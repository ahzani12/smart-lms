import { useState, useEffect } from 'react'
import axios from 'axios'
import { Trophy, Medal, Crown, Filter } from 'lucide-react'

interface LeaderboardEntry {
  rank: number
  student_id: number
  name: string
  nis: string
  class_name: string
  avg_score: number
  total_exams: number
  best_score: number
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [exams, setExams] = useState<any[]>([])
  const [classFilter, setClassFilter] = useState(0)
  const [examFilter, setExamFilter] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (classFilter) params.class_id = classFilter
      if (examFilter) params.exam_id = examFilter
      const res = await axios.get('/api/leaderboard', { params })
      setEntries(res.data.leaderboard || [])
      setClasses(res.data.classes || [])
      setExams(res.data.exams || [])
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [classFilter, examFilter])

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-500" />
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />
    return <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-gray-500">{rank}</span>
  }

  const getRankBg = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200'
    if (rank === 2) return 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200'
    if (rank === 3) return 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200'
    return 'bg-white border-gray-100'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Trophy className="w-7 h-7 text-yellow-500" />
            Leaderboard
          </h1>
          <p className="text-gray-500">Ranking siswa berdasarkan rata-rata nilai ujian</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Filter className="w-4 h-4" />
          <span>Filter:</span>
        </div>
        <select
          value={classFilter}
          onChange={e => setClassFilter(Number(e.target.value))}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value={0}>Semua Kelas</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={examFilter}
          onChange={e => setExamFilter(Number(e.target.value))}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value={0}>Semua Ujian</option>
          {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </div>

      {/* Top 3 Podium */}
      {entries.length >= 3 && (
        <div className="grid grid-cols-3 gap-4">
          {[entries[1], entries[0], entries[2]].map((e, idx) => (
            <div key={e.student_id} className={`relative rounded-2xl border p-6 text-center ${
              idx === 1 ? 'bg-gradient-to-b from-yellow-50 to-white border-yellow-300 shadow-lg -mt-4' :
              idx === 0 ? 'bg-gradient-to-b from-gray-50 to-white border-gray-200' :
              'bg-gradient-to-b from-orange-50 to-white border-orange-200'
            }`}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                  idx === 1 ? 'bg-yellow-500' : idx === 0 ? 'bg-gray-400' : 'bg-amber-600'
                }`}>
                  {e.rank}
                </div>
              </div>
              <div className="mt-4">
                <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-indigo-600">{e.name.charAt(0)}</span>
                </div>
                <h3 className="font-semibold text-gray-900 truncate">{e.name}</h3>
                <p className="text-xs text-gray-500">{e.class_name}</p>
                <div className="mt-3">
                  <span className="text-2xl font-bold text-indigo-600">{e.avg_score}</span>
                  <span className="text-xs text-gray-400 ml-1">rata-rata</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{e.total_exams} ujian</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full List */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-16">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Siswa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kelas</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ujian</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rata-rata</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tertinggi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Memuat...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Belum ada data ujian</td></tr>
              ) : entries.map(e => (
                <tr key={e.student_id} className={`border-b last:border-0 ${getRankBg(e.rank)}`}>
                  <td className="px-4 py-3">{getRankIcon(e.rank)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-medium text-indigo-600">{e.name.charAt(0)}</span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{e.name}</div>
                        <div className="text-xs text-gray-400">{e.nis}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{e.class_name}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">{e.total_exams}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-sm font-semibold ${
                      e.avg_score >= 80 ? 'bg-green-100 text-green-700' :
                      e.avg_score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {e.avg_score}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm font-medium text-gray-700">{e.best_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
