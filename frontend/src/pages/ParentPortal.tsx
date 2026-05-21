import { useState, useEffect } from 'react'
import axios from 'axios'
import { GraduationCap, ClipboardCheck, BookOpen, User } from 'lucide-react'

export default function ParentPortal() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get('/api/parent/portal')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-warm border-t-indigo-600 rounded-full"></div></div>

  if (!data) return <div className="text-center py-20 text-navy/60">Gagal memuat data</div>

  const { student, attendance, raport } = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-amber-warm" />
          Portal Orang Tua
        </h1>
        <p className="text-navy/60">Pantau perkembangan anak Anda</p>
      </div>

      {/* Student Info */}
      <div className="bg-white rounded-2xl border p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-amber-soft rounded-full flex items-center justify-center">
            <User className="w-7 h-7 text-amber-warm" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-navy">{student.name}</h2>
            <p className="text-navy/60">NIS: {student.nis} | Kelas: {student.class?.name || '-'}</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-mint" />
            </div>
            <span className="text-sm text-navy/70">Hadir</span>
          </div>
          <p className="text-3xl font-bold text-mint">{attendance.hadir}</p>
        </div>
        <div className="bg-white rounded-2xl border p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-rose" />
            </div>
            <span className="text-sm text-navy/70">Alfa</span>
          </div>
          <p className="text-3xl font-bold text-rose">{attendance.alpha}</p>
        </div>
        <div className="bg-white rounded-2xl border p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-amber-warm" />
            </div>
            <span className="text-sm text-navy/70">Terlambat</span>
          </div>
          <p className="text-3xl font-bold text-amber-warm">{attendance.terlambat}</p>
        </div>
      </div>

      {/* Raport */}
      <div className="bg-white rounded-2xl border p-6">
        <h3 className="font-semibold text-navy flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-amber-warm" />
          Nilai Raport Terakhir
        </h3>
        {raport && raport.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-soft border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-navy/70">Mata Pelajaran</th>
                  <th className="text-center px-4 py-3 font-medium text-navy/70">Nilai</th>
                  <th className="text-center px-4 py-3 font-medium text-navy/70">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {raport.map((item: any, i: number) => (
                  <tr key={i} className="hover:bg-cream-soft">
                    <td className="px-4 py-3">{item.subject}</td>
                    <td className="px-4 py-3 text-center font-semibold">{item.score}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        item.grade === 'A' ? 'bg-mint/15 text-mint' :
                        item.grade === 'B' ? 'bg-sky-warm/15 text-sky-warm' :
                        item.grade === 'C' ? 'bg-amber-warm/15 text-amber-warm' :
                        'bg-rose/15 text-rose'
                      }`}>
                        {item.grade}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-navy/40 text-center py-6">Belum ada data raport</p>
        )}
      </div>
    </div>
  )
}
