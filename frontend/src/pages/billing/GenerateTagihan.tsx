import { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Sparkles, ArrowLeft, Loader2, Send, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { formatRupiah, periodeOptions } from '../../lib/billing'

export default function GenerateTagihan() {
  const nav = useNavigate()
  const [jenisList, setJenisList] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [studentCount, setStudentCount] = useState(0)

  const [jenisId, setJenisId] = useState<number | ''>('')
  const [classId, setClassId] = useState<number | ''>('')
  const [periode, setPeriode] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [nominal, setNominal] = useState<number>(0)
  const [jatuhTempo, setJatuhTempo] = useState(() => {
    const d = new Date()
    d.setDate(10)
    return d.toISOString().slice(0, 10)
  })
  const [skipExisting, setSkipExisting] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    axios.get('/api/billing/jenis?aktif=true').then(r => setJenisList(r.data || []))
    axios.get('/api/classes/').then(r => setClasses(r.data || []))
  }, [])

  useEffect(() => {
    const url = classId ? `/api/students/?class_id=${classId}` : '/api/students/'
    axios.get(url).then(r => setStudentCount((r.data || []).length))
  }, [classId])

  const onPickJenis = (id: number) => {
    setJenisId(id)
    const j = jenisList.find(x => x.id === id)
    if (j && nominal === 0) setNominal(j.nominal_default || 0)
  }

  const submit = async () => {
    if (!jenisId) { toast.error('Pilih jenis tagihan'); return }
    if (!periode) { toast.error('Pilih periode'); return }
    if (!nominal || nominal <= 0) { toast.error('Nominal harus diisi'); return }
    setSubmitting(true)
    try {
      const r = await axios.post('/api/billing/generate', {
        jenis_tagihan_id: jenisId,
        class_id: classId || null,
        periode,
        nominal,
        jatuh_tempo: jatuhTempo,
        skip_existing: skipExisting,
      })
      toast.success(`Berhasil: ${r.data.created} dibuat, ${r.data.skipped || 0} dilewati`, { duration: 4000 })
      nav(`/billing/tagihan?periode=${periode}`)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Gagal generate')
    } finally {
      setSubmitting(false)
    }
  }

  const j = jenisList.find(x => x.id === jenisId)
  const cls = classes.find(x => x.id === classId)
  const totalTagihan = nominal * studentCount

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <button onClick={() => nav(-1)} className="flex items-center gap-2 text-navy/60 hover:text-navy mb-4 text-sm">
        <ArrowLeft className="w-4 h-4" /> Kembali
      </button>

      <div className="flex items-center gap-3 mb-5">
        <div className="w-12 h-12 rounded-2xl bg-amber-soft flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-amber-warm" strokeWidth={2.2} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-navy">Generate Tagihan</h1>
          <p className="text-sm text-navy/60">Bulk-buat tagihan untuk banyak siswa sekaligus.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-warm/60 shadow-card p-5 lg:p-6 space-y-5">
        {/* Jenis tagihan */}
        <div>
          <label className="text-sm font-bold text-navy mb-2 block">1. Pilih Jenis Tagihan</label>
          {jenisList.length === 0 ? (
            <div className="p-4 bg-amber-soft/40 rounded-xl text-sm text-navy/70 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-warm shrink-0 mt-0.5" />
              <div>
                Belum ada jenis tagihan. <button onClick={() => nav('/billing/jenis')} className="font-bold text-amber-warm underline">Buat dulu di sini</button>.
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {jenisList.map(jt => (
                <button key={jt.id} onClick={() => onPickJenis(jt.id)}
                  className={`text-left p-3 rounded-xl border-2 transition ${
                    jenisId === jt.id
                      ? 'border-amber-warm bg-amber-soft/50 shadow-warm-sm'
                      : 'border-warm/60 hover:border-amber-warm/50'
                  }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-navy">{jt.nama}</span>
                    {jenisId === jt.id && <CheckCircle2 className="w-4 h-4 text-amber-warm" />}
                  </div>
                  <div className="text-xs text-navy/60">
                    Default: {formatRupiah(jt.nominal_default)} • <span className="capitalize">{jt.periode}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Scope */}
        <div>
          <label className="text-sm font-bold text-navy mb-2 block">2. Target Siswa</label>
          <select value={classId} onChange={e => setClassId(e.target.value ? parseInt(e.target.value) : '')}
            className="w-full px-4 py-3 rounded-xl border border-warm/60 bg-cream-soft focus:outline-none focus:border-amber-warm">
            <option value="">Semua siswa di sekolah ({studentCount})</option>
            {classes.map(c => <option key={c.id} value={c.id}>Kelas {c.name}</option>)}
          </select>
        </div>

        {/* Periode + Nominal + Jatuh tempo */}
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-bold text-navy mb-1 block">3. Periode</label>
            <select value={periode} onChange={e => setPeriode(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-warm/60 bg-cream-soft focus:outline-none focus:border-amber-warm">
              {periodeOptions().map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <p className="text-xs text-navy/50 mt-1">Format YYYY-MM</p>
          </div>
          <div>
            <label className="text-sm font-bold text-navy mb-1 block">4. Nominal</label>
            <input type="number" value={nominal || ''} onChange={e => setNominal(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-3 rounded-xl border border-warm/60 bg-cream-soft focus:outline-none focus:border-amber-warm" />
            <p className="text-xs text-navy/50 mt-1">{formatRupiah(nominal)}</p>
          </div>
          <div>
            <label className="text-sm font-bold text-navy mb-1 block">5. Jatuh Tempo</label>
            <input type="date" value={jatuhTempo} onChange={e => setJatuhTempo(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-warm/60 bg-cream-soft focus:outline-none focus:border-amber-warm" />
          </div>
        </div>

        {/* Skip existing */}
        <label className="flex items-start gap-3 p-3 rounded-xl bg-cream-soft cursor-pointer">
          <input type="checkbox" checked={skipExisting} onChange={e => setSkipExisting(e.target.checked)}
            className="w-4 h-4 mt-0.5 accent-amber-warm" />
          <div>
            <div className="font-bold text-navy text-sm">Lewati siswa yang sudah punya tagihan ini</div>
            <div className="text-xs text-navy/60">Aman untuk re-run tiap bulan tanpa risiko duplikat.</div>
          </div>
        </label>

        {/* Preview */}
        {jenisId && nominal > 0 && (
          <div className="bg-amber-soft/40 rounded-2xl p-4 border border-amber-warm/30">
            <div className="text-xs font-extrabold text-amber-warm uppercase tracking-wide mb-2">Preview</div>
            <div className="space-y-1 text-sm">
              <div>Jenis: <span className="font-bold text-navy">{j?.nama}</span></div>
              <div>Target: <span className="font-bold text-navy">{cls ? `Kelas ${cls.name}` : 'Semua siswa'} ({studentCount} siswa)</span></div>
              <div>Periode: <span className="font-bold text-navy">{periode}</span></div>
              <div>Nominal/siswa: <span className="font-bold text-navy">{formatRupiah(nominal)}</span></div>
              <div className="pt-2 border-t border-amber-warm/30 mt-2 flex justify-between">
                <span className="font-bold text-navy">Total tagihan dibuat:</span>
                <span className="font-extrabold text-amber-warm text-lg">{formatRupiah(totalTagihan)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Action */}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={() => nav(-1)} className="px-5 py-3 rounded-xl font-bold text-navy/70 hover:bg-cream-soft">
            Batal
          </button>
          <button onClick={submit} disabled={submitting || !jenisId || !nominal}
            className="px-6 py-3 gradient-warm text-white rounded-xl font-extrabold disabled:opacity-50 flex items-center gap-2 shadow-warm-sm">
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            Generate {studentCount} Tagihan
          </button>
        </div>
      </div>
    </div>
  )
}
