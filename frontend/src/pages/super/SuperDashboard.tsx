import { useEffect, useState } from 'react'
import axios from 'axios'
import { Building2, Users, GraduationCap, FileText, BarChart3 } from 'lucide-react'

interface Overview {
  total_schools: number
  total_students: number
  total_teachers: number
  total_exams: number
  school_stats: { id: number; name: string; students: number; teachers: number }[]
}

export default function SuperDashboard() {
  const [data, setData] = useState<Overview | null>(null)

  useEffect(() => {
    axios.get('/api/super/overview').then(r => setData(r.data))
  }, [])

  if (!data) return <div className="p-6 text-center text-navy/60">Memuat...</div>

  const cards = [
    { label: 'Total Sekolah', value: data.total_schools, icon: Building2, color: 'bg-amber-soft text-amber-warm' },
    { label: 'Total Siswa', value: data.total_students, icon: GraduationCap, color: 'bg-mint/15 text-mint' },
    { label: 'Total Guru', value: data.total_teachers, icon: Users, color: 'bg-blue-100 text-sky-warm' },
    { label: 'Total Ujian', value: data.total_exams, icon: FileText, color: 'bg-purple-100 text-coral' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="w-7 h-7 text-amber-warm" />
        <h1 className="text-2xl font-bold text-navy">Superadmin Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className="bg-white rounded-2xl shadow-sm border p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${c.color}`}>
              <c.icon className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-navy">{c.value}</div>
              <div className="text-sm text-navy/60">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-navy mb-4">Statistik Per Sekolah</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-navy/60">
                <th className="pb-3 font-medium">Sekolah</th>
                <th className="pb-3 font-medium text-center">Siswa</th>
                <th className="pb-3 font-medium text-center">Guru</th>
              </tr>
            </thead>
            <tbody>
              {data.school_stats?.map(s => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-3 font-medium text-navy">{s.name}</td>
                  <td className="py-3 text-center">{s.students}</td>
                  <td className="py-3 text-center">{s.teachers}</td>
                </tr>
              ))}
              {(!data.school_stats || data.school_stats.length === 0) && (
                <tr><td colSpan={3} className="py-6 text-center text-navy/40">Belum ada sekolah</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
