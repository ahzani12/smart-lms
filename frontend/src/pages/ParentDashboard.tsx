import { useState, useEffect } from 'react'
import axios from 'axios'
import { User, BookOpen, ClipboardCheck, Award, TrendingUp } from 'lucide-react'

interface ExamScore {
  exam_title: string
  score: number | null
  status: string
  date: string
}

interface AttendanceSummary {
  total: number
  hadir: number
  izin: number
  sakit: number
  alpha: number
}

export default function ParentDashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get('/api/parent/dashboard').then(res => {
      setData(res.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-navy/40">Memuat...</div>
  if (!data) return <div className="text-center py-12 text-navy/40">Data tidak ditemukan</div>

  const { student, relation, scores, attendance, raports } = data
  const att: AttendanceSummary = attendance || { total: 0, hadir: 0, izin: 0, sakit: 0, alpha: 0 }
  const attendancePercent = att.total > 0 ? Math.round((att.hadir / att.total) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
            <User className="w-8 h-8" />
          </div>
          <div>
            <p className="text-white/70 text-sm">Portal Orang Tua ({relation})</p>
            <h1 className="text-2xl font-bold">{student?.name}</h1>
            <p className="text-white/80 text-sm">NIS: {student?.nis} • Kelas: {student?.class?.name || '-'}</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 text-mint mb-2">
            <ClipboardCheck className="w-5 h-5" />
            <span className="text-sm font-medium">Kehadiran</span>
          </div>
          <p className="text-2xl font-bold text-navy">{attendancePercent}%</p>
          <p className="text-xs text-navy/40">30 hari terakhir</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 text-sky-warm mb-2">
            <BookOpen className="w-5 h-5" />
            <span className="text-sm font-medium">Ujian</span>
          </div>
          <p className="text-2xl font-bold text-navy">{scores?.length || 0}</p>
          <p className="text-xs text-navy/40">Total ujian</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <Award className="w-5 h-5" />
            <span className="text-sm font-medium">Rata-rata</span>
          </div>
          <p className="text-2xl font-bold text-navy">
            {scores && scores.length > 0
              ? Math.round(scores.filter((s: ExamScore) => s.score !== null).reduce((a: number, b: ExamScore) => a + (b.score || 0), 0) / Math.max(scores.filter((s: ExamScore) => s.score !== null).length, 1))
              : '-'}
          </p>
          <p className="text-xs text-navy/40">Nilai ujian</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 text-rose mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-medium">Alpha</span>
          </div>
          <p className="text-2xl font-bold text-navy">{att.alpha}</p>
          <p className="text-xs text-navy/40">30 hari terakhir</p>
        </div>
      </div>

      {/* Attendance Detail */}
      <div className="bg-white rounded-2xl border p-6">
        <h2 className="font-semibold text-navy mb-4">Rekap Kehadiran (30 Hari)</h2>
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center p-3 rounded-xl bg-mint/10">
            <p className="text-xl font-bold text-mint">{att.hadir}</p>
            <p className="text-xs text-mint">Hadir</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-sky-warm/10">
            <p className="text-xl font-bold text-sky-warm">{att.izin}</p>
            <p className="text-xs text-sky-warm">Izin</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-amber-soft/40">
            <p className="text-xl font-bold text-amber-warm">{att.sakit}</p>
            <p className="text-xs text-amber-warm">Sakit</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-rose/10">
            <p className="text-xl font-bold text-rose">{att.alpha}</p>
            <p className="text-xs text-rose">Alpha</p>
          </div>
        </div>
      </div>

      {/* Recent Scores */}
      <div className="bg-white rounded-2xl border p-6">
        <h2 className="font-semibold text-navy mb-4">Nilai Ujian Terbaru</h2>
        {!scores || scores.length === 0 ? (
          <p className="text-navy/40 text-center py-4">Belum ada data ujian</p>
        ) : (
          <div className="space-y-3">
            {scores.map((s: ExamScore, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-cream-soft">
                <div>
                  <p className="font-medium text-navy">{s.exam_title}</p>
                  <p className="text-xs text-navy/40">{s.date}</p>
                </div>
                <div className="text-right">
                  {s.score !== null ? (
                    <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${
                      s.score >= 80 ? 'bg-mint/15 text-mint' :
                      s.score >= 60 ? 'bg-amber-warm/15 text-amber-warm' :
                      'bg-rose/15 text-rose'
                    }`}>
                      {s.score}
                    </span>
                  ) : (
                    <span className="text-xs text-navy/40">{s.status === 'submitted' ? 'Menunggu koreksi' : s.status}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Raport */}
      {raports && raports.length > 0 && (
        <div className="bg-white rounded-2xl border p-6">
          <h2 className="font-semibold text-navy mb-4">Raport</h2>
          {raports.map((r: any) => (
            <div key={r.id} className="mb-4 last:mb-0">
              <p className="text-sm font-medium text-amber-warm mb-2">{r.semester?.name || 'Semester'}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-cream-soft">
                      <th className="px-3 py-2 text-left">Mapel</th>
                      <th className="px-3 py-2 text-center">Nilai</th>
                      <th className="px-3 py-2 text-center">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.items?.map((item: any) => (
                      <tr key={item.id} className="border-t">
                        <td className="px-3 py-2">{item.subject?.name}</td>
                        <td className="px-3 py-2 text-center font-medium">{item.score}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            item.grade === 'A' ? 'bg-mint/15 text-mint' :
                            item.grade === 'B' ? 'bg-sky-warm/15 text-sky-warm' :
                            item.grade === 'C' ? 'bg-amber-warm/15 text-amber-warm' :
                            'bg-rose/15 text-rose'
                          }`}>{item.grade}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
