import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  Plus, Edit2, Trash2, Loader2, Wallet, X, Save,
} from 'lucide-react'
import { formatRupiah } from '../../lib/billing'

type Jenis = {
  id: number
  nama: string
  kode: string
  deskripsi: string
  nominal_default: number
  periode: string
  aktif: boolean
}

const PERIODE_OPTIONS = [
  { value: 'bulanan', label: 'Bulanan (SPP)' },
  { value: 'sekali', label: 'Sekali bayar (Seragam, Daftar Ulang)' },
  { value: 'tahunan', label: 'Tahunan (Iuran)' },
]

export default function JenisTagihanPage() {
  const [list, setList] = useState<Jenis[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Partial<Jenis> | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await axios.get('/api/billing/jenis')
      setList(r.data || [])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!edit?.nama) { toast.error('Nama wajib'); return }
    setSaving(true)
    try {
      const payload = {
        nama: edit.nama,
        kode: edit.kode || '',
        deskripsi: edit.deskripsi || '',
        nominal_default: edit.nominal_default || 0,
        periode: edit.periode || 'bulanan',
        aktif: edit.aktif ?? true,
      }
      if (edit.id) {
        await axios.put(`/api/billing/jenis/${edit.id}`, payload)
      } else {
        await axios.post('/api/billing/jenis', payload)
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
    if (!confirm('Hapus jenis tagihan ini? Tagihan yang sudah dibuat tetap ada.')) return
    try {
      await axios.delete(`/api/billing/jenis/${id}`)
      toast.success('Terhapus')
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Gagal hapus')
    }
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-soft flex items-center justify-center">
            <Wallet className="w-6 h-6 text-amber-warm" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-navy">Jenis Tagihan</h1>
            <p className="text-sm text-navy/60">Master data SPP, iuran, study tour, dll.</p>
          </div>
        </div>
        <button
          onClick={() => setEdit({ aktif: true, periode: 'bulanan' })}
          className="px-4 py-2.5 gradient-warm text-white rounded-xl font-bold hover:shadow-warm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Tambah
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-navy/60">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading...
        </div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-3xl border border-warm/60 p-10 text-center">
          <Wallet className="w-12 h-12 text-navy/20 mx-auto mb-3" />
          <p className="text-navy/60 mb-4">Belum ada jenis tagihan.</p>
          <button onClick={() => setEdit({ aktif: true, periode: 'bulanan' })}
                  className="px-4 py-2 gradient-warm text-white rounded-xl font-bold">
            Tambah Pertama
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-warm/60 shadow-card overflow-hidden">
          <table className="w-full hidden lg:table">
            <thead className="bg-amber-soft/40">
              <tr className="text-left text-xs font-extrabold text-navy/70 uppercase tracking-wide">
                <th className="px-5 py-3">Nama</th>
                <th className="px-5 py-3">Kode</th>
                <th className="px-5 py-3">Periode</th>
                <th className="px-5 py-3 text-right">Nominal Default</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm/30">
              {list.map(j => (
                <tr key={j.id} className="hover:bg-cream-soft">
                  <td className="px-5 py-3 font-bold text-navy">{j.nama}</td>
                  <td className="px-5 py-3 text-navy/70 font-mono text-xs">{j.kode || '-'}</td>
                  <td className="px-5 py-3 text-navy/70 capitalize">{j.periode}</td>
                  <td className="px-5 py-3 text-right font-bold text-navy">{formatRupiah(j.nominal_default)}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      j.aktif ? 'bg-mint/15 text-mint' : 'bg-navy/10 text-navy/50'
                    }`}>
                      {j.aktif ? 'AKTIF' : 'NONAKTIF'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => setEdit(j)} className="p-2 rounded-lg hover:bg-amber-soft text-amber-warm">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(j.id)} className="p-2 rounded-lg hover:bg-rose/10 text-rose">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile cards */}
          <div className="lg:hidden divide-y divide-warm/30">
            {list.map(j => (
              <div key={j.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-navy">{j.nama}</div>
                    <div className="text-xs text-navy/60 mt-0.5">
                      {j.kode && <span className="font-mono mr-2">{j.kode}</span>}
                      <span className="capitalize">{j.periode}</span>
                    </div>
                    <div className="text-sm font-bold text-amber-warm mt-1">{formatRupiah(j.nominal_default)}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => setEdit(j)} className="p-2 rounded-lg hover:bg-amber-soft text-amber-warm">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(j.id)} className="p-2 rounded-lg hover:bg-rose/10 text-rose">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {edit && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm flex items-end lg:items-center justify-center z-50 p-0 lg:p-4">
          <div className="bg-cream w-full max-w-lg rounded-t-3xl lg:rounded-3xl shadow-card-lg max-h-[92vh] overflow-hidden flex flex-col">
            <div className="bg-white border-b border-warm/60 px-5 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-navy">{edit.id ? 'Edit Jenis Tagihan' : 'Tambah Jenis Tagihan'}</h3>
              <button onClick={() => setEdit(null)} className="p-1.5 rounded-lg hover:bg-cream-soft">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto">
              <div>
                <label className="text-sm font-bold text-navy mb-1 block">Nama *</label>
                <input
                  value={edit.nama || ''}
                  onChange={e => setEdit({ ...edit, nama: e.target.value })}
                  placeholder="contoh: SPP, Seragam, Study Tour"
                  className="w-full px-4 py-3 rounded-xl border border-warm/60 bg-white focus:outline-none focus:border-amber-warm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-bold text-navy mb-1 block">Kode</label>
                  <input
                    value={edit.kode || ''}
                    onChange={e => setEdit({ ...edit, kode: e.target.value.toUpperCase() })}
                    placeholder="SPP"
                    maxLength={10}
                    className="w-full px-4 py-3 rounded-xl border border-warm/60 bg-white focus:outline-none focus:border-amber-warm font-mono"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-navy mb-1 block">Periode</label>
                  <select
                    value={edit.periode || 'bulanan'}
                    onChange={e => setEdit({ ...edit, periode: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-warm/60 bg-white focus:outline-none focus:border-amber-warm"
                  >
                    {PERIODE_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-navy mb-1 block">Nominal Default</label>
                <input
                  type="number"
                  value={edit.nominal_default || ''}
                  onChange={e => setEdit({ ...edit, nominal_default: parseFloat(e.target.value) || 0 })}
                  placeholder="350000"
                  className="w-full px-4 py-3 rounded-xl border border-warm/60 bg-white focus:outline-none focus:border-amber-warm"
                />
                <p className="text-xs text-navy/60 mt-1">Bisa di-override saat generate tagihan.</p>
              </div>
              <div>
                <label className="text-sm font-bold text-navy mb-1 block">Deskripsi</label>
                <textarea
                  value={edit.deskripsi || ''}
                  onChange={e => setEdit({ ...edit, deskripsi: e.target.value })}
                  rows={2}
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
