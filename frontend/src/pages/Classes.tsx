import CRUDPage from '../components/CRUDPage'
import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Users, X, Plus, Trash2, Loader2, Search } from 'lucide-react'

function getLevelOptions(schoolLevel: string): { label: string; value: string }[] {
  switch (schoolLevel) {
    case 'TK': case 'RA':
      return [{ label: 'TK A', value: 'TK A' }, { label: 'TK B', value: 'TK B' }]
    case 'SD': case 'MI':
      return [
        { label: '1', value: '1' }, { label: '2', value: '2' }, { label: '3', value: '3' },
        { label: '4', value: '4' }, { label: '5', value: '5' }, { label: '6', value: '6' },
      ]
    case 'SMP': case 'MTs':
      return [{ label: '7', value: '7' }, { label: '8', value: '8' }, { label: '9', value: '9' }]
    case 'SMA': case 'SMK': case 'MA':
      return [{ label: '10', value: '10' }, { label: '11', value: '11' }, { label: '12', value: '12' }]
    default:
      return [{ label: '10', value: '10' }, { label: '11', value: '11' }, { label: '12', value: '12' }]
  }
}

export default function Classes() {
  const [teachers, setTeachers] = useState<any[]>([])
  const [manageClass, setManageClass] = useState<any>(null)
  const [schoolLevel, setSchoolLevel] = useState('')

  useEffect(() => {
    axios.get('/api/teachers/').then(r => setTeachers(r.data || []))
    axios.get('/api/school').then(r => setSchoolLevel(r.data?.level || ''))
  }, [])

  return (
    <>
      <CRUDPage
        title="Kelas"
        endpoint="classes"
        columns={[
          { key: 'name', label: 'Nama Kelas' },
          { key: 'level', label: 'Tingkat' },
          { key: 'major', label: 'Jurusan' },
          { key: 'capacity', label: 'Kapasitas' },
          { key: 'homeroom', label: 'Wali Kelas', render: (_, row) => row.teacher?.user?.name || '-' },
          { key: 'manage', label: 'Siswa', render: (_, row) => (
            <button onClick={(e) => { e.stopPropagation(); setManageClass(row) }}
              className="flex items-center gap-1 px-3 py-1.5 bg-mint/10 text-mint rounded-lg hover:bg-green-100 text-sm font-medium">
              <Users className="w-4 h-4" /> Kelola
            </button>
          )},
        ]}
        formFields={[
          { key: 'name', label: 'Nama Kelas' },
          { key: 'level', label: 'Tingkat', type: 'select', options: getLevelOptions(schoolLevel) },
          { key: 'major', label: 'Jurusan', type: 'select', options: [{ label: 'IPA', value: 'IPA' }, { label: 'IPS', value: 'IPS' }, { label: 'BAHASA', value: 'BAHASA' }] },
          { key: 'capacity', label: 'Kapasitas', type: 'number' },
          { key: 'teacher_id', label: 'Wali Kelas', type: 'select', options: teachers.map(t => ({ label: `${t.user?.name || '-'} (${t.nip})`, value: t.id })) },
        ]}
      />
      {manageClass && <ManageStudentsModal classData={manageClass} onClose={() => setManageClass(null)} />}
    </>
  )
}

