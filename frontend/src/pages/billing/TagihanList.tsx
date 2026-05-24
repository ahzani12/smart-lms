import { useEffect, useState } from 'react'
import axios from 'axios'
import { useSearchParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Receipt, Filter, Loader2, X, Save, Eye, Wallet,
  CreditCard, AlertCircle, RefreshCw,
} from 'lucide-react'
import { formatRupiah, statusBadge, formatTanggal } from '../../lib/billing'

type Tagihan = {
  id: number
  student_id: number
  periode: string
  nominal: number
  keringanan: number
  keringanan_note: string
  terbayar: number
  jatuh_tempo: string
  status: string
  student?: { id: number; user?: { name: string }; nis?: string; class?: { name: string } }
  jenis_tagihan?: { nama: string; kode: string }
}

export default function TagihanList() {
  const [params, setParams] = useSearchParams()
  const [list, setList] = useState<Tagihan[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<any[]>([])
  const [jenisList, setJenisList] = useState<any[]>([])

  const status = params.get('status') || ''
  const classId = params.get('class_id') || ''
  const periode = params.get('periode') || ''
  const jenisId = params.get('jenis_tagihan_id') || ''

  const [bayarFor, setBayarFor] = useState<Tagihan | null>(null)
  const [bayarForm, setBayarForm] = useState({
    nominal_bayar: 0,
    metode: 'cash',
    tanggal_bayar: new Date().toISOString().slice(0, 10),
    catatan: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await axios.get('/api/billing/tagihan', {
        params: { status, class_id: classId, periode, jenis_tagihan_id: jenisId, limit: 200 },
      })
      setList(r.data.data || [])
      setTotal(r.data.total || 0)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [status, classId, periode, jenisId])

  useEffect(() => {
    axios.get('/api/classes/').then(r => setClasses(r.data || []))
    axios.get('/api/billing/jenis').then(r => setJenisList(r.data || []))
  }, [])

  const setFilter = (key: string, val: string) => {
    const p = new URLSearchParams(params)
    if (val) p.set(key, val); else p.delete(key)
    setParams(p)
  }

  const openBayar = (t: Tagihan) => {
    const sisa = t.nominal - t.keringanan - t.terbayar
    setBayarForm({
      nominal_bayar: sisa > 0 ? sisa : 0,
      metode: 'cash',
      tanggal_bayar: new Date().toISOString().slice(0, 10),
      catatan: '',
    })
    setBayarFor(t)
  }

  const submitBayar = async () => {
    if (!bayarFor) return
    if (bayarForm.nominal_bayar <= 0) { toast.error('Nominal bayar harus > 0'); return }
    setSubmitting(true)
    try {
      const r = await axios.post('/api/billing/bayar', {
        tagihan_id: bayarFor.id,
        ...bayarForm,
      })
      toast.success('Pembayaran tercatat')
      const pbId = r.data.pembayaran?.id || r.data.id
      setBayarFor(null)
      load()
      // Auto-open kuitansi di tab baru
      if (pbId) {
        const tok = localStorage.getItem('token')
        // backend butuh auth header — pakai window.open dengan token via URL? aman lewat axios → buka HTML lewat fetch+blob
        const resp = await fetch(`/api/billing/pembayaran/${pbId}/kuitansi`, {
          headers: { Authorization: `Bearer ${tok}` },
        })
        const html = await resp.text()
        const w = window.open('', '_blank')
        if (w) { w.document.write(html); w.document.close() }
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Gagal simpan pembayaran')
    } finally {
      setSubmitting(false)
    }
  }

  const cancel = async (t: Tagihan) => {
    if (!confirm(`Batalkan tagihan ${t.jenis_tagihan?.nama} ${t.periode} untuk ${t.student?.user?.name}?`)) return
    try {
      await axios.delete(`/api/billing/tagihan/${t.id}`)
      toast.success('Tagihan dibatalkan')
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Gagal batalkan')
    }
  }

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-12 h-12 rounded-2xl bg-amber-soft flex items-center justify-center">
          <Receipt className="w-6 h-6 text-amber-warm" strokeWidth={2.2} />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold text-navy">Daftar Tagihan</h1>
          <p className="text-sm text-navy/60">{total} tagihan</p>
        </div>
        <Link to="/billing/generate" className="px-4 py-2.5 gradient-warm text-white rounded-xl font-bold flex items-center gap-2 hover:shadow-warm">
          <Wallet className="w-4 h-4" /> Generate
        </Link>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-2xl border border-warm/60 p-3 lg:p-4 mb-4 flex flex-wrap gap-2 items-center">
        <Filter className="w-4 h-4 text-navy/60 ml-1" />
        <select value={status} onChange={e => setFilter('status', e.target.value)}
          className="px-3 py-2 rounded-lg border border-warm/60 bg-cream-soft text-sm">
          <option value="">Semua status</option>
          <option value="lunas">Lunas</option>
          <option value="sebagian">Cicilan</option>
          <option value="belum_bayar">Belum Bayar</option>
          <option value="batal">Batal</option>
        </select>
        <select value={classId} onChange={e => setFilter('class_id', e.target.value)}
          className="px-3 py-2 rounded-lg border border-warm/60 bg-cream-soft text-sm">
          <option value="">Semua kelas</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={jenisId} onChange={e => setFilter('jenis_tagihan_id', e.target.value)}
          className="px-3 py-2 rounded-lg border border-warm/60 bg-cream-soft text-sm">
          <option value="">Semua jenis</option>
          {jenisList.map(j => <option key={j.id} value={j.id}>{j.nama}</option>)}
        </select>
        <input value={periode} onChange={e => setFilter('periode', e.target.value)}
          placeholder="Periode YYYY-MM"
          className="px-3 py-2 rounded-lg border border-warm/60 bg-cream-soft text-sm w-32" />
        <button onClick={load} className="px-3 py-2 bg-white border border-warm/60 rounded-lg hover:bg-amber-soft text-navy/70">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-navy/60 py-8">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading...
        </div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-3xl border border-warm/60 p-10 text-center">
          <AlertCircle className="w-12 h-12 text-navy/20 mx-auto mb-3" />
          <p className="text-navy/60">Tidak ada tagihan dengan filter ini.</p>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="bg-white rounded-3xl border border-warm/60 shadow-card overflow-hidden hidden lg:block">
            <table className="w-full">
              <thead className="bg-amber-soft/40">
                <tr className="text-left text-xs font-extrabold text-navy/70 uppercase tracking-wide">
                  <th className="px-5 py-3">Siswa</th>
                  <th className="px-5 py-3">Tagihan</th>
                  <th className="px-5 py-3">Periode</th>
                  <th className="px-5 py-3 text-right">Nominal</th>
                  <th className="px-5 py-3 text-right">Sisa</th>
                  <th className="px-5 py-3">Jatuh Tempo</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm/30">
                {list.map(t => {
                  const total = t.nominal - t.keringanan
                  const sisa = total - t.terbayar
                  const badge = statusBadge(t.status)
                  return (
                    <tr key={t.id} className="hover:bg-cream-soft">
                      <td className="px-5 py-3">
                        <div className="font-bold text-navy">{t.student?.user?.name || '-'}</div>
                        <div className="text-xs text-navy/60">
                          {t.student?.class?.name || '-'} {t.student?.nis ? `• ${t.student.nis}` : ''}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-navy">{t.jenis_tagihan?.nama || '-'}</td>
                      <td className="px-5 py-3 text-navy/70 font-mono text-xs">{t.periode}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="font-bold text-navy">{formatRupiah(total)}</div>
                        {t.keringanan > 0 && <div className="text-[10px] text-mint">-{formatRupiah(t.keringanan)}</div>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className={`font-extrabold ${sisa > 0 ? 'text-rose' : 'text-mint'}`}>
                          {sisa > 0 ? formatRupiah(sisa) : 'Lunas'}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-navy/70">{formatTanggal(t.jatuh_tempo)}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {t.status !== 'lunas' && t.status !== 'batal' && (
                          <button onClick={() => openBayar(t)} title="Bayar"
                            className="p-2 rounded-lg hover:bg-amber-soft text-amber-warm">
                            <CreditCard className="w-4 h-4" />
                          </button>
                        )}
                        <Link to={`/billing/siswa/${t.student_id}`} title="Detail siswa"
                          className="inline-block p-2 rounded-lg hover:bg-amber-soft text-navy/60">
                          <Eye className="w-4 h-4" />
                        </Link>
                        {t.status !== 'lunas' && t.status !== 'batal' && (
                          <button onClick={() => cancel(t)} title="Batalkan"
                            className="p-2 rounded-lg hover:bg-rose/10 text-rose">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-2">
            {list.map(t => {
              const total = t.nominal - t.keringanan
              const sisa = total - t.terbayar
              const badge = statusBadge(t.status)
              return (
                <div key={t.id} className="bg-white rounded-2xl border border-warm/60 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="font-bold text-navy">{t.student?.user?.name}</div>
                      <div className="text-xs text-navy/60">{t.student?.class?.name} {t.student?.nis && `• ${t.student.nis}`}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs border-t border-warm/30 pt-2">
                    <div>
                      <div className="text-navy/50 uppercase font-bold">Tagihan</div>
                      <div className="font-bold text-navy">{t.jenis_tagihan?.nama} {t.periode}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-navy/50 uppercase font-bold">Sisa</div>
                      <div className={`font-extrabold ${sisa > 0 ? 'text-rose' : 'text-mint'}`}>
                        {sisa > 0 ? formatRupiah(sisa) : 'Lunas'}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-warm/30">
                    {t.status !== 'lunas' && t.status !== 'batal' && (
                      <button onClick={() => openBayar(t)}
                        className="flex-1 px-3 py-2 gradient-warm text-white rounded-lg font-bold text-sm flex items-center justify-center gap-1">
                        <CreditCard className="w-4 h-4" /> Bayar
                      </button>
                    )}
                    <Link to={`/billing/siswa/${t.student_id}`}
                      className="px-4 py-2 bg-cream-soft border border-warm/60 rounded-lg font-bold text-sm text-navy/70 flex items-center gap-1">
                      <Eye className="w-4 h-4" /> Detail
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Bayar modal */}
      {bayarFor && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm flex items-end lg:items-center justify-center z-50 p-0 lg:p-4">
          <div className="bg-cream w-full max-w-lg rounded-t-3xl lg:rounded-3xl shadow-card-lg max-h-[92vh] overflow-hidden flex flex-col">
            <div className="bg-white border-b border-warm/60 px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-navy">Catat Pembayaran</h3>
                <p className="text-xs text-navy/60">{bayarFor.student?.user?.name} • {bayarFor.jenis_tagihan?.nama} {bayarFor.periode}</p>
              </div>
              <button onClick={() => setBayarFor(null)} className="p-1.5 rounded-lg hover:bg-cream-soft">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto">
              <div className="bg-amber-soft/40 rounded-2xl p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-navy/70">Total tagihan</span>
                  <span className="font-bold text-navy">{formatRupiah(bayarFor.nominal - bayarFor.keringanan)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-navy/70">Sudah dibayar</span>
                  <span className="font-bold text-mint">{formatRupiah(bayarFor.terbayar)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1 pt-2 border-t border-amber-warm/30">
                  <span className="font-bold text-navy">Sisa</span>
                  <span className="font-extrabold text-rose">{formatRupiah(bayarFor.nominal - bayarFor.keringanan - bayarFor.terbayar)}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-navy mb-1 block">Nominal Bayar</label>
                <input type="number" value={bayarForm.nominal_bayar || ''}
                  onChange={e => setBayarForm({ ...bayarForm, nominal_bayar: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-3 rounded-xl border border-warm/60 bg-white focus:outline-none focus:border-amber-warm text-lg font-bold" />
                <p className="text-xs text-navy/60 mt-1">{formatRupiah(bayarForm.nominal_bayar)}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-bold text-navy mb-1 block">Metode</label>
                  <select value={bayarForm.metode} onChange={e => setBayarForm({ ...bayarForm, metode: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-warm/60 bg-white focus:outline-none focus:border-amber-warm">
                    <option value="cash">Cash</option>
                    <option value="transfer">Transfer</option>
                    <option value="qris">QRIS</option>
                    <option value="va">Virtual Account</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-bold text-navy mb-1 block">Tanggal</label>
                  <input type="date" value={bayarForm.tanggal_bayar}
                    onChange={e => setBayarForm({ ...bayarForm, tanggal_bayar: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-warm/60 bg-white focus:outline-none focus:border-amber-warm" />
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-navy mb-1 block">Catatan</label>
                <textarea value={bayarForm.catatan} rows={2}
                  onChange={e => setBayarForm({ ...bayarForm, catatan: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-warm/60 bg-white focus:outline-none focus:border-amber-warm" />
              </div>
            </div>
            <div className="bg-white border-t border-warm/60 px-5 py-3 flex justify-end gap-2 safe-bottom">
              <button onClick={() => setBayarFor(null)} className="px-4 py-2.5 rounded-xl font-bold text-navy/70 hover:bg-cream-soft">Batal</button>
              <button onClick={submitBayar} disabled={submitting}
                className="px-5 py-2.5 gradient-warm text-white rounded-xl font-bold disabled:opacity-50 flex items-center gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Simpan & Cetak Kuitansi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
