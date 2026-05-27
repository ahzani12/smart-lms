import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, Loader2, Users, X, Save, Tag, ArrowLeft, Search, UserPlus } from 'lucide-react'
import { formatRupiah } from '../../lib/billing'

type Potongan = {
  id: number
  nama: string
  kode: string
  deskripsi: string
  nominal: number
  aktif: boolean
  student_count?: number
}

type StudentPotongan = {
  id: number
  student_id: number
  potongan_id: number
  catatan: string
  student?: {
    id: number
    nama: string
    nis: string
    class_id: number
    class?: { id: number; name: string }
  }
}

type Student = {
  id: number
  nama: string
  nis: string
  class_id: number
  class?: { id: number; name: string }
}

export default function PotonganPage() {
  const [list, setList] = useState<Potongan[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Partial<Potongan> | null>(null)
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<Potongan | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const r = await axios.get('/api/billing/potongan')
      setList(r.data || [])
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Gagal memuat potongan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!edit?.nama) { toast.error('Nama wajib'); return }
    if (!edit?.nominal || edit.nominal <= 0) { toast.error('Nominal harus > 0'); return }
    setSaving(true)
    try {
      const payload = {
        nama: edit.nama,
        kode: edit.kode || '',
        deskripsi: edit.deskripsi || '',
        nominal: edit.nominal || 0,
        aktif: edit.aktif ?? true,
      }
      if (edit.id) {
        await axios.put(`/api/billing/potongan/${edit.id}`, payload)
      } else {
        await axios.post('/api/billing/potongan', payload)
      }
      toast.success('Tersimpan')
      setEdit(null)
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Gagal simpan')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    if (!confirm('Hapus potongan ini?\n\nSiswa yang sudah di-assign akan kehilangan potongan ini di tagihan SPP berikutnya.')) return
    try {
      await axios.delete(`/api/billing/potongan/${id}`)
      toast.success('Terhapus')
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Gagal hapus')
    }
  }

  if (detail) {
    return <PotonganDetail potongan={detail} onBack={() => { setDetail(null); load() }} />
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-soft flex items-center justify-center">
            <Tag className="w-6 h-6 text-amber-warm" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-navy">Potongan SPP</h1>
            <p className="text-sm text-navy/60">Master jenis keringanan/potongan untuk SPP siswa.</p>
          </div>
        </div>
        <button
          onClick={() => setEdit({ aktif: true })}
          className="px-4 py-2.5 gradient-warm text-white rounded-xl font-bold hover:shadow-warm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Tambah Potongan
        </button>
      </div>

      <div className="bg-amber-soft/30 border border-amber-warm/30 rounded-2xl p-4 mb-4 text-sm text-navy/80">
        <div className="font-bold mb-1">Cara kerja:</div>
        <ol className="list-decimal list-inside space-y-0.5 text-navy/70">
          <li>Buat jenis potongan (mis. "Yatim" Rp 50.000, "Anak Guru" Rp 100.000)</li>
          <li>Klik kartu potongan → assign ke siswa-siswa yang berhak</li>
          <li>Pastikan jenis tagihan SPP centang "Auto-apply Potongan Siswa"</li>
          <li>Saat generate SPP bulan baru, tagihan siswa otomatis dipotong</li>
        </ol>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-navy/60">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading...
        </div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-3xl border border-warm/60 p-10 text-center">
          <Tag className="w-12 h-12 text-navy/20 mx-auto mb-3" />
          <p className="text-navy/60 mb-4">Belum ada potongan SPP.</p>
          <button onClick={() => setEdit({ aktif: true })}
                  className="px-4 py-2 gradient-warm text-white rounded-xl font-bold">
            Tambah Pertama
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-warm/40 p-4 hover:shadow-card transition">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-navy text-lg truncate">{p.nama}</div>
                  {p.kode && <div className="text-xs font-mono text-navy/50">{p.kode}</div>}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  p.aktif ? 'bg-mint/15 text-mint' : 'bg-navy/10 text-navy/50'
                }`}>
                  {p.aktif ? 'AKTIF' : 'OFF'}
                </span>
              </div>
              <div className="text-2xl font-extrabold text-amber-warm mb-1">{formatRupiah(p.nominal)}</div>
              {p.deskripsi && <div className="text-xs text-navy/60 mb-2 line-clamp-2">{p.deskripsi}</div>}
              <div className="flex items-center justify-between pt-3 border-t border-warm/30">
                <button
                  onClick={() => setDetail(p)}
                  className="flex items-center gap-1.5 text-sm text-navy hover:text-amber-warm font-semibold"
                >
                  <Users className="w-4 h-4" />
                  {p.student_count || 0} siswa
                </button>
                <div className="flex gap-1">
                  <button onClick={() => setEdit(p)} className="p-1.5 rounded-lg hover:bg-amber-soft text-amber-warm">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(p.id)} className="p-1.5 rounded-lg hover:bg-rose/10 text-rose">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm flex items-end lg:items-center justify-center z-50 p-0 lg:p-4">
          <div className="bg-cream w-full max-w-lg rounded-t-3xl lg:rounded-3xl shadow-card-lg max-h-[92vh] overflow-hidden flex flex-col">
            <div className="bg-white border-b border-warm/60 px-5 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-navy">{edit.id ? 'Edit Potongan' : 'Tambah Potongan'}</h3>
              <button onClick={() => setEdit(null)} className="p-1.5 rounded-lg hover:bg-cream-soft">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto">
              <div>
                <label className="text-sm font-bold text-navy mb-1 block">Nama Potongan *</label>
                <input
                  value={edit.nama || ''}
                  onChange={e => setEdit({ ...edit, nama: e.target.value })}
                  placeholder="contoh: Yatim, Anak Guru, Saudara Kandung"
                  className="w-full px-4 py-3 rounded-xl border border-warm/60 bg-white focus:outline-none focus:border-amber-warm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-bold text-navy mb-1 block">Kode</label>
                  <input
                    value={edit.kode || ''}
                    onChange={e => setEdit({ ...edit, kode: e.target.value.toUpperCase() })}
                    placeholder="YTM"
                    maxLength={10}
                    className="w-full px-4 py-3 rounded-xl border border-warm/60 bg-white focus:outline-none focus:border-amber-warm font-mono"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-navy mb-1 block">Nominal Potongan *</label>
                  <input
                    type="number"
                    value={edit.nominal || ''}
                    onChange={e => setEdit({ ...edit, nominal: parseFloat(e.target.value) || 0 })}
                    placeholder="50000"
                    className="w-full px-4 py-3 rounded-xl border border-warm/60 bg-white focus:outline-none focus:border-amber-warm"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-navy mb-1 block">Deskripsi</label>
                <textarea
                  value={edit.deskripsi || ''}
                  onChange={e => setEdit({ ...edit, deskripsi: e.target.value })}
                  rows={2}
                  placeholder="Keringanan untuk siswa yatim atau dhuafa"
                  className="w-full px-4 py-3 rounded-xl border border-warm/60 bg-white focus:outline-none focus:border-amber-warm"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={edit.aktif ?? true}
                  onChange={e => setEdit({ ...edit, aktif: e.target.checked })}
                  className="w-5 h-5 accent-amber-warm"
                />
                <span className="font-bold text-navy">Aktif</span>
              </label>
            </div>
            <div className="bg-white border-t border-warm/60 px-5 py-3 flex justify-end gap-2 safe-bottom">
              <button onClick={() => setEdit(null)} className="px-4 py-2.5 rounded-xl font-bold text-navy/70 hover:bg-cream-soft">Batal</button>
              <button onClick={save} disabled={saving} className="px-5 py-2.5 gradient-warm text-white rounded-xl font-bold disabled:opacity-50 flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Detail page: list siswa + assign/unassign ───────────────────
function PotonganDetail({ potongan, onBack }: { potongan: Potongan; onBack: () => void }) {
  const [members, setMembers] = useState<StudentPotongan[]>([])
  const [loading, setLoading] = useState(true)
  const [showPicker, setShowPicker] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await axios.get(`/api/billing/potongan/${potongan.id}/students`)
      setMembers(r.data || [])
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Gagal memuat siswa')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const unassign = async (spID: number, name: string) => {
    if (!confirm(`Lepas ${name} dari potongan "${potongan.nama}"?`)) return
    try {
      await axios.delete(`/api/billing/potongan/student/${spID}`)
      toast.success('Siswa dilepas')
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Gagal lepas')
    }
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-navy/60 hover:text-navy mb-3"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali ke daftar potongan
      </button>

      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-soft flex items-center justify-center">
            <Tag className="w-6 h-6 text-amber-warm" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-navy">{potongan.nama}</h1>
            <p className="text-sm text-navy/60">Potongan {formatRupiah(potongan.nominal)} · {members.length} siswa</p>
          </div>
        </div>
        <button
          onClick={() => setShowPicker(true)}
          className="px-4 py-2.5 gradient-warm text-white rounded-xl font-bold hover:shadow-warm flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" /> Tambah Siswa
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-navy/60">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading...
        </div>
      ) : members.length === 0 ? (
        <div className="bg-white rounded-3xl border border-warm/60 p-10 text-center">
          <Users className="w-12 h-12 text-navy/20 mx-auto mb-3" />
          <p className="text-navy/60 mb-4">Belum ada siswa yang dapat potongan ini.</p>
          <button onClick={() => setShowPicker(true)}
                  className="px-4 py-2 gradient-warm text-white rounded-xl font-bold">
            Assign Siswa Pertama
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-warm/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-soft border-b border-warm/40 text-navy">
              <tr>
                <th className="text-left px-4 py-3 font-bold">NIS</th>
                <th className="text-left px-4 py-3 font-bold">Nama</th>
                <th className="text-left px-4 py-3 font-bold">Kelas</th>
                <th className="text-left px-4 py-3 font-bold">Catatan</th>
                <th className="text-right px-4 py-3 font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm/30">
              {members.map(m => (
                <tr key={m.id} className="hover:bg-amber-soft/20">
                  <td className="px-4 py-3 font-mono text-xs text-navy/70">{m.student?.nis || '-'}</td>
                  <td className="px-4 py-3 font-medium text-navy">{m.student?.nama || `Siswa #${m.student_id}`}</td>
                  <td className="px-4 py-3 text-navy/70">{m.student?.class?.name || '-'}</td>
                  <td className="px-4 py-3 text-xs text-navy/60">{m.catatan || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => unassign(m.id, m.student?.nama || 'siswa ini')}
                      className="p-2 hover:bg-rose/10 rounded-lg text-rose"
                      title="Lepas dari potongan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showPicker && (
        <StudentPicker
          potonganID={potongan.id}
          existingIDs={members.map(m => m.student_id)}
          onClose={() => setShowPicker(false)}
          onSaved={() => { setShowPicker(false); load() }}
        />
      )}
    </div>
  )
}