function ManageStudentsModal({ classData, onClose }: { classData: any; onClose: () => void }) {
  const [classStudents, setClassStudents] = useState<any[]>([])
  const [unassigned, setUnassigned] = useState<any[]>([])
  const [allStudents, setAllStudents] = useState<any[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'current' | 'add'>('current')
  const [search, setSearch] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      const [cs, un, all] = await Promise.all([
        axios.get(`/api/classes/${classData.id}/students`),
        axios.get('/api/students/unassigned'),
        axios.get('/api/students/'),
      ])
      setClassStudents(cs.data || [])
      setUnassigned(un.data || [])
      setAllStudents((all.data || []).filter((s: any) => s.class_id !== classData.id))
    } catch { toast.error('Gagal load data') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const assignSelected = async () => {
    if (selected.size === 0) return toast.error('Pilih siswa dulu')
    setSaving(true)
    try {
      await axios.post(`/api/classes/${classData.id}/assign-students`, { student_ids: Array.from(selected) })
      toast.success(`${selected.size} siswa ditambahkan ke kelas`)
      setSelected(new Set())
      fetchData()
    } catch { toast.error('Gagal menambahkan') }
    finally { setSaving(false) }
  }

  const removeStudent = async (studentId: number) => {
    if (!confirm('Keluarkan siswa dari kelas ini?')) return
    try {
      await axios.post(`/api/classes/${classData.id}/unassign-students`, { student_ids: [studentId] })
      toast.success('Siswa dikeluarkan')
      fetchData()
    } catch { toast.error('Gagal mengeluarkan') }
  }

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = (students: any[]) => {
    const filtered = students.filter(s =>
      s.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.nis?.toLowerCase().includes(search.toLowerCase())
    )
    setSelected(new Set(filtered.map(s => s.id)))
  }

  const availableStudents = tab === 'add' ? [...unassigned, ...allStudents.filter(s => !unassigned.find((u: any) => u.id === s.id))] : []
  const filteredAvailable = availableStudents.filter(s =>
    s.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.nis?.toLowerCase().includes(search.toLowerCase())
  )
  const filteredCurrent = classStudents.filter(s =>
    s.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.nis?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Kelola Siswa &mdash; {classData.name}</h2>
            <p className="text-sm text-navy/60">{classStudents.length} siswa terdaftar</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-amber-soft/40 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex border-b">
          <button onClick={() => { setTab('current'); setSearch(''); setSelected(new Set()) }}
            className={`flex-1 py-3 text-sm font-medium ${tab === 'current' ? 'border-b-2 border-amber-warm text-amber-warm' : 'text-navy/60'}`}>
            Siswa di Kelas ({classStudents.length})
          </button>
          <button onClick={() => { setTab('add'); setSearch(''); setSelected(new Set()) }}
            className={`flex-1 py-3 text-sm font-medium ${tab === 'add' ? 'border-b-2 border-amber-warm text-amber-warm' : 'text-navy/60'}`}>
            <Plus className="w-4 h-4 inline mr-1" /> Tambah Siswa
          </button>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy/40" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama atau NIS..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-warm/60 text-sm focus:ring-2 focus:ring-amber-warm/40 outline-none" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-amber-warm" /></div>
          ) : tab === 'current' ? (
            filteredCurrent.length === 0 ? (
              <div className="text-center text-navy/40 py-8">Belum ada siswa di kelas ini</div>
            ) : (
              <div className="space-y-2">
                {filteredCurrent.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-warm/40 hover:bg-cream-soft">
                    <div>
                      <div className="font-medium text-sm">{s.user?.name || '-'}</div>
                      <div className="text-xs text-navy/40">NIS: {s.nis || '-'}</div>
                    </div>
                    <button onClick={() => removeStudent(s.id)} className="p-2 text-rose hover:bg-rose/10 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : (
            filteredAvailable.length === 0 ? (
              <div className="text-center text-navy/40 py-8">Semua siswa sudah punya kelas</div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-navy/60">{selected.size} dipilih</span>
                  <button onClick={() => selectAll(availableStudents)} className="text-xs text-amber-warm hover:underline">Pilih Semua</button>
                </div>
                {filteredAvailable.map(s => (
                  <div key={s.id} onClick={() => toggleSelect(s.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${selected.has(s.id) ? 'border-amber-warm bg-amber-soft/40' : 'border-warm/40 hover:bg-cream-soft'}`}>
                    <input type="checkbox" checked={selected.has(s.id)} readOnly
                      className="w-4 h-4 rounded border-warm/60 text-amber-warm" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{s.user?.name || '-'}</div>
                      <div className="text-xs text-navy/40">NIS: {s.nis || '-'} {s.class?.name ? `(sekarang: ${s.class.name})` : '(belum ada kelas)'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {tab === 'add' && selected.size > 0 && (
          <div className="p-4 border-t">
            <button onClick={assignSelected} disabled={saving}
              className="w-full py-2.5 gradient-warm text-white rounded-xl hover:bg-amber-warm disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Tambahkan {selected.size} Siswa ke Kelas
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
