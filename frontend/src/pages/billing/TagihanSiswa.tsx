import { useEffect, useState } from 'react'
import axios from 'axios'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Loader2, Receipt, AlertCircle } from 'lucide-react'
import { formatRupiah, statusBadge, formatTanggal } from '../../lib/billing'

export default function TagihanSiswa() {
  const { id } = useParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get(`/api/billing/siswa/${id}`).then(r => setData(r.data)).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-6 flex items-center gap-2 text-navy/60"><Loader2 className="w-5 h-5 animate-spin" /> Loading...</div>
  if (!data) return null

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <Link to="/billing/tagihan" className="flex items-center gap-2 text-navy/60 hover:text-navy mb-4 text-sm">
        <ArrowLeft className="w-4 h-4" /> Kembali
      </Link>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Tagihan', val: data.total_tagihan, color: 'text-navy', bg: 'bg-amber-soft' },
          { label: 'Keringanan', val: data.total_keringanan, color: 'text-mint', bg: 'bg-mint/10' },
          { label: 'Terbayar', val: data.total_terbayar, color: 'text-mint', bg: 'bg-mint/15' },
          { label: 'Tunggakan', val: data.total_tunggakan, color: 'text-rose', bg: 'bg-rose/10' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4`}>
            <div className="text-xs font-bold text-navy/60 uppercase">{s.label}</div>
            <div className={`text-lg lg:text-xl font-extrabold mt-1 ${s.color}`}>{formatRupiah(s.val)}</div>
          </div>
        ))}
      </div>

      <h2 className="font-extrabold text-navy mb-3 flex items-center gap-2">
        <Receipt className="w-5 h-5 text-amber-warm" /> Riwayat Tagihan ({data.data?.length || 0})
      </h2>

      {(!data.data || data.data.length === 0) ? (
        <div className="bg-white rounded-3xl border border-warm/60 p-10 text-center">
          <AlertCircle className="w-12 h-12 text-navy/20 mx-auto mb-3" />
          <p className="text-navy/60">Belum ada tagihan untuk siswa ini.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.data.map((t: any) => {
            const total = t.nominal - t.keringanan
            const sisa = total - t.terbayar
            const badge = statusBadge(t.status)
            return (
              <div key={t.id} className="bg-white rounded-2xl border border-warm/60 p-4 lg:p-5 shadow-card">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="font-extrabold text-navy">{t.jenis_tagihan?.nama} • {t.periode}</div>
                    {t.jatuh_tempo && <div className="text-xs text-navy/60 mt-0.5">Jatuh tempo: {formatTanggal(t.jatuh_tempo)}</div>}
                    {t.keringanan_note && <div className="text-xs text-mint mt-1">Keringanan: {t.keringanan_note} (-{formatRupiah(t.keringanan)})</div>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${badge.cls}`}>{badge.label}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs border-t border-warm/30 pt-3">
                  <div>
                    <div className="text-navy/50 uppercase font-bold">Total</div>
                    <div className="font-bold text-navy">{formatRupiah(total)}</div>
                  </div>
                  <div>
                    <div className="text-navy/50 uppercase font-bold">Terbayar</div>
                    <div className="font-bold text-mint">{formatRupiah(t.terbayar)}</div>
                  </div>
                  <div>
                    <div className="text-navy/50 uppercase font-bold">Sisa</div>
                    <div className={`font-extrabold ${sisa > 0 ? 'text-rose' : 'text-mint'}`}>{sisa > 0 ? formatRupiah(sisa) : 'Lunas'}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