// ─── Student picker modal: pilih banyak siswa via checkbox ─────
function StudentPicker({ potonganID, existingIDs, onClose, onSaved }: {
  potonganID: number
  existingIDs: number[]
  onClose: () => void
  onSaved: () => void
}) {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [catatan, setCatatan] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      axios.get('/api/students/'),
      axios.get('/api/classes/'),
    ]).then(([rs, rc]) => {
      setStudents(rs.data || [])
      setClasses(rc.data || [])
    }).catch(e => toast.error(e.response?.data?.error || 'Gagal load'))
      .finally(() => setLoading(false))
  }, [])

  const existing = new Set(existingIDs)
  const filtered = students.filter(s => {
    if (existing.has(s.id)) return false
    if (filterClass && String(s.class_id) !== filterClass) return false
    if (search) {
      const q = search.toLowerCase()
      return s.nama.toLowerCase().includes(q) || (s.nis || '').toLowerCase().includes(q)
    }
    return true
  })

  const toggle = (id: number) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(s => s.id)))
  }

  const submit = async () => {
    if (selected.size === 0) {
      toast.error('Pilih minimal 1 siswa')
      return
    }
    setSaving(true)
    try {
      const r = await axios.post(`/api/billing/potongan/${potonganID}/students`, {
        student_ids: Array.from(selected),
        catatan: catatan,
      })
      toast.success(r.data.message || `${r.data.added || 0} siswa di-assign`)
      onSaved()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Gagal assign')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm flex items-end lg:items-center justify-center z-50 p-0 lg:p-4">
      <div className="bg-cream w-full max-w-2xl rounded-t-3xl lg:rounded-3xl shadow-card-lg max-h-[92vh] overflow-hidden flex flex-col">
        <div className="bg-white border-b border-warm/60 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-navy">Assign Siswa ke Potongan</h3>
            <div className="text-xs text-navy/60">{selected.size} dipilih dari {filtered.length} tersedia</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-cream-soft">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-warm/40 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy/40" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama atau NIS..."
                className="w-full pl-10 pr-3 py-2 border border-warm/60 rounded-xl text-sm bg-white"
              />
            </div>
            <select
              value={filterClass}
              onChange={e => setFilterClass(e.target.value)}
              className="px-3 py-2 border border-warm/60 rounded-xl text-sm bg-white"
            >
              <option value="">Semua Kelas</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <input
            type="text"
            value={catatan}
            onChange={e => setCatatan(e.target.value)}
            placeholder="Catatan (opsional, mis: SK Yatim no. 123)"
            className="w-full px-3 py-2 border border-warm/60 rounded-xl text-sm bg-white"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex items-center gap-2 text-navy/60 py-10 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-navy/40 text-sm">
              {students.length === existing.size
                ? 'Semua siswa sudah dapat potongan ini.'
                : 'Tidak ada siswa cocok.'}
            </div>
          ) : (
            <>
              <button
                onClick={toggleAll}
                className="text-xs text-amber-warm font-bold mb-2 hover:underline"
              >
                {selected.size === filtered.length ? 'Batalkan semua' : `Pilih semua (${filtered.length})`}
              </button>
              <div className="space-y-1">
                {filtered.map(s => (
                  <label
                    key={s.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-amber-soft/30 rounded-xl cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggle(s.id)}
                      className="w-4 h-4 accent-amber-warm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-navy text-sm truncate">{s.nama}</div>
                      <div className="text-xs text-navy/60">
                        {s.nis && <span className="font-mono mr-2">{s.nis}</span>}
                        {s.class?.name && <span>{s.class.name}</span>}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-white border-t border-warm/60 px-5 py-3 flex justify-end gap-2 safe-bottom">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl font-bold text-navy/70 hover:bg-cream-soft">Batal</button>
          <button
            onClick={submit}
            disabled={saving || selected.size === 0}
            className="px-5 py-2.5 gradient-warm text-white rounded-xl font-bold disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Assign {selected.size > 0 && `(${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}
